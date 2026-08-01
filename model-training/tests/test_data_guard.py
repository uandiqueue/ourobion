import unittest
from pathlib import Path

from ourobion_model_lab.data_guard import (
    assert_allowed_input_path,
    assert_no_forbidden_schema,
    assert_no_forbidden_schema_in_all,
    is_safe_relative_path,
    unsafe_relative_path_reason,
)
from ourobion_model_lab.errors import ForbiddenDataError

try:  # `unittest discover -s tests` (how CI runs) imports test modules top-level
    from pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS
except ImportError:  # `unittest discover -s tests -t .` imports them as a package
    from tests.pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS


class TestForbiddenSchema(unittest.TestCase):
    def test_clean_record_passes(self):
        assert_no_forbidden_schema({"sentence": "x", "label": "finding"})

    def test_user_id_column_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"user_id": "abc", "value": 1})

    def test_daily_gut_rows_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"daily_gut_rows": []})

    def test_all_variant_stops_at_first_bad_record(self):
        records = [{"a": 1}, {"user_id": "u1"}, {"b": 2}]
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema_in_all(records)


class TestForbiddenSchemaBypasses(unittest.TestCase):
    """Every one of these passed the exact-lowercase-top-level-key matcher."""

    def test_mixed_case_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"User_Id": "abc"})

    def test_camel_case_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"userId": "abc"})

    def test_screaming_camel_case_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"userID": "abc"})

    def test_hyphenated_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"user-id": "abc"})

    def test_schema_qualified_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"public.daily_gut_rows": []})

    def test_nested_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"rows": [{"user_id": "u1"}]})

    def test_deeply_nested_key_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"a": {"b": {"c": [{"insight_cards": 1}]}}})

    def test_forbidden_name_as_a_value_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"table": "daily_gut_rows", "rows": 3})

    def test_forbidden_name_inside_a_query_value_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"query": "select user_id from public.daily_gut_rows"})

    def test_auth_users_qualified_name_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_no_forbidden_schema({"source": "public.auth.users"})

    def test_error_names_every_hit(self):
        with self.assertRaises(ForbiddenDataError) as ctx:
            assert_no_forbidden_schema({"userId": 1, "table": "daily_gut_rows"})
        self.assertIn("daily_gut_rows", str(ctx.exception))
        self.assertIn("user_id", str(ctx.exception))

    def test_longer_word_containing_a_forbidden_name_is_not_over_matched(self):
        # Token boundaries: these merely *contain* forbidden substrings.
        assert_no_forbidden_schema({"superuser_identity": 1, "text": "multiuser_idea"})

    def test_prose_mentioning_words_separately_is_not_over_matched(self):
        assert_no_forbidden_schema({"text": "The user id was never collected."})


class TestForbiddenPath(unittest.TestCase):
    def test_allowed_path_passes(self):
        assert_allowed_input_path("model-training/tests/fixtures/example_config.json")

    def test_supabase_path_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("supabase/migrations/0001_init.sql")

    def test_biotope_app_path_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("apps/biotope/lib/main.dart")

    def test_env_file_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("supabase/.env")

    def test_windows_style_path_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("C:\\project\\ourobion\\supabase\\seed.sql")


class TestForbiddenPathBypasses(unittest.TestCase):
    """Every one of these passed the bare-substring matcher."""

    def test_directory_without_trailing_separator_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("C:/project/ourobion/supabase")

    def test_capitalized_directory_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("C:/project/ourobion/Supabase/seed.sql")

    def test_apps_biotope_without_trailing_separator_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("apps/biotope")

    def test_suffixed_forbidden_directory_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("apps/biotope-export/rows.csv")

    def test_apps_nao_rejected(self):
        with self.assertRaises(ForbiddenDataError):
            assert_allowed_input_path("APPS\\NAO\\app\\page.tsx")

    def test_env_variants_rejected(self):
        for path in ("apps/nao/.env.public", ".env.local", "supabase/.dev.vars"):
            with self.subTest(path=path):
                with self.assertRaises(ForbiddenDataError):
                    assert_allowed_input_path(path)

    def test_unrelated_word_sharing_a_prefix_is_allowed(self):
        # No separator boundary -> a different word, not the forbidden location.
        assert_allowed_input_path("fixtures/supabasement/notes.txt")
        assert_allowed_input_path("model-training/tests/fixtures/environment.json")


class TestUnsafeRelativePathPredicate(unittest.TestCase):
    """Regression: the guard must give the same answer on Windows and on Linux.

    The predecessor of this predicate used `pathlib.Path(rel).is_absolute()`.
    That is an OS question, not a string question: on Linux
    `Path("C:/secrets/x").is_absolute()` is False, so a Windows-style absolute
    path read as a directory named "C:" and walked straight past a guard whose
    only job is keeping manifest entries inside the workspace -- on exactly the
    platform (Linux) the GMI training containers use. Two rows below
    ("C:x.jsonl", "data\\x.jsonl") also slipped past the old guard on Windows,
    so this table fails against the old implementation on both platforms rather
    than only on the CI runner.
    """

    def test_every_unsafe_form_is_rejected(self):
        for bad, expected_reason in UNSAFE_RELATIVE_PATHS:
            with self.subTest(path=bad):
                reason = unsafe_relative_path_reason(bad)
                self.assertIsNotNone(reason, f"{bad!r} was accepted but must be rejected")
                self.assertIn(expected_reason, reason or "")
                self.assertFalse(is_safe_relative_path(bad))

    def test_ordinary_relative_paths_are_accepted(self):
        for good in SAFE_RELATIVE_PATHS:
            with self.subTest(path=good):
                self.assertIsNone(
                    unsafe_relative_path_reason(good),
                    f"{good!r} is an ordinary relative path and must be accepted",
                )
                self.assertTrue(is_safe_relative_path(good))

    def test_pathlib_spellings_are_also_rejected(self):
        """Callers may hand over a Path; a host-specific re-spelling must not launder it.

        `str(Path("C:/secrets/x"))` is "C:\\secrets\\x" on Windows and
        "C:/secrets/x" on Linux -- both must still be rejected.
        """
        for bad, _ in UNSAFE_RELATIVE_PATHS:
            if not bad.strip() or "\x00" in bad:
                continue  # Path() cannot represent these
            with self.subTest(path=bad):
                self.assertIsNotNone(unsafe_relative_path_reason(Path(bad)))


if __name__ == "__main__":
    unittest.main()
