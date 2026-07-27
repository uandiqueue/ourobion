"""Grouped-split leakage assertions.

Every model in this roster splits by a *group key* (source abstract/PMID/etc.)
rather than by row, because biomedical corpora repeat near-duplicate
sentences/entities across rows of the same source document. Stdlib only.
"""

from __future__ import annotations

from collections.abc import Hashable, Iterable, Mapping

from .errors import SplitLeakageError


def _normalize_text(value: object) -> str:
    """Collapse *all* internal whitespace and casefold.

    `.strip().lower()` is not enough: "a  b" (double space), "a\tb", and
    "a\xa0b" (non-breaking space) are the same sentence for leakage purposes,
    and `str.split()` splits on every Unicode whitespace character including
    NBSP. `casefold()` rather than `lower()` so e.g. German "ß"/"ss" also
    normalize together.
    """
    return " ".join(str(value).split()).casefold()


def assert_disjoint_groups(*named_group_sets: tuple[str, Iterable[Hashable]]) -> None:
    """Raise SplitLeakageError if any two named group collections share a member.

    Usage:
        assert_disjoint_groups(
            ("train", train_groups), ("val", val_groups), ("test", test_groups)
        )

    Two silent no-ops are treated as caller errors rather than "no leakage":
    passing the same split *name* twice (the second collection would be
    compared only against itself), and passing an already-consumed or
    single-pass iterator (which yields nothing). Both used to pass vacuously.
    """
    materialized: list[tuple[str, tuple[Hashable, ...]]] = []
    names_seen: set[str] = set()
    for name, groups in named_group_sets:
        if name in names_seen:
            raise SplitLeakageError(
                f"split name {name!r} was passed twice; groups within one name are never "
                "compared against each other, so this would silently skip a leakage check"
            )
        names_seen.add(name)
        materialized.append((name, tuple(groups)))

    empty = [name for name, groups in materialized if not groups]
    if empty and len(materialized) > 1:
        raise SplitLeakageError(
            f"split(s) {sorted(empty)} contributed no groups; an empty or already-consumed "
            "iterator cannot be checked for leakage"
        )

    seen: dict[Hashable, str] = {}
    for name, groups in materialized:
        for group in groups:
            owner = seen.get(group)
            if owner is not None and owner != name:
                raise SplitLeakageError(
                    f"group {group!r} appears in both split {owner!r} and {name!r}"
                )
            seen[group] = name


def assert_no_duplicate_normalized_text(
    records: Iterable[Mapping[str, object]],
    *,
    text_field: str,
    group_field: str,
) -> None:
    """Raise SplitLeakageError if normalized text repeats across two different groups.

    Catches the Leafcutter-shaped leakage mode: the same sentence text (after
    whitespace/case normalization -- leading, trailing *and internal*, see
    _normalize_text) reappearing under a different group, which would let a
    model memorize rather than generalize. The same text repeating within one
    group is not leakage and is allowed.
    """
    seen: dict[str, Hashable] = {}
    for record in records:
        text = _normalize_text(record[text_field])
        group = record[group_field]
        owner = seen.get(text)
        if owner is not None and owner != group:
            raise SplitLeakageError(
                f"normalized text {text!r} appears in both group {owner!r} and {group!r}"
            )
        seen[text] = group
