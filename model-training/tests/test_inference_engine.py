"""Label-permutation resolution — the silent-mislabelling guard.

`build_label_permutation` is stdlib-testable (no Torch), which matters: it is
the piece whose failure mode is invisible. A wrong permutation produces a fully
well-formed prediction file in which every row is confidently wrong.
"""

from __future__ import annotations

import unittest

from ourobion_model_lab.errors import ConfigError
from ourobion_model_lab.inference.runners._engine import build_label_permutation
from ourobion_model_lab.inference.runners.viceroy import LABEL_ALIASES as VICEROY_ALIASES
from ourobion_model_lab.inference.runners.zebra import LABEL_ALIASES as ZEBRA_ALIASES
from ourobion_model_lab.inference.schemas import VICEROY_LABELS, ZEBRA_LABELS


class TestZebraPermutation(unittest.TestCase):
    def test_identity_when_checkpoint_order_matches(self):
        id2label = {0: "supported", 1: "contradicted", 2: "insufficient_evidence"}
        perm = build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertEqual(perm, [0, 1, 2])

    def test_permutation_when_checkpoint_order_differs(self):
        """The case a positional assumption would get silently wrong."""
        id2label = {0: "CONTRADICTION", 1: "NEUTRAL", 2: "ENTAILMENT"}
        perm = build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        # declared order is (supported, contradicted, insufficient_evidence)
        self.assertEqual(perm, [2, 0, 1])

    def test_nli_vocabulary_is_resolved(self):
        id2label = {0: "entailment", 1: "neutral", 2: "contradiction"}
        perm = build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertEqual(perm, [0, 2, 1])

    def test_case_and_separator_variants_resolve(self):
        id2label = {0: "Not-Enough-Info", 1: "SUPPORTS", 2: "refutes"}
        perm = build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertEqual(perm, [1, 2, 0])

    def test_string_keys_are_accepted(self):
        id2label = {"0": "supported", "1": "contradicted", "2": "insufficient_evidence"}
        perm = build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertEqual(perm, [0, 1, 2])


class TestRefusalToGuess(unittest.TestCase):
    def test_anonymous_label_names_fail_closed(self):
        """LABEL_0/1/2 carry no class information, so no permutation is safe."""
        id2label = {0: "LABEL_0", 1: "LABEL_1", 2: "LABEL_2"}
        with self.assertRaises(ConfigError) as ctx:
            build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        message = str(ctx.exception)
        self.assertIn("Refusing to assume positional order", message)
        # The message must name what it actually found, so the fix is obvious.
        self.assertIn("label_0", message)

    def test_partially_unknown_labels_fail_closed(self):
        id2label = {0: "supported", 1: "contradicted", 2: "something_new"}
        with self.assertRaises(ConfigError) as ctx:
            build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertIn("insufficient_evidence", str(ctx.exception))

    def test_duplicate_mapping_is_ambiguous_and_refused(self):
        id2label = {0: "entailment", 1: "supported", 2: "neutral"}
        with self.assertRaises(ConfigError) as ctx:
            build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)
        self.assertIn("ambiguous", str(ctx.exception))

    def test_non_integer_key_is_refused(self):
        id2label = {"first": "supported"}
        with self.assertRaises(ConfigError):
            build_label_permutation(id2label, declared=ZEBRA_LABELS, aliases=ZEBRA_ALIASES)


class TestViceroyPermutation(unittest.TestCase):
    def test_identity_order(self):
        id2label = dict(enumerate(VICEROY_LABELS))
        perm = build_label_permutation(id2label, declared=VICEROY_LABELS, aliases=VICEROY_ALIASES)
        self.assertEqual(perm, [0, 1, 2, 3])

    def test_shipped_checkpoint_id2label_resolves(self):
        """The exact id2label read from release sha256-751fbf1f…'s config.json."""
        id2label = {
            "0": "no_relationship",
            "1": "direct_causal",
            "2": "conditional_causal",
            "3": "correlational",
        }
        perm = build_label_permutation(id2label, declared=VICEROY_LABELS, aliases=VICEROY_ALIASES)
        self.assertEqual(perm, [0, 1, 2, 3])

    def test_alias_vocabulary_resolves(self):
        id2label = {0: "none", 1: "correlation", 2: "direct", 3: "conditional"}
        perm = build_label_permutation(id2label, declared=VICEROY_LABELS, aliases=VICEROY_ALIASES)
        # declared is (no_relationship, direct_causal, conditional_causal, correlational)
        self.assertEqual(perm, [0, 2, 3, 1])

    def test_bare_causal_is_not_aliased(self):
        """`causal` cannot be resolved: it does not say direct or conditional.

        Aliasing it would silently collapse the one distinction this model
        exists to draw, so it must fail and force a deliberate decision.
        """
        self.assertNotIn("causal", VICEROY_ALIASES)
        id2label = {0: "no_relationship", 1: "causal", 2: "conditional_causal", 3: "correlational"}
        with self.assertRaises(ConfigError):
            build_label_permutation(id2label, declared=VICEROY_LABELS, aliases=VICEROY_ALIASES)

    def test_no_alias_targets_mechanistic(self):
        """`mechanistic` is not a class of this checkpoint, so nothing may map to it."""
        self.assertNotIn("mechanistic", VICEROY_LABELS)
        self.assertNotIn("mechanistic", set(VICEROY_ALIASES.values()))

    def test_missing_class_fails_closed(self):
        id2label = {0: "no_relationship", 1: "direct_causal", 2: "conditional_causal"}
        with self.assertRaises(ConfigError):
            build_label_permutation(id2label, declared=VICEROY_LABELS, aliases=VICEROY_ALIASES)


class TestAliasTablesAreDisjointAndSane(unittest.TestCase):
    def test_no_alias_targets_an_undeclared_label(self):
        for aliases, declared in (
            (ZEBRA_ALIASES, ZEBRA_LABELS),
            (VICEROY_ALIASES, VICEROY_LABELS),
        ):
            for source, target in aliases.items():
                with self.subTest(alias=source):
                    self.assertIn(target, declared)

    def test_no_alias_shadows_a_declared_label_with_a_different_meaning(self):
        for aliases, declared in (
            (ZEBRA_ALIASES, ZEBRA_LABELS),
            (VICEROY_ALIASES, VICEROY_LABELS),
        ):
            for source, target in aliases.items():
                if source in declared:
                    with self.subTest(alias=source):
                        self.assertEqual(source, target)


if __name__ == "__main__":
    unittest.main()
