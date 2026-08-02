"""Build claim/evidence pairs for the Zebra disagreement pilot.

Zebra v1's recipe is "BM25 top-3 evidence selection" — at training time its
`evidence_text` was several retrieved sentences concatenated, not one
hand-written sentence. Feeding it a single tidy sentence measures the format
mismatch instead of the model, which is the live hypothesis for the
`supported`-never-fires behaviour seen on the smoke fixtures. So this harness
reproduces the training-time construction.

Evidence is drawn from a DIFFERENT paper on the SAME topic, never the claim's
own paper. Two reasons:

  * SciFact checks a claim against some other paper's abstract, so same-paper
    evidence is off-distribution.
  * Same-paper evidence would almost always entail the claim, collapsing the
    label distribution onto `supported` and making the disagreement test
    measure nothing.
"""

from __future__ import annotations

import json
import math
import random
import re
from collections import Counter, defaultdict

from corpus_survey import corpus_credentials, get_object
from sample_conclusions import CUE, is_usable, sentences

SEED = 266
N_TARGET = 100
TOP_K = 3

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = frozenset(
    "the a an and or of in to for with on by at from as is are was were be been "
    "this that these those it its we our they their he she can may might could "
    "than then thus also into over under between during not no".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 2]


def bm25_top_k(query: str, docs: list[str], k: int, k1: float = 1.5, b: float = 0.75) -> list[str]:
    """Classic BM25 over a small sentence pool. Stdlib only."""
    tok_docs = [tokenize(d) for d in docs]
    n = len(tok_docs)
    if n == 0:
        return []
    avgdl = sum(len(d) for d in tok_docs) / n
    df: Counter[str] = Counter()
    for d in tok_docs:
        df.update(set(d))
    q = tokenize(query)

    scores = []
    for idx, d in enumerate(tok_docs):
        tf = Counter(d)
        dl = len(d) or 1
        score = 0.0
        for term in q:
            if term not in tf:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += idf * (tf[term] * (k1 + 1)) / (tf[term] + k1 * (1 - b + b * dl / avgdl))
        scores.append((score, idx))
    scores.sort(key=lambda x: (-x[0], x[1]))
    return [docs[i] for s, i in scores[:k] if s > 0]


def main() -> None:
    creds = corpus_credentials()
    raw = get_object(creds, "manifest/papers.jsonl").decode("utf-8", "replace")
    papers = [json.loads(line) for line in raw.splitlines() if line.strip()]

    by_topic: dict[str, list[dict]] = defaultdict(list)
    for p in papers:
        abstract = (p.get("abstract") or "").strip()
        if not abstract:
            continue
        sents = sentences(abstract)
        if len(sents) < 4:
            continue
        tags = p.get("topicTags") or ["untagged"]
        tag = tags[0] if isinstance(tags[0], str) else "untagged"
        by_topic[tag].append({"uid": p.get("paperUid", ""), "sents": sents, "tag": tag})

    rng = random.Random(SEED)
    rows: list[dict] = []
    topics = sorted(by_topic)
    per = max(1, N_TARGET // max(1, len(topics)))

    for tag in topics:
        pool = by_topic[tag]
        if len(pool) < 2:
            continue
        rng.shuffle(pool)
        made = 0
        for _i, claim_paper in enumerate(pool):
            if made >= per:
                break
            cued = [s for s in claim_paper["sents"][2:] if CUE.search(s) and is_usable(s)]
            claim = cued[-1] if cued else None
            if not claim:
                last = claim_paper["sents"][-1]
                claim = last if is_usable(last) else None
            if not claim:
                continue
            # Evidence retrieved across EVERY other paper in the topic, not one
            # arbitrary paper. The first version picked a single random same-topic
            # paper, whose sentences almost never bore on the claim — Zebra
            # correctly answered `insufficient_evidence` for 96/96, leaving zero
            # label variance and nothing for a disagreement test to measure. This
            # is closer to SciFact, where a claim is checked against retrieved
            # abstracts that actually discuss it.
            candidates: list[tuple[str, str]] = []
            for other in pool:
                if other["uid"] == claim_paper["uid"]:
                    continue
                for s in other["sents"]:
                    if is_usable(s):
                        candidates.append((s, other["uid"]))
            if len(candidates) < TOP_K:
                continue
            ranked = bm25_top_k(claim, [c[0] for c in candidates], TOP_K)
            owner = {s: u for s, u in candidates}
            ev_paper = {"uid": ",".join(sorted({owner[s] for s in ranked}))[:60]}
            top = ranked
            if len(top) < 2:
                continue
            evidence = " ".join(top)
            if not (80 <= len(evidence) <= 4000):
                continue
            rows.append(
                {
                    "row_id": f"zeb-{tag[:6]}-{len(rows):03d}",
                    "claim_text": claim,
                    "evidence_text": evidence,
                    "_topic": tag,
                    "_claim_uid": claim_paper["uid"],
                    "_evidence_uid": ev_paper["uid"],
                }
            )
            made += 1

    rng.shuffle(rows)
    rows = rows[:N_TARGET]

    with open("zebra-pilot-inputs.jsonl", "w", encoding="utf-8", newline="\n") as fh:
        for r in rows:
            fh.write(json.dumps(r, sort_keys=True) + "\n")
    with open("zebra-pilot-clean.jsonl", "w", encoding="utf-8", newline="\n") as fh:
        for r in rows:
            fh.write(
                json.dumps(
                    {
                        "row_id": r["row_id"],
                        "claim_text": r["claim_text"],
                        "evidence_text": r["evidence_text"],
                    },
                    sort_keys=True,
                )
                + "\n"
            )

    print(f"pairs: {len(rows)}  topics: {Counter(r['_topic'] for r in rows).most_common()}")
    print(f"mean evidence chars: {sum(len(r['evidence_text']) for r in rows) // max(1, len(rows))}")
    same = sum(1 for r in rows if r["_claim_uid"] == r["_evidence_uid"])
    print(f"same-paper leakage: {same} (must be 0)")
    if rows:
        print("\nexample claim   :", rows[0]["claim_text"][:130])
        print("example evidence:", rows[0]["evidence_text"][:190])


if __name__ == "__main__":
    main()
