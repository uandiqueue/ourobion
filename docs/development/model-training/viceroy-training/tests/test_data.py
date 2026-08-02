"""Tests for viceroy.data — the scope boundary, label mapping, normalization, and corpus reports.

The most important tests in this file are ``TestScopeBoundary``: they are the Viceroy analogue of
the Zebra bundle's label-blindness tests. This model was rescoped after review because its original
target (``EdgeVerification.claimKindCheck``) asks a different question than the corpus answers, and
the guard against quietly re-widening that scope has to be mechanical, not a comment.

Uses a tiny hand-rolled fake tokenizer (whitespace-based) so these tests need neither a real HF
tokenizer nor any network access.
"""

import unicodedata
import unittest

from viceroy.config import ViceroyConfig
from viceroy.data import (
    CLASS_NAMES,
    CONTRACT_MAP,
    NATIVE_LABEL_IDS,
    RawExample,
    build_dataset,
    build_example,
    class_distribution_report,
    conflicting_label_report,
    dedup_key_for,
    map_to_contract_claim_kind,
    normalize_text,
    preflight_check_scope_boundary,
    preprocessing_version_hash,
    token_length_report,
    tokens_for_similarity,
)


class FakeTokenizer:
    """Whitespace tokenizer exposing exactly the surface `viceroy.data` needs: `.tokenize`."""

    def tokenize(self, text: str) -> list:
        return text.split()


def _raw(sentence: str, native_label_id: int, row_id: int = 0, pmid=None) -> RawExample:
    return RawExample(
        row_id=row_id, sentence=sentence, native_label_id=native_label_id, pmid=pmid
    )


class TestScopeBoundary(unittest.TestCase):
    """The rescope is load-bearing: this model reports causal *wording risk*, and must never be
    wired to a contract verdict. Each test below corresponds to a specific rejected proposal."""

    def test_default_contract_map_passes(self):
        preflight_check_scope_boundary()

    def test_mechanistic_is_never_predicted(self):
        widened = dict(CONTRACT_MAP)
        widened["conditional_causal"] = "mechanistic"
        with self.assertRaises(ValueError) as ctx:
            preflight_check_scope_boundary(widened)
        self.assertIn("mechanistic", str(ctx.exception))

    def test_no_relationship_must_abstain(self):
        widened = dict(CONTRACT_MAP)
        widened["no_relationship"] = "correlational"
        with self.assertRaises(ValueError) as ctx:
            preflight_check_scope_boundary(widened)
        self.assertIn("abstain", str(ctx.exception))

    def test_no_effect_mapping_is_rejected(self):
        widened = dict(CONTRACT_MAP)
        widened["no_relationship"] = "no_effect"
        with self.assertRaises(ValueError) as ctx:
            preflight_check_scope_boundary(widened)
        self.assertIn("no_effect", str(ctx.exception))

    def test_map_must_cover_exactly_the_native_classes(self):
        partial = {k: v for k, v in CONTRACT_MAP.items() if k != "correlational"}
        with self.assertRaises(ValueError):
            preflight_check_scope_boundary(partial)

    def test_both_causal_classes_map_to_causal(self):
        self.assertEqual(map_to_contract_claim_kind("direct_causal"), "causal")
        self.assertEqual(map_to_contract_claim_kind("conditional_causal"), "causal")

    def test_no_relationship_maps_to_none_not_a_string(self):
        self.assertIsNone(map_to_contract_claim_kind("no_relationship"))

    def test_unknown_label_raises(self):
        with self.assertRaises(ValueError):
            map_to_contract_claim_kind("mechanistic")


class TestLabelIds(unittest.TestCase):
    def test_label_ids_match_the_released_corpus_encoding(self):
        # Verified against the distributed file: 0/1/2/3 with counts 1356/494/213/998.
        self.assertEqual(NATIVE_LABEL_IDS[0], "no_relationship")
        self.assertEqual(NATIVE_LABEL_IDS[1], "direct_causal")
        self.assertEqual(NATIVE_LABEL_IDS[2], "conditional_causal")
        self.assertEqual(NATIVE_LABEL_IDS[3], "correlational")

    def test_class_names_and_label_ids_agree(self):
        self.assertEqual(set(CLASS_NAMES), set(NATIVE_LABEL_IDS.values()))

    def test_unrecognized_label_id_raises(self):
        with self.assertRaises(ValueError):
            build_example(_raw("x", 7), ViceroyConfig(), tokenizer=FakeTokenizer())


class TestNormalization(unittest.TestCase):
    def test_whitespace_is_collapsed(self):
        self.assertEqual(normalize_text("  a   b \n c "), "a b c")

    def test_nfc_not_nfkc(self):
        """NFKC would fold a superscript into a plain digit, silently changing scientific content."""
        text = "CO² levels"  # superscript two
        self.assertIn("²", normalize_text(text))
        self.assertNotEqual(normalize_text(text), unicodedata.normalize("NFKC", text))

    def test_unpaired_trailing_quote_is_stripped(self):
        """Measured on the real corpus: rows differing ONLY by a trailing CSV quote artifact would
        otherwise escape exact-duplicate detection and land in different folds."""
        self.assertEqual(
            normalize_text('LEVEL OF EVIDENCE: Therapeutic, III."'),
            normalize_text("LEVEL OF EVIDENCE: Therapeutic, III."),
        )

    def test_paired_quotes_are_preserved(self):
        text = 'The authors called it a "positive" finding.'
        self.assertEqual(normalize_text(text).count('"'), 2)

    def test_dedup_key_follows_normalization(self):
        self.assertEqual(
            dedup_key_for(normalize_text('Same sentence."')),
            dedup_key_for(normalize_text("Same  sentence.")),
        )

    def test_similarity_tokens_are_lowercased_alphanumeric(self):
        self.assertEqual(
            tokens_for_similarity("Well-being improved (p<0.05)!"),
            ["well-being", "improved", "p", "0", "05"],
        )


class TestBuildExample(unittest.TestCase):
    def setUp(self):
        self.config = ViceroyConfig()
        self.tokenizer = FakeTokenizer()

    def test_fields_are_populated(self):
        row = build_example(
            _raw("Coffee may reduce fatigue.", 2, row_id=5), self.config, tokenizer=self.tokenizer
        )
        self.assertEqual(row.label, "conditional_causal")
        self.assertEqual(row.native_label_id, 2)
        self.assertEqual(row.row_id, 5)
        self.assertEqual(row.example_id, "row:5")
        self.assertEqual(row.token_count, 4)
        self.assertTrue(row.raw_source_hash)
        self.assertTrue(row.preprocessing_version)

    def test_same_content_different_row_id_shares_dedup_key(self):
        a = build_example(_raw("Identical text here.", 0, row_id=1), self.config, tokenizer=self.tokenizer)
        b = build_example(_raw("Identical  text here.", 0, row_id=2), self.config, tokenizer=self.tokenizer)
        self.assertEqual(a.dedup_key, b.dedup_key)
        self.assertNotEqual(a.example_id, b.example_id)

    def test_preprocessing_version_is_shared_across_a_build(self):
        rows = build_dataset(
            [_raw("a b c", 0, row_id=0), _raw("d e f", 1, row_id=1)],
            self.config,
            tokenizer=self.tokenizer,
        )
        self.assertEqual(rows[0].preprocessing_version, rows[1].preprocessing_version)
        self.assertEqual(
            rows[0].preprocessing_version, preprocessing_version_hash(self.config)
        )

    def test_preprocessing_version_changes_with_max_seq_len(self):
        other = ViceroyConfig(max_seq_len=128)
        self.assertNotEqual(
            preprocessing_version_hash(self.config), preprocessing_version_hash(other)
        )


class TestReports(unittest.TestCase):
    def setUp(self):
        self.config = ViceroyConfig()
        self.rows = build_dataset(
            [
                _raw("no association was observed here", 0, row_id=0),
                _raw("also nothing was observed at all", 0, row_id=1),
                _raw("coffee causes alertness", 1, row_id=2),
                _raw("coffee may cause alertness", 2, row_id=3),
                _raw("coffee is associated with alertness", 3, row_id=4),
            ],
            self.config,
            tokenizer=FakeTokenizer(),
        )

    def test_class_distribution_reports_majority_accuracy(self):
        report = class_distribution_report(self.rows)
        self.assertEqual(report["n"], 5)
        self.assertEqual(report["counts"]["no_relationship"], 2)
        self.assertAlmostEqual(report["majority_class_accuracy"], 0.4)

    def test_class_distribution_lists_every_class_even_at_zero(self):
        rows = build_dataset([_raw("x y", 0, row_id=0)], self.config, tokenizer=FakeTokenizer())
        self.assertEqual(set(class_distribution_report(rows)["counts"]), set(CLASS_NAMES))

    def test_token_length_report_counts_truncation(self):
        report = token_length_report(self.rows, ViceroyConfig(max_seq_len=3))
        self.assertGreater(report["n_truncated"], 0)
        self.assertEqual(token_length_report(self.rows, self.config)["n_truncated"], 0)

    def test_conflicting_labels_are_found_and_described(self):
        rows = build_dataset(
            [_raw("same sentence", 0, row_id=0), _raw("same sentence", 2, row_id=1)],
            self.config,
            tokenizer=FakeTokenizer(),
        )
        report = conflicting_label_report(rows)
        self.assertEqual(report["n_conflicting_texts"], 1)
        self.assertEqual(report["n_conflicting_rows"], 2)
        self.assertEqual(
            report["examples"][0]["labels"], ["conditional_causal", "no_relationship"]
        )

    def test_no_conflicts_reports_zero(self):
        self.assertEqual(conflicting_label_report(self.rows)["n_conflicting_texts"], 0)


if __name__ == "__main__":
    unittest.main()
