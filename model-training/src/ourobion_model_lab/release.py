"""Release-manifest construction.

Builds are atomic (write to a temp file in the destination directory, fsync,
then `os.replace`) so a crash mid-write can never leave a file under the final
name that looks like a complete release. Manifests are hashed deterministically
from their own canonicalized content (excluding the hash field itself), so
repeated builds from identical inputs produce an identical `release_hash`;
anything that varies between runs (wall-clock time, absolute local paths,
secrets) must never be embedded in the hashed body.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .environment import EnvironmentSnapshot
from .errors import ReleaseIncompleteError

# Substring fragments that must never appear in a manifest key, anywhere in the
# (possibly nested) body. Checked defensively at build time even though callers
# should never pass these in the first place -- see data_guard.py for the
# input-side version of this discipline.
FORBIDDEN_MANIFEST_KEY_FRAGMENTS = frozenset(
    {"api_key", "secret", "password", "token", "service_role_key", "local_path"}
)

# --------------------------------------------------------------------------
# Value scanning. Keys alone are near-useless as a guard: the body's keys are a
# fixed literal set, so a secret or a local path only ever arrives as a *value*
# (a model_version with a key pasted into it, a git_commit holding a checkout
# path, ...). Everything below therefore inspects values as well as keys.
#
# Bias: fail closed. A false positive here blocks one release build and is
# fixed by passing a cleaner value; a false negative writes a credential to a
# file that is meant to be shareable. Legitimate manifest shapes (hex digests,
# semantic versions, UUIDs, short slugs) are explicitly exempted from the
# entropy heuristic only -- never from the path or credential-marker scans.
# --------------------------------------------------------------------------

# Absolute/local filesystem locations: a release manifest must be portable, so
# no value may carry a machine-specific path.
_LOCAL_PATH_PATTERNS = (
    # C:\Users\... or C:/Users/... The leading guard keeps "https://" (scheme +
    # "//") from reading as a drive letter.
    re.compile(r"(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]"),
    re.compile(r"^\\\\[^\\]+\\"),  # \\server\share UNC
    re.compile(r"(?:^|[\s\"'=(,;:])/(?:home|Users|users|root|private)/"),  # POSIX home dirs
    re.compile(r"(?:^|[\s\"'=(,;:])~[\\/]"),  # ~/ shorthand
    re.compile(r"\$(?:HOME|USERPROFILE)\b"),
    re.compile(r"%USERPROFILE%", re.IGNORECASE),
)

# Credential-shaped markers, searched anywhere in the value (not just as a
# prefix) so a token pasted into the middle of another string is still caught.
_CREDENTIAL_PATTERNS = (
    re.compile(r"sk[-_](?:live|test|proj)[-_][A-Za-z0-9]", re.IGNORECASE),
    re.compile(r"\bsk-[A-Za-z0-9]{16,}"),
    re.compile(r"\bpk[-_]live[-_][A-Za-z0-9]", re.IGNORECASE),
    re.compile(r"gmi_sk_", re.IGNORECASE),
    re.compile(r"\bghp_[A-Za-z0-9]{8,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{8,}"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{8,}"),
    re.compile(r"\bAKIA[0-9A-Z]{12,}"),
    re.compile(r"\bASIA[0-9A-Z]{12,}"),
    re.compile(r"\bAIza[0-9A-Za-z_\-]{20,}"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),  # JWT
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bhf_[A-Za-z0-9]{16,}"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._\-]{12,}"),
    re.compile(r"service_role", re.IGNORECASE),
    re.compile(r"\b(?:api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]", re.IGNORECASE),
)

# Env vars whose *values* must never be echoed into a manifest. Matched by name
# shape, so a new secret-shaped variable is covered without editing this list.
_SECRET_ENV_NAME_RE = re.compile(
    r"(KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|SESSION|COOKIE)", re.IGNORECASE
)
_MIN_ENV_VALUE_LEN = 8

# Entropy heuristic. Measured over the longest *unbroken alphanumeric run* in a
# value, not over the whole string: randomness in a secret is contiguous
# ("Zk3PmQ9xLv2RtY8wAe4UbN6cJd0FgHs1"), whereas the legitimate long values a
# manifest carries are delimited token salads whose whole-string entropy is
# deceptively high ("Linux-6.5.0-1025-azure-x86_64-with-glibc2.39",
# "Windows-11-10.0.26200-SP0"). Scoring the whole string flagged those; scoring
# the longest run does not, because their longest runs are ~6 characters.
_ENTROPY_MIN_RUN = 24
_ENTROPY_BITS_PER_CHAR = 3.5

_HEXISH_RE = re.compile(r"^[0-9a-fA-F]+$")
_ALNUM_RUN_RE = re.compile(r"[^A-Za-z0-9]+")


def _shannon_entropy(text: str) -> float:
    counts = Counter(text)
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _has_secret_shaped_run(value: str) -> bool:
    """True if some long alphanumeric run in `value` looks like raw key material.

    Known blind spot, accepted deliberately: a purely hexadecimal run is
    exempted, because git SHAs and SHA-256 digests are exactly that shape and
    are the manifest's own bread and butter. A 32-hex-character secret would
    therefore pass this particular check -- the key-name scan, the credential
    markers, and the env-value comparison are its backstops.
    """
    for token in _ALNUM_RUN_RE.split(value):
        if len(token) < _ENTROPY_MIN_RUN:
            continue
        if _HEXISH_RE.match(token):
            continue
        classes = sum(
            (
                any(c.islower() for c in token),
                any(c.isupper() for c in token),
                any(c.isdigit() for c in token),
            )
        )
        if classes < 3:
            continue  # a long lowercase slug, not key material
        if _shannon_entropy(token) >= _ENTROPY_BITS_PER_CHAR:
            return True
    return False


def _secret_env_names_matching(value: str) -> list[str]:
    """Names (never values) of secret-shaped env vars whose value appears in `value`."""
    hits: list[str] = []
    for name, env_value in os.environ.items():
        if not _SECRET_ENV_NAME_RE.search(name):
            continue
        candidate = (env_value or "").strip()
        if len(candidate) >= _MIN_ENV_VALUE_LEN and candidate in value:
            hits.append(name)
    return sorted(hits)


def _describe_unsafe_value(value: str) -> str | None:
    """Return why `value` is unsafe to publish, or None if it looks publishable."""
    stripped = value.strip()
    if not stripped:
        return None
    for pattern in _LOCAL_PATH_PATTERNS:
        if pattern.search(value):
            return "looks like an absolute local path or a user home directory"
    for pattern in _CREDENTIAL_PATTERNS:
        if pattern.search(value):
            return "looks like a credential/API-key token"
    env_hits = _secret_env_names_matching(value)
    if env_hits:
        return f"contains the value of secret-shaped environment variable(s) {env_hits}"
    if _has_secret_shaped_run(stripped):
        return (
            "contains a long high-entropy run, which is the shape of raw key material "
            "rather than a version, hash, or slug"
        )
    return None


@dataclass(frozen=True)
class ReleaseManifest:
    model_name: str
    model_version: str
    git_commit: str | None
    config_hash: str
    dataset_manifest_hash: str | None
    metrics: dict[str, float]
    release_hash: str
    body: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return dict(self.body, release_hash=self.release_hash)


def _assert_no_forbidden_keys(obj: Any, path: str = "") -> None:
    """Reject secret/local-path-shaped *keys*, anywhere in a (nested) body."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            lowered = str(key).lower()
            if any(bad in lowered for bad in FORBIDDEN_MANIFEST_KEY_FRAGMENTS):
                raise ReleaseIncompleteError(
                    f"refusing to build release: manifest key '{path}{key}' looks like a "
                    "secret or local-path field"
                )
            _assert_no_forbidden_keys(value, f"{path}{key}.")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _assert_no_forbidden_keys(item, f"{path}[{i}].")


def _assert_no_forbidden_values(obj: Any, path: str = "") -> None:
    """Reject secret/local-path-shaped *values*, anywhere in a (nested) body.

    The reason is reported; the offending value never is -- an error message is
    itself an artifact that gets logged and pasted into PRs.
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            _assert_no_forbidden_values(value, f"{path}{key}.")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _assert_no_forbidden_values(item, f"{path}[{i}].")
    elif isinstance(obj, str):
        reason = _describe_unsafe_value(obj)
        if reason is not None:
            field_name = path[:-1] if path.endswith(".") else path or "<root>"
            raise ReleaseIncompleteError(
                f"refusing to build release: the value of '{field_name}' {reason}; "
                "release manifests must be portable and publishable (value not echoed here)"
            )


def assert_manifest_body_is_publishable(body: Any) -> None:
    """Key scan + value scan. Raises ReleaseIncompleteError on the first problem."""
    _assert_no_forbidden_keys(body)
    _assert_no_forbidden_values(body)


def _canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def build_release_manifest(
    *,
    model_name: str,
    model_version: str,
    git_commit: str | None,
    config_hash: str,
    dataset_manifest_hash: str | None,
    metrics: dict[str, float],
    environment: EnvironmentSnapshot | None = None,
) -> ReleaseManifest:
    """Build a deterministic release manifest. Raises ReleaseIncompleteError on a
    secret/local-path-shaped key *or value*. Never performs I/O -- see
    write_release_manifest_atomic for that.

    `environment` adds reproducibility metadata (interpreter version, platform,
    which credential env vars were *present*). Only the deterministic subset is
    embedded: `captured_at` is deliberately dropped so repeated builds from
    identical inputs stay byte-identical, and no env var *value* is ever
    recorded -- see environment.EnvironmentSnapshot.to_release_fields.
    """
    body: dict[str, Any] = {
        "model_name": model_name,
        "model_version": model_version,
        "git_commit": git_commit,
        "config_hash": config_hash,
        "dataset_manifest_hash": dataset_manifest_hash,
        "metrics": dict(sorted(metrics.items())),
        # Always literally true for this code-build; see docs/temp/model-training/README.md.
        "training_status": "not run",
    }
    if environment is not None:
        body["environment"] = environment.to_release_fields()
    assert_manifest_body_is_publishable(body)
    release_hash = hashlib.sha256(_canonical_json(body).encode("utf-8")).hexdigest()
    return ReleaseManifest(
        model_name=model_name,
        model_version=model_version,
        git_commit=git_commit,
        config_hash=config_hash,
        dataset_manifest_hash=dataset_manifest_hash,
        metrics=dict(metrics),
        release_hash=release_hash,
        body=body,
    )


def write_release_manifest_atomic(manifest: ReleaseManifest, destination: str | Path) -> Path:
    """Write a release manifest so a crash mid-write can never look like a complete release.

    Re-runs the key/value scan first: writing to disk is where a leaked secret
    actually becomes harmful, and a ReleaseManifest can be constructed directly
    (bypassing build_release_manifest) by a caller.
    """
    assert_manifest_body_is_publishable(manifest.to_dict())
    dest = Path(destination)
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(dest.parent), prefix=".release-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(manifest.to_dict(), fh, indent=2, sort_keys=True)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, dest)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return dest
