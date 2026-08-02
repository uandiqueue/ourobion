"""Zebra NLI Shadow v0 — data processing.

THE ONE RULE THIS MODULE EXISTS TO ENFORCE
-------------------------------------------
An earlier design built the evidence window *differently depending on the label*: gold
rationale sentences for supported/contradicted rows, BM25-selected sentences for NEI rows.
That lets a classifier learn the input-*selection* policy instead of entailment, and at
inference time there are no gold rationales at all — it would inflate the headline number and
make the experiment worthless.

So the evidence-selection function is structurally forbidden from ever seeing the label:

    def select_evidence_sentences(claim_text: str, abstract_sentences: Sequence[str], config) -> SelectedEvidence

Its signature is exactly ``(claim_text, abstract_sentences, config)``. There is no fourth
parameter, no ``**kwargs`` it could be smuggled through, and ``config`` is the frozen, global,
example-independent training recipe (``zebra.config.ZebraConfig``) — it has no per-row field a
label could ever occupy. ``preflight_check_label_blind`` (bottom of this file) inspects the
callable's signature with ``inspect.signature`` and raises if this shape is violated, so the
guarantee is checked mechanically, not just documented.

The label is attached to a row only *afterward*, by ``build_example``, which:
  1. calls the selector with only ``(claim_text, abstract_sentences, config)``,
  2. only *then* reads ``raw.verdict`` and maps it to a class name,
  3. combines the two into a ``ProcessedExample``.
The selector's return value (``SelectedEvidence``) carries no reference back to ``raw`` or to
the label, so there is no path — accidental or otherwise — by which selection could depend on
class.

Label map
---------
SciFat's ``allenai/scifact_entailment`` transform verdicts map to this project's three classes:
``SUPPORT`` -> ``supported``, ``CONTRADICT`` -> ``contradicted``, explicit ``NEI`` ->
``insufficient_evidence``. The third name is load-bearing and must never be renamed to
``uncertain``: this project's contract separates "no evidence found either way" from "could not
be grounded", and SciFact's NEI is cleanly neither, so the class is model-native and fills no
contract state.
"""

import hashlib
import inspect
import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Callable, Sequence

from .config import ZebraConfig

# --- constants -------------------------------------------------------------------------------

LABEL_MAP: dict[str, str] = {
    "SUPPORT": "supported",
    "CONTRADICT": "contradicted",
    "NEI": "insufficient_evidence",
}

CLASS_NAMES: tuple[str, ...] = ("supported", "contradicted", "insufficient_evidence")

# Bumped whenever the *logic* of preprocessing changes materially (scorer, normalization,
# truncation strategy). Feeds preprocessing_version_hash so stale cached rows are detectable.
_CODE_VERSION = "zebra-data-v1"

# Fallback special-token overhead (e.g. [CLS] claim [SEP] evidence [SEP]) used only when the
# supplied tokenizer doesn't expose num_special_tokens_to_add(pair=True).
_FALLBACK_SPECIAL_TOKENS = 3

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*")


# --- raw / processed row shapes ---------------------------------------------------------------


@dataclass(frozen=True)
class RawExample:
    """One row as it comes out of the ``allenai/scifact_entailment`` transform.

    ASSUMPTION (unverified from this offline environment — see the schema note at the bottom
    of the report): each row already pairs one claim with exactly one evidence-bearing
    abstract, and ``evidence`` is a flat list of sentence indices into ``abstract`` that are the
    gold rationale for *this* (claim, abstract) pair. That is the point of the "_entailment"
    transform relative to raw SciFact's ``{doc_id: [rationale sets]}`` structure. NEI rows are
    expected to carry an empty ``evidence`` list.
    """

    claim_id: object
    abstract_id: object
    claim: str
    title: str
    abstract: tuple[str, ...]
    verdict: str  # "SUPPORT" | "CONTRADICT" | "NEI"
    evidence: tuple[int, ...] = ()


@dataclass(frozen=True)
class SelectedEvidence:
    """The output of an evidence-selection function. Deliberately carries nothing that traces
    back to the label or to ``raw`` — just sentence identity, text, and (for audit purposes) the
    scores that produced the selection."""

    sentence_ids: tuple[int, ...]
    sentences: tuple[str, ...]
    scores: tuple[float, ...]
    method: str  # "retrieved" | "oracle"


@dataclass(frozen=True)
class ProcessedExample:
    """One fully-built training row. Every field here exists so a row's provenance can be
    reconstructed later — "no row without lineage"."""

    example_id: str
    claim_id: object
    abstract_id: object
    split: str  # e.g. "train" | "dev"
    source_sentence_ids: tuple[int, ...]
    claim_text: str
    evidence_text: str
    label: str  # one of CLASS_NAMES
    evidence_method: str  # "retrieved" | "oracle"
    claim_token_count: int
    evidence_token_count: int
    total_token_count: int
    gold_overlap: float | None  # None when the row has no gold rationale to compare against
    preprocessing_version: str
    raw_source_hash: str


# --- text normalization ------------------------------------------------------------------------


def normalize_text(text: str) -> str:
    """Unicode/whitespace normalization that does NOT alter scientific symbols.

    Uses NFC, not NFKC/NFKD: the compatibility forms fold things like superscripts, ligatures,
    and some Greek/math glyphs into plain-ASCII equivalents (e.g. a literal superscript minus
    could be folded into an ASCII hyphen), which would silently change the scientific content of
    a claim or abstract sentence. NFC only composes/reorders combining marks; it never discards
    a distinction the source text was actually making.
    """
    normalized = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", normalized).strip()


def _map_label(verdict: str) -> str:
    try:
        return LABEL_MAP[verdict]
    except KeyError as exc:
        raise ValueError(
            f"unrecognized SciFact verdict {verdict!r}; expected one of {sorted(LABEL_MAP)}"
        ) from exc


# --- label-blind lexical scorer (BM25-style, pure stdlib, deterministic) ----------------------


def _tokenize_for_scoring(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _bm25_scores(
    query_tokens: Sequence[str],
    doc_token_lists: Sequence[Sequence[str]],
    k1: float,
    b: float,
) -> list[float]:
    """Deterministic BM25-style overlap score of a claim against each abstract sentence.

    Plain Python/NumPy-free implementation (stdlib only) so there is no dependency beyond what
    requirements-macos.txt already pins. Iterates over sorted unique query terms and over the
    documents in their given order, so summation order — and therefore the floating-point
    result — is fixed given fixed inputs; no randomness anywhere.
    """
    n_docs = len(doc_token_lists)
    if n_docs == 0:
        return []
    doc_lengths = [len(d) for d in doc_token_lists]
    avg_doc_length = (sum(doc_lengths) / n_docs) if n_docs else 0.0
    query_terms = sorted(set(query_tokens))  # sorted: deterministic regardless of input order
    doc_frequency = {t: sum(1 for d in doc_token_lists if t in d) for t in query_terms}
    idf = {
        t: math.log(1 + (n_docs - doc_frequency[t] + 0.5) / (doc_frequency[t] + 0.5))
        for t in query_terms
    }
    scores: list[float] = []
    for doc_tokens, doc_length in zip(doc_token_lists, doc_lengths):
        term_counts = Counter(doc_tokens)
        score = 0.0
        for t in query_terms:
            tf = term_counts.get(t, 0)
            if tf == 0:
                continue
            norm = 1 - b + b * (doc_length / avg_doc_length) if avg_doc_length > 0 else 1.0
            denom = tf + k1 * norm
            score += idf[t] * (tf * (k1 + 1)) / denom
        scores.append(score)
    return scores


def _priority_order(indices: Sequence[int], scores: Sequence[float]) -> list[int]:
    """Deterministic ranking: highest score first, ties broken by lower original index first.
    Used both for top-k selection and (within the selected set) for truncation-drop order, so
    the same tie-break rule applies everywhere."""
    paired = sorted(zip(indices, scores), key=lambda pair: (-pair[1], pair[0]))
    return [i for i, _ in paired]


# --- the label-blind selector (and its oracle counterpart) --------------------------------------


def select_evidence_sentences(
    claim_text: str, abstract_sentences: Sequence[str], config: ZebraConfig
) -> SelectedEvidence:
    """Label-blind evidence retrieval: the SAME scorer, sentence count, and tie-break rule for
    every class. Signature is exactly ``(claim_text, abstract_sentences, config)`` — see this
    module's docstring for why that shape is the whole point. Do not add a parameter here.

    ``config`` supplies ``evidence_top_k`` / ``bm25_k1`` / ``bm25_b``; it is the same frozen,
    global recipe object for the entire dataset, not a per-row object, so it cannot carry a
    per-example label even in principle.
    """
    normalized_claim = normalize_text(claim_text)
    normalized_sentences = [normalize_text(s) for s in abstract_sentences]
    query_tokens = _tokenize_for_scoring(normalized_claim)
    doc_token_lists = [_tokenize_for_scoring(s) for s in normalized_sentences]
    scores = _bm25_scores(query_tokens, doc_token_lists, k1=config.bm25_k1, b=config.bm25_b)

    all_indices = list(range(len(normalized_sentences)))
    ranked = _priority_order(all_indices, scores)
    top_k = ranked[: config.evidence_top_k]
    chosen = sorted(top_k)  # restore source order per-requirement ("preserve source sentence order")

    return SelectedEvidence(
        sentence_ids=tuple(chosen),
        sentences=tuple(normalized_sentences[i] for i in chosen),
        scores=tuple(scores[i] for i in chosen),
        method="retrieved",
    )


def select_oracle_evidence_sentences(
    gold_sentence_ids: Sequence[int], abstract_sentences: Sequence[str], config: ZebraConfig
) -> SelectedEvidence:
    """SECONDARY ANALYSIS ONLY. Uses the gold rationale sentence indices directly, which is
    exactly the label-dependent shortcut this module otherwise exists to prevent (NEI rows
    typically have no gold rationale at all, so this mode trivially separates NEI from the
    other two classes by evidence *presence* alone). It exists only so an oracle-evidence upper
    bound can be reported alongside the real, label-blind result — never as the training path.

    Only reachable when ``config.oracle_evidence`` is explicitly set to ``True``; see
    ``build_example`` for the single dispatch point. There is deliberately no default that
    enables this.
    """
    normalized_sentences = [normalize_text(s) for s in abstract_sentences]
    n = len(normalized_sentences)
    chosen = sorted({int(i) for i in gold_sentence_ids if 0 <= int(i) < n})
    return SelectedEvidence(
        sentence_ids=tuple(chosen),
        sentences=tuple(normalized_sentences[i] for i in chosen),
        scores=tuple(1.0 for _ in chosen),
        method="oracle",
    )


# --- token-budget truncation (evidence truncates, never the claim) -----------------------------


def _count_tokens(tokenizer: object, text: str) -> int:
    return len(tokenizer.tokenize(text))


def fit_evidence_to_budget(
    claim_text: str,
    evidence_sentences: Sequence[str],
    tokenizer: object,
    config: ZebraConfig,
) -> tuple[list[str], int, int]:
    """Caps the (claim, evidence) pair at ``config.max_seq_len`` wordpiece tokens by truncating
    evidence, never the claim. Accepts a tokenizer object (any object exposing ``.tokenize(str)
    -> list[str]``, e.g. a Hugging Face ``PreTrainedTokenizer``) so the cap is enforced against
    the real wordpiece count rather than an estimate; tokenizer *construction* deliberately does
    not happen in this module (that's cli.py's / model.py's job).

    Returns ``(kept_evidence_sentences, evidence_token_count, claim_token_count)``.

    Sentences are dropped/truncated from the end of ``evidence_sentences`` (i.e. the caller is
    expected to pass them in priority order if partial inclusion should prefer certain
    sentences; ``build_example`` passes them in the selector's source-order output, so in the
    rare case truncation is needed at all, the sentence that happens to sit last in the abstract
    is the one shortened first — evidence_top_k defaults small enough that this should rarely
    bind, but it is a real, documented edge case, not silently ignored).
    """
    special_tokens_fn = getattr(tokenizer, "num_special_tokens_to_add", None)
    special_tokens = (
        special_tokens_fn(pair=True) if special_tokens_fn is not None else _FALLBACK_SPECIAL_TOKENS
    )

    claim_tokens = _count_tokens(tokenizer, claim_text)
    budget = config.max_seq_len - claim_tokens - special_tokens
    if budget <= 0:
        # The claim alone already consumes the cap. Per the requirement, evidence is truncated
        # rather than the claim, so evidence gets nothing here rather than clipping the claim.
        return [], 0, claim_tokens

    kept: list[str] = []
    used = 0
    for sentence in evidence_sentences:
        sentence_tokens = _count_tokens(tokenizer, sentence)
        if used + sentence_tokens <= budget:
            kept.append(sentence)
            used += sentence_tokens
            continue
        remaining = budget - used
        if remaining > 0:
            pieces = tokenizer.tokenize(sentence)[:remaining]
            to_string = getattr(tokenizer, "convert_tokens_to_string", None)
            truncated = to_string(pieces) if to_string is not None else " ".join(pieces)
            kept.append(truncated)
            used += remaining
        break

    return kept, used, claim_tokens


# --- lineage hashing ----------------------------------------------------------------------------


def preprocessing_version_hash(config: ZebraConfig) -> str:
    """Hash over the preprocessing *logic* version and the config knobs that affect it. Changes
    whenever the scorer, its parameters, normalization, or the oracle/retrieved switch change,
    so stale cached rows are detectable rather than silently reused."""
    payload = {
        "code_version": _CODE_VERSION,
        "scorer": "bm25_lexical_overlap",
        "bm25_k1": config.bm25_k1,
        "bm25_b": config.bm25_b,
        "evidence_top_k": config.evidence_top_k,
        "max_seq_len": config.max_seq_len,
        "oracle_evidence": config.oracle_evidence,
        "normalization": "unicodedata.NFC+whitespace-collapse",
    }
    blob = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _raw_source_hash(raw: RawExample) -> str:
    """Per-row content hash of the raw fields, so a row's source content can later be verified
    unchanged. This is a per-row hash, not a whole-dataset fingerprint; the loader that reads
    the dataset off disk (out of scope here — cli.py / fetch_assets.py) should additionally
    record a single whole-dataset hash (e.g. a file sha256 or the HF `datasets` fingerprint) in
    the run manifest once, since a per-row hash alone cannot catch e.g. a whole row silently
    dropped."""
    payload = {
        "claim_id": raw.claim_id,
        "abstract_id": raw.abstract_id,
        "claim": raw.claim,
        "title": raw.title,
        "abstract": list(raw.abstract),
        "verdict": raw.verdict,
        "evidence": list(raw.evidence),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _make_example_id(claim_id: object, abstract_id: object, split: str) -> str:
    return f"{split}:{claim_id}:{abstract_id}"


def _overlap_with_gold(selected_ids: Sequence[int], gold_ids: Sequence[int]) -> float | None:
    """Fraction of the gold rationale recovered by selection. ``None`` (not applicable) when the
    row has no gold rationale at all — this is expected and common for NEI rows, and must be
    reported as "not applicable", not coerced into 0.0, which would look like a real miss."""
    gold_set = {int(g) for g in gold_ids}
    if not gold_set:
        return None
    selected_set = set(selected_ids)
    return len(selected_set & gold_set) / len(gold_set)


# --- row assembly: the single point where selection and label are combined ---------------------


def build_example(
    raw: RawExample,
    config: ZebraConfig,
    *,
    tokenizer: object,
    source_split: str,
    preprocessing_version: str | None = None,
) -> ProcessedExample:
    """Builds one training row. This is the ONLY place in this module where the label and the
    evidence-selection machinery are both in scope, and the order of operations below is the
    structural enforcement of label-blindness, not just a description of intent:

        1. select evidence by calling the selector with ONLY (claim_text, abstract_sentences,
           config) — `raw` and `raw.verdict` are never passed in;
        2. only THEN read `raw.verdict` and map it to a class name, in a separate step, from a
           separate function (`_map_label`), operating on `raw` directly rather than on
           anything the selector returned;
        3. combine the two (plus lineage fields) into a `ProcessedExample`.

    The oracle-evidence path (`config.oracle_evidence = True`) is the one place this function
    deliberately breaks label-blindness for a clearly-separate, off-by-default secondary
    analysis; see `select_oracle_evidence_sentences`.
    """
    claim_text = normalize_text(raw.claim)
    abstract_sentences = list(raw.abstract)

    if config.oracle_evidence:
        selected = select_oracle_evidence_sentences(raw.evidence, abstract_sentences, config)
    else:
        selected = select_evidence_sentences(claim_text, abstract_sentences, config)

    # Label is attached only now — after selection has already run and returned — and comes
    # from `raw` directly, never from `selected`.
    label = _map_label(raw.verdict)

    evidence_sentences, evidence_token_count, claim_token_count = fit_evidence_to_budget(
        claim_text, list(selected.sentences), tokenizer, config
    )
    evidence_text = " ".join(evidence_sentences)

    gold_overlap = _overlap_with_gold(selected.sentence_ids, raw.evidence)
    version_hash = preprocessing_version or preprocessing_version_hash(config)

    return ProcessedExample(
        example_id=_make_example_id(raw.claim_id, raw.abstract_id, source_split),
        claim_id=raw.claim_id,
        abstract_id=raw.abstract_id,
        split=source_split,
        source_sentence_ids=selected.sentence_ids,
        claim_text=claim_text,
        evidence_text=evidence_text,
        label=label,
        evidence_method=selected.method,
        claim_token_count=claim_token_count,
        evidence_token_count=evidence_token_count,
        total_token_count=claim_token_count + evidence_token_count,
        gold_overlap=gold_overlap,
        preprocessing_version=version_hash,
        raw_source_hash=_raw_source_hash(raw),
    )


def build_dataset(
    raw_examples: Sequence[RawExample],
    config: ZebraConfig,
    *,
    tokenizer: object,
    source_split: str,
) -> list[ProcessedExample]:
    """Convenience wrapper: `build_example` over a whole split, sharing one
    preprocessing_version_hash computation instead of recomputing it per row."""
    version_hash = preprocessing_version_hash(config)
    return [
        build_example(
            raw,
            config,
            tokenizer=tokenizer,
            source_split=source_split,
            preprocessing_version=version_hash,
        )
        for raw in raw_examples
    ]


# --- shortcut detectors: the audit this whole module exists to make possible -------------------


def _distribution_summary(values: Sequence[float | int | None]) -> dict:
    applicable = sorted(v for v in values if v is not None)
    n_total = len(values)
    n_applicable = len(applicable)
    if n_applicable == 0:
        return {
            "n": n_total,
            "n_applicable": 0,
            "mean": None,
            "min": None,
            "max": None,
            "p50": None,
            "p90": None,
        }

    def percentile(p: float) -> float:
        idx = min(n_applicable - 1, max(0, math.ceil(p * n_applicable) - 1))
        return applicable[idx]

    return {
        "n": n_total,
        "n_applicable": n_applicable,
        "mean": sum(applicable) / n_applicable,
        "min": applicable[0],
        "max": applicable[-1],
        "p50": percentile(0.5),
        "p90": percentile(0.9),
    }


def evidence_shortcut_report(examples: Sequence[ProcessedExample]) -> dict[str, dict]:
    """Per-class evidence token-length distribution and retrieval-overlap-with-gold
    distribution — the two shortcut detectors this design is built around. If either
    distribution differs sharply by class (e.g. `insufficient_evidence` rows are
    systematically shorter, or have systematically lower gold overlap, than the other two),
    that is exactly the failure mode a label-dependent evidence policy would produce, and the
    run should stop and investigate before trusting any headline number — even though this
    module's construction makes that failure mode structurally much harder to reintroduce.
    """
    report: dict[str, dict] = {}
    for cls in CLASS_NAMES:
        subset = [e for e in examples if e.label == cls]
        report[cls] = {
            "n": len(subset),
            "evidence_token_length": _distribution_summary([e.evidence_token_count for e in subset]),
            "gold_overlap": _distribution_summary([e.gold_overlap for e in subset]),
        }
    return report


# --- preflight self-check: mechanically verify the label-blind guarantee -----------------------

_DEFAULT_EXPECTED_PARAMS: tuple[str, ...] = ("claim_text", "abstract_sentences", "config")
_LABEL_LIKE_TOKENS: tuple[str, ...] = (
    "label",
    "verdict",
    "target",
    "answer",
    "class_id",
    "classname",
    "y_true",
    "gold_label",
    "ground_truth",
)


def preflight_check_label_blind(
    fn: Callable[..., SelectedEvidence],
    expected_params: Sequence[str] = _DEFAULT_EXPECTED_PARAMS,
) -> None:
    """Inspects `fn`'s signature and raises if it is not label-blind by construction. Meant to
    be called on the primary retrieval function (`select_evidence_sentences`), e.g. from a test:

        from zebra.data import preflight_check_label_blind, select_evidence_sentences
        def test_selector_is_label_blind():
            preflight_check_label_blind(select_evidence_sentences)

    Checks, in order:
      1. no ``*args`` / ``**kwargs`` (either could smuggle a label through undetected);
      2. the parameter names match `expected_params` exactly, in order;
      3. none of the parameter names look label-like (defense in depth, in case
         `expected_params` is ever loosened).
    """
    sig = inspect.signature(fn)
    params = list(sig.parameters.values())

    for p in params:
        if p.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
            raise TypeError(
                f"{getattr(fn, '__name__', fn)!r}: *args/**kwargs are not allowed on a "
                f"label-blind evidence selector (found {p.name!r}) — they could smuggle a "
                "label through unnoticed"
            )

    names = tuple(p.name for p in params)
    if names != tuple(expected_params):
        raise TypeError(
            f"{getattr(fn, '__name__', fn)!r}: expected exactly the parameters "
            f"{tuple(expected_params)!r}, got {names!r}"
        )

    for name in names:
        lowered = name.lower()
        if any(token in lowered for token in _LABEL_LIKE_TOKENS):
            raise ValueError(
                f"{getattr(fn, '__name__', fn)!r}: parameter {name!r} looks label-like; the "
                "evidence selector must never be able to see the label"
            )
