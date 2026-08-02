"""Tests for viceroy.splits — the leakage-control module. The most important file in this bundle.

Two things are being proved here, and they are different:

  1. **Construction.** Folds are built so the invariants hold — whole groups land in one fold,
     exact duplicates cannot separate, classes stay balanced. This is what the Zebra bundle
     lacked: there, size-only assignment was checked afterwards by an assertion that could only
     ever report failure, never prevent it.

  2. **Honest limits.** The near-duplicate surrogate does NOT recover same-paper clusters in
     general, and ``residual_leakage_audit`` is expected to report a non-zero number. A test that
     asserted "no leakage" would be asserting something the design cannot deliver — see
     ``TestResidualAuditIsHonest``.

Builds ProcessedExample rows directly (bypassing build_example, which needs a tokenizer) where
only the split-relevant fields matter.
"""

import dataclasses
import unittest

from viceroy.config import ViceroyConfig
from viceroy.data import ProcessedExample, dedup_key_for, normalize_text
from viceroy.splits import (
    GroupPolicyError,
    InsufficientFoldSupportError,
    SplitLeakageError,
    assert_min_class_support,
    assert_no_cross_fold_leakage,
    assign_folds,
    build_groups,
    build_splits,
    candidate_pairs,
    drop_conflicting_label_rows,
    fold_class_table,
    fold_group_table,
    jaccard,
    near_duplicate_pairs,
    residual_leakage_audit,
)

CLASSES = ("no_relationship", "direct_causal", "conditional_causal", "correlational")


def _row(row_id: int, text: str, label: str, pmid=None) -> ProcessedExample:
    normalized = normalize_text(text)
    return ProcessedExample(
        example_id=f"row:{row_id}",
        row_id=row_id,
        pmid=pmid,
        sentence_text=normalized,
        label=label,
        native_label_id=CLASSES.index(label),
        token_count=len(normalized.split()),
        dedup_key=dedup_key_for(normalized),
        preprocessing_version="test-version",
        raw_source_hash=f"hash-{row_id}",
    )


def _balanced_rows(n_per_class: int = 12) -> list[ProcessedExample]:
    """Distinct rows, evenly spread over the four classes, with no accidental near-duplicates."""
    rows = []
    rid = 0
    for c_i, cls in enumerate(CLASSES):
        for k in range(n_per_class):
            rows.append(_row(rid, f"class{c_i} sentence{k} unique{rid} filler{rid * 7}", cls))
            rid += 1
    return rows


def _small_config(**overrides) -> ViceroyConfig:
    base = {"n_folds": 3, "min_per_class_per_fold": 1}
    base.update(overrides)
    return ViceroyConfig(**base)


class TestJaccardAndCandidates(unittest.TestCase):
    def test_identical_sets(self):
        self.assertEqual(jaccard(frozenset({"a", "b"}), frozenset({"a", "b"})), 1.0)

    def test_disjoint_sets(self):
        self.assertEqual(jaccard(frozenset({"a"}), frozenset({"b"})), 0.0)

    def test_empty_set_is_never_a_perfect_match(self):
        """Two empty sentences share no evidence of provenance; calling that 1.0 would merge
        unrelated degenerate rows into one group."""
        self.assertEqual(jaccard(frozenset(), frozenset()), 0.0)
        self.assertEqual(jaccard(frozenset(), frozenset({"a"})), 0.0)

    def test_common_tokens_are_skipped_by_the_posting_cap(self):
        """A token in more rows than the cap is too common to indicate shared provenance; without
        the cap this would be quadratic in corpus size for no recall gain."""
        token_sets = [frozenset({"common"}) for _ in range(10)]
        self.assertEqual(candidate_pairs(token_sets, max_posting_length=5), set())
        self.assertEqual(len(candidate_pairs(token_sets, max_posting_length=20)), 45)

    def test_candidate_pairs_are_ordered_low_high(self):
        token_sets = [frozenset({"rare"}), frozenset({"rare"})]
        self.assertEqual(candidate_pairs(token_sets, max_posting_length=10), {(0, 1)})


class TestNearDuplicateDetection(unittest.TestCase):
    def test_near_duplicates_are_found_and_sorted(self):
        # 8 shared tokens + 1 unique each -> jaccard 8/10 = 0.80, exactly at the threshold.
        rows = [
            _row(0, "alpha beta gamma delta epsilon zeta eta theta iota", "no_relationship"),
            _row(1, "alpha beta gamma delta epsilon zeta eta theta kappa", "no_relationship"),
            _row(2, "totally different words entirely here", "correlational"),
        ]
        hits = near_duplicate_pairs(rows, _small_config())
        self.assertEqual([(i, j) for i, j, _s in hits], [(0, 1)])

    def test_threshold_is_respected(self):
        rows = [
            _row(0, "alpha beta gamma delta", "no_relationship"),
            _row(1, "alpha beta epsilon zeta", "no_relationship"),
        ]
        config = _small_config()
        self.assertEqual(near_duplicate_pairs(rows, config), [])  # 0.33 < 0.80
        loose = dataclasses.replace(config, near_dup_jaccard=0.3, audit_jaccard=0.3)
        self.assertEqual(len(near_duplicate_pairs(rows, loose)), 1)


class TestGrouping(unittest.TestCase):
    def test_exact_duplicates_always_share_a_group(self):
        rows = [
            _row(0, "identical sentence text", "no_relationship"),
            _row(1, "identical  sentence text", "no_relationship"),
            _row(2, "a completely separate sentence", "correlational"),
        ]
        group_ids, meta = build_groups(rows, _small_config())
        self.assertEqual(group_ids[0], group_ids[1])
        self.assertNotEqual(group_ids[0], group_ids[2])
        self.assertEqual(meta["n_exact_duplicate_rows"], 1)

    def test_exact_duplicates_are_grouped_even_under_row_policy(self):
        """`row` disables the surrogate, not basic sanity: an identical sentence in two folds is
        indefensible under any policy."""
        rows = [
            _row(0, "identical sentence text", "no_relationship"),
            _row(1, "identical sentence text", "no_relationship"),
        ]
        group_ids, _meta = build_groups(rows, _small_config(group_policy="row"))
        self.assertEqual(group_ids[0], group_ids[1])

    def test_near_duplicates_are_grouped_under_surrogate_but_not_row(self):
        rows = [
            _row(0, "alpha beta gamma delta epsilon zeta eta theta iota", "no_relationship"),
            _row(1, "alpha beta gamma delta epsilon zeta eta theta kappa", "no_relationship"),
        ]
        surrogate, _ = build_groups(rows, _small_config(group_policy="surrogate"))
        self.assertEqual(surrogate[0], surrogate[1])

        row_policy, meta = build_groups(rows, _small_config(group_policy="row"))
        self.assertNotEqual(row_policy[0], row_policy[1])
        self.assertEqual(meta["n_near_duplicate_links"], 0)

    def test_grouping_is_transitive(self):
        """A links to B, B links to C, so all three must share a group even though A and C are
        not similar enough to link directly."""
        # A-B and B-C are both exactly 0.80; A-C is 7/11 = 0.64, below the threshold.
        rows = [
            _row(0, "t1 t2 t3 t4 t5 t6 t7 t8 aaa", "no_relationship"),
            _row(1, "t1 t2 t3 t4 t5 t6 t7 t8 bbb", "no_relationship"),
            _row(2, "t1 t2 t3 t4 t5 t6 t7 bbb ccc", "no_relationship"),
        ]
        self.assertEqual(
            [(i, j) for i, j, _s in near_duplicate_pairs(rows, _small_config())],
            [(0, 1), (1, 2)],
        )
        group_ids, _meta = build_groups(rows, _small_config())
        self.assertEqual(len(set(group_ids)), 1)

    def test_pmid_policy_fails_closed_when_pmid_missing(self):
        """The released corpus has no PMID. Silently degrading to row-level splitting is exactly
        the failure this module exists to prevent, so it must raise."""
        rows = [_row(0, "some sentence here", "no_relationship")]
        with self.assertRaises(GroupPolicyError) as ctx:
            build_groups(rows, _small_config(group_policy="pmid"))
        self.assertIn("pubmed_causal_language_use.csv", str(ctx.exception))

    def test_pmid_policy_fails_closed_when_pmid_is_partial(self):
        rows = [
            _row(0, "sentence one here", "no_relationship", pmid="111"),
            _row(1, "sentence two here", "correlational", pmid=None),
        ]
        with self.assertRaises(GroupPolicyError):
            build_groups(rows, _small_config(group_policy="pmid"))

    def test_pmid_policy_groups_by_paper_when_available(self):
        rows = [
            _row(0, "wholly unrelated wording one", "no_relationship", pmid="111"),
            _row(1, "entirely distinct phrasing two", "correlational", pmid="111"),
            _row(2, "third separate utterance three", "direct_causal", pmid="222"),
        ]
        group_ids, meta = build_groups(rows, _small_config(group_policy="pmid"))
        self.assertEqual(group_ids[0], group_ids[1])
        self.assertNotEqual(group_ids[0], group_ids[2])
        self.assertEqual(meta["n_pmid_links"], 1)

    def test_group_ids_are_deterministic(self):
        rows = _balanced_rows(4)
        first, _ = build_groups(rows, _small_config())
        second, _ = build_groups(rows, _small_config())
        self.assertEqual(first, second)


class TestConflictingLabels(unittest.TestCase):
    def test_both_copies_are_dropped(self):
        """There is no principled way to pick the right annotation, so keeping either would inject
        a coin flip into the supervision."""
        rows = [
            _row(0, "contested sentence", "no_relationship"),
            _row(1, "contested sentence", "conditional_causal"),
            _row(2, "uncontested sentence", "correlational"),
        ]
        kept, dropped = drop_conflicting_label_rows(rows)
        self.assertEqual([r.row_id for r in kept], [2])
        self.assertEqual(len(dropped), 2)

    def test_agreeing_duplicates_are_kept(self):
        rows = [
            _row(0, "agreed sentence", "no_relationship"),
            _row(1, "agreed sentence", "no_relationship"),
        ]
        kept, dropped = drop_conflicting_label_rows(rows)
        self.assertEqual(len(kept), 2)
        self.assertEqual(dropped, [])


class TestFoldAssignment(unittest.TestCase):
    def test_every_row_is_assigned(self):
        rows = _balanced_rows()
        group_ids, _ = build_groups(rows, _small_config())
        folds = assign_folds(rows, group_ids, 3)
        self.assertEqual(len(folds), len(rows))
        self.assertTrue(all(0 <= f < 3 for f in folds))

    def test_groups_are_never_split(self):
        rows = [
            _row(0, "shared alpha beta gamma delta epsilon zeta eta iota", "no_relationship"),
            _row(1, "shared alpha beta gamma delta epsilon zeta eta kappa", "correlational"),
        ] + _balanced_rows(6)
        group_ids, _ = build_groups(rows, _small_config())
        folds = assign_folds(rows, group_ids, 3)
        self.assertEqual(folds[0], folds[1])

    def test_classes_are_balanced_across_folds(self):
        """This is the constructive guarantee. Size-only balancing (the Zebra approach) makes no
        such promise and then asserts against it afterwards."""
        rows = _balanced_rows(12)
        group_ids, _ = build_groups(rows, _small_config())
        folds = assign_folds(rows, group_ids, 3)
        table = fold_class_table(rows, folds, 3)
        for cls in CLASSES:
            counts = [table[f][cls] for f in range(3)]
            self.assertLessEqual(max(counts) - min(counts), 1, f"{cls} unbalanced: {counts}")

    def test_assignment_is_deterministic_and_seed_free(self):
        rows = _balanced_rows(8)
        group_ids, _ = build_groups(rows, _small_config())
        self.assertEqual(assign_folds(rows, group_ids, 3), assign_folds(rows, group_ids, 3))


class TestLeakageAssertions(unittest.TestCase):
    def test_clean_split_passes(self):
        rows = _balanced_rows(6)
        group_ids, _ = build_groups(rows, _small_config())
        folds = assign_folds(rows, group_ids, 3)
        assert_no_cross_fold_leakage(rows, folds, group_ids)

    def test_split_group_raises(self):
        rows = [
            _row(0, "alpha beta gamma delta", "no_relationship"),
            _row(1, "alpha beta gamma delta", "no_relationship"),
        ]
        with self.assertRaises(SplitLeakageError) as ctx:
            assert_no_cross_fold_leakage(rows, [0, 1], [0, 0])
        self.assertIn("group", str(ctx.exception))

    def test_duplicate_text_across_folds_raises(self):
        rows = [
            _row(0, "identical text", "no_relationship"),
            _row(1, "identical text", "no_relationship"),
        ]
        with self.assertRaises(SplitLeakageError) as ctx:
            assert_no_cross_fold_leakage(rows, [0, 1], [0, 1])
        self.assertIn("exact normalized sentence", str(ctx.exception))

    def test_shared_pmid_across_folds_raises(self):
        rows = [
            _row(0, "one distinct sentence", "no_relationship", pmid="777"),
            _row(1, "another distinct sentence", "correlational", pmid="777"),
        ]
        with self.assertRaises(SplitLeakageError) as ctx:
            assert_no_cross_fold_leakage(rows, [0, 1], [0, 1])
        self.assertIn("pmid", str(ctx.exception))

    def test_min_class_support_raises_and_lists_every_violation(self):
        table = {0: {c: 5 for c in CLASSES}, 1: {c: 5 for c in CLASSES}}
        table[1]["conditional_causal"] = 1
        with self.assertRaises(InsufficientFoldSupportError) as ctx:
            assert_min_class_support(table, 5)
        self.assertIn("conditional_causal", str(ctx.exception))

    def test_min_class_support_passes_at_the_boundary(self):
        assert_min_class_support({0: {c: 5 for c in CLASSES}}, 5)


class TestResidualAuditIsHonest(unittest.TestCase):
    """The audit's job is to report what grouping did NOT catch. A test asserting the residual is
    zero would be asserting something a similarity threshold cannot deliver."""

    def test_pairs_below_the_grouping_threshold_are_reported_when_they_cross_folds(self):
        rows = [
            _row(0, "aa bb cc dd ee ff", "no_relationship"),
            _row(1, "aa bb cc dd xx yy", "correlational"),  # jaccard 0.5: below 0.8, above 0.6? no
        ]
        config = _small_config(near_dup_jaccard=0.8, audit_jaccard=0.4)
        audit = residual_leakage_audit(rows, [0, 1], config)
        self.assertEqual(audit["n_crossing_folds"], 1)
        self.assertEqual(audit["n_above_threshold_crossing"], 0)
        self.assertEqual(audit["worst_examples"][0]["fold_a"], 0)

    def test_same_fold_pairs_are_not_counted_as_leakage(self):
        rows = [
            _row(0, "aa bb cc dd ee ff", "no_relationship"),
            _row(1, "aa bb cc dd xx yy", "correlational"),
        ]
        audit = residual_leakage_audit(
            rows, [0, 0], _small_config(near_dup_jaccard=0.8, audit_jaccard=0.4)
        )
        self.assertEqual(audit["n_crossing_folds"], 0)

    def test_above_threshold_crossing_signals_a_bug_not_a_data_property(self):
        rows = [
            _row(0, "aa bb cc dd ee ff gg", "no_relationship"),
            _row(1, "aa bb cc dd ee ff hh", "no_relationship"),
        ]
        audit = residual_leakage_audit(
            rows, [0, 1], _small_config(near_dup_jaccard=0.6, audit_jaccard=0.4)
        )
        self.assertEqual(audit["n_above_threshold_crossing"], 1)

    def test_a_real_split_reports_zero_above_threshold(self):
        rows = _balanced_rows(8)
        _kept, split = build_splits(rows, _small_config())
        self.assertEqual(split.leakage_audit["n_above_threshold_crossing"], 0)


class TestBuildSplits(unittest.TestCase):
    def test_end_to_end(self):
        rows = _balanced_rows(9)
        kept, split = build_splits(rows, _small_config())
        self.assertEqual(len(kept), len(rows))
        self.assertEqual(len(split.fold_of_row), len(kept))
        self.assertEqual(split.n_folds, 3)
        self.assertEqual(split.group_policy, "surrogate")
        self.assertEqual(sum(split.fold_group_counts.values()), split.n_groups)

    def test_conflicting_rows_are_dropped_and_counted(self):
        rows = _balanced_rows(9) + [
            _row(900, "contested sentence text", "no_relationship"),
            _row(901, "contested sentence text", "direct_causal"),
        ]
        kept, split = build_splits(rows, _small_config())
        self.assertEqual(split.n_conflicting_rows_dropped, 2)
        self.assertNotIn(900, [r.row_id for r in kept])

    def test_fold_of_row_indexes_the_kept_list(self):
        """build_splits returns (kept, result) together precisely so these cannot be misaligned:
        dropping rows shifts indices, and fold_of_row indexes the KEPT list."""
        rows = _balanced_rows(9) + [
            _row(900, "contested sentence text", "no_relationship"),
            _row(901, "contested sentence text", "direct_causal"),
        ]
        kept, split = build_splits(rows, _small_config())
        self.assertEqual(len(kept), len(split.fold_of_row))
        self.assertEqual(tuple(r.row_id for r in kept), split.kept_row_ids)

    def test_keeping_conflicting_rows_is_possible_but_opt_in(self):
        rows = _balanced_rows(9) + [
            _row(900, "contested sentence text", "no_relationship"),
            _row(901, "contested sentence text", "direct_causal"),
        ]
        kept, split = build_splits(rows, _small_config(drop_conflicting_labels=False))
        self.assertEqual(split.n_conflicting_rows_dropped, 0)
        self.assertEqual(len(kept), len(rows))

    def test_insufficient_support_propagates(self):
        rows = _balanced_rows(2)  # 2 rows per class over 3 folds cannot give 2 per fold
        with self.assertRaises(InsufficientFoldSupportError):
            build_splits(rows, _small_config(min_per_class_per_fold=2))

    def test_empty_after_dropping_raises(self):
        rows = [
            _row(0, "contested sentence", "no_relationship"),
            _row(1, "contested sentence", "direct_causal"),
        ]
        with self.assertRaises(ValueError):
            build_splits(rows, _small_config())

    def test_fold_group_table_counts_distinct_groups(self):
        rows = _balanced_rows(6)
        group_ids, _ = build_groups(rows, _small_config())
        folds = assign_folds(rows, group_ids, 3)
        table = fold_group_table(folds, group_ids, 3)
        self.assertEqual(sum(table.values()), len(set(group_ids)))

    def test_deterministic_across_runs(self):
        rows = _balanced_rows(7)
        _k1, first = build_splits(rows, _small_config())
        _k2, second = build_splits(rows, _small_config())
        self.assertEqual(first.fold_of_row, second.fold_of_row)


if __name__ == "__main__":
    unittest.main()
