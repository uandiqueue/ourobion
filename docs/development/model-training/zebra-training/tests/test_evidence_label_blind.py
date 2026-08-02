"""The most important test file in this bundle.

Proves, mechanically, that evidence selection cannot depend on the label — both the structural
guarantee (signature shape, via `preflight_check_label_blind`) and the behavioral guarantee
(selection is byte-for-byte identical for the same claim+abstract regardless of verdict).

Uses a tiny hand-rolled fake tokenizer (whitespace-based) so these tests need neither a real HF
tokenizer nor any network access — see FakeTokenizer below.
"""

import unicodedata
import unittest

from zebra.config import ZebraConfig
from zebra.data import (
    CLASS_NAMES,
    RawExample,
    SelectedEvidence,
    build_dataset,
    build_example,
    evidence_shortcut_report,
    fit_evidence_to_budget,
    normalize_text,
    preflight_check_label_blind,
    preprocessing_version_hash,
    select_evidence_sentences,
)


class FakeTokenizer:
    """Whitespace tokenizer exposing exactly the surface `zebra.data` needs: `.tokenize`,
    `.num_special_tokens_to_add`, `.convert_tokens_to_string`. Deliberately not a real
    wordpiece tokenizer — these tests are about label-blindness and budget arithmetic, not
    about matching BiomedBERT's exact vocabulary."""

    def tokenize(self, text: str) -> list:
        return text.split()

    def num_special_tokens_to_add(self, pair: bool = True) -> int:
        return 3 if pair else 2

    def convert_tokens_to_string(self, tokens) -> str:
        return " ".join(tokens)


def _raw(verdict: str, evidence=(0,)) -> RawExample:
    return RawExample(
        claim_id="c1",
        abstract_id="a1",
        claim="Metformin reduces fasting blood glucose in adults with type 2 diabetes.",
        title="Metformin trial",
        abstract=(
            "This study examined metformin in adults with type 2 diabetes.",
            "Fasting blood glucose fell significantly in the treatment group.",
            "No significant change was observed in the placebo group.",
            "Adverse events were mild and mostly gastrointestinal.",
        ),
        verdict=verdict,
        evidence=evidence,
    )


class TestPreflightCheckStructural(unittest.TestCase):
    """The mechanical, signature-level guarantee."""

    def test_real_selector_passes(self):
        # Must not raise.
        preflight_check_label_blind(select_evidence_sentences)

    def test_rejects_varargs(self):
        def bad(claim_text, abstract_sentences, config, *args):
            raise AssertionError("never called")

        with self.assertRaises(TypeError):
            preflight_check_label_blind(bad)

    def test_rejects_kwargs(self):
        def bad(claim_text, abstract_sentences, config, **kwargs):
            raise AssertionError("never called")

        with self.assertRaises(TypeError):
            preflight_check_label_blind(bad)

    def test_rejects_wrong_param_names(self):
        def bad(claim, sentences, cfg):
            raise AssertionError("never called")

        with self.assertRaises(TypeError):
            preflight_check_label_blind(bad)

    def test_rejects_wrong_param_order(self):
        def bad(abstract_sentences, claim_text, config):
            raise AssertionError("never called")

        with self.assertRaises(TypeError):
            preflight_check_label_blind(bad)

    def test_rejects_extra_param(self):
        def bad(claim_text, abstract_sentences, config, extra):
            raise AssertionError("never called")

        with self.assertRaises(TypeError):
            preflight_check_label_blind(bad)

    def test_rejects_label_like_param_name(self):
        # Defense-in-depth: even if `expected_params` were ever loosened to allow a differently
        # named third parameter, a label-like name must still be rejected.
        def bad(claim_text, abstract_sentences, label):
            raise AssertionError("never called")

        with self.assertRaises(ValueError):
            preflight_check_label_blind(bad, expected_params=("claim_text", "abstract_sentences", "label"))


class TestSelectionIsBehaviorallyLabelBlind(unittest.TestCase):
    """The behavioral guarantee: identical claim+abstract, different verdict -> identical
    selection. This is what would actually catch a regression to the label-dependent design
    the module's docstring describes."""

    def test_build_example_selection_identical_across_verdicts(self):
        config = ZebraConfig()
        tokenizer = FakeTokenizer()

        support_row = build_example(
            _raw("SUPPORT", evidence=(1,)), config, tokenizer=tokenizer, source_split="train"
        )
        contradict_row = build_example(
            _raw("CONTRADICT", evidence=(1,)), config, tokenizer=tokenizer, source_split="train"
        )
        nei_row = build_example(_raw("NEI", evidence=()), config, tokenizer=tokenizer, source_split="train")

        # Selection outputs must be identical: same claim+abstract in, same evidence out,
        # regardless of verdict/evidence gold labels.
        self.assertEqual(support_row.source_sentence_ids, contradict_row.source_sentence_ids)
        self.assertEqual(support_row.source_sentence_ids, nei_row.source_sentence_ids)
        self.assertEqual(support_row.evidence_text, contradict_row.evidence_text)
        self.assertEqual(support_row.evidence_text, nei_row.evidence_text)
        self.assertEqual(support_row.evidence_method, "retrieved")
        self.assertEqual(nei_row.evidence_method, "retrieved")

        # Only the label (and gold_overlap, since gold rationale differs) may legitimately differ.
        self.assertEqual(support_row.label, "supported")
        self.assertEqual(contradict_row.label, "contradicted")
        self.assertEqual(nei_row.label, "insufficient_evidence")

    def test_selector_signature_matches_call_site(self):
        # select_evidence_sentences is called with exactly (claim_text, abstract_sentences,
        # config) inside build_example — this is a sanity check that the call site hasn't
        # drifted from the structurally-checked signature.
        config = ZebraConfig()
        result = select_evidence_sentences(
            "claim text", ("sentence one", "sentence two", "sentence three"), config
        )
        self.assertIsInstance(result, SelectedEvidence)

    def test_selection_deterministic_across_repeated_calls(self):
        config = ZebraConfig()
        abstract = (
            "Aspirin reduces platelet aggregation in healthy volunteers.",
            "Bleeding time was measured before and after dosing.",
            "No serious adverse events occurred during the study.",
        )
        first = select_evidence_sentences("aspirin platelet aggregation", abstract, config)
        second = select_evidence_sentences("aspirin platelet aggregation", abstract, config)
        self.assertEqual(first, second)

    def test_tie_break_prefers_lower_index(self):
        # Two sentences with zero query overlap score identically (score 0.0); top_k=1 must
        # deterministically prefer the lower original index, not an arbitrary one.
        config = ZebraConfig(evidence_top_k=1)
        abstract = ("completely unrelated sentence alpha", "completely unrelated sentence beta")
        result = select_evidence_sentences("zzz query with no overlap", abstract, config)
        self.assertEqual(result.sentence_ids, (0,))


class TestNormalizeText(unittest.TestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(normalize_text("a   b\n\tc"), "a b c")

    def test_nfc_not_nfkc_preserves_compatibility_distinctions(self):
        # U+00B2 SUPERSCRIPT TWO has a *compatibility* (not canonical) decomposition to "2".
        # NFC must NOT fold it away; NFKC/NFKD would. This is the concrete behavior the
        # docstring's "NFC, not NFKC" claim depends on.
        superscript_two = "²"
        self.assertEqual(normalize_text(superscript_two), superscript_two)
        self.assertNotEqual(unicodedata.normalize("NFKC", superscript_two), superscript_two)


class TestFitEvidenceToBudget(unittest.TestCase):
    def test_truncates_evidence_not_claim(self):
        tokenizer = FakeTokenizer()
        config = ZebraConfig(max_seq_len=10)  # tiny budget forces truncation
        claim = "one two three"  # 3 tokens
        evidence = ["four five six seven eight nine ten eleven twelve"]
        kept, evidence_tokens, claim_tokens = fit_evidence_to_budget(claim, evidence, tokenizer, config)
        self.assertEqual(claim_tokens, 3)
        # budget = 10 - 3 claim - 3 special = 4; evidence sentence has 9 tokens -> truncated to 4
        self.assertEqual(evidence_tokens, 4)
        self.assertTrue(kept)

    def test_claim_alone_over_budget_yields_no_evidence(self):
        tokenizer = FakeTokenizer()
        config = ZebraConfig(max_seq_len=2)
        claim = "one two three four five"
        kept, evidence_tokens, claim_tokens = fit_evidence_to_budget(claim, ["some evidence"], tokenizer, config)
        self.assertEqual(kept, [])
        self.assertEqual(evidence_tokens, 0)


class TestBuildDatasetAndShortcutReport(unittest.TestCase):
    def test_build_dataset_shares_preprocessing_version(self):
        config = ZebraConfig()
        tokenizer = FakeTokenizer()
        raws = [_raw("SUPPORT"), _raw("CONTRADICT"), _raw("NEI", evidence=())]
        examples = build_dataset(raws, config, tokenizer=tokenizer, source_split="train")
        expected_hash = preprocessing_version_hash(config)
        self.assertTrue(all(e.preprocessing_version == expected_hash for e in examples))

    def test_evidence_shortcut_report_has_all_classes(self):
        config = ZebraConfig()
        tokenizer = FakeTokenizer()
        raws = [_raw("SUPPORT"), _raw("CONTRADICT"), _raw("NEI", evidence=())]
        examples = build_dataset(raws, config, tokenizer=tokenizer, source_split="train")
        report = evidence_shortcut_report(examples)
        self.assertEqual(set(report.keys()), set(CLASS_NAMES))
        # NEI row here has no gold rationale -> gold_overlap distribution reports "not applicable"
        nei_summary = report["insufficient_evidence"]["gold_overlap"]
        self.assertEqual(nei_summary["n_applicable"], 0)
        self.assertIsNone(nei_summary["mean"])


if __name__ == "__main__":
    unittest.main()
