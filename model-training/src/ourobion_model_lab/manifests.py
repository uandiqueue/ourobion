"""Licence/data manifests and SHA-256 verification.

Fail-closed by construction: a missing approval file, an unapproved status, a
missing pinned file, or a hash mismatch raises rather than warns or defaults.
Stdlib only (hashlib + json). This module never decides a licence question
itself -- it only reads a decision a human already made and recorded as a file.

Files are decoded as `utf-8-sig` on purpose: this repo's own PowerShell tooling
writes UTF-8 *with* a BOM by default, and a BOM must not turn into an opaque
"not valid JSON" failure (plain utf-8 keeps the BOM as U+FEFF and json chokes).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .data_guard import assert_allowed_input_path, unsafe_relative_path_reason
from .errors import DataManifestError, HashMismatchError, LicenceApprovalError

_APPROVED_STATUSES = frozenset({"approved"})
_HEX_DIGITS = frozenset("0123456789abcdef")


@dataclass(frozen=True)
class LicenceApproval:
    dataset: str
    status: str
    approved_by: str | None
    reference: str | None
    raw: dict[str, Any]

    @property
    def is_approved(self) -> bool:
        return self.status in _APPROVED_STATUSES


def load_licence_approval(path: str | Path) -> LicenceApproval:
    """Load a signed licence-approval artifact.

    Raises LicenceApprovalError if the file is absent, malformed, or records a
    status other than "approved". No training/build/release step may proceed
    without a positive result from this function.
    """
    p = Path(path)
    if not p.exists():
        raise LicenceApprovalError(
            f"licence approval artifact not found: {p}; "
            "no training/evaluation/release may proceed without a recorded human approval"
        )
    try:
        raw = json.loads(p.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise LicenceApprovalError(f"licence approval artifact is not valid JSON: {p}") from exc

    if not isinstance(raw, dict):
        raise LicenceApprovalError(f"licence approval artifact must be a JSON object: {p}")

    for field_name in ("dataset", "status"):
        if field_name not in raw:
            raise LicenceApprovalError(f"licence approval artifact missing '{field_name}': {p}")

    approval = LicenceApproval(
        dataset=str(raw["dataset"]),
        status=str(raw["status"]),
        approved_by=raw.get("approved_by"),
        reference=raw.get("reference"),
        raw=raw,
    )
    if not approval.is_approved:
        raise LicenceApprovalError(
            f"licence for {approval.dataset!r} is not approved (status={approval.status!r}); "
            "failing closed"
        )
    return approval


def require_licence_approval(path: str | Path | None) -> LicenceApproval:
    """Like load_licence_approval, but an unset path is itself an immediate failure."""
    if path is None:
        raise LicenceApprovalError(
            "no licence_approval_path configured; refusing to proceed without one"
        )
    return load_licence_approval(path)


def sha256_file(path: str | Path, chunk_size: int = 1 << 20) -> str:
    """Return the lowercase hex SHA-256 digest of a file's contents."""
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def verify_hash(path: str | Path, expected_hex: str) -> None:
    """Raise HashMismatchError unless the file's SHA-256 matches `expected_hex`."""
    p = Path(path)
    if not p.is_file():
        raise HashMismatchError(
            f"cannot verify {p}: the file a manifest pins is missing, so its digest cannot "
            "be checked; failing closed"
        )
    actual = sha256_file(p)
    if actual.lower() != expected_hex.lower():
        raise HashMismatchError(f"hash mismatch for {path}: expected {expected_hex}, got {actual}")


# --------------------------------------------------------------------------
# Data manifests: relative path -> expected SHA-256, plus licence/source
# metadata. This is the "changed hashes fail closed" half of the acceptance
# bar; job.py wires verification into the one central execution path so no
# subcommand can consume data whose digest moved.
# --------------------------------------------------------------------------


def _is_sha256_hex(value: str) -> bool:
    return len(value) == 64 and set(value.lower()) <= _HEX_DIGITS


@dataclass(frozen=True)
class DataFileEntry:
    """One pinned file: a manifest-relative path and its expected SHA-256."""

    path: str
    sha256: str


@dataclass(frozen=True)
class DataManifest:
    """A frozen description of exactly which data files a job may read.

    `base_dir` is the manifest file's own directory: every pinned path is
    resolved relative to it, so a manifest is portable and can never point at
    an absolute local location.
    """

    dataset: str
    files: tuple[DataFileEntry, ...]
    base_dir: Path
    source: str | None = None
    licence: str | None = None
    licence_approval_path: str | None = None
    manifest_path: Path | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    def resolved_path(self, entry: DataFileEntry) -> Path:
        return self.base_dir / entry.path

    def verify(self) -> None:
        """Raise HashMismatchError on the first missing or changed pinned file."""
        for entry in self.files:
            verify_hash(self.resolved_path(entry), entry.sha256)

    def to_dict(self) -> dict[str, Any]:
        return {
            "dataset": self.dataset,
            "source": self.source,
            "licence": self.licence,
            "licence_approval_path": self.licence_approval_path,
            "files": [{"path": e.path, "sha256": e.sha256} for e in self.files],
        }


def load_data_manifest(path: str | Path) -> DataManifest:
    """Load and validate a data manifest. Never verifies digests -- call verify() for that.

    Raises DataManifestError if the file is absent, malformed, pins a
    non-relative/escaping path, pins something inside a forbidden Ourobion
    location, or carries a digest that is not a SHA-256 hex string.
    """
    p = Path(path)
    if not p.is_file():
        raise DataManifestError(
            f"data manifest not found: {p}; refusing to proceed with unpinned data"
        )
    try:
        raw = json.loads(p.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise DataManifestError(f"data manifest is not valid JSON: {p}: {exc}") from exc
    except OSError as exc:
        raise DataManifestError(f"data manifest could not be read: {p}: {exc}") from exc

    if not isinstance(raw, dict):
        raise DataManifestError(f"data manifest must be a JSON object: {p}")

    dataset = raw.get("dataset")
    if not isinstance(dataset, str) or not dataset:
        raise DataManifestError(f"data manifest field 'dataset' must be a non-empty string: {p}")

    files_raw = raw.get("files")
    if not isinstance(files_raw, list) or not files_raw:
        raise DataManifestError(
            f"data manifest field 'files' must be a non-empty list of "
            f"{{path, sha256}} objects: {p}"
        )

    for optional_field in ("source", "licence", "licence_approval_path"):
        value = raw.get(optional_field)
        if value is not None and not isinstance(value, str):
            raise DataManifestError(
                f"data manifest field '{optional_field}' must be a string or null: {p}"
            )

    entries: list[DataFileEntry] = []
    seen: set[str] = set()
    for item in files_raw:
        if not isinstance(item, dict):
            raise DataManifestError(f"each 'files' entry must be a JSON object: {p}")
        rel = item.get("path")
        digest = item.get("sha256")
        if not isinstance(rel, str) or not rel:
            raise DataManifestError(f"each 'files' entry needs a non-empty 'path': {p}")
        if not isinstance(digest, str) or not _is_sha256_hex(digest):
            raise DataManifestError(f"'files' entry {rel!r} needs a 64-character hex 'sha256': {p}")
        # Platform-independent on purpose. The previous Path(rel).is_absolute()
        # check passed on Windows but let "C:/secrets/x.jsonl" straight through
        # on Linux -- the OS the GMI training containers run on. See
        # data_guard.unsafe_relative_path_reason.
        unsafe = unsafe_relative_path_reason(rel)
        if unsafe is not None:
            raise DataManifestError(
                f"'files' entry {rel!r} {unsafe}; it must be a relative path inside "
                f"the manifest's own directory: {p}"
            )
        # A manifest may not smuggle in a product/Supabase location.
        assert_allowed_input_path(rel)
        if rel in seen:
            raise DataManifestError(f"'files' entry {rel!r} is listed twice: {p}")
        seen.add(rel)
        entries.append(DataFileEntry(path=rel, sha256=digest.lower()))

    return DataManifest(
        dataset=dataset,
        files=tuple(entries),
        base_dir=p.parent,
        source=raw.get("source"),
        licence=raw.get("licence"),
        licence_approval_path=raw.get("licence_approval_path"),
        manifest_path=p,
        raw=raw,
    )


def require_data_manifest(path: str | Path | None) -> DataManifest:
    """Like load_data_manifest, but an unset path is itself an immediate failure."""
    if path is None:
        raise DataManifestError(
            "no dataset_manifest_path configured; this model requires one, so there is no "
            "pinned digest to check -- failing closed"
        )
    return load_data_manifest(path)
