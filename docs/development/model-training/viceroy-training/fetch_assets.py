#!/usr/bin/env python3
"""Viceroy Causal-Language-Risk v0 — asset fetcher.

This is the ONLY script in this bundle allowed network access (``cli.py``'s ``fetch`` subcommand
just delegates here). Everything else — ``preflight``, ``dry-run``, ``splits``, ``smoke``,
``train``, ``evaluate`` — must work offline against whatever this script already fetched.

Downloads:
  1. ``pubmed_causal_language_use.csv`` (3,061 labelled conclusion sentences) and the repository's
     ``LICENSE``, both from a **pinned commit** rather than a moving branch, written under
     ``assets/causal_language_use/``.
  2. The BiomedBERT tokenizer + weights via ``transformers``, materializing the HF cache under
     ``.cache/`` (this bundle's ``ViceroyConfig.cache_dir``).

The LICENSE file is fetched deliberately, not incidentally: the corpus repository is **GPL-3.0**,
this bundle must be able to show exactly which licence text applied at the pinned commit, and the
release manifest is required to name the GPL-3.0 dependency prominently.

Then computes a SHA-256 (+ size) for every file fetched and writes ``data-manifest.json`` at the
bundle root, recording source, pinned commit, retrieval time (UTC), sizes, hashes, and licences.
If a manifest already exists, this refuses to silently overwrite it when the freshly-computed
hashes disagree with what it already recorded — that would hide data drift rather than surface it
(use ``--force`` to intentionally replace it after actually reviewing why they differ).

Usage:
    python fetch_assets.py                 # fetch data + model
    python fetch_assets.py --data-only      # skip model weights
    python fetch_assets.py --model-only     # skip the corpus
    python fetch_assets.py --force          # overwrite an existing, disagreeing manifest anyway
"""

import argparse
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_SRC = _HERE / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from viceroy.config import ViceroyConfig  # noqa: E402

MANIFEST_PATH = _HERE / "data-manifest.json"

# Pinned commit on junwang4/causal-language-use-in-science (repository last updated 2020-10-27).
# Pinning the commit rather than `master` is what makes the data hash meaningful: a branch can
# move under you, and then a "hash mismatch" is indistinguishable from a corrupted download.
CORPUS_REPO = "junwang4/causal-language-use-in-science"
CORPUS_COMMIT = "7ca243a00ec07f1c63fd9ac5b0acc9cac3a6a596"
_RAW_BASE = f"https://raw.githubusercontent.com/{CORPUS_REPO}/{CORPUS_COMMIT}"

CORPUS_FILES: dict[str, str] = {
    "pubmed_causal_language_use.csv": f"{_RAW_BASE}/data/pubmed_causal_language_use.csv",
    "LICENSE": f"{_RAW_BASE}/LICENSE",
}

# Verified against the pinned commit at authoring time (2026-07-27) from this environment. This is
# an integrity tripwire, not a licence approval: if the fetched bytes differ, the run stops and a
# human decides whether upstream legitimately changed. `--force` is the deliberate override.
EXPECTED_SHA256: dict[str, str] = {
    "pubmed_causal_language_use.csv": (
        "f3e50fb07bfe9c9dcbbe3bbfcf0a27e71d460e06895b2867002a61c34ee1f202"
    ),
}

# Licences as understood at authoring time — NOT a substitute for the human licence-approval step
# (see licence-approval.example.json). Verify current terms before relying on this.
LICENCES: dict[str, str] = {
    CORPUS_REPO: (
        "GPL-3.0 on the repository. Whether copyleft on a DATA repository propagates to model "
        "weights trained on it is legally unsettled; this bundle does not assert an answer. A "
        "written human determination on the four questions in the training plan §4.2 is required "
        "before any training runs — cli.py's licence gate enforces it."
    ),
    "microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext": "MIT",
}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _hash_tree(root: Path) -> dict[str, dict]:
    """sha256 + size for every regular file under ``root``, keyed by path relative to ``root``."""
    out: dict[str, dict] = {}
    if not root.exists():
        return out
    for p in sorted(root.rglob("*")):
        if p.is_file():
            out[str(p.relative_to(root)).replace("\\", "/")] = {
                "sha256": _sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
    return out


def _load_existing_manifest(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _disagreements(existing: dict, fresh_hashes: dict, key: str) -> list[str]:
    problems = []
    for relpath, info in existing.get(key, {}).items():
        fresh = fresh_hashes.get(relpath)
        if fresh is None:
            problems.append(
                f"{key}: {relpath!r} was in the existing manifest but is missing on disk now"
            )
        elif fresh["sha256"] != info["sha256"]:
            problems.append(
                f"{key}: {relpath!r} hash changed "
                f"({info['sha256'][:12]}... -> {fresh['sha256'][:12]}...)"
            )
    return problems


def fetch_data(config: ViceroyConfig, *, force: bool) -> dict:
    """Downloads the pinned corpus CSV and the repository LICENSE via stdlib urllib.

    No `datasets` dependency: this corpus is a plain 414 KB CSV in a git repository, not a Hub
    dataset, so pulling in the `datasets` library would add a moving part for nothing.
    """
    t0 = time.time()
    config.data_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for name, url in CORPUS_FILES.items():
        out_path = config.data_dir / name
        with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 - pinned https URL
            payload = response.read()
        out_path.write_bytes(payload)
        written.append(out_path)

        digest = hashlib.sha256(payload).hexdigest()
        expected = EXPECTED_SHA256.get(name)
        if expected and digest != expected and not force:
            raise SystemExit(
                f"[fetch] ABORT: {name} sha256 {digest[:12]}... does not match the expected "
                f"{expected[:12]}... recorded for pinned commit {CORPUS_COMMIT[:12]}.\n"
                "        The pinned commit's bytes should never change. Investigate before "
                "proceeding; pass --force only once you understand why they differ."
            )
        print(f"[fetch] {name} -> {out_path} :: {len(payload):,} bytes, sha256 {digest[:12]}...")

    elapsed = time.time() - t0
    total_bytes = sum(p.stat().st_size for p in written)
    print(
        f"[fetch] corpus @ {CORPUS_COMMIT[:12]} -> {config.data_dir} :: "
        f"{len(written)} file(s), {total_bytes:,} bytes, {elapsed:.1f}s"
    )
    return {
        "elapsed_seconds": elapsed,
        "total_bytes": total_bytes,
        "files": [str(p) for p in written],
    }


def fetch_model(config: ViceroyConfig) -> dict:
    """Downloads the BiomedBERT config, tokenizer, and weights via `transformers`, materializing
    the HF cache under config.cache_dir. Nothing is returned that isn't already on disk — the
    point of this call is entirely its cache side effect."""
    from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer

    t0 = time.time()
    before = (
        sum(p.stat().st_size for p in config.cache_dir.rglob("*") if p.is_file())
        if config.cache_dir.exists()
        else 0
    )

    hf_config = AutoConfig.from_pretrained(
        config.model_name, num_labels=4, cache_dir=str(config.cache_dir)
    )
    tokenizer = AutoTokenizer.from_pretrained(config.model_name, cache_dir=str(config.cache_dir))
    model = AutoModelForSequenceClassification.from_pretrained(
        config.model_name, config=hf_config, cache_dir=str(config.cache_dir)
    )
    del tokenizer, model  # materializing the on-disk cache was the point of this call

    after = sum(p.stat().st_size for p in config.cache_dir.rglob("*") if p.is_file())
    elapsed = time.time() - t0
    print(
        f"[fetch] {config.model_name} -> {config.cache_dir} :: "
        f"{after - before:,} bytes, {elapsed:.1f}s"
    )
    return {"elapsed_seconds": elapsed, "total_bytes": after - before}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--data-only", action="store_true", help="fetch the corpus only, skip model weights"
    )
    parser.add_argument(
        "--model-only", action="store_true", help="fetch the model only, skip the corpus"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite an existing manifest (and accept an unexpected corpus hash) anyway",
    )
    args = parser.parse_args(argv)

    if args.data_only and args.model_only:
        print("--data-only and --model-only are mutually exclusive", file=sys.stderr)
        return 2

    config = ViceroyConfig()
    existing = _load_existing_manifest(MANIFEST_PATH)

    stats: dict[str, dict] = {}
    if not args.model_only:
        stats["data"] = fetch_data(config, force=args.force)
    if not args.data_only:
        stats["model"] = fetch_model(config)

    data_hashes = _hash_tree(config.data_dir)
    model_hashes = _hash_tree(config.cache_dir)

    if existing is not None and not args.force:
        problems = _disagreements(existing, data_hashes, "data_hashes") + _disagreements(
            existing, model_hashes, "model_hashes"
        )
        if problems:
            print(
                "REFUSING to overwrite data-manifest.json: existing hashes disagree with what was "
                "just fetched (pass --force to intentionally replace it after reviewing why):",
                file=sys.stderr,
            )
            for p in problems:
                print(f"  - {p}", file=sys.stderr)
            return 2

    manifest = {
        "retrieved_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": {
            "data": f"https://github.com/{CORPUS_REPO} @ {CORPUS_COMMIT} (pinned commit)",
            "model": f"{config.model_name} (via the `transformers` library)",
        },
        "corpus_commit": CORPUS_COMMIT,
        "licences": LICENCES,
        "data_hashes": data_hashes,
        "model_hashes": model_hashes,
        "config_hash": config.config_hash(),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")

    total_bytes = sum(v.get("total_bytes", 0) for v in stats.values())
    print(f"[fetch] wrote {MANIFEST_PATH.name}. Total bytes fetched this run: {total_bytes:,}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
