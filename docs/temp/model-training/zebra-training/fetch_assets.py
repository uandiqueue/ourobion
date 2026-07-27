#!/usr/bin/env python3
"""Zebra NLI Shadow v0 — asset fetcher.

This is the ONLY script in this bundle allowed network access (``cli.py``'s ``fetch``
subcommand just delegates here). Everything else — ``preflight``, ``dry-run``, ``smoke``,
``train``, ``evaluate`` — must work offline against whatever this script already fetched.

Downloads:
  1. SciFact (``allenai/scifact_entailment``, train + dev) via the ``datasets`` library, written
     out as JSONL under ``assets/scifact_entailment/``.
  2. The BiomedBERT tokenizer + weights via ``transformers``, materializing the HF cache under
     ``.cache/`` (this bundle's ``ZebraConfig.cache_dir``).

Then computes a SHA-256 (+ size) for every file fetched and writes ``data-manifest.json`` at the
bundle root, recording source, retrieval time (UTC), sizes, hashes, and licences. If a manifest
already exists, this refuses to silently overwrite it when the freshly-computed hashes disagree
with what it already recorded — that would hide a data drift rather than surface it (use
``--force`` to intentionally replace it after actually reviewing why they differ).

Usage:
    python fetch_assets.py                 # fetch data + model
    python fetch_assets.py --data-only      # skip model weights
    python fetch_assets.py --model-only     # skip the dataset
    python fetch_assets.py --force          # overwrite an existing, disagreeing manifest anyway
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_SRC = _HERE / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from zebra.config import ZebraConfig  # noqa: E402

MANIFEST_PATH = _HERE / "data-manifest.json"

# Licences as understood at authoring time — NOT a substitute for the human licence-approval
# step (see licence-approval.example.json). Verify current terms before relying on this.
LICENCES: dict[str, str] = {
    "allenai/scifact_entailment": (
        "Inherits SciFact's licence (CC BY-NC 2.0 at authoring time) — verify current terms on "
        "the HF Hub dataset card before any non-research use."
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
            problems.append(f"{key}: {relpath!r} was in the existing manifest but is missing on disk now")
        elif fresh["sha256"] != info["sha256"]:
            problems.append(
                f"{key}: {relpath!r} hash changed ({info['sha256'][:12]}... -> {fresh['sha256'][:12]}...)"
            )
    return problems


def fetch_data(config: ZebraConfig) -> dict:
    """Downloads SciFact via `datasets` and writes each split as JSONL under config.data_dir."""
    from datasets import load_dataset

    t0 = time.time()
    dataset = load_dataset("allenai/scifact_entailment")
    config.data_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for split_name in dataset.keys():
        out_path = config.data_dir / f"{split_name}.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for row in dataset[split_name]:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        written.append(out_path)

    elapsed = time.time() - t0
    total_bytes = sum(p.stat().st_size for p in written)
    print(f"[fetch] SciFact -> {config.data_dir} :: {len(written)} split file(s), "
          f"{total_bytes:,} bytes, {elapsed:.1f}s")
    return {"elapsed_seconds": elapsed, "total_bytes": total_bytes, "files": [str(p) for p in written]}


def fetch_model(config: ZebraConfig) -> dict:
    """Downloads the BiomedBERT config, tokenizer, and weights via `transformers`, materializing
    the HF cache under config.cache_dir. Nothing is returned that isn't already on disk — the
    point of this call is entirely its cache side effect."""
    from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer

    t0 = time.time()
    before = sum(p.stat().st_size for p in config.cache_dir.rglob("*") if p.is_file()) if config.cache_dir.exists() else 0

    hf_config = AutoConfig.from_pretrained(config.model_name, num_labels=3, cache_dir=str(config.cache_dir))
    tokenizer = AutoTokenizer.from_pretrained(config.model_name, cache_dir=str(config.cache_dir))
    model = AutoModelForSequenceClassification.from_pretrained(
        config.model_name, config=hf_config, cache_dir=str(config.cache_dir)
    )
    del tokenizer, model  # materializing the on-disk cache was the point of this call

    after = sum(p.stat().st_size for p in config.cache_dir.rglob("*") if p.is_file())
    elapsed = time.time() - t0
    print(f"[fetch] {config.model_name} -> {config.cache_dir} :: {after - before:,} bytes, {elapsed:.1f}s")
    return {"elapsed_seconds": elapsed, "total_bytes": after - before}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-only", action="store_true", help="fetch SciFact only, skip model weights")
    parser.add_argument("--model-only", action="store_true", help="fetch the model only, skip SciFact")
    parser.add_argument(
        "--force", action="store_true", help="overwrite an existing manifest even if hashes disagree"
    )
    args = parser.parse_args(argv)

    if args.data_only and args.model_only:
        print("--data-only and --model-only are mutually exclusive", file=sys.stderr)
        return 2

    config = ZebraConfig()
    existing = _load_existing_manifest(MANIFEST_PATH)

    stats: dict[str, dict] = {}
    if not args.model_only:
        stats["data"] = fetch_data(config)
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
            "data": "allenai/scifact_entailment (via the `datasets` library)",
            "model": f"{config.model_name} (via the `transformers` library)",
        },
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
