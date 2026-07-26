import unittest

from ourobion_model_lab.data_guard import (
    assert_allowed_input_path,
    assert_no_forbidden_schema,
    assert_no_forbidden_schema_in_all,
)
from ourobion_model_lab.errors import ForbiddenDataError


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


if __name__ == "__main__":
    unittest.main()
