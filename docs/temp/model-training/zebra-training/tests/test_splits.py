"""Tests for zebra.splits — component-grouped folds and leakage assertions.

Builds ProcessedExample rows directly (bypassing build_example/build_dataset, which need a
tokenizer) since splits.py only cares about claim_id/abstract_id/claim_text/label — a real
tokenizer contributes nothing to these tests.
"""

import unittest

from zebra.config import ZebraConfig
from zebra.data import ProcessedExample
from zebra.splits import (
    InsufficientFoldSupportError,
    SplitLeakageError,
    assert_min_class_support,
    assert_no_cross_fold_leakage,
    assert_no_train_dev_leakage,
    assign_folds,
    build_components,
    build_splits,
    dedupe_rows,
    fold_class_table,
    fold_component_table,
)


def _row(claim_id, abstract_id, claim_text, label, split="train") -> ProcessedExample:
    return ProcessedExample(
        example_id=f"{split}:{claim_id}:{abstract_id}",
        claim_id=claim_id,
        abstract_id=abstract_id,
        split=split,
        source_sentence_ids=(0,),
        claim_text=claim_text,
        evidence_text="some evidence sentence",
        label=label,
        evidence_method="retrieved",
        claim_token_count=3,
        evidence_token_count=3,
        total_token_count=6,
        gold_overlap=None,
        preprocessing_version="test-version",
        raw_source_hash="deadbeef",
    )


class TestDedupeAndComponents(unittest.TestCase):
    def test_shared_abstract_joins_component(self):
        rows = [
            _row("c1", "a1", "claim one", "supported"),
            _row("c2", "a1", "claim two", "contradicted"),  # shares abstract with c1
            _row("c3", "a2", "claim three", "insufficient_evidence"),
        ]
        component_ids, meta = build_components(rows)
        self.assertEqual(component_ids[0], component_ids[1])  # c1, c2 share a component
        self.assertNotEqual(component_ids[0], component_ids[2])
        self.assertEqual(meta["n_components"], 2)

    def test_duplicate_claim_text_detected(self):
        rows = [
            _row("c1", "a1", "identical claim text", "supported"),
            _row("c2", "a2", "identical claim text", "contradicted"),
        ]
        _claim_key, _abstract_key, n_claim_collisions, n_abstract_collisions = dedupe_rows(rows)
        self.assertEqual(n_claim_collisions, 1)
        self.assertEqual(n_abstract_collisions, 0)

    def test_duplicate_claim_text_collapses_component(self):
        # Same claim_text under two different claim_ids should be treated as one graph node,
        # so a shared claim_text plus distinct abstracts still forms one component.
        rows = [
            _row("c1", "a1", "identical claim text", "supported"),
            _row("c2", "a2", "identical claim text", "contradicted"),
        ]
        component_ids, _meta = build_components(rows)
        self.assertEqual(component_ids[0], component_ids[1])


class TestAssignFoldsDeterminism(unittest.TestCase):
    def test_deterministic_given_same_inputs(self):
        rows = [_row(f"c{i}", f"a{i}", f"claim number {i}", "supported") for i in range(10)]
        component_ids, _meta = build_components(rows)
        first = assign_folds(rows, component_ids, n_folds=3, seed=42)
        second = assign_folds(rows, component_ids, n_folds=3, seed=999)  # seed is a no-op
        self.assertEqual(first, second)

    def test_every_row_assigned(self):
        rows = [_row(f"c{i}", f"a{i}", f"claim number {i}", "supported") for i in range(7)]
        component_ids, _meta = build_components(rows)
        fold_of_row = assign_folds(rows, component_ids, n_folds=3, seed=0)
        self.assertTrue(all(f >= 0 for f in fold_of_row))
        self.assertEqual(len(fold_of_row), len(rows))


class TestLeakageAssertions(unittest.TestCase):
    def test_no_leakage_passes_silently(self):
        rows = [_row(f"c{i}", f"a{i}", f"claim number {i}", "supported") for i in range(4)]
        component_ids, _meta = build_components(rows)
        fold_of_row = [0, 0, 1, 1]
        assert_no_cross_fold_leakage(rows, fold_of_row, component_ids)  # must not raise

    def test_component_split_across_folds_raises(self):
        rows = [
            _row("c1", "a1", "claim one", "supported"),
            _row("c2", "a1", "claim two", "contradicted"),  # same abstract -> same component
        ]
        component_ids, _meta = build_components(rows)
        bad_fold_of_row = [0, 1]  # manually forces the shared component across two folds
        with self.assertRaises(SplitLeakageError):
            assert_no_cross_fold_leakage(rows, bad_fold_of_row, component_ids)

    def test_train_dev_shared_claim_raises(self):
        train_rows = [_row("c1", "a1", "claim one", "supported")]
        dev_rows = [_row("c1", "a2", "claim one but different abstract", "contradicted")]
        with self.assertRaises(SplitLeakageError):
            assert_no_train_dev_leakage(train_rows, dev_rows)

    def test_train_dev_disjoint_passes(self):
        train_rows = [_row("c1", "a1", "claim one", "supported")]
        dev_rows = [_row("c2", "a2", "claim two", "contradicted")]
        assert_no_train_dev_leakage(train_rows, dev_rows)  # must not raise


class TestReportingTablesAndMinSupport(unittest.TestCase):
    def test_fold_class_table_has_all_fold_class_combinations(self):
        rows = [_row("c1", "a1", "claim one", "supported"), _row("c2", "a2", "claim two", "contradicted")]
        fold_of_row = [0, 1]
        table = fold_class_table(rows, fold_of_row, n_folds=2)
        self.assertEqual(set(table.keys()), {0, 1})
        for f in (0, 1):
            self.assertEqual(set(table[f].keys()), {"supported", "contradicted", "insufficient_evidence"})

    def test_fold_component_table_counts(self):
        rows = [_row("c1", "a1", "claim one", "supported"), _row("c2", "a2", "claim two", "contradicted")]
        component_ids, _meta = build_components(rows)
        fold_of_row = [0, 1]
        table = fold_component_table(fold_of_row, component_ids, n_folds=2)
        self.assertEqual(table, {0: 1, 1: 1})

    def test_insufficient_support_raises(self):
        table = {0: {"supported": 5, "contradicted": 0, "insufficient_evidence": 5}, 1: {"supported": 5, "contradicted": 5, "insufficient_evidence": 5}}
        with self.assertRaises(InsufficientFoldSupportError):
            assert_min_class_support(table, min_per_class_per_fold=1)

    def test_sufficient_support_passes(self):
        table = {0: {"supported": 5, "contradicted": 5, "insufficient_evidence": 5}}
        assert_min_class_support(table, min_per_class_per_fold=1)  # must not raise


class TestBuildSplitsEndToEnd(unittest.TestCase):
    def _synthetic_rows(self, n_per_class=6):
        rows = []
        i = 0
        for label in ("supported", "contradicted", "insufficient_evidence"):
            for _ in range(n_per_class):
                rows.append(_row(f"c{i}", f"a{i}", f"unique claim number {i}", label))
                i += 1
        return rows

    def test_succeeds_with_adequate_support(self):
        config = ZebraConfig(n_folds=2, min_per_class_per_fold=1)
        train_rows = self._synthetic_rows(n_per_class=6)
        dev_rows = [_row("cdev1", "adev1", "a totally separate dev claim", "supported", split="dev")]
        result = build_splits(train_rows, dev_rows, config)
        self.assertEqual(result.n_folds, 2)
        self.assertEqual(len(result.fold_of_row), len(train_rows))

    def test_raises_when_support_too_thin(self):
        config = ZebraConfig(n_folds=5, min_per_class_per_fold=10)
        train_rows = self._synthetic_rows(n_per_class=2)  # far too few for 5 folds x 10/class
        dev_rows = []
        with self.assertRaises(InsufficientFoldSupportError):
            build_splits(train_rows, dev_rows, config)


if __name__ == "__main__":
    unittest.main()
