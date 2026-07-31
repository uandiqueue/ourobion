"""Fail-closed acquisition of a frozen model release into a disposable directory.

Stdlib only.

This module is the single gate between the network and any Torch/Transformers
load. Its contract is narrow on purpose: it either returns a directory whose
every byte matched the authenticated manifest, or it raises. There is no
partial-success return value, no "verified: false" flag for a caller to ignore,
and no fallback path — not to Hugging Face Hub, not to a local cache, not to
another release, not to randomly initialised weights. Each of those would turn
"the private release could not be verified" into a run that still produces
numbers, and numbers from an unidentified checkpoint are worse than no numbers.

Ordering matters and is deliberate: the remote listing is checked for exact set
equality *before* anything is downloaded, every downloaded file is hashed
*before* `transformers` is imported anywhere, and the temp directory is removed
in a `finally` so a mid-run failure cannot leave weights on disk.
"""

from __future__ import annotations

import shutil
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from ..data_guard import unsafe_relative_path_reason
from ..errors import HashMismatchError, ModelLabError
from ..manifests import sha256_file
from .r2 import ReadOnlyR2Client
from .releases import EXPECTED_BUNDLE_FILENAMES, ResolvedRelease


class ArtifactAcquisitionError(ModelLabError):
    """The remote release does not match its pinned description."""


@dataclass(frozen=True)
class AcquiredModel:
    """A verified, local, disposable copy of one release."""

    release: ResolvedRelease
    directory: Path
    total_bytes: int
    verified_files: tuple[str, ...]


def _assert_listing_matches(release: ResolvedRelease, keys: list[str]) -> None:
    """Require the remote prefix to contain exactly the six expected objects."""
    prefix = release.object_prefix
    relative: list[str] = []
    for key in keys:
        if not key.startswith(prefix):
            raise ArtifactAcquisitionError(
                f"object {key!r} is outside the pinned prefix {prefix!r}; refusing to proceed"
            )
        rel = key[len(prefix) :]
        if not rel:
            # A zero-length "directory marker" object; not a bundle file.
            continue
        relative.append(rel)

    unsafe = [r for r in relative if unsafe_relative_path_reason(r) is not None]
    if unsafe:
        raise ArtifactAcquisitionError(
            f"remote listing contains unsafe object name(s) {sorted(unsafe)}; a key that "
            "normalises outside the download directory is refused"
        )
    nested = [r for r in relative if "/" in r]
    if nested:
        raise ArtifactAcquisitionError(
            f"remote listing contains nested object(s) {sorted(nested)}; a release bundle is "
            "flat, so a subdirectory means this is not the release that was pinned"
        )

    found = set(relative)
    expected = set(EXPECTED_BUNDLE_FILENAMES)
    missing = sorted(expected - found)
    extra = sorted(found - expected)
    if missing or extra:
        raise ArtifactAcquisitionError(
            f"remote release {release.release_id} does not match its pinned file set — "
            f"missing={missing} extra={extra}. Expected exactly "
            f"{list(EXPECTED_BUNDLE_FILENAMES)}."
        )
    if len(relative) != len(found):
        raise ArtifactAcquisitionError(
            "remote listing returned a duplicate object name; refusing an ambiguous release"
        )


@contextmanager
def acquire_release(
    release: ResolvedRelease,
    client: ReadOnlyR2Client,
    *,
    parent_dir: Path | None = None,
) -> Iterator[AcquiredModel]:
    """Download and fully verify a release into a temp dir; always clean it up.

    Yields an `AcquiredModel` whose directory is safe to hand to a loader. The
    directory and everything in it is removed when the context exits, on both
    the success and failure paths.
    """
    keys = client.list_prefix(release.object_prefix)
    if not keys:
        raise ArtifactAcquisitionError(
            f"no objects found under {release.object_prefix!r}. Either the credential is not "
            "scoped to this bucket, or the release id is wrong; failing closed rather than "
            "falling back to any other source."
        )
    _assert_listing_matches(release, keys)

    temp_root = Path(tempfile.mkdtemp(prefix=f"ourobion-{release.model}-", dir=parent_dir))
    try:
        model_dir = temp_root / "model"
        model_dir.mkdir(parents=True, exist_ok=False)

        total_bytes = 0
        for filename in EXPECTED_BUNDLE_FILENAMES:
            dest = model_dir / filename
            # Defence in depth: the listing check above already proved the name is
            # flat and safe, but the destination is re-checked against the download
            # root so a future refactor cannot reintroduce a traversal.
            resolved = dest.resolve()
            if resolved.parent != model_dir.resolve():
                raise ArtifactAcquisitionError(
                    f"destination for {filename!r} escapes the download directory"
                )
            written = client.download(release.object_prefix + filename, dest)
            total_bytes += written

            if dest.is_symlink():
                raise ArtifactAcquisitionError(
                    f"{filename!r} materialised as a symlink; refusing to hash or load it"
                )

            expected_digest = release.digests[filename]
            actual_digest = sha256_file(dest)
            if actual_digest != expected_digest:
                raise HashMismatchError(
                    f"{filename!r} from release {release.release_id} failed verification: "
                    f"expected {expected_digest}, got {actual_digest}. No model is loaded."
                )

        weights_path = model_dir / release.pin.weights_filename
        actual_weights_size = weights_path.stat().st_size
        if actual_weights_size != release.pin.weights_size_bytes:
            raise ArtifactAcquisitionError(
                f"weights file is {actual_weights_size} bytes, expected "
                f"{release.pin.weights_size_bytes}"
            )
        if total_bytes != release.pin.bundle_size_bytes:
            raise ArtifactAcquisitionError(
                f"bundle totals {total_bytes} bytes, expected {release.pin.bundle_size_bytes}"
            )

        yield AcquiredModel(
            release=release,
            directory=model_dir,
            total_bytes=total_bytes,
            verified_files=EXPECTED_BUNDLE_FILENAMES,
        )
    finally:
        # Weights must not survive the run, on any exit path.
        shutil.rmtree(temp_root, ignore_errors=True)
