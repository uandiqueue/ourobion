"""Viceroy Causal-Language-Risk v0 — data processing.

THE ONE RULE THIS MODULE EXISTS TO ENFORCE
-------------------------------------------
This model detects **which causal language an author used** in a conclusion sentence. That is not
the same question as **what a specific claim's independently retrieved evidence licenses**, which
is what the product contract's ``EdgeVerification.claimKindCheck`` asks. The original plan
conflated the two; an independent review found the task mismatched, and the correction — accepted
in full — was to rescope and rename the model to ``viceroy-causal-language-risk-v0``.

So this module is structurally forbidden from producing a contract verdict:

  * ``CONTRACT_MAP`` maps native labels to an *advisory* ``ClaimKind`` string or to ``None``
    (abstain). It is the only mapping in the bundle, and ``preflight_check_scope_boundary``
    inspects it mechanically at preflight time.
  * ``mechanistic`` is never a value in that map. No public supervision labels conclusion
    sentences as mechanistic in the contract's sense, so this model has *no opinion* on it. An
    absent ``mechanistic`` prediction must never be read as "not mechanistic".
  * ``no_relationship`` maps to ``None``, never to ``RelationKind.no_effect``. Meta-research finds
    over 80% of titles misinterpret non-significance as support for the null, so a classifier
    trained on author phrasing learns the authors' spin: absence of evidence and evidence of
    absence look identical at the sentence level.

If you find yourself widening ``CONTRACT_MAP`` so the output can fill a contract field, stop —
that mapping is not authorised and was explicitly rejected during review.

Label ids
---------
The released corpus encodes labels as integers in a ``label`` column. Verified against the
distributed file (3,061 rows) and against the training plan's published per-class counts, which
agree exactly:

    0 -> no_relationship     (1,356)
    1 -> direct_causal         (494)
    2 -> conditional_causal    (213)
    3 -> correlational         (998)

Provenance note
---------------
The released labelled file has exactly two columns, ``sentence`` and ``label`` — there is **no
paper identifier**. That is a measured property of the corpus, not an oversight in this bundle,
and it is the single most consequential fact about how folds must be built. See ``viceroy.splits``
and LEAKAGE.md.
"""

import hashlib
import json
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Sequence

from .config import ViceroyConfig

# --- constants -------------------------------------------------------------------------------

NATIVE_LABEL_IDS: dict[int, str] = {
    0: "no_relationship",
    1: "direct_causal",
    2: "conditional_causal",
    3: "correlational",
}

CLASS_NAMES: tuple[str, ...] = (
    "no_relationship",
    "direct_causal",
    "conditional_causal",
    "correlational",
)

# Advisory mapping to the product's ClaimKind vocabulary. ``None`` means "this model abstains" —
# it is NOT a prediction of absence. Read this module's docstring before touching it.
CONTRACT_MAP: dict[str, str | None] = {
    "no_relationship": None,  # abstain — never RelationKind.no_effect
    "direct_causal": "causal",
    "conditional_causal": "causal",  # a hedged causal claim is still causal; sub-label kept in logs
    "correlational": "correlational",
}

# ClaimKind values this model must never emit, and why. Checked mechanically at preflight.
NEVER_PREDICTED: tuple[str, ...] = ("mechanistic",)

# Bumped whenever the *logic* of preprocessing changes materially (normalization, dedup key,
# similarity tokenization). Feeds preprocessing_version_hash so stale cached rows are detectable.
_CODE_VERSION = "viceroy-data-v1"

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*")


# --- raw / processed row shapes ---------------------------------------------------------------


@dataclass(frozen=True)
class RawExample:
    """One row as it comes out of ``pubmed_causal_language_use.csv``.

    ``pmid`` is ``None`` for every row of the released labelled corpus — the file does not carry
    one. It is modelled here anyway because the repository's *unlabelled* sample file
    (``sample_new_sentences.csv``) does have a ``pmid`` column, so a PMID-carrying version of the
    labelled data is conceivable later; ``viceroy.splits`` will use it if it ever appears, and
    fails closed rather than half-using it if it appears for only some rows.
    """

    row_id: int
    sentence: str
    native_label_id: int
    pmid: str | None = None


@dataclass(frozen=True)
class ProcessedExample:
    """One fully-built training row. Every field here exists so a row's provenance can be
    reconstructed later — "no row without lineage"."""

    example_id: str
    row_id: int
    pmid: str | None
    sentence_text: str
    label: str  # one of CLASS_NAMES
    native_label_id: int
    token_count: int
    dedup_key: str  # hash of the normalized text; equal keys are exact duplicates
    preprocessing_version: str
    raw_source_hash: str


# --- text normalization ------------------------------------------------------------------------


def _strip_unpaired_wrapping_quotes(text: str) -> str:
    """Removes a leading or trailing double quote left over from CSV quoting when it has no
    partner inside the string.

    This is not cosmetic. Measured on the real corpus, two rows differ from another row *only*
    by a trailing ``"`` — so without this step they escape exact-duplicate detection, survive
    dedup as "distinct" sentences, and can land on opposite sides of a fold boundary. A
    normalization gap is a leakage gap.
    """
    if text.count('"') % 2 == 0:
        return text
    if text.endswith('"'):
        return text[:-1]
    if text.startswith('"'):
        return text[1:]
    return text


def normalize_text(text: str) -> str:
    """Unicode/whitespace normalization that does NOT alter scientific symbols.

    Uses NFC, not NFKC/NFKD: the compatibility forms fold things like superscripts, ligatures,
    and some Greek/math glyphs into plain-ASCII equivalents (e.g. a literal superscript minus
    could be folded into an ASCII hyphen), which would silently change the scientific content of
    a conclusion sentence — and this model's whole subject is the precise wording of that
    sentence. NFC only composes/reorders combining marks; it never discards a distinction the
    source text was actually making.
    """
    normalized = unicodedata.normalize("NFC", text)
    collapsed = re.sub(r"\s+", " ", normalized).strip()
    return _strip_unpaired_wrapping_quotes(collapsed).strip()


def tokens_for_similarity(text: str) -> list[str]:
    """Lowercased alphanumeric tokens used for near-duplicate detection in ``viceroy.splits``.

    Deliberately lives here, next to ``normalize_text``, so the similarity view of a sentence and
    the model's view of a sentence can never drift apart: grouping decisions must be made on the
    same normalized text the model is trained on.
    """
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _map_native_label(native_label_id: int) -> str:
    try:
        return NATIVE_LABEL_IDS[int(native_label_id)]
    except (KeyError, ValueError, TypeError) as exc:
        raise ValueError(
            f"unrecognized native label id {native_label_id!r}; expected one of "
            f"{sorted(NATIVE_LABEL_IDS)}"
        ) from exc


def map_to_contract_claim_kind(label: str) -> str | None:
    """Advisory native-label -> ``ClaimKind`` mapping. Returns ``None`` when this model abstains.

    ``None`` means "no opinion", never "no relationship exists" and never
    ``RelationKind.no_effect``. This function exists so the one legitimate mapping is written
    once, in a place the preflight check can inspect — not so that a caller can fill a contract
    field with it. Nothing in this bundle writes a contract field.
    """
    if label not in CONTRACT_MAP:
        raise ValueError(f"unknown native label {label!r}; expected one of {CLASS_NAMES}")
    return CONTRACT_MAP[label]


# --- lineage hashing ----------------------------------------------------------------------------


def preprocessing_version_hash(config: ViceroyConfig) -> str:
    """Hash over the preprocessing *logic* version and the config knobs that affect it. Changes
    whenever normalization, the dedup key, or the similarity tokenizer change, so stale cached
    rows are detectable rather than silently reused."""
    payload = {
        "code_version": _CODE_VERSION,
        "normalization": "unicodedata.NFC+whitespace-collapse+unpaired-quote-strip",
        "similarity_tokenizer": "lowercase-alnum-with-internal-hyphen-apostrophe",
        "max_seq_len": config.max_seq_len,
    }
    blob = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _raw_source_hash(raw: RawExample) -> str:
    """Per-row content hash of the raw fields, so a row's source content can later be verified
    unchanged. This is a per-row hash, not a whole-dataset fingerprint; ``fetch_assets.py``
    additionally records a single whole-file sha256 in ``data-manifest.json``, since a per-row
    hash alone cannot catch e.g. a whole row silently dropped."""
    payload = {
        "row_id": raw.row_id,
        "sentence": raw.sentence,
        "native_label_id": raw.native_label_id,
        "pmid": raw.pmid,
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def dedup_key_for(normalized_text: str) -> str:
    """Stable key for exact-duplicate detection: a hash of the *normalized* text. Two rows with
    the same key are the same sentence and must never be separated by a fold boundary."""
    return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()[:32]


# --- row assembly ---------------------------------------------------------------------------


def _count_tokens(tokenizer: object, text: str) -> int:
    return len(tokenizer.tokenize(text))


def build_example(
    raw: RawExample,
    config: ViceroyConfig,
    *,
    tokenizer: object,
    preprocessing_version: str | None = None,
) -> ProcessedExample:
    """Builds one training row.

    Unlike the Zebra bundle there is no evidence-selection step to keep label-blind: the input is
    the conclusion sentence and nothing else, so there is no retrieval policy that could learn to
    encode the label. The corresponding risk here is different in kind — it is *provenance*
    leakage between folds — and it is handled in ``viceroy.splits``, not here.

    Truncation is by the tokenizer at encode time (``config.max_seq_len`` = 256 wordpieces, well
    above the measured p90 of ~30 whitespace tokens); ``token_count`` is recorded per row so a
    reader can confirm from the artifact that truncation was not silently binding.
    """
    sentence_text = normalize_text(raw.sentence)
    label = _map_native_label(raw.native_label_id)
    version_hash = preprocessing_version or preprocessing_version_hash(config)

    return ProcessedExample(
        example_id=f"row:{raw.row_id}",
        row_id=raw.row_id,
        pmid=raw.pmid,
        sentence_text=sentence_text,
        label=label,
        native_label_id=int(raw.native_label_id),
        token_count=_count_tokens(tokenizer, sentence_text),
        dedup_key=dedup_key_for(sentence_text),
        preprocessing_version=version_hash,
        raw_source_hash=_raw_source_hash(raw),
    )


def build_dataset(
    raw_examples: Sequence[RawExample],
    config: ViceroyConfig,
    *,
    tokenizer: object,
) -> list[ProcessedExample]:
    """Convenience wrapper: ``build_example`` over the whole corpus, sharing one
    preprocessing_version_hash computation instead of recomputing it per row."""
    version_hash = preprocessing_version_hash(config)
    return [
        build_example(raw, config, tokenizer=tokenizer, preprocessing_version=version_hash)
        for raw in raw_examples
    ]


# --- corpus reports ----------------------------------------------------------------------------


def class_distribution_report(examples: Sequence[ProcessedExample]) -> dict:
    """Per-class counts and shares, plus the majority-class accuracy a trivial predictor would
    score. That last number exists so nobody can quote a headline accuracy without the reader
    immediately seeing what accuracy means for free on this corpus (~0.44)."""
    counts = Counter(e.label for e in examples)
    n = len(examples)
    ordered = {cls: counts.get(cls, 0) for cls in CLASS_NAMES}
    majority = max(ordered.values()) if n else 0
    return {
        "n": n,
        "counts": ordered,
        "shares": {cls: (c / n if n else 0.0) for cls, c in ordered.items()},
        "majority_class_accuracy": (majority / n) if n else 0.0,
        "imbalance_ratio": (max(ordered.values()) / min(ordered.values()))
        if n and min(ordered.values()) > 0
        else None,
    }


def token_length_report(examples: Sequence[ProcessedExample], config: ViceroyConfig) -> dict:
    """Token-length distribution and how many rows would actually be truncated at
    ``config.max_seq_len``. If ``n_truncated`` is anything but 0, say so when reporting results:
    a truncated conclusion sentence may have lost the very clause that carries the causal claim.
    """
    lengths = sorted(e.token_count for e in examples)
    n = len(lengths)
    if n == 0:
        return {"n": 0, "min": None, "p50": None, "p90": None, "max": None, "n_truncated": 0}

    def percentile(p: float) -> int:
        idx = min(n - 1, max(0, int(round(p * n)) - 1))
        return lengths[idx]

    return {
        "n": n,
        "min": lengths[0],
        "p50": percentile(0.5),
        "p90": percentile(0.9),
        "max": lengths[-1],
        "n_truncated": sum(1 for length in lengths if length > config.max_seq_len),
        "max_seq_len": config.max_seq_len,
    }


def conflicting_label_report(examples: Sequence[ProcessedExample]) -> dict:
    """Finds normalized sentences carrying more than one distinct label.

    The real corpus contains one such sentence (measured). Keeping both copies would place
    contradictory supervision on two sides of a fold boundary — the model is asked to learn a
    rule and then penalised for applying it — so ``viceroy.splits`` drops them by default. What
    matters is that the count is *reported*, not that it is small: a corpus that quietly
    contradicts itself is a fact about the ceiling on achievable accuracy.
    """
    labels_by_key: dict[str, set[str]] = {}
    rows_by_key: dict[str, list[int]] = {}
    text_by_key: dict[str, str] = {}
    for e in examples:
        labels_by_key.setdefault(e.dedup_key, set()).add(e.label)
        rows_by_key.setdefault(e.dedup_key, []).append(e.row_id)
        text_by_key[e.dedup_key] = e.sentence_text

    conflicts = {k: v for k, v in labels_by_key.items() if len(v) > 1}
    return {
        "n_conflicting_texts": len(conflicts),
        "n_conflicting_rows": sum(len(rows_by_key[k]) for k in conflicts),
        "examples": [
            {
                "dedup_key": k,
                "labels": sorted(labels_by_key[k]),
                "row_ids": sorted(rows_by_key[k]),
                "sentence": text_by_key[k],
            }
            for k in sorted(conflicts)
        ],
    }


# --- preflight self-check: mechanically verify the scope boundary -----------------------------


def preflight_check_scope_boundary(
    contract_map: dict[str, str | None] | None = None,
    never_predicted: Sequence[str] = NEVER_PREDICTED,
) -> None:
    """Inspects ``CONTRACT_MAP`` and raises if this model's scope boundary has been widened.

    This is the Viceroy analogue of the Zebra bundle's label-blindness signature check: the
    guarantee that matters most for this model is checked mechanically at preflight, not merely
    documented. Checks, in order:

      1. the map covers exactly the four native classes and nothing else;
      2. no native class maps to a ``never_predicted`` kind (``mechanistic``) — no supervision
         for it exists, so a prediction would be manufactured;
      3. ``no_relationship`` maps to ``None`` (abstain), never to a kind and never to
         ``no_effect``;
      4. no mapping value anywhere mentions ``no_effect``.
    """
    cmap = CONTRACT_MAP if contract_map is None else contract_map

    if set(cmap) != set(CLASS_NAMES):
        raise ValueError(
            f"CONTRACT_MAP must cover exactly the native classes {CLASS_NAMES}, got "
            f"{tuple(sorted(cmap))}"
        )

    for native, kind in cmap.items():
        if kind is None:
            continue
        lowered = str(kind).lower()
        for forbidden in never_predicted:
            if forbidden.lower() in lowered:
                raise ValueError(
                    f"CONTRACT_MAP[{native!r}] = {kind!r}: this model must never predict "
                    f"{forbidden!r} — no public corpus labels conclusion sentences as "
                    f"{forbidden} in the contract's sense, so any such prediction would be "
                    "manufactured rather than learned"
                )
        if "no_effect" in lowered:
            raise ValueError(
                f"CONTRACT_MAP[{native!r}] = {kind!r}: mapping any native class to "
                "RelationKind.no_effect is not authorised — sentence-level 'no relationship "
                "was found' is authors' phrasing about one paper, not edge-level evidence of "
                "absence across a body of literature"
            )

    if cmap.get("no_relationship") is not None:
        raise ValueError(
            "CONTRACT_MAP['no_relationship'] must be None (abstain), got "
            f"{cmap['no_relationship']!r} — over 80% of titles misinterpret non-significance as "
            "support for the null, so this class records author phrasing, not a demonstrated "
            "absence of effect"
        )
