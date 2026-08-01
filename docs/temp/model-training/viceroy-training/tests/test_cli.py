"""Tests for viceroy.cli — the fail-closed gates and corpus loading.

The licence-gate tests matter because this model's gate is deliberately stricter than the Zebra
bundle's: the corpus repository is GPL-3.0, and a bare ``"status": "approved"`` is not sufficient
to start. Each test below corresponds to a way that gate could be weakened by accident.

These patch the module-level path constants rather than writing into the bundle root, so running
the suite can never leave a real ``licence-approval.json`` behind — which would silently open the
gate for every subsequent run on that machine.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from viceroy import cli


def _complete_determination(**overrides) -> dict:
    determination = {f: f"answered: {f}" for f in cli.GPL3_REQUIRED_FIELDS}
    determination["determined_by"] = "reviewer@example.invalid"
    determination["date"] = "2026-07-27"
    determination["permits_intended_use"] = True
    determination.update(overrides)
    return determination


def _approval(**overrides) -> dict:
    payload = {
        "status": "approved",
        "approved_by": "approver@example.invalid",
        "date": "2026-07-27",
        "gpl3_determination": _complete_determination(),
    }
    payload.update(overrides)
    return payload


class LicenceGateTestCase(unittest.TestCase):
    """Base class that points the gate at a temp file instead of the bundle root."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "licence-approval.json"
        patcher = mock.patch.object(cli, "LICENCE_APPROVAL_PATH", self.path)
        patcher.start()
        self.addCleanup(patcher.stop)

    def write(self, payload, *, encoding="utf-8"):
        self.path.write_text(json.dumps(payload), encoding=encoding)


class TestLicenceGate(LicenceGateTestCase):
    def test_missing_file_fails_closed(self):
        report = cli.check_licence_gate()
        self.assertFalse(report["ok"])
        self.assertIn("does not exist", report["reason"])

    def test_unreadable_file_fails_closed(self):
        self.path.write_text("{not json", encoding="utf-8")
        self.assertFalse(cli.check_licence_gate()["ok"])

    def test_pending_status_fails_closed(self):
        self.write(_approval(status="pending"))
        report = cli.check_licence_gate()
        self.assertFalse(report["ok"])
        self.assertIn("not 'approved'", report["reason"])

    def test_approved_without_any_determination_fails_closed(self):
        """The whole point of this gate: approval alone is not enough for GPL-3.0 data."""
        payload = _approval()
        del payload["gpl3_determination"]
        self.write(payload)
        report = cli.check_licence_gate()
        self.assertFalse(report["ok"])
        self.assertIn("gpl3_determination", report["reason"])

    def test_each_unanswered_question_fails_closed(self):
        for field in cli.GPL3_REQUIRED_FIELDS:
            with self.subTest(field=field):
                self.write(_approval(gpl3_determination=_complete_determination(**{field: ""})))
                report = cli.check_licence_gate()
                self.assertFalse(report["ok"])
                self.assertIn(field, report["reason"])

    def test_whitespace_only_answer_is_not_an_answer(self):
        field = cli.GPL3_REQUIRED_FIELDS[0]
        self.write(_approval(gpl3_determination=_complete_determination(**{field: "   "})))
        self.assertFalse(cli.check_licence_gate()["ok"])

    def test_non_string_answer_fails_closed(self):
        field = cli.GPL3_REQUIRED_FIELDS[0]
        self.write(_approval(gpl3_determination=_complete_determination(**{field: True})))
        self.assertFalse(cli.check_licence_gate()["ok"])

    def test_determination_not_an_object_fails_closed(self):
        self.write(_approval(gpl3_determination="I reviewed it, it's fine"))
        self.assertFalse(cli.check_licence_gate()["ok"])

    def test_negative_determination_blocks(self):
        """A negative determination is a valid completion state for this model, not a hurdle to
        route around — the plan's stop conditions say it blocks."""
        self.write(
            _approval(gpl3_determination=_complete_determination(permits_intended_use=False))
        )
        report = cli.check_licence_gate()
        self.assertFalse(report["ok"])
        self.assertIn("permits_intended_use", report["reason"])

    def test_missing_permits_flag_blocks(self):
        determination = _complete_determination()
        del determination["permits_intended_use"]
        self.write(_approval(gpl3_determination=determination))
        self.assertFalse(cli.check_licence_gate()["ok"])

    def test_complete_approval_passes(self):
        self.write(_approval())
        report = cli.check_licence_gate()
        self.assertTrue(report["ok"])
        self.assertEqual(report["approved_by"], "approver@example.invalid")
        self.assertEqual(report["gpl3_determined_by"], "reviewer@example.invalid")

    def test_bom_prefixed_file_is_tolerated(self):
        self.write(_approval(), encoding="utf-8-sig")
        self.assertTrue(cli.check_licence_gate()["ok"])

    def test_the_shipped_example_does_not_pass(self):
        """The example file must never be a working approval — copying it without editing has to
        fail, or the gate is decorative."""
        example = Path(cli._BUNDLE_ROOT) / "licence-approval.example.json"
        self.path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
        self.assertFalse(cli.check_licence_gate()["ok"])


class TestScopeBoundaryGate(unittest.TestCase):
    def test_scope_report_passes_by_default(self):
        self.assertTrue(cli._scope_boundary_report()["ok"])

    def test_widened_scope_is_reported_not_raised(self):
        with mock.patch.object(
            cli, "preflight_check_scope_boundary", side_effect=ValueError("widened")
        ):
            report = cli._scope_boundary_report()
        self.assertFalse(report["ok"])
        self.assertEqual(report["reason"], "widened")


class TestEnvReportWithoutTorch(unittest.TestCase):
    def test_missing_torch_degrades_instead_of_crashing(self):
        """preflight is documented as working before the ML stack is installed. If a missing torch
        raised here, the one command you are told to run when unsure would crash on a fresh
        machine."""
        with mock.patch.object(cli, "select_device", side_effect=ImportError("No module named 'torch'")):
            report = cli._env_report()
        self.assertEqual(report["device"], "unknown")
        self.assertIn("torch is not installed", report["device_reason"])


class TestLoadCorpus(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = Path(self._tmp.name)

    def _write(self, text: str) -> Path:
        path = self.dir / "corpus.csv"
        path.write_text(text, encoding="utf-8")
        return path

    def test_reads_the_released_two_column_shape(self):
        rows = cli.load_corpus(self._write("sentence,label\nCoffee causes alertness.,1\n"))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].row_id, 0)
        self.assertEqual(rows[0].native_label_id, 1)
        self.assertIsNone(rows[0].pmid)

    def test_reads_an_optional_pmid_column_when_present(self):
        rows = cli.load_corpus(
            self._write("pmid,sentence,label\n31064345,Coffee causes alertness.,1\n")
        )
        self.assertEqual(rows[0].pmid, "31064345")

    def test_missing_required_column_raises(self):
        with self.assertRaises(ValueError) as ctx:
            cli.load_corpus(self._write("sentence\nNo label column here.\n"))
        self.assertIn("label", str(ctx.exception))

    def test_blank_label_raises_rather_than_defaulting(self):
        with self.assertRaises(ValueError):
            cli.load_corpus(self._write("sentence,label\nSomething.,\n"))

    def test_row_ids_are_positional_and_stable(self):
        rows = cli.load_corpus(self._write("sentence,label\na,0\nb,1\nc,3\n"))
        self.assertEqual([r.row_id for r in rows], [0, 1, 2])

    def test_the_shipped_fixture_loads(self):
        rows = cli.load_corpus(cli.FIXTURES_DIR / "toy_causal_language.csv")
        self.assertEqual(len(rows), 18)
        self.assertEqual({r.native_label_id for r in rows}, {0, 1, 2, 3})


class TestSplitHash(unittest.TestCase):
    def test_same_split_same_hash(self):
        self.assertEqual(cli._split_hash([1, 2, 3], [0, 1, 0]), cli._split_hash([1, 2, 3], [0, 1, 0]))

    def test_different_fold_assignment_changes_the_hash(self):
        """Two runs over the same data manifest but different splits are not comparable, and the
        artifact has to make that visible."""
        self.assertNotEqual(
            cli._split_hash([1, 2, 3], [0, 1, 0]), cli._split_hash([1, 2, 3], [0, 1, 1])
        )

    def test_different_kept_rows_change_the_hash(self):
        self.assertNotEqual(
            cli._split_hash([1, 2, 3], [0, 1, 0]), cli._split_hash([1, 2, 4], [0, 1, 0])
        )


if __name__ == "__main__":
    unittest.main()
