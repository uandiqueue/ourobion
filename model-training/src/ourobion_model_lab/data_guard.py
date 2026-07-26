"""Fail-closed guards against Ourobion production data ever entering training.

Stdlib only. These are deliberately conservative, name-based heuristics: a
false positive (blocking a benign fixture) is acceptable; a false negative
(letting a production export through) is not. Do not "fix" a false positive by
narrowing a pattern -- widen the caller's fixture naming instead.

The *roster* below is deliberately narrow and reviewed; the *matching* is
deliberately aggressive. An earlier version matched only exact, lowercase,
top-level dict keys and bare path substrings, so every one of these slipped
through: `C:/project/ourobion/supabase` (no trailing slash), `.../Supabase/`
(capitalized), `apps/biotope` (no trailing slash), `{"User_Id": ...}`,
`{"userId": ...}`, `{"public.daily_gut_rows": ...}`, a nested
`{"rows": [{"user_id": ...}]}`, and a forbidden name appearing as a *value*
(`{"table": "daily_gut_rows"}`). All of those are caught now.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Iterable, Mapping

from .errors import ForbiddenDataError

# Column/table/key names that only ever appear in Ourobion's own product schema
# or Supabase project config (see AGENTS.md's two-tier-truth tables and
# shared/types/). Keep this an explicit, reviewed roster -- never widen it by
# fuzzy/partial matching, and never narrow it just because a fixture collided
# with it (rename the fixture instead).
FORBIDDEN_COLUMN_NAMES = frozenset(
    {
        "daily_gut_rows",
        "antibiotic_courses",
        "wearable_daily",
        "env_daily",
        "baseline_snapshots",
        "insight_cards",
        "engagement_state",
        "user_id",
        "auth.users",
        "supabase_url",
        "supabase_anon_key",
        "supabase_service_role_key",
        "service_role_key",
    }
)

# Path locations that must never be the source of a training input, expressed as
# ordered path *segments* rather than raw substrings so matching can respect
# segment boundaries. Same roster as before: supabase/, apps/biotope/,
# apps/nao/, plus the credential files below.
FORBIDDEN_PATH_SEGMENTS: tuple[tuple[str, ...], ...] = (
    ("supabase",),
    ("apps", "biotope"),
    ("apps", "nao"),
)

# Credential-file segments. `.env` also covers `.env.public`/`.env.local`, and
# `.dev.vars` also covers `.dev.vars.local`, via the shared prefix rule below.
FORBIDDEN_FILE_SEGMENTS: tuple[str, ...] = (".env", ".dev.vars")

# Characters that may follow a forbidden segment and still be the same thing:
# `apps/biotope-export/` and `supabase.bak/` are the forbidden location under a
# suffix, whereas `biotopedata/` (no separator) is a different word and is not
# matched on this rule alone.
_SEGMENT_SUFFIX_SEPARATORS = ("-", "_", ".", "+")

# Split camelCase/PascalCase so `userId`/`userID` normalize onto `user_id`.
_CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
# Hyphens normalize to underscores (`user-id` is the same key as `user_id`).
# Whitespace deliberately does NOT: collapsing spaces would make the prose
# "the user id was recorded" read as the column `user_id`, which is the kind of
# over-match the roster is not meant to produce.
_SEPARATOR_RE = re.compile(r"-+")

# Word-boundary matchers for every forbidden name, built once.
_FORBIDDEN_NAME_RES = tuple(
    (name, re.compile(r"(?<![0-9a-z_])" + re.escape(name) + r"(?![0-9a-z_])"))
    for name in sorted(FORBIDDEN_COLUMN_NAMES)
)


def _normalize_identifier(text: object) -> str:
    """casefold + camelCase-split + separator-normalize, for boundary matching."""
    normalized = _CAMEL_BOUNDARY_RE.sub("_", str(text))
    normalized = normalized.casefold()
    return _SEPARATOR_RE.sub("_", normalized)


def _segment_matches(segment: str, forbidden: str) -> bool:
    if segment == forbidden:
        return True
    return any(
        segment.startswith(forbidden + sep) for sep in _SEGMENT_SUFFIX_SEPARATORS
    )


def _path_segments(path: str | Path) -> list[str]:
    """Case-folded path segments, separator-normalized (Windows or POSIX)."""
    text = str(path).replace("\\", "/").casefold()
    return [seg for seg in text.split("/") if seg not in ("", ".")]


def assert_allowed_input_path(path: str | Path) -> None:
    """Raise ForbiddenDataError if `path` resolves into a forbidden Ourobion location.

    Case-insensitive, separator-agnostic, and boundary-aware: a trailing
    separator is not required (`.../supabase` is caught as well as
    `.../supabase/seed.sql`), and a suffixed variant of a forbidden directory
    (`apps/biotope-export`) is caught too.
    """
    segments = _path_segments(path)

    for sequence in FORBIDDEN_PATH_SEGMENTS:
        window = len(sequence)
        for start in range(0, len(segments) - window + 1):
            if all(
                _segment_matches(segments[start + offset], sequence[offset])
                for offset in range(window)
            ):
                raise ForbiddenDataError(
                    f"input path '{path}' resolves inside a forbidden Ourobion location "
                    f"({'/'.join(sequence)!r}); model-training may only read "
                    "fixtures/manifests it owns"
                )

    for segment in segments:
        for forbidden in FORBIDDEN_FILE_SEGMENTS:
            if _segment_matches(segment, forbidden):
                raise ForbiddenDataError(
                    f"input path '{path}' names a credential/config file ({forbidden!r}); "
                    "model-training may only read fixtures/manifests it owns"
                )


def _forbidden_names_in(text: object) -> list[str]:
    """Forbidden schema names appearing as whole tokens in `text`."""
    normalized = _normalize_identifier(text)
    return [name for name, pattern in _FORBIDDEN_NAME_RES if pattern.search(normalized)]


def _scan(node: Any, hits: set[str], depth: int = 0) -> None:
    if depth > 32:  # defensive: absurdly deep input is itself suspicious, stop here
        return
    if isinstance(node, Mapping):
        for key, value in node.items():
            hits.update(_forbidden_names_in(key))
            _scan(value, hits, depth + 1)
    elif isinstance(node, (list, tuple, set, frozenset)):
        for item in node:
            _scan(item, hits, depth + 1)
    elif isinstance(node, str):
        hits.update(_forbidden_names_in(node))


def assert_no_forbidden_schema(record: Mapping[str, Any]) -> None:
    """Raise ForbiddenDataError if a record looks like an Ourobion/Supabase row.

    Checks keys *and* string values, at every nesting depth, case-insensitively,
    with camelCase and `schema.table` qualification normalized away. A forbidden
    name is matched on token boundaries, so `user_id` is caught in `User_Id`,
    `userId`, `public.user_id` and `"select user_id from ..."`, while a longer
    unrelated word merely containing it is not.
    """
    hits: set[str] = set()
    _scan(record, hits)
    if hits:
        raise ForbiddenDataError(
            f"record contains forbidden Ourobion schema field(s): {sorted(hits)}; "
            "model-training must never ingest product/Supabase data"
        )


def assert_no_forbidden_schema_in_all(records: Iterable[Mapping[str, Any]]) -> None:
    """Apply assert_no_forbidden_schema to every record in an iterable."""
    for record in records:
        assert_no_forbidden_schema(record)
