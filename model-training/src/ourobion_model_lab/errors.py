"""Shared exception hierarchy for ourobion_model_lab.

Stdlib only. Every error below is meant to be a fail-closed stop, not a warning:
callers (see cli.py) catch `ModelLabError` and exit non-zero rather than let a
job proceed on an assumption. Do not add a subclass that gets silently caught
and ignored anywhere in this package.
"""

from __future__ import annotations


class ModelLabError(Exception):
    """Base class for every ourobion_model_lab error."""


class ConfigError(ModelLabError):
    """A job config is missing, malformed, or internally inconsistent."""


class LicenceApprovalError(ModelLabError):
    """A required licence-approval artifact is absent, malformed, or not approved.

    This is never raised to *resolve* a licence question -- only to refuse to
    proceed without a human decision already recorded as a file.
    """


class HashMismatchError(ModelLabError):
    """A file's SHA-256 does not match the expected, pinned digest.

    Also raised when a file a data manifest pins is absent: an unverifiable
    digest and a changed digest are the same fail-closed stop.
    """


class DataManifestError(ModelLabError):
    """A data manifest is absent, malformed, or pins a path that is not allowed."""


class MetricInputError(ModelLabError, ValueError):
    """A metric was called with inputs it cannot score (mismatched lengths, or a
    confidence outside [0, 1] -- typically logits passed where probabilities were
    expected).

    Subclasses ValueError as well as ModelLabError so long-standing
    `except ValueError` callers keep working while cli.py's ModelLabError
    handler still turns it into a fail-closed exit.
    """


class ForbiddenDataError(ModelLabError):
    """An input looks like Ourobion production/Supabase data or a forbidden path."""


class SplitLeakageError(ModelLabError):
    """A train/val/test split shares a group or a duplicate normalized text value."""


class GmiPreflightError(ModelLabError):
    """A GMI environment preflight check failed."""


class ReleaseIncompleteError(ModelLabError):
    """A release manifest is unsafe to build (e.g. a secret-shaped key) or unsafe to trust."""
