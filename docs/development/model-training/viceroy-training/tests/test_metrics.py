"""Tests for viceroy.metrics — confusion matrix / prf1 / the directional report / Brier / ECE /
bootstrap / abstention / temperature scaling / baselines, plus the "raise, don't silently return
0.0" input-validation contract.

``TestDirectionalConfusion`` is the one that encodes a safety property rather than an arithmetic
one: the causal↔correlational cells must stay separated, because averaging them hides the only
error mode that would make this signal actively misleading.
"""

import unittest

from viceroy.metrics import (
    MetricsError,
    abstention_and_selective_error,
    accuracy,
    apply_temperature,
    balanced_accuracy,
    bootstrap_ci_by_group,
    bootstrap_macro_f1_ci,
    causal_cue_baseline_predict,
    confusion_matrix,
    cross_validation_summary,
    directional_confusion_report,
    ece_equal_mass,
    fit_temperature,
    macro_f1,
    majority_class_label,
    majority_class_probs,
    multiclass_brier,
    per_class_prf1,
)

CLASSES = ("no_relationship", "direct_causal", "conditional_causal", "correlational")


class TestConfusionMatrixAndPrf1(unittest.TestCase):
    def test_perfect_predictions(self):
        y_true = list(CLASSES)
        cm = confusion_matrix(y_true, y_true)
        self.assertEqual(cm, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
        per_class = per_class_prf1(cm)
        for cls in CLASSES:
            self.assertEqual(per_class[cls]["f1"], 1.0)
        self.assertEqual(macro_f1(per_class), 1.0)
        self.assertEqual(balanced_accuracy(cm), 1.0)

    def test_all_wrong(self):
        cm = confusion_matrix(["direct_causal", "direct_causal"], ["correlational"] * 2)
        per_class = per_class_prf1(cm)
        self.assertEqual(per_class["direct_causal"]["recall"], 0.0)
        self.assertEqual(macro_f1(per_class), 0.0)

    def test_unknown_label_raises(self):
        with self.assertRaises(MetricsError):
            confusion_matrix(["mechanistic"], ["direct_causal"])

    def test_empty_input_raises_rather_than_returning_zero(self):
        with self.assertRaises(MetricsError):
            confusion_matrix([], [])

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(MetricsError):
            confusion_matrix(["direct_causal"], ["direct_causal", "correlational"])

    def test_wrong_shape_matrix_raises(self):
        with self.assertRaises(MetricsError):
            per_class_prf1([[1, 0], [0, 1]])


class TestAccuracy(unittest.TestCase):
    def test_accuracy_always_reports_the_majority_baseline_beside_it(self):
        # 6 no_relationship, 2 correlational; a one-class predictor scores 0.75 here.
        y_true = ["no_relationship"] * 6 + ["correlational"] * 2
        cm = confusion_matrix(y_true, y_true)
        report = accuracy(cm)
        self.assertEqual(report["accuracy"], 1.0)
        self.assertEqual(report["majority_class_accuracy"], 0.75)
        self.assertEqual(report["n"], 8)

    def test_all_zero_matrix_raises(self):
        with self.assertRaises(MetricsError):
            accuracy([[0] * 4 for _ in range(4)])


class TestDirectionalConfusion(unittest.TestCase):
    def test_dangerous_direction_is_reported_separately(self):
        y_true = ["correlational", "correlational", "direct_causal", "conditional_causal"]
        y_pred = ["direct_causal", "correlational", "correlational", "correlational"]
        report = directional_confusion_report(confusion_matrix(y_true, y_pred))

        self.assertEqual(report["correlational_read_as_causal"]["n"], 1)
        self.assertEqual(report["correlational_read_as_causal"]["of_true_support"], 2)
        self.assertEqual(report["correlational_read_as_causal"]["rate"], 0.5)
        self.assertIn("DANGEROUS", report["correlational_read_as_causal"]["severity"])

        self.assertEqual(report["causal_read_as_correlational"]["n"], 2)
        self.assertEqual(report["causal_read_as_correlational"]["of_true_support"], 2)

    def test_both_causal_classes_count_toward_the_causal_side(self):
        y_true = ["conditional_causal"]
        y_pred = ["correlational"]
        report = directional_confusion_report(confusion_matrix(y_true, y_pred))
        self.assertEqual(report["causal_read_as_correlational"]["n"], 1)

    def test_predicting_the_other_causal_subclass_is_not_a_directional_error(self):
        y_true = ["direct_causal"]
        y_pred = ["conditional_causal"]
        report = directional_confusion_report(confusion_matrix(y_true, y_pred))
        self.assertEqual(report["causal_read_as_correlational"]["n"], 0)
        self.assertEqual(report["correlational_read_as_causal"]["n"], 0)

    def test_zero_support_yields_none_not_zero(self):
        y_true = ["no_relationship"]
        report = directional_confusion_report(confusion_matrix(y_true, y_true))
        self.assertIsNone(report["correlational_read_as_causal"]["rate"])


class TestBrierAndEce(unittest.TestCase):
    def test_perfect_confident_prediction_scores_zero_brier(self):
        self.assertEqual(multiclass_brier(["no_relationship"], [[1.0, 0.0, 0.0, 0.0]]), 0.0)

    def test_out_of_range_probability_raises(self):
        with self.assertRaises(MetricsError):
            multiclass_brier(["no_relationship"], [[1.2, 0.0, 0.0, 0.0]])

    def test_wrong_width_probability_row_raises(self):
        with self.assertRaises(MetricsError):
            multiclass_brier(["no_relationship"], [[1.0, 0.0, 0.0]])

    def test_ece_of_a_perfectly_calibrated_confident_model_is_zero(self):
        y_true = ["no_relationship"] * 4
        probs = [[1.0, 0.0, 0.0, 0.0]] * 4
        result = ece_equal_mass(y_true, probs, n_bins=2)
        self.assertAlmostEqual(result["ece"], 0.0)

    def test_ece_bins_cover_every_row(self):
        y_true = ["no_relationship", "direct_causal", "correlational", "conditional_causal"]
        probs = [
            [0.7, 0.1, 0.1, 0.1],
            [0.1, 0.6, 0.2, 0.1],
            [0.2, 0.2, 0.1, 0.5],
            [0.3, 0.3, 0.3, 0.1],
        ]
        result = ece_equal_mass(y_true, probs, n_bins=2)
        self.assertEqual(sum(b["n"] for b in result["bins"]), 4)
        self.assertEqual(result["n_bins"], 2)

    def test_more_bins_than_rows_is_clamped(self):
        result = ece_equal_mass(["no_relationship"], [[1.0, 0.0, 0.0, 0.0]], n_bins=10)
        self.assertEqual(result["n_bins"], 1)


class TestBootstrap(unittest.TestCase):
    def test_ci_brackets_the_point_estimate(self):
        y_true = ["no_relationship", "direct_causal", "correlational", "conditional_causal"] * 4
        y_pred = list(y_true)
        groups = list(range(len(y_true)))
        result = bootstrap_macro_f1_ci(y_true, y_pred, groups, n_resamples=50, seed=1)
        self.assertEqual(result["point"], 1.0)
        self.assertLessEqual(result["ci_lo"], result["point"])
        self.assertEqual(result["n_groups"], len(groups))

    def test_resampling_is_by_group_not_row(self):
        """All rows in one group: every resample draws that whole group, so the metric never
        varies. A row-level bootstrap would show spread here — which is exactly the understated
        variance this function exists to avoid."""
        y_true = ["no_relationship", "direct_causal", "correlational", "conditional_causal"]
        y_pred = ["no_relationship", "direct_causal", "correlational", "no_relationship"]
        result = bootstrap_macro_f1_ci(y_true, y_pred, [0, 0, 0, 0], n_resamples=25, seed=3)
        self.assertEqual(result["n_groups"], 1)
        self.assertEqual(result["ci_lo"], result["ci_hi"])

    def test_deterministic_given_a_seed(self):
        y_true = ["no_relationship", "correlational"] * 6
        y_pred = ["no_relationship"] * 12
        groups = [i // 2 for i in range(12)]
        a = bootstrap_macro_f1_ci(y_true, y_pred, groups, n_resamples=40, seed=7)
        b = bootstrap_macro_f1_ci(y_true, y_pred, groups, n_resamples=40, seed=7)
        self.assertEqual(a, b)

    def test_invalid_resample_count_raises(self):
        with self.assertRaises(MetricsError):
            bootstrap_ci_by_group(lambda idx: 0.0, [0, 1], n_resamples=0)

    def test_empty_groups_raise(self):
        with self.assertRaises(MetricsError):
            bootstrap_ci_by_group(lambda idx: 0.0, [])


class TestCrossValidationSummary(unittest.TestCase):
    def test_mean_and_sample_sd(self):
        result = cross_validation_summary([0.6, 0.8])
        self.assertAlmostEqual(result["mean"], 0.7)
        self.assertAlmostEqual(result["sd"], 0.1414213562, places=6)
        self.assertEqual(result["n_folds"], 2)

    def test_single_fold_has_no_sd(self):
        self.assertIsNone(cross_validation_summary([0.6])["sd"])

    def test_empty_raises(self):
        with self.assertRaises(MetricsError):
            cross_validation_summary([])


class TestAbstention(unittest.TestCase):
    def test_coverage_and_selective_error(self):
        y_true = ["no_relationship", "direct_causal"]
        probs = [[0.9, 0.1, 0.0, 0.0], [0.55, 0.45, 0.0, 0.0]]
        result = abstention_and_selective_error(y_true, probs, thresholds=(0.5, 0.8))
        self.assertEqual(result[0.5]["coverage"], 1.0)
        self.assertEqual(result[0.5]["selective_error"], 0.5)
        self.assertEqual(result[0.8]["coverage"], 0.5)
        self.assertEqual(result[0.8]["selective_error"], 0.0)

    def test_no_row_clears_threshold_gives_none_not_zero(self):
        result = abstention_and_selective_error(
            ["no_relationship"], [[0.4, 0.3, 0.2, 0.1]], thresholds=(0.95,)
        )
        self.assertEqual(result[0.95]["coverage"], 0.0)
        self.assertIsNone(result[0.95]["selective_error"])

    def test_empty_thresholds_raise(self):
        with self.assertRaises(MetricsError):
            abstention_and_selective_error(
                ["no_relationship"], [[1.0, 0.0, 0.0, 0.0]], thresholds=()
            )


class TestTemperature(unittest.TestCase):
    def test_overconfident_logits_fit_temperature_above_one(self):
        logits = [[6.0, 0.0, 0.0, 0.0], [0.0, 6.0, 0.0, 0.0], [6.0, 0.0, 0.0, 0.0]]
        y_true = ["no_relationship", "no_relationship", "no_relationship"]
        self.assertGreater(fit_temperature(logits, y_true), 1.0)

    def test_apply_temperature_returns_normalized_rows(self):
        probs = apply_temperature([[1.0, 2.0, 3.0, 4.0]], 2.0)
        self.assertAlmostEqual(sum(probs[0]), 1.0)

    def test_nonpositive_temperature_raises(self):
        with self.assertRaises(MetricsError):
            apply_temperature([[1.0, 0.0, 0.0, 0.0]], 0.0)

    def test_bad_bounds_raise(self):
        with self.assertRaises(MetricsError):
            fit_temperature([[1.0, 0.0, 0.0, 0.0]], ["no_relationship"], bounds=(2.0, 1.0))

    def test_wrong_width_logits_raise(self):
        with self.assertRaises(MetricsError):
            fit_temperature([[1.0, 0.0]], ["no_relationship"])

    def test_fit_is_deterministic(self):
        logits = [[3.0, 1.0, 0.0, 0.0], [0.0, 3.0, 1.0, 0.0]]
        y_true = ["no_relationship", "direct_causal"]
        self.assertEqual(fit_temperature(logits, y_true), fit_temperature(logits, y_true))


class TestBaselines(unittest.TestCase):
    def test_majority_class(self):
        labels = ["no_relationship"] * 3 + ["correlational"]
        self.assertEqual(majority_class_label(labels), "no_relationship")

    def test_majority_ties_break_alphabetically(self):
        self.assertEqual(
            majority_class_label(["correlational", "direct_causal"]), "correlational"
        )

    def test_majority_probs_are_one_hot(self):
        rows = majority_class_probs("direct_causal", 2)
        self.assertEqual(rows, [[0.0, 1.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0]])

    def test_majority_probs_reject_unknown_label(self):
        with self.assertRaises(MetricsError):
            majority_class_probs("mechanistic", 1)

    def test_cue_baseline_null_cue_wins(self):
        self.assertEqual(
            causal_cue_baseline_predict("There was no significant association between X and Y."),
            "no_relationship",
        )

    def test_cue_baseline_correlational(self):
        self.assertEqual(
            causal_cue_baseline_predict("Sleep debt was associated with lower recovery scores."),
            "correlational",
        )

    def test_cue_baseline_direct_causal(self):
        self.assertEqual(
            causal_cue_baseline_predict("The intervention reduced symptom frequency."),
            "direct_causal",
        )

    def test_cue_baseline_hedged_causal(self):
        self.assertEqual(
            causal_cue_baseline_predict("Hydration may reduce symptom frequency."),
            "conditional_causal",
        )

    def test_cue_baseline_prefers_correlational_over_causal_on_mixed_wording(self):
        """A sentence carrying both cue types must land on the cautious side. Rule order (null,
        then correlational, then causal) is what guarantees it — a baseline that resolved ties
        toward causal would flatter the model it is meant to challenge."""
        self.assertEqual(
            causal_cue_baseline_predict(
                "X was associated with Y, but the study did not show that X causes Y."
            ),
            "correlational",
        )

    def test_cue_baseline_null_cue_outranks_both_other_cue_types(self):
        self.assertEqual(
            causal_cue_baseline_predict(
                "There was no significant association, and no evidence that X reduced Y."
            ),
            "no_relationship",
        )

    def test_cue_baseline_falls_back_to_the_majority_class(self):
        self.assertEqual(
            causal_cue_baseline_predict("Further research in this area is warranted."),
            "no_relationship",
        )

    def test_cue_baseline_output_is_always_a_valid_class(self):
        for text in ("", "random words", "CAUSES", "may be linked to"):
            self.assertIn(causal_cue_baseline_predict(text), CLASSES)


if __name__ == "__main__":
    unittest.main()
