"""The pinned registry of frozen model releases that may be loaded for inference.

Stdlib only.

## Why the expected digests are not written out in this file

The obvious shape for "pin the six filenames and their SHA-256 hashes in
reviewable configuration" is a literal dict of sixty-four-character strings per
model. That shape has a quiet failure mode: the digests would exist in two
places (here and `evidence/<model>/local-bundle-sha256sums.txt`), and nothing
would notice if they drifted apart. Whichever copy a reader trusted, the other
could be wrong.

So the pin is one level up. Each release is identified by
`sha256(local-bundle-sha256sums.txt)` — the digest of the checksum manifest
itself, which is exactly how the private R2 prefixes were named during the
#250 transfer. `load_release()` re-derives that digest from the tracked
manifest file and refuses to continue unless it equals the pinned
`release_id`. The per-file digests are then *read* from the manifest it just
authenticated.

The result is that this file pins one digest per model instead of six, and the
six cannot be tampered with independently: editing any line of the checksum
manifest changes its SHA-256, which no longer matches the pinned release id,
which is a hard stop before a single byte is downloaded.

## What is deliberately not pinned

Per-file byte sizes. The #250 evidence records the total bundle size and the
weights file's size, and those are pinned below; individual sizes for the other
five files were never measured and are not invented here. This costs nothing in
strength — a SHA-256 check subsumes a length check — and a size pin would only
have been an early-exit optimisation on a download that must be hashed anyway.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..errors import ConfigError, HashMismatchError
from ..manifests import sha256_file

# The private bucket from #250. Read-only, bucket-scoped credentials only; this
# module never names a corpus bucket and never writes.
MODEL_ARTIFACT_BUCKET = "ourobion-model-artifacts"

# Every release bundle is exactly these six Hugging Face files. An object listing
# containing anything else — extra file, missing file, renamed file — is a stop.
EXPECTED_BUNDLE_FILENAMES: tuple[str, ...] = (
    "config.json",
    "pytorch_model.bin",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.txt",
)


@dataclass(frozen=True)
class ReleasePin:
    """Reviewable, frozen configuration for one model release."""

    model: str
    version: str
    release_id: str
    """`sha256-<hex>`; the hex half is the SHA-256 of the checksum manifest."""
    evidence_dirname: str
    weights_filename: str
    weights_size_bytes: int
    bundle_size_bytes: int

    @property
    def manifest_digest(self) -> str:
        return self.release_id.split("sha256-", 1)[-1]

    @property
    def object_prefix(self) -> str:
        return f"models/{self.model}/releases/{self.release_id}/model/"


# --------------------------------------------------------------------------
# The registry. Adding an entry here is the only way to make a release
# loadable; there is no "any prefix the caller passes" path on purpose.
# --------------------------------------------------------------------------
RELEASE_PINS: dict[str, ReleasePin] = {
    "zebra-v1": ReleasePin(
        model="zebra-v1",
        version="v1",
        release_id=("sha256-e1d09fbdf442303bf9c5c3aefbe201a0e8509674d5401eacad84321443589169"),
        evidence_dirname="zebra-v1",
        weights_filename="pytorch_model.bin",
        weights_size_bytes=438004206,
        bundle_size_bytes=438938903,
    ),
    "viceroy-v0": ReleasePin(
        model="viceroy-v0",
        version="v0",
        release_id=("sha256-751fbf1fb1a680b39b50c91f7dd4d7a0caba404417effde724564615d9849ec2"),
        evidence_dirname="viceroy-v0",
        weights_filename="pytorch_model.bin",
        weights_size_bytes=438007278,
        bundle_size_bytes=438942033,
    ),
}


@dataclass(frozen=True)
class ResolvedRelease:
    """A release pin whose checksum manifest has been authenticated and parsed."""

    pin: ReleasePin
    digests: dict[str, str]
    """filename -> expected lowercase hex SHA-256, read from the authenticated manifest."""

    @property
    def model(self) -> str:
        return self.pin.model

    @property
    def release_id(self) -> str:
        return self.pin.release_id

    @property
    def object_prefix(self) -> str:
        return self.pin.object_prefix

    def identity(self) -> dict[str, object]:
        """The model-identity block stamped onto every prediction row."""
        return {
            "model": self.pin.model,
            "version": self.pin.version,
            "release_id": self.pin.release_id,
            "bucket": MODEL_ARTIFACT_BUCKET,
            "object_prefix": self.pin.object_prefix,
        }


def registered_releases() -> tuple[str, ...]:
    return tuple(sorted(RELEASE_PINS))


def evidence_root() -> Path:
    """`model-training/evidence/`, derived from this file's location."""
    # .../model-training/src/ourobion_model_lab/inference/releases.py
    #                    ^-- parents[3] is model-training/
    return Path(__file__).resolve().parents[3] / "evidence"


def parse_checksum_manifest(text: str) -> dict[str, str]:
    """Parse `sha256sum` output into {filename: digest}.

    Accepts the standard two-space form (`<hex>  <name>`) and the single-space
    form some tools emit. A `*` binary marker on the filename is stripped.
    """
    digests: dict[str, str] = {}
    for lineno, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            raise ConfigError(
                f"checksum manifest line {lineno} is not '<sha256>  <filename>': {line!r}"
            )
        digest, filename = parts[0].lower(), parts[1].strip().lstrip("*")
        if len(digest) != 64 or set(digest) - set("0123456789abcdef"):
            raise ConfigError(
                f"checksum manifest line {lineno} has a malformed SHA-256: {digest!r}"
            )
        if filename in digests:
            raise ConfigError(f"checksum manifest lists {filename!r} twice")
        digests[filename] = digest
    return digests


def load_release(model: str, *, evidence_dir: Path | None = None) -> ResolvedRelease:
    """Resolve a registered release, authenticating its checksum manifest first.

    Raises ConfigError for an unregistered model or a malformed/incomplete
    manifest, and HashMismatchError when the manifest's own SHA-256 does not
    equal the pinned release id — which is the tamper check that makes the
    per-file digests below trustworthy.
    """
    pin = RELEASE_PINS.get(model)
    if pin is None:
        raise ConfigError(
            f"unknown model {model!r}; registered releases are {list(registered_releases())}. "
            "Inference may only load a release pinned in releases.py."
        )

    root = evidence_dir if evidence_dir is not None else evidence_root()
    manifest_path = Path(root) / pin.evidence_dirname / "local-bundle-sha256sums.txt"
    if not manifest_path.is_file():
        raise ConfigError(
            f"checksum manifest not found for {model!r}: {manifest_path}. "
            "Without it the pinned per-file digests cannot be authenticated; failing closed."
        )

    actual_digest = sha256_file(manifest_path)
    if actual_digest != pin.manifest_digest:
        raise HashMismatchError(
            f"checksum manifest for {model!r} does not match its pinned release id: "
            f"expected sha256 {pin.manifest_digest}, got {actual_digest}. "
            "The release id IS the manifest digest, so this means the manifest was edited "
            "or the pin is stale; refusing to download or load anything."
        )

    digests = parse_checksum_manifest(manifest_path.read_text(encoding="utf-8"))

    missing = [name for name in EXPECTED_BUNDLE_FILENAMES if name not in digests]
    if missing:
        raise ConfigError(
            f"checksum manifest for {model!r} is missing required bundle file(s): {missing}"
        )
    extra = [name for name in digests if name not in EXPECTED_BUNDLE_FILENAMES]
    if extra:
        raise ConfigError(
            f"checksum manifest for {model!r} lists unexpected file(s): {sorted(extra)}; "
            f"a release bundle is exactly {list(EXPECTED_BUNDLE_FILENAMES)}"
        )

    weights_digest = digests[pin.weights_filename]
    if not weights_digest:  # pragma: no cover - defensive; parse guarantees non-empty
        raise ConfigError(f"no digest for the weights file of {model!r}")

    return ResolvedRelease(pin=pin, digests=digests)
