"""Tests for zebra.metrics — confusion matrix / prf1 / Brier / ECE / bootstrap / abstention /
temperature scaling / baselines, plus the "raise, don't silently return 0.0" input-validation
contract.
"""

import unittest

from zebra.metrics import (
    MetricsError,
    abstention_and_selective_error,
    apply_temperature,
    balanced_accuracy,
    bootstrap_ci_by_component,
    bootstrap_macro_f1_ci,
    confusion_matrix,
    ece_equal_mass,
    fit_temperature,
    lexical_overlap_baseline_predict,
    macro_f1,
    majority_class_label,
    majority_class_probs,
    multiclass_brier,
    per_class_prf1,
)

CLASSES = ("supported", "contradicted", "insufficient_evidence")


class TestConfusionMatrixAndPrf1(unittest.TestCase):
    def test_perfect_predictions(self):
        y_true = ["supported", "contradicted", "insufficient_evidence"]
        cm = confusion_matrix(y_true, y_true)
        self.assertEqual(cm, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
        per_class = per_class_prf1(cm)
        for cls in CLASSES:
            self.assertEqual(per_class[cls]["precision"], 1.0)
            self.assertEqual(per_class[cls]["recall"], 1.0)
            self.assertEqual(per_class[cls]["f1"], 1.0)
        self.assertEqual(macro_f1(per_class), 1.0)
        self.assertEqual(balanced_accuracy(cm), 1.0)

    def test_all_wrong(self):
        y_true = ["supported", "supported"]
        y_pred = ["contradicted", "contradicted"]
        cm = confusion_matrix(y_true, y_pred)
        per_class = per_class_prf1(cm)
        self.assertEqual(per_class["supported"]["recall"], 0.0)
        self.assertEqual(macro_f1(per_class), 0.0)

    def test_unknown_label_raises(self):
        with self.assertRaises(MetricsError):
            confusion_matrix(["not_a_real_class"], ["supported"])

    def test_empty_input_raises_not_zero(self):
        with self.assertRaises(MetricsError):
            confusion_matrix([], [])

    def test_mismatched_lengths_raises(self):
        with self.assertRaises(MetricsError):
            confusion_matrix(["supported", "supported"], ["supported"])


class TestBrier(unittest.TestCase):
    def test_perfect_confident_prediction_is_zero(self):
        y_true = ["supported"]
        probs = [[1.0, 0.0, 0.0]]
        self.assertAlmostEqual(multiclass_brier(y_true, probs, CLASSES), 0.0)

    def test_confident_wrong_prediction_is_two(self):
        y_true = ["supported"]
        probs = [[0.0, 1.0, 0.0]]
        self.assertAlmostEqual(multiclass_brier(y_true, probs, CLASSES), 2.0)

    def test_out_of_range_probability_raises(self):
        with self.assertRaises(MetricsError):
            multiclass_brier(["supported"], [[1.5, -0.5, 0.0]], CLASSES)

    def test_empty_input_raises(self):
        with self.assertRaises(MetricsError):
            multiclass_brier([], [], CLASSES)


class TestEceEqualMass(unittest.TestCase):
    def test_perfectly_calibrated_is_near_zero(self):
        # 10 rows, confidence == accuracy exactly within each half -> ECE should be tiny.
        y_true = ["supported"] * 5 + ["contradicted"] * 5
        probs = [[0.9, 0.05, 0.05]] * 5 + [[0.05, 0.9, 0.05]] * 5
        result = ece_equal_mass(y_true, probs, CLASSES, n_bins=2)
        self.assertLess(result["ece"], 0.15)
        self.assertEqual(result["n_bins"], 2)
        self.assertEqual(sum(b["n"] for b in result["bins"]), 10)

    def test_equal_mass_bins_have_balanced_counts(self):
        y_true = ["supported"] * 10
        probs = [[0.5 + i * 0.01, 0.3, 0.2 - i * 0.01] for i in range(10)]
        result = ece_equal_mass(y_true, probs, CLASSES, n_bins=5)
        counts = [b["n"] for b in result["bins"]]
        self.assertTrue(max(counts) - min(counts) <= 1)

    def test_n_bins_less_than_one_raises(self):
        with self.assertRaises(MetricsError):
            ece_equal_mass(["supported"], [[1.0, 0.0, 0.0]], CLASSES, n_bins=0)

    def test_empty_input_raises(self):
        with self.assertRaises(MetricsError):
            ece_equal_mass([], [], CLASSES, n_bins=5)


class TestAbstentionAndSelectiveError(unittest.TestCase):
    def test_known_coverage_and_error(self):
        y_true = ["supported", "supported", "contradicted", "contradicted"]
        probs = [
            [0.9, 0.05, 0.05],  # correct, high confidence
            [0.55, 0.4, 0.05],  # correct, low confidence
            [0.1, 0.85, 0.05],  # correct, high confidence
            [0.6, 0.35, 0.05],  # WRONG (predicted supported), moderate confidence
        ]
        results = abstention_and_selective_error(y_true, probs, CLASSES, thresholds=(0.5, 0.8))
        at_50 = results[0.5]
        self.assertEqual(at_50["n_answered"], 4)
        self.assertEqual(at_50["coverage"], 1.0)
        self.assertAlmostEqual(at_50["selective_error"], 1 / 4)

        at_80 = results[0.8]
        self.assertEqual(at_80["n_answered"], 2)
        self.assertEqual(at_80["coverage"], 0.5)
        self.assertEqual(at_80["selective_error"], 0.0)  # both high-confidence rows were correct

    def test_no_row_clears_threshold_gives_none_not_zero(self):
        y_true = ["supported"]
        probs = [[0.4, 0.3, 0.3]]
        results = abstention_and_selective_error(y_true, probs, CLASSES, thresholds=(0.9,))
        self.assertEqual(results[0.9]["n_answered"], 0)
        self.assertIsNone(results[0.9]["selective_error"])

    def test_empty_input_raises(self):
        with self.assertRaises(MetricsError):
            abstention_and_selective_error([], [], CLASSES)


class TestBootstrapByComponent(unittest.TestCase):
    def test_point_estimate_matches_full_sample(self):
        y_true = ["supported", "contradicted", "insufficient_evidence", "supported"]
        y_pred = ["supported", "contradicted", "insufficient_evidence", "supported"]
        component_ids = ["comp_a", "comp_b", "comp_c", "comp_d"]
        result = bootstrap_macro_f1_ci(y_true, y_pred, component_ids, CLASSES, n_resamples=50, seed=1)
        self.assertAlmostEqual(result["point"], 1.0)
        self.assertEqual(result["n_components"], 4)

    def test_never_splits_a_component(self):
        # Two rows share component "shared"; a custom metric_fn records, for each resample,
        # whether the two rows of that component always appear together (or not at all).
        component_ids = ["shared", "shared", "solo"]

        def metric_fn(indices):
            count_shared = sum(1 for i in indices if component_ids[i] == "shared")
            # count_shared must always be a multiple of 2 (the component's full row count),
            # never 1 -- that would mean the component was split.
            self.assertEqual(count_shared % 2, 0)
            return float(count_shared)

        bootstrap_ci_by_component(metric_fn, component_ids, n_resamples=100, seed=7)

    def test_empty_component_ids_raises(self):
        with self.assertRaises(MetricsError):
            bootstrap_ci_by_component(lambda idx: 0.0, [])


class TestTemperatureScaling(unittest.TestCase):
    def test_overconfident_logits_get_temperature_above_one(self):
        # Very large-magnitude logits are massively overconfident relative to a ~70% true
        # accuracy rate -> the fitted temperature should soften them (T > 1).
        y_true = ["supported"] * 7 + ["contradicted"] * 3
        logits = [[10.0, -10.0, -10.0]] * 7 + [[10.0, -10.0, -10.0]] * 3  # always predicts "supported"
        t = fit_temperature(logits, y_true, CLASSES)
        self.assertGreater(t, 1.0)

    def test_apply_temperature_softens_confidence(self):
        logits = [[5.0, 0.0, 0.0]]
        probs_t1 = apply_temperature(logits, 1.0)
        probs_t5 = apply_temperature(logits, 5.0)
        self.assertGreater(probs_t1[0][0], probs_t5[0][0])
        self.assertAlmostEqual(sum(probs_t1[0]), 1.0, places=6)

    def test_nonpositive_temperature_raises(self):
        with self.assertRaises(MetricsError):
            apply_temperature([[1.0, 0.0, 0.0]], 0.0)

    def test_empty_input_raises(self):
        with self.assertRaises(MetricsError):
            fit_temperature([], [], CLASSES)


class TestBaselines(unittest.TestCase):
    def test_majority_class_label_ties_broken_alphabetically(self):
        # supported and contradicted tie at 2 each -> alphabetically "contradicted" first.
        labels = ["supported", "supported", "contradicted", "contradicted"]
        self.assertEqual(majority_class_label(labels, CLASSES), "contradicted")

    def test_majority_class_probs_shape(self):
        probs = majority_class_probs("supported", 3, CLASSES)
        self.assertEqual(len(probs), 3)
        self.assertEqual(probs[0], [1.0, 0.0, 0.0])

    def test_lexical_overlap_no_evidence_is_insufficient(self):
        self.assertEqual(lexical_overlap_baseline_predict("some claim", ""), "insufficient_evidence")

    def test_lexical_overlap_low_overlap_is_insufficient(self):
        pred = lexical_overlap_baseline_predict(
            "metformin reduces blood glucose", "completely unrelated sentence about volcanoes"
        )
        self.assertEqual(pred, "insufficient_evidence")

    def test_lexical_overlap_high_overlap_no_negation_is_supported(self):
        pred = lexical_overlap_baseline_predict(
            "metformin reduces fasting blood glucose", "metformin reduces fasting blood glucose in adults"
        )
        self.assertEqual(pred, "supported")

    def test_lexical_overlap_asymmetric_negation_is_contradicted(self):
        pred = lexical_overlap_baseline_predict(
            "metformin reduces fasting blood glucose",
            "metformin does not reduce fasting blood glucose in adults",
        )
        self.assertEqual(pred, "contradicted")

    def test_majority_class_label_empty_raises(self):
        with self.assertRaises(MetricsError):
            majority_class_label([], CLASSES)


if __name__ == "__main__":
    unittest.main()
