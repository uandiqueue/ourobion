"""Viceroy Causal-Language-Risk v0 — leakage-safe cross-validation splits.

WHY THIS MODULE IS THE HARD PART OF THIS BUNDLE
------------------------------------------------
The Zebra run hit data leakage. The lesson generalises, and it is not "add another assertion":

    An assertion that fires at the end of a pipeline tells you the split is unusable.
    It does not give you a usable split.

Zebra's splits module assigns folds by *size balance only* and then asserts that no claim,
abstract, component, or exact text spans a fold boundary — so the assertion is the first thing
that knows about a constraint the assigner never tried to satisfy. This module inverts that
order: folds are **constructed** so the invariants hold by construction, and the assertions run
afterwards as a double-check on the construction rather than as the mechanism.

The second lesson is about trusting an inherited split. Zebra took the corpus's official
train/dev split as a given and checked it; this bundle builds its own folds over the whole
corpus, because an upstream split is an upstream author's judgement about leakage, not ours.

THE MEASURED PROBLEM SPECIFIC TO THIS CORPUS
---------------------------------------------
The training plan says to group folds "by PMID so no paper's sentences straddle folds".
**The released labelled corpus has no PMID.** Measured on the distributed file: 3,061 rows, two
columns, ``sentence`` and ``label``. The repository's *unlabelled* sample file does carry a
``pmid`` column, so the authors had paper ids and did not publish them with the labels.

This matters because same-paper sentences are demonstrably present. One measured cluster of four
rows — all about sugar-sweetened beverages, fruit juice, and their substitution — is plainly one
paper's conclusion split into sentences, and carries three different labels between them. Under
row-level splitting those four rows scatter across folds, and a model that has memorised the
paper's phrasing is scored as if it were generalising.

For the record, the upstream repository's own ``main.py`` uses
``StratifiedKFold(n_splits=K, shuffle=True, random_state=0)`` over sentences — no grouping. So the
published **0.90 accuracy / 0.88 macro-F1** anchor is itself a row-level number. A group-safe
score from this bundle is expected to be lower, and that gap is a finding, not a regression. Do
not "fix" it by relaxing the grouping.

WHAT THIS MODULE DOES INSTEAD
------------------------------
Groups are built by union-find over three kinds of evidence that two rows share provenance:

  1. **exact normalized text** (``dedup_key``) — always, under every policy;
  2. **lexical near-duplication** at ``config.near_dup_jaccard`` — the surrogate for the missing
     paper id;
  3. **PMID**, when a real one is present and ``group_policy="pmid"``.

Then folds are assigned to *whole groups* with a stratified greedy heuristic that minimises
per-class imbalance, and the result is audited — including an explicit report of near-duplicate
pairs *below* the grouping threshold that still crossed a fold boundary. That residual report is
the honest part: a similarity threshold has imperfect recall, and a run that claims zero leakage
is claiming something it cannot know.
"""

import math
from collections import defaultdict
from dataclasses import dataclass, field
from itertools import combinations
from typing import Sequence

from .config import ViceroyConfig
from .data import CLASS_NAMES, ProcessedExample, tokens_for_similarity


class SplitLeakageError(AssertionError):
    """A fold-separation invariant was violated. Subclasses AssertionError deliberately: after
    construction these are "this must be structurally impossible" conditions, so reaching one
    means the *assigner* is buggy, not that the data is awkward. Never catch-and-continue."""


class InsufficientFoldSupportError(ValueError):
    """A fold does not have at least ``min_per_class_per_fold`` rows of some class. A data/config
    viability problem rather than a correctness bug, hence ValueError. Unlike the Zebra bundle
    this should be rare, because fold assignment actively balances classes instead of only
    balancing size — if it fires here, the group structure genuinely cannot support the
    configured minimum."""


class GroupPolicyError(ValueError):
    """The configured ``group_policy`` cannot be satisfied by the data as loaded — e.g.
    ``"pmid"`` was requested but the corpus carries no PMID, or carries one for only some rows.
    Raised instead of silently falling back to a weaker grouping, because a silent fallback to
    row-level splitting is precisely the failure this module exists to prevent."""


@dataclass(frozen=True)
class SplitResult:
    fold_of_row: tuple[int, ...]
    group_ids: tuple[int, ...]
    fold_class_counts: dict[int, dict[str, int]]
    fold_group_counts: dict[int, int]
    n_groups: int
    n_folds: int
    group_policy: str
    n_exact_duplicate_rows: int
    n_near_duplicate_links: int
    n_pmid_links: int
    n_conflicting_rows_dropped: int
    kept_row_ids: tuple[int, ...]
    leakage_audit: dict = field(default_factory=dict)


# --- conflicting-label rows ---------------------------------------------------------------------


def drop_conflicting_label_rows(
    examples: Sequence[ProcessedExample],
) -> tuple[list[ProcessedExample], list[ProcessedExample]]:
    """Splits rows into (kept, dropped) where dropped rows share a normalized sentence with
    another row carrying a *different* label.

    Both copies are dropped, not one of them: there is no principled way to pick which
    annotation is right, and keeping either would inject a coin-flip into the supervision.
    Returns both lists so the caller can report the count rather than lose it.
    """
    labels_by_key: dict[str, set[str]] = defaultdict(set)
    for e in examples:
        labels_by_key[e.dedup_key].add(e.label)
    conflicted = {k for k, labels in labels_by_key.items() if len(labels) > 1}
    kept = [e for e in examples if e.dedup_key not in conflicted]
    dropped = [e for e in examples if e.dedup_key in conflicted]
    return kept, dropped


# --- near-duplicate detection --------------------------------------------------------------------


def _token_sets(examples: Sequence[ProcessedExample]) -> list[frozenset[str]]:
    return [frozenset(tokens_for_similarity(e.sentence_text)) for e in examples]


def candidate_pairs(
    token_sets: Sequence[frozenset[str]], max_posting_length: int
) -> set[tuple[int, int]]:
    """Generates the pairs worth scoring, via an inverted index over tokens.

    A token whose posting list is longer than ``max_posting_length`` is skipped: it is too common
    to be evidence of shared provenance ("patients", "significant", "associated"), and including
    it would make this quadratic in corpus size for no recall gain. Rare tokens — a drug name, a
    cohort size, an odd turn of phrase — are what actually link two sentences from one paper.

    Deterministic: returns a set of ``(lower_index, higher_index)`` pairs, and the caller sorts
    before use.
    """
    inverted: dict[str, list[int]] = defaultdict(list)
    for idx, tokens in enumerate(token_sets):
        for token in tokens:
            inverted[token].append(idx)

    pairs: set[tuple[int, int]] = set()
    for _token, postings in inverted.items():
        if len(postings) > max_posting_length:
            continue
        for a, b in combinations(sorted(postings), 2):
            pairs.add((a, b))
    return pairs


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    """Token-set Jaccard similarity. Two empty sets are treated as similarity 0.0, not 1.0 —
    an empty sentence carries no evidence of shared provenance, and calling it a perfect match
    would merge unrelated degenerate rows into one group."""
    if not a or not b:
        return 0.0
    union = len(a | b)
    return len(a & b) / union if union else 0.0


def near_duplicate_pairs(
    examples: Sequence[ProcessedExample], config: ViceroyConfig, threshold: float | None = None
) -> list[tuple[int, int, float]]:
    """All row-index pairs at or above ``threshold`` (default ``config.near_dup_jaccard``),
    sorted deterministically by (-similarity, i, j). Row indices are positions in ``examples``,
    not ``row_id`` values."""
    cutoff = config.near_dup_jaccard if threshold is None else threshold
    token_sets = _token_sets(examples)
    hits: list[tuple[int, int, float]] = []
    for i, j in candidate_pairs(token_sets, config.max_posting_length):
        similarity = jaccard(token_sets[i], token_sets[j])
        if similarity >= cutoff:
            hits.append((i, j, similarity))
    hits.sort(key=lambda h: (-h[2], h[0], h[1]))
    return hits


# --- union-find over provenance evidence ---------------------------------------------------------


class _UnionFind:
    def __init__(self) -> None:
        self.parent: dict[int, int] = {}

    def find(self, x: int) -> int:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        # deterministic attachment direction (larger root under smaller) so group identity does
        # not depend on the order links happen to be discovered in
        if ra > rb:
            ra, rb = rb, ra
        self.parent[rb] = ra


def build_groups(
    examples: Sequence[ProcessedExample], config: ViceroyConfig
) -> tuple[list[int], dict]:
    """Builds provenance groups and returns ``(group_id_per_row, meta)``.

    Group ids are assigned in order of first appearance, so they are stable given a stable row
    order. ``meta`` records how many links each kind of evidence contributed, which is what makes
    the grouping auditable rather than a black box: if ``n_near_duplicate_links`` is 0 on a real
    corpus, the surrogate is not doing anything and the split is effectively row-level.

    Raises ``GroupPolicyError`` under ``group_policy="pmid"`` when the PMID is absent or partial.
    """
    uf = _UnionFind()
    for idx in range(len(examples)):
        uf.find(idx)

    # 1. exact normalized-text duplicates — always, under every policy including "row".
    rows_by_dedup_key: dict[str, list[int]] = defaultdict(list)
    for idx, e in enumerate(examples):
        rows_by_dedup_key[e.dedup_key].append(idx)
    n_exact_duplicate_rows = 0
    for _key, idxs in sorted(rows_by_dedup_key.items()):
        if len(idxs) > 1:
            n_exact_duplicate_rows += len(idxs) - 1
            for other in idxs[1:]:
                uf.union(idxs[0], other)

    # 2. PMID, when the policy asks for it and the data can actually supply it.
    n_pmid_links = 0
    if config.group_policy == "pmid":
        missing = [e.row_id for e in examples if e.pmid in (None, "")]
        if missing:
            raise GroupPolicyError(
                f"group_policy='pmid' but {len(missing)} of {len(examples)} row(s) have no pmid "
                f"(e.g. row_id {missing[:5]}). The released labelled corpus "
                "(pubmed_causal_language_use.csv) has only 'sentence' and 'label' columns, so "
                "this policy cannot be satisfied by it. Use group_policy='surrogate' — and see "
                "LEAKAGE.md for what that does and does not guarantee."
            )
        rows_by_pmid: dict[str, list[int]] = defaultdict(list)
        for idx, e in enumerate(examples):
            rows_by_pmid[str(e.pmid)].append(idx)
        for _pmid, idxs in sorted(rows_by_pmid.items()):
            for other in idxs[1:]:
                uf.union(idxs[0], other)
                n_pmid_links += 1

    # 3. lexical near-duplication — the surrogate for the missing paper id.
    n_near_duplicate_links = 0
    if config.group_policy in ("surrogate", "pmid"):
        for i, j, _similarity in near_duplicate_pairs(examples, config):
            if uf.find(i) != uf.find(j):
                n_near_duplicate_links += 1
            uf.union(i, j)

    root_to_group_id: dict[int, int] = {}
    group_ids: list[int] = []
    for idx in range(len(examples)):
        root = uf.find(idx)
        if root not in root_to_group_id:
            root_to_group_id[root] = len(root_to_group_id)
        group_ids.append(root_to_group_id[root])

    sizes: dict[int, int] = defaultdict(int)
    for gid in group_ids:
        sizes[gid] += 1
    largest = max(sizes.values()) if sizes else 0

    meta = {
        "n_groups": len(root_to_group_id),
        "n_rows": len(examples),
        "group_policy": config.group_policy,
        "n_exact_duplicate_rows": n_exact_duplicate_rows,
        "n_near_duplicate_links": n_near_duplicate_links,
        "n_pmid_links": n_pmid_links,
        "largest_group_size": largest,
        "n_multi_row_groups": sum(1 for s in sizes.values() if s > 1),
        "near_dup_jaccard": config.near_dup_jaccard,
    }
    return group_ids, meta


# --- stratified grouped fold assignment ----------------------------------------------------------


def assign_folds(
    examples: Sequence[ProcessedExample],
    group_ids: Sequence[int],
    n_folds: int,
) -> list[int]:
    """Assigns whole groups to folds, balancing **per-class** counts rather than only total size.

    This is the constructive half of the module. The heuristic is the standard stratified-grouped
    one: process groups from most-constraining to least (largest first, ties by rarest-class
    content, then by group id), and place each into whichever fold minimises the resulting
    imbalance across classes. Cost is the sum over classes of the standard deviation of that
    class's per-fold counts — so a fold that is already heavy in ``conditional_causal`` stops
    attracting more of it.

    Fully deterministic: no RNG, no seed. Re-running produces byte-identical fold assignments,
    which is what makes the split hashable and a rerun comparable.
    """
    rows_by_group: dict[int, list[int]] = defaultdict(list)
    for idx, gid in enumerate(group_ids):
        rows_by_group[gid].append(idx)

    class_index = {cls: i for i, cls in enumerate(CLASS_NAMES)}
    n_classes = len(CLASS_NAMES)

    global_counts = [0] * n_classes
    for e in examples:
        global_counts[class_index[e.label]] += 1
    # Rarest class first: used only as a deterministic ordering signal, so the groups that
    # constrain the scarce classes get to choose their fold before the abundant ones do.
    rarity_rank = sorted(range(n_classes), key=lambda c: (global_counts[c], c))

    group_class_counts: dict[int, list[int]] = {}
    for gid, idxs in rows_by_group.items():
        counts = [0] * n_classes
        for idx in idxs:
            counts[class_index[examples[idx].label]] += 1
        group_class_counts[gid] = counts

    def ordering_key(gid: int) -> tuple:
        counts = group_class_counts[gid]
        return (
            -sum(counts),  # largest groups first — they have the least placement freedom
            tuple(-counts[c] for c in rarity_rank),  # then those holding the scarcest classes
            gid,  # then a stable id, so the order never depends on dict iteration
        )

    ordered_groups = sorted(rows_by_group, key=ordering_key)

    fold_class_counts = [[0] * n_classes for _ in range(n_folds)]
    fold_sizes = [0] * n_folds
    fold_of_row = [-1] * len(examples)

    def imbalance_cost(counts_per_fold: list[list[int]]) -> float:
        total = 0.0
        for c in range(n_classes):
            column = [counts_per_fold[f][c] for f in range(n_folds)]
            mean = sum(column) / n_folds
            total += math.sqrt(sum((v - mean) ** 2 for v in column) / n_folds)
        return total

    for gid in ordered_groups:
        counts = group_class_counts[gid]
        best_fold = 0
        best_key: tuple[float, int, int] | None = None
        for f in range(n_folds):
            for c in range(n_classes):
                fold_class_counts[f][c] += counts[c]
            cost = imbalance_cost(fold_class_counts)
            for c in range(n_classes):
                fold_class_counts[f][c] -= counts[c]
            # tie-breaks: lower cost, then the emptier fold, then the lower fold index
            key = (cost, fold_sizes[f], f)
            if best_key is None or key < best_key:
                best_key = key
                best_fold = f

        for c in range(n_classes):
            fold_class_counts[best_fold][c] += counts[c]
        fold_sizes[best_fold] += sum(counts)
        for idx in rows_by_group[gid]:
            fold_of_row[idx] = best_fold

    return fold_of_row


# --- assertions (double-checks on the construction, not the mechanism) -----------------------------


def assert_no_cross_fold_leakage(
    examples: Sequence[ProcessedExample],
    fold_of_row: Sequence[int],
    group_ids: Sequence[int],
) -> None:
    """Raises SplitLeakageError if any group, exact normalized sentence, or PMID spans more than
    one fold. Reaching any of these after ``assign_folds`` means the assigner is broken — groups
    are assigned whole, and the other two keys are subsets of a group by construction."""
    group_to_folds: dict[int, set[int]] = defaultdict(set)
    for gid, f in zip(group_ids, fold_of_row):
        group_to_folds[gid].add(f)
    bad_groups = {g: sorted(fs) for g, fs in group_to_folds.items() if len(fs) > 1}
    if bad_groups:
        raise SplitLeakageError(
            f"{len(bad_groups)} group(s) span more than one fold — fold assignment is buggy, "
            f"since groups are assigned whole: {dict(list(bad_groups.items())[:5])}"
        )

    text_to_folds: dict[str, set[int]] = defaultdict(set)
    pmid_to_folds: dict[str, set[int]] = defaultdict(set)
    for e, f in zip(examples, fold_of_row):
        text_to_folds[e.dedup_key].add(f)
        if e.pmid not in (None, ""):
            pmid_to_folds[str(e.pmid)].add(f)

    for name, mapping in (
        ("exact normalized sentence", text_to_folds),
        ("pmid", pmid_to_folds),
    ):
        bad = {k: v for k, v in mapping.items() if len(v) > 1}
        if bad:
            example_key, example_folds = next(iter(sorted(bad.items())))
            raise SplitLeakageError(
                f"{len(bad)} {name} value(s) span more than one fold, e.g. {example_key!r} -> "
                f"folds {sorted(example_folds)}"
            )


def assert_min_class_support(
    fold_class_counts: dict[int, dict[str, int]], min_per_class_per_fold: int
) -> None:
    """Fails loudly rather than proceeding with a fold too thin in some class for a stable
    estimate. With the rarest class at 213 rows over 5 folds (~42/fold) the configured minimum of
    20 is comfortably reachable — so unlike the Zebra bundle, this firing is a genuine signal
    that group structure (a few very large groups, say) has distorted the split, not the expected
    cost of a small corpus.

    Raises InsufficientFoldSupportError listing every (fold, class) below the minimum.
    """
    violations = [
        (f, cls, n)
        for f, counts in sorted(fold_class_counts.items())
        for cls, n in sorted(counts.items())
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


# --- the residual audit: what the grouping did NOT catch ------------------------------------------


def residual_leakage_audit(
    examples: Sequence[ProcessedExample],
    fold_of_row: Sequence[int],
    config: ViceroyConfig,
) -> dict:
    """Reports near-duplicate pairs that still cross a fold boundary, scored at the *lower*
    ``config.audit_jaccard`` threshold.

    This is the most important number this module produces, and the one a summary is most likely
    to omit. Grouping at ``near_dup_jaccard`` guarantees nothing about pairs just below it: two
    sentences from one paper at similarity 0.65 are still one paper. Reporting them keeps the
    claim honest — "leakage controlled down to similarity X, with N residual pairs between X and
    the threshold" — instead of the unsupportable "no leakage".

    ``n_above_threshold_crossing`` must be 0. Anything else means grouping and assignment
    disagree, i.e. a bug in this module rather than a property of the data.
    """
    pairs = near_duplicate_pairs(examples, config, threshold=config.audit_jaccard)
    crossing = [(i, j, s) for i, j, s in pairs if fold_of_row[i] != fold_of_row[j]]
    above = [p for p in crossing if p[2] >= config.near_dup_jaccard]

    def describe(pair: tuple[int, int, float]) -> dict:
        i, j, similarity = pair
        return {
            "jaccard": round(similarity, 4),
            "fold_a": fold_of_row[i],
            "fold_b": fold_of_row[j],
            "row_id_a": examples[i].row_id,
            "row_id_b": examples[j].row_id,
            "label_a": examples[i].label,
            "label_b": examples[j].label,
            "sentence_a": examples[i].sentence_text[:160],
            "sentence_b": examples[j].sentence_text[:160],
        }

    return {
        "audit_jaccard": config.audit_jaccard,
        "grouping_jaccard": config.near_dup_jaccard,
        "n_pairs_scanned": len(pairs),
        "n_crossing_folds": len(crossing),
        "n_above_threshold_crossing": len(above),
        "worst_examples": [describe(p) for p in crossing[:10]],
        "interpretation": (
            "n_above_threshold_crossing must be 0 (a non-zero value is a bug in fold assignment, "
            "not a data property). n_crossing_folds counts pairs between audit_jaccard and the "
            "grouping threshold that this policy deliberately did not group — report this number "
            "rather than claiming the split is leakage-free."
        ),
    }


# --- reporting tables ---------------------------------------------------------------------------


def fold_class_table(
    examples: Sequence[ProcessedExample], fold_of_row: Sequence[int], n_folds: int
) -> dict[int, dict[str, int]]:
    """fold -> class -> row count, as a plain dict (every fold/class combination present, even if
    zero, so a missing key never silently reads as "no data to check")."""
    table: dict[int, dict[str, int]] = {f: {c: 0 for c in CLASS_NAMES} for f in range(n_folds)}
    for e, f in zip(examples, fold_of_row):
        table[f][e.label] += 1
    return table


def fold_group_table(
    fold_of_row: Sequence[int], group_ids: Sequence[int], n_folds: int
) -> dict[int, int]:
    """fold -> number of distinct groups in that fold, as a plain dict."""
    groups_by_fold: dict[int, set[int]] = {f: set() for f in range(n_folds)}
    for gid, f in zip(group_ids, fold_of_row):
        groups_by_fold[f].add(gid)
    return {f: len(s) for f, s in groups_by_fold.items()}


# --- orchestrator ---------------------------------------------------------------------------------


def build_splits(
    examples: Sequence[ProcessedExample], config: ViceroyConfig
) -> tuple[list[ProcessedExample], SplitResult]:
    """Runs the full pipeline: drop conflicting labels -> build groups -> stratified grouped fold
    assignment -> leakage assertions -> reporting tables -> minimum-support check -> residual
    audit.

    Returns ``(kept_examples, SplitResult)``. The kept list is returned alongside the result
    because dropping conflicting-label rows changes row indices, and ``fold_of_row`` indexes the
    *kept* list — returning the two together makes it impossible to line the wrong pair up.

    Raises (does not return a partial/invalid result) if any assertion fails.
    """
    if config.drop_conflicting_labels:
        kept, dropped = drop_conflicting_label_rows(examples)
    else:
        kept, dropped = list(examples), []

    if not kept:
        raise ValueError("no examples left after dropping conflicting-label rows")

    group_ids, group_meta = build_groups(kept, config)
    fold_of_row = assign_folds(kept, group_ids, config.n_folds)

    assert_no_cross_fold_leakage(kept, fold_of_row, group_ids)

    class_table = fold_class_table(kept, fold_of_row, config.n_folds)
    group_table = fold_group_table(fold_of_row, group_ids, config.n_folds)

    assert_min_class_support(class_table, config.min_per_class_per_fold)

    audit = residual_leakage_audit(kept, fold_of_row, config)
    audit["group_meta"] = group_meta
    audit["n_conflicting_rows_dropped"] = len(dropped)

    return kept, SplitResult(
        fold_of_row=tuple(fold_of_row),
        group_ids=tuple(group_ids),
        fold_class_counts=class_table,
        fold_group_counts=group_table,
        n_groups=group_meta["n_groups"],
        n_folds=config.n_folds,
        group_policy=config.group_policy,
        n_exact_duplicate_rows=group_meta["n_exact_duplicate_rows"],
        n_near_duplicate_links=group_meta["n_near_duplicate_links"],
        n_pmid_links=group_meta["n_pmid_links"],
        n_conflicting_rows_dropped=len(dropped),
        kept_row_ids=tuple(e.row_id for e in kept),
        leakage_audit=audit,
    )
