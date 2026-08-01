"""Sample conclusion sentences from the nao corpus for the Viceroy disagreement pilot.

Viceroy v0 classifies the causal language of a biomedical *conclusion sentence*,
so the sample must be conclusion sentences — not arbitrary abstract text, or the
test measures sentence-type mismatch instead of the model.

Sampling is stratified by topicTag and seeded, so the pilot is reproducible.
"""

from __future__ import annotations

import json
import random
import re
from collections import defaultdict

from corpus_survey import corpus_credentials, get_object

SEED = 266
N_TARGET = 100

# Conclusion cues used in biomedical abstracts. A sentence carrying one of these
# is very likely the authors' own summary claim rather than background or method.
CUE = re.compile(
    r"\b(in conclusion|we conclude|these (results|findings|data)|our (results|findings|data)"
    r"|this study (suggests|shows|demonstrates|indicates)|taken together|overall,"
    r"|collectively|the results (suggest|show|demonstrate|indicate))\b",
    re.I,
)

# Rough sentence splitter. Deliberately conservative about abbreviations that
# would otherwise split mid-sentence and produce fragments.
_ABBREV = r"(?<!\be\.g)(?<!\bi\.e)(?<!\bvs)(?<!\bcf)(?<!\bFig)(?<!\bNo)(?<!\bDr)(?<!\bet al)"
SPLIT = re.compile(_ABBREV + r"(?<=[.!?])\s+(?=[A-Z(])")


def sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"^Abstract\s+", "", text, flags=re.I)
    return [s.strip() for s in SPLIT.split(text) if s.strip()]


def is_usable(s: str) -> bool:
    if not (60 <= len(s) <= 400):
        return False
    if s.count("(") != s.count(")"):
        return False
    # Drop citation dumps, figure refs, and fragments that are mostly numerals.
    if len(re.findall(r"\d", s)) > len(s) * 0.25:
        return False
    if re.match(r"^\s*(figure|table|fig\.)", s, re.I):
        return False
    return s[0].isupper() and s.endswith((".", "?"))


def main() -> None:
    creds = corpus_credentials()
    raw = get_object(creds, "manifest/papers.jsonl").decode("utf-8", "replace")
    papers = [json.loads(line) for line in raw.splitlines() if line.strip()]

    by_topic: dict[str, list[dict]] = defaultdict(list)
    for paper in papers:
        abstract = (paper.get("abstract") or "").strip()
        if not abstract:
            continue
        sents = sentences(abstract)
        if len(sents) < 3:
            continue
        # Prefer an explicitly cued conclusion; fall back to the final sentence,
        # which in a structured abstract is nearly always the conclusion.
        cued = [s for s in sents[2:] if CUE.search(s) and is_usable(s)]
        chosen = cued[-1] if cued else (sents[-1] if is_usable(sents[-1]) else None)
        if not chosen:
            continue
        tags = paper.get("topicTags") or ["untagged"]
        tag = tags[0] if isinstance(tags[0], str) else "untagged"
        by_topic[tag].append(
            {
                "row_id": f"nao-{paper.get('paperUid', '')[:24]}",
                "conclusion_sentence": chosen,
                "_topic": tag,
                "_cued": bool(cued),
                "_title": (paper.get("title") or "")[:120],
            }
        )

    rng = random.Random(SEED)
    topics = sorted(by_topic)
    per = max(1, N_TARGET // max(1, len(topics)))
    picked: list[dict] = []
    for tag in topics:
        pool = by_topic[tag]
        rng.shuffle(pool)
        picked.extend(pool[:per])
    rng.shuffle(picked)
    picked = picked[:N_TARGET]

    with open("viceroy-pilot-inputs.jsonl", "w", encoding="utf-8", newline="\n") as fh:
        for row in picked:
            fh.write(json.dumps(row, sort_keys=True) + "\n")

    print(f"topics: {[(t, len(by_topic[t])) for t in topics]}")
    print(f"sampled: {len(picked)}  cued: {sum(1 for r in picked if r['_cued'])}")
    for row in picked[:3]:
        print("  -", row["_topic"], "|", row["conclusion_sentence"][:120])


if __name__ == "__main__":
    main()
