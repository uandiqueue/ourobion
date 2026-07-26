import unittest

from ourobion_model_lab.errors import MetricInputError, ModelLabError
from ourobion_model_lab.metrics import (
    EvaluationReport,
    accuracy,
    expected_calibration_error,
    macro_f1,
)


class TestAccuracy(unittest.TestCase):
    def test_perfect(self):
        self.assertEqual(accuracy(["a", "b"], ["a", "b"]), 1.0)

    def test_partial(self):
        self.assertAlmostEqual(accuracy(["a", "b", "c", "d"], ["a", "x", "c", "y"]), 0.5)

    def test_empty(self):
        self.assertEqual(accuracy([], []), 0.0)

    def test_length_mismatch_raises(self):
        with self.assertRaises(ValueError):
            accuracy(["a"], ["a", "b"])


class TestMacroF1(unittest.TestCase):
    def test_perfect(self):
        self.assertEqual(macro_f1(["a", "b", "a"], ["a", "b", "a"]), 1.0)

    def test_imperfect_matches_hand_computation(self):
        y_true = ["a", "a", "b", "b"]
        y_pred = ["a", "b", "b", "b"]
        # label a: tp=1 fp=0 fn=1 -> P=1.0 R=0.5 F1=0.6667
        # label b: tp=2 fp=1 fn=0 -> P=0.6667 R=1.0 F1=0.8
        self.assertAlmostEqual(macro_f1(y_true, y_pred), (2 / 3 + 0.8) / 2, places=6)


class TestExpectedCalibrationError(unittest.TestCase):
    def test_perfect_calibration_is_zero(self):
        ece = expected_calibration_error([1.0, 1.0], [True, True])
        self.assertAlmostEqual(ece, 0.0)

    def test_known_miscalibration(self):
        ece = expected_calibration_error([0.9, 0.9, 0.9, 0.9], [True, True, True, False])
        self.assertAlmostEqual(ece, 0.15)

    def test_empty_is_zero(self):
        self.assertEqual(expected_calibration_error([], []), 0.0)

    def test_length_mismatch_raises(self):
        with self.assertRaises(ValueError):
            expected_calibration_error([0.5], [])

    def test_negative_confidence_rejected_not_binned_backwards(self):
        # min(int(-0.5 * 10), 9) == -5 -> indexed the *last* bins and returned a
        # confident-looking 1.0 from the wrong bucket.
        with self.assertRaises(MetricInputError):
            expected_calibration_error([-0.5, -0.5], [True, False])

    def test_confidence_above_one_rejected_not_indexerror(self):
        # Used to raise a raw IndexError, which cli.py's ModelLabError handler
        # does not catch -- i.e. a stack trace instead of a fail-closed exit.
        with self.assertRaises(MetricInputError):
            expected_calibration_error([1.5], [True])

    def test_logit_shaped_input_is_rejected_with_a_useful_message(self):
        with self.assertRaises(MetricInputError) as ctx:
            expected_calibration_error([2.7, -1.3], [True, False])
        self.assertIn("logits", str(ctx.exception))

    def test_metric_input_error_is_both_valueerror_and_modellaberror(self):
        self.assertTrue(issubclass(MetricInputError, ValueError))
        self.assertTrue(issubclass(MetricInputError, ModelLabError))

    def test_boundary_values_are_accepted(self):
        self.assertAlmostEqual(expected_calibration_error([0.0, 1.0], [False, True]), 0.0)

    def test_zero_bins_rejected(self):
        with self.assertRaises(MetricInputError):
            expected_calibration_error([0.5], [True], n_bins=0)


class TestEvaluationReport(unittest.TestCase):
    def test_to_dict_shape(self):
        report = EvaluationReport(model_name="x", metrics={"acc": 1.0}, n_examples=3, notes=("n",))
        d = report.to_dict()
        self.assertEqual(d["model_name"], "x")
        self.assertEqual(d["metrics"], {"acc": 1.0})
        self.assertEqual(d["n_examples"], 3)
        self.assertEqual(d["notes"], ["n"])


if __name__ == "__main__":
    unittest.main()
