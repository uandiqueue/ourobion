import unittest

from ourobion_model_lab.errors import SplitLeakageError
from ourobion_model_lab.splits import (
    assert_disjoint_groups,
    assert_no_duplicate_normalized_text,
)


class TestDisjointGroups(unittest.TestCase):
    def test_disjoint_groups_ok(self):
        assert_disjoint_groups(("train", ["a", "b"]), ("val", ["c"]), ("test", ["d", "e"]))

    def test_overlap_raises(self):
        with self.assertRaises(SplitLeakageError):
            assert_disjoint_groups(("train", ["a", "b"]), ("val", ["b", "c"]))

    def test_same_group_repeated_within_split_ok(self):
        assert_disjoint_groups(("train", ["a", "a", "b"]))

    def test_duplicate_split_name_is_rejected_not_silently_skipped(self):
        # Passing the same name twice used to no-op: the second collection was
        # only ever compared against itself.
        with self.assertRaises(SplitLeakageError):
            assert_disjoint_groups(("train", ["a"]), ("train", ["a", "b"]))

    def test_iterables_are_materialized_once(self):
        # A generator is single-pass; the check must still see its members.
        train = (g for g in ["a", "b"])
        val = (g for g in ["b", "c"])
        with self.assertRaises(SplitLeakageError):
            assert_disjoint_groups(("train", train), ("val", val))

    def test_exhausted_iterator_is_rejected_not_treated_as_clean(self):
        consumed = iter(["a", "b"])
        list(consumed)  # drain it, as an upstream loop would
        with self.assertRaises(SplitLeakageError):
            assert_disjoint_groups(("train", consumed), ("val", ["a"]))


class TestDuplicateNormalizedText(unittest.TestCase):
    def test_no_leakage_when_clean(self):
        records = [
            {"text": "Patients improved.", "group": "abs1"},
            {"text": "No significant change.", "group": "abs2"},
        ]
        assert_no_duplicate_normalized_text(records, text_field="text", group_field="group")

    def test_repeated_text_within_same_group_ok(self):
        records = [
            {"text": "Patients improved.", "group": "abs1"},
            {"text": "  PATIENTS IMPROVED.  ", "group": "abs1"},
        ]
        assert_no_duplicate_normalized_text(records, text_field="text", group_field="group")

    def test_repeated_text_across_groups_raises(self):
        records = [
            {"text": "Patients improved.", "group": "abs1"},
            {"text": "patients improved.", "group": "abs2"},
        ]
        with self.assertRaises(SplitLeakageError):
            assert_no_duplicate_normalized_text(records, text_field="text", group_field="group")

    def test_internal_whitespace_differences_are_still_leakage(self):
        # .strip().lower() missed all of these: only leading/trailing space was
        # normalized, so a double space, a tab, a newline, or a non-breaking
        # space hid a cross-group duplicate.
        for variant in (
            "Patients  improved.",
            "Patients\timproved.",
            "Patients\nimproved.",
            "Patients\u00a0improved.",  # non-breaking space
            "  Patients   improved.  ",
        ):
            with self.subTest(variant=repr(variant)):
                records = [
                    {"text": "Patients improved.", "group": "abs1"},
                    {"text": variant, "group": "abs2"},
                ]
                with self.assertRaises(SplitLeakageError):
                    assert_no_duplicate_normalized_text(
                        records, text_field="text", group_field="group"
                    )


if __name__ == "__main__":
    unittest.main()
