"""Zebra NLI Shadow v0 — leakage-safe cross-validation splits.

SciFact claims and abstracts form a many-to-many graph: the same abstract can be evidence for
several claims, and (less commonly) a claim can cite more than one abstract. Assigning *rows*
to folds independently can therefore leak information across folds through a shared abstract
(the model would have seen the document, just paired with a different claim). This module
instead assigns whole connected *components* of the claim<->abstract bipartite graph to folds,
so a component is always entirely inside one fold or entirely inside another.

Because the whole point is to prevent leakage that is easy to reintroduce by accident, every
guarantee here is enforced with an assertion that raises on violation, not just documented:
zero overlap of claim_id, abstract_id, component, and exact normalized claim text, both across
folds and between the assembled train folds and the official dev split.

This module assumes its inputs are already-processed rows (``zebra.data.ProcessedExample``),
whose ``claim_text`` has already been Unicode/whitespace-normalized by
``zebra.data.normalize_text`` — it does not re-normalize.
"""

from collections import defaultdict
from dataclasses import dataclass
from typing import Sequence

from .config import ZebraConfig
from .data import CLASS_NAMES, ProcessedExample


class SplitLeakageError(AssertionError):
    """A fold/train/dev separation invariant was violated. Subclasses AssertionError
    deliberately: these are "this must be structurally impossible" conditions that should never
    be caught-and-continued, not ordinary, recoverable validation errors."""


class InsufficientFoldSupportError(ValueError):
    """A fold does not have at least `min_per_class_per_fold` rows of some class. This is a
    data/config viability problem — component-locked fold assignment over a small, three-class
    dataset can plausibly starve a fold of a minority class — not a correctness bug, hence
    ValueError rather than AssertionError."""


@dataclass(frozen=True)
class SplitResult:
    fold_of_row: tuple[int, ...]
    component_ids: tuple[int, ...]
    fold_class_counts: dict[int, dict[str, int]]
    fold_component_counts: dict[int, int]
    n_claim_text_collisions_removed: int
    n_abstract_id_collisions_removed: int
    n_folds: int


def _canon(x: object) -> str:
    return str(x).strip()


# --- dedup -------------------------------------------------------------------------------------


def dedupe_rows(
    rows: Sequence[ProcessedExample],
) -> tuple[dict[int, str], dict[int, str], int, int]:
    """Collapses (a) rows whose claim text is an exact normalized duplicate under a *different*
    claim_id, and (b) rows whose abstract_id is the same document under a different string/int
    representation — BEFORE the leakage graph is built. Skipping this step would let two literal
    duplicates land in different folds and look like independent test points.

    Returns ``(claim_key_by_row, abstract_key_by_row, n_claim_text_collisions,
    n_abstract_id_collisions)`` where the two dicts map row index -> canonical graph-node key.
    """
    claim_key_of_text: dict[str, str] = {}
    abstract_key_of_id: dict[str, str] = {}
    n_claim_collisions = 0
    n_abstract_collisions = 0
    claim_key_by_row: dict[int, str] = {}
    abstract_key_by_row: dict[int, str] = {}

    for idx, row in enumerate(rows):
        text = row.claim_text
        if text in claim_key_of_text:
            n_claim_collisions += 1
        else:
            claim_key_of_text[text] = _canon(row.claim_id)
        claim_key_by_row[idx] = claim_key_of_text[text]

        abstract_key = _canon(row.abstract_id)
        if abstract_key in abstract_key_of_id:
            n_abstract_collisions += 1
        else:
            abstract_key_of_id[abstract_key] = abstract_key
        abstract_key_by_row[idx] = abstract_key_of_id[abstract_key]

    return claim_key_by_row, abstract_key_by_row, n_claim_collisions, n_abstract_collisions


# --- connected components (union-find over claim<->abstract bipartite graph) -------------------


class _UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        # deterministic attachment direction (lexicographically larger root under smaller) so
        # component identity doesn't depend on row iteration order
        if ra > rb:
            ra, rb = rb, ra
        self.parent[rb] = ra


def build_components(rows: Sequence[ProcessedExample]) -> tuple[list[int], dict]:
    """Builds the claim<->abstract bipartite graph (after dedup) and returns a small integer
    component id per row, plus dedup metadata. Component ids are assigned in order of first
    appearance, so they are stable given a stable row order."""
    claim_key_by_row, abstract_key_by_row, n_claim_collisions, n_abstract_collisions = dedupe_rows(
        rows
    )

    uf = _UnionFind()
    for idx in range(len(rows)):
        claim_node = f"claim::{claim_key_by_row[idx]}"
        abstract_node = f"abstract::{abstract_key_by_row[idx]}"
        uf.find(claim_node)
        uf.find(abstract_node)
        uf.union(claim_node, abstract_node)

    root_to_component_id: dict[str, int] = {}
    component_ids: list[int] = []
    for idx in range(len(rows)):
        root = uf.find(f"claim::{claim_key_by_row[idx]}")
        if root not in root_to_component_id:
            root_to_component_id[root] = len(root_to_component_id)
        component_ids.append(root_to_component_id[root])

    meta = {
        "n_components": len(root_to_component_id),
        "n_claim_text_collisions": n_claim_collisions,
        "n_abstract_id_collisions": n_abstract_collisions,
    }
    return component_ids, meta


# --- fold assignment -----------------------------------------------------------------------------


def assign_folds(
    rows: Sequence[ProcessedExample], component_ids: Sequence[int], n_folds: int, seed: int
) -> list[int]:
    """Assigns whole connected components to folds via deterministic greedy size-balancing:
    largest components first, each placed into the fold with the fewest rows so far (ties broken
    by lowest fold index, then lowest component id). This is fully deterministic by
    construction — `seed` is accepted for interface symmetry with the rest of the config, but
    the assignment does not depend on it, so re-running with a different seed allocates
    identically. (Stratifying by class as well as by size is not attempted here; class balance
    is *checked* afterward by `assert_min_class_support`, not assumed.)
    """
    del seed  # accepted for interface symmetry; assignment is deterministic without it

    rows_by_component: dict[int, list[int]] = defaultdict(list)
    for idx, cid in enumerate(component_ids):
        rows_by_component[cid].append(idx)

    ordered = sorted(rows_by_component.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    fold_sizes = [0] * n_folds
    fold_of_row = [-1] * len(rows)
    for _cid, idxs in ordered:
        target = min(range(n_folds), key=lambda f: (fold_sizes[f], f))
        for idx in idxs:
            fold_of_row[idx] = target
        fold_sizes[target] += len(idxs)

    return fold_of_row


# --- leakage assertions --------------------------------------------------------------------------


def assert_no_cross_fold_leakage(
    rows: Sequence[ProcessedExample], fold_of_row: Sequence[int], component_ids: Sequence[int]
) -> None:
    """Raises SplitLeakageError if any component, claim_id, abstract_id, or exact normalized
    claim text spans more than one fold."""
    component_to_folds: dict[int, set[int]] = defaultdict(set)
    for cid, f in zip(component_ids, fold_of_row):
        component_to_folds[cid].add(f)
    bad_components = {c: fs for c, fs in component_to_folds.items() if len(fs) > 1}
    if bad_components:
        raise SplitLeakageError(
            f"{len(bad_components)} component(s) span more than one fold "
            f"(fold assignment is buggy): {bad_components}"
        )

    claim_to_folds: dict[str, set[int]] = defaultdict(set)
    abstract_to_folds: dict[str, set[int]] = defaultdict(set)
    text_to_folds: dict[str, set[int]] = defaultdict(set)
    for row, f in zip(rows, fold_of_row):
        claim_to_folds[_canon(row.claim_id)].add(f)
        abstract_to_folds[_canon(row.abstract_id)].add(f)
        text_to_folds[row.claim_text].add(f)

    for name, mapping in (
        ("claim_id", claim_to_folds),
        ("abstract_id", abstract_to_folds),
        ("exact normalized claim text", text_to_folds),
    ):
        bad = {k: v for k, v in mapping.items() if len(v) > 1}
        if bad:
            example_key, example_folds = next(iter(bad.items()))
            raise SplitLeakageError(
                f"{len(bad)} {name} value(s) span more than one fold, "
                f"e.g. {example_key!r} -> folds {sorted(example_folds)}"
            )


def assert_no_train_dev_leakage(
    train_rows: Sequence[ProcessedExample], dev_rows: Sequence[ProcessedExample]
) -> None:
    """Raises SplitLeakageError if any claim_id, abstract_id, exact normalized claim text, or
    connected component is shared between the assembled train folds and the official dev split.
    Components are recomputed jointly over train+dev so a claim/abstract bridge between the two
    pools (e.g. the same abstract appearing in both) is caught even though train and dev were
    originally loaded as separate splits."""
    train_claims = {_canon(r.claim_id) for r in train_rows}
    dev_claims = {_canon(r.claim_id) for r in dev_rows}
    overlap_claims = train_claims & dev_claims

    train_abstracts = {_canon(r.abstract_id) for r in train_rows}
    dev_abstracts = {_canon(r.abstract_id) for r in dev_rows}
    overlap_abstracts = train_abstracts & dev_abstracts

    train_texts = {r.claim_text for r in train_rows}
    dev_texts = {r.claim_text for r in dev_rows}
    overlap_texts = train_texts & dev_texts

    joint_rows = list(train_rows) + list(dev_rows)
    joint_component_ids, _meta = build_components(joint_rows)
    n_train = len(train_rows)
    train_components = set(joint_component_ids[:n_train])
    dev_components = set(joint_component_ids[n_train:])
    overlap_components = train_components & dev_components

    problems = []
    if overlap_claims:
        problems.append(f"{len(overlap_claims)} claim_id(s) shared between train and dev")
    if overlap_abstracts:
        problems.append(f"{len(overlap_abstracts)} abstract_id(s) shared between train and dev")
    if overlap_texts:
        problems.append(
            f"{len(overlap_texts)} exact normalized claim text duplicate(s) between train and dev"
        )
    if overlap_components:
        problems.append(
            f"{len(overlap_components)} connected component(s) bridge train and dev"
        )
    if problems:
        raise SplitLeakageError("train/dev leakage detected: " + "; ".join(problems))


# --- reporting tables ------------------------------------------------------------------------


def fold_class_table(
    rows: Sequence[ProcessedExample], fold_of_row: Sequence[int], n_folds: int
) -> dict[int, dict[str, int]]:
    """fold -> class -> row count, as a plain dict (every fold/class combination present, even
    if zero, so a missing key never silently reads as "no data to check")."""
    table: dict[int, dict[str, int]] = {f: {c: 0 for c in CLASS_NAMES} for f in range(n_folds)}
    for row, f in zip(rows, fold_of_row):
        table[f][row.label] += 1
    return table


def fold_component_table(
    fold_of_row: Sequence[int], component_ids: Sequence[int], n_folds: int
) -> dict[int, int]:
    """fold -> number of distinct components in that fold, as a plain dict."""
    components_by_fold: dict[int, set[int]] = {f: set() for f in range(n_folds)}
    for cid, f in zip(component_ids, fold_of_row):
        components_by_fold[f].add(cid)
    return {f: len(s) for f, s in components_by_fold.items()}


def assert_min_class_support(
    fold_class_counts: dict[int, dict[str, int]], min_per_class_per_fold: int
) -> None:
    """Fails loudly rather than silently proceeding with a fold that has too little support in
    some class for a stable estimate. With ~1,259 rows over three classes, and folds locked to
    whole claim/abstract components rather than assigned row-by-row, a viable per-class minimum
    in every fold is NOT guaranteed by construction — it depends on how supported/contradicted/
    insufficient_evidence claims happen to cluster into shared-abstract components. This must be
    measured and enforced, not hoped for.

    Raises InsufficientFoldSupportError listing every (fold, class) that falls below the
    configured minimum.
    """
    violations = [
        (f, cls, n)
        for f, counts in fold_class_counts.items()
        for cls, n in counts.items()
        if n < min_per_class_per_fold
    ]
    if violations:
        detail = "; ".join(
            f"fold {f} class {cls!r} has {n} row(s) (< {min_per_class_per_fold})"
            for f, cls, n in violations
        )
        raise InsufficientFoldSupportError(
            f"{len(violations)} fold/class combination(s) fall below the configured "
            f"min_per_class_per_fold={min_per_class_per_fold}: {detail}"
        )


# --- orchestrator ----------------------------------------------------------------------------


def build_splits(
    train_rows: Sequence[ProcessedExample],
    dev_rows: Sequence[ProcessedExample],
    config: ZebraConfig,
) -> SplitResult:
    """Runs the full pipeline: dedup -> components -> fold assignment -> every leakage
    assertion -> reporting tables -> minimum-support check. Raises (does not return a
    partial/invalid result) if any assertion fails."""
    component_ids, dedupe_meta = build_components(train_rows)
    fold_of_row = assign_folds(train_rows, component_ids, config.n_folds, config.seed)

    assert_no_cross_fold_leakage(train_rows, fold_of_row, component_ids)
    assert_no_train_dev_leakage(train_rows, dev_rows)

    class_table = fold_class_table(train_rows, fold_of_row, config.n_folds)
    component_table = fold_component_table(fold_of_row, component_ids, config.n_folds)

    assert_min_class_support(class_table, config.min_per_class_per_fold)

    return SplitResult(
        fold_of_row=tuple(fold_of_row),
        component_ids=tuple(component_ids),
        fold_class_counts=class_table,
        fold_component_counts=component_table,
        n_claim_text_collisions_removed=dedupe_meta["n_claim_text_collisions"],
        n_abstract_id_collisions_removed=dedupe_meta["n_abstract_id_collisions"],
        n_folds=config.n_folds,
    )
