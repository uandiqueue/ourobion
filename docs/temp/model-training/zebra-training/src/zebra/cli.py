"""Zebra NLI Shadow v0 — command-line entry point.

Subcommands: ``preflight | fetch | dry-run | smoke | train | evaluate``.

Only ``fetch`` is allowed network access (it delegates to ``fetch_assets.py`` at the bundle
root). Every other subcommand must work fully offline.

Fail-closed gates (exit code 2, clear stderr message), enforced by ``preflight``, ``dry-run``,
``train``, and ``evaluate`` alike:
  - ``licence-approval.json`` missing, unreadable, or ``status`` != ``"approved"``;
  - any asset's SHA-256 disagreeing with what ``data-manifest.json`` recorded.

This module imports only ``zebra.config``/``zebra.data``/``zebra.splits`` at module level (all
torch/transformers-free) so ``preflight`` stays fast and possible before the pinned ML stack is
installed. ``zebra.model`` is imported lazily, only by the subcommands that actually need it.
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from .config import ZebraConfig, select_device
from .data import (
    CLASS_NAMES,
    build_dataset,
    preflight_check_label_blind,
    select_evidence_sentences,
)
from .splits import build_splits

# ``src/zebra/cli.py`` -> parents[0]=src/zebra, [1]=src, [2]=zebra-training (the bundle root).
_BUNDLE_ROOT = Path(__file__).resolve().parents[2]
LICENCE_APPROVAL_PATH = _BUNDLE_ROOT / "licence-approval.json"
DATA_MANIFEST_PATH = _BUNDLE_ROOT / "data-manifest.json"
FETCH_ASSETS_SCRIPT = _BUNDLE_ROOT / "fetch_assets.py"
FIXTURES_DIR = _BUNDLE_ROOT / "tests" / "fixtures"

EXIT_OK = 0
EXIT_GATE_FAILED = 2


def _fail_closed(message: str) -> int:
    print(f"GATE FAILED: {message}", file=sys.stderr)
    return EXIT_GATE_FAILED


# --- gate checks (shared by preflight / dry-run / train / evaluate) ------------------------------


def check_licence_gate() -> dict:
    """Returns a report dict; never raises. ``ok`` is False if the approval is missing, unreadable,
    or not explicitly ``"approved"``. Never fabricates an approval — an absent or malformed file
    is always a failure, not a default-allow."""
    if not LICENCE_APPROVAL_PATH.exists():
        return {
            "ok": False,
            "path": str(LICENCE_APPROVAL_PATH),
            "reason": "licence-approval.json does not exist (see licence-approval.example.json)",
        }
    try:
        raw = LICENCE_APPROVAL_PATH.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "path": str(LICENCE_APPROVAL_PATH), "reason": f"unreadable: {exc!r}"}

    status = data.get("status")
    if status != "approved":
        return {
            "ok": False,
            "path": str(LICENCE_APPROVAL_PATH),
            "reason": f"status is {status!r}, not 'approved'",
        }
    return {
        "ok": True,
        "path": str(LICENCE_APPROVAL_PATH),
        "approved_by": data.get("approved_by"),
        "date": data.get("date"),
    }


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def check_data_manifest_gate() -> dict:
    """Returns a report dict; never raises. ``fetched`` is False when no manifest exists yet
    (an expected, non-failing state before ``fetch`` has run). ``ok`` is False only when the
    manifest exists AND at least one on-disk file's hash disagrees with what it recorded — a
    real integrity problem, not just "not fetched yet"."""
    if not DATA_MANIFEST_PATH.exists():
        return {"ok": True, "fetched": False, "reason": "no data-manifest.json yet (fetch not run)"}

    try:
        manifest = json.loads(DATA_MANIFEST_PATH.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "fetched": True, "reason": f"data-manifest.json unreadable: {exc!r}"}

    mismatches = []
    checked = 0
    for key, root in (("data_hashes", None), ("model_hashes", None)):
        for relpath, info in manifest.get(key, {}).items():
            root_dir = ZebraConfig().data_dir if key == "data_hashes" else ZebraConfig().cache_dir
            fpath = root_dir / relpath
            if not fpath.exists():
                mismatches.append(f"{key}: {relpath!r} listed in manifest but missing on disk")
                continue
            checked += 1
            actual = _sha256_file(fpath)
            if actual != info.get("sha256"):
                mismatches.append(
                    f"{key}: {relpath!r} hash mismatch (manifest {info.get('sha256', '?')[:12]}... "
                    f"vs on-disk {actual[:12]}...)"
                )

    if mismatches:
        return {"ok": False, "fetched": True, "n_checked": checked, "mismatches": mismatches}
    return {"ok": True, "fetched": True, "n_checked": checked}


def run_gates_or_exit() -> int | None:
    """Runs both fail-closed gates. Returns an exit code to use immediately if either fails,
    else None (proceed)."""
    licence = check_licence_gate()
    if not licence["ok"]:
        return _fail_closed(f"licence approval — {licence['reason']} (path: {licence['path']})")
    manifest = check_data_manifest_gate()
    if not manifest["ok"]:
        detail = "; ".join(manifest.get("mismatches", [manifest.get("reason", "unknown")]))
        return _fail_closed(f"data manifest — {detail}")
    return None


# --- shared report building ------------------------------------------------------------------


def _env_report() -> dict:
    device, device_reason = select_device()
    return {
        "python_version": sys.version.split()[0],
        "platform": sys.platform,
        "device": device,
        "device_reason": device_reason,
    }


def _config_report(config: ZebraConfig) -> dict:
    return {"ok": True, "config_hash": config.config_hash(), "config": config.to_dict()}


def _label_blind_report() -> dict:
    try:
        preflight_check_label_blind(select_evidence_sentences)
        return {"ok": True}
    except (TypeError, ValueError) as exc:
        return {"ok": False, "reason": str(exc)}


def _build_report(config: ZebraConfig) -> dict:
    report = {
        "env": _env_report(),
        "config": _config_report(config),
        "label_blind": _label_blind_report(),
        "licence_gate": check_licence_gate(),
        "data_manifest_gate": check_data_manifest_gate(),
    }
    report["ok"] = bool(
        report["config"]["ok"] and report["label_blind"]["ok"] and report["licence_gate"]["ok"]
        and report["data_manifest_gate"]["ok"]
    )
    return report


# --- subcommands -----------------------------------------------------------------------------


def cmd_preflight(args: argparse.Namespace) -> int:
    """No network. Verifies env, device, config validity, the label-blind signature check, the
    licence gate, and data-manifest presence/hashes when assets exist. Always prints the full
    JSON report; exits 2 if either fail-closed gate did not pass."""
    config = ZebraConfig()
    report = _build_report(config)
    print(json.dumps(report, indent=2, sort_keys=True, default=str))

    if not report["label_blind"]["ok"]:
        return _fail_closed(f"label-blind signature check — {report['label_blind']['reason']}")
    if not report["licence_gate"]["ok"]:
        return _fail_closed(
            f"licence approval — {report['licence_gate']['reason']} (path: {report['licence_gate']['path']})"
        )
    if not report["data_manifest_gate"]["ok"]:
        detail = "; ".join(report["data_manifest_gate"].get("mismatches", ["unknown"]))
        return _fail_closed(f"data manifest — {detail}")
    return EXIT_OK


def cmd_fetch(args: argparse.Namespace) -> int:
    """The only subcommand allowed network access. Delegates to fetch_assets.py as a
    subprocess (kept as a standalone script so it can also be run directly per the README)."""
    if not FETCH_ASSETS_SCRIPT.exists():
        print(f"fetch_assets.py not found at {FETCH_ASSETS_SCRIPT}", file=sys.stderr)
        return 1
    cmd = [sys.executable, str(FETCH_ASSETS_SCRIPT)]
    if args.data_only:
        cmd.append("--data-only")
    if args.model_only:
        cmd.append("--model-only")
    if args.force:
        cmd.append("--force")
    result = subprocess.run(cmd)
    return result.returncode


def cmd_dry_run(args: argparse.Namespace) -> int:
    """Resolves and validates the whole job (config, gates, and — when assets are present —
    building the dataset/splits) without executing training. Must work offline."""
    config = ZebraConfig()
    report = _build_report(config)

    if not report["label_blind"]["ok"]:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
        return _fail_closed(f"label-blind signature check — {report['label_blind']['reason']}")
    if not report["licence_gate"]["ok"]:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
        return _fail_closed(
            f"licence approval — {report['licence_gate']['reason']} (path: {report['licence_gate']['path']})"
        )
    if not report["data_manifest_gate"]["ok"]:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
        detail = "; ".join(report["data_manifest_gate"].get("mismatches", ["unknown"]))
        return _fail_closed(f"data manifest — {detail}")

    plan = {
        "would_train_on": str(config.data_dir / "train.jsonl"),
        "would_evaluate_on": str(config.data_dir / "dev.jsonl"),
        "epochs": config.epochs,
        "effective_batch_size": config.effective_batch_size,
        "physical_batch_size": config.physical_batch_size,
        "gradient_accumulation_steps": config.gradient_accumulation_steps,
        "n_folds": config.n_folds,
        "output_dir": str(config.output_dir),
    }
    if config.data_dir.exists() and any(config.data_dir.glob("*.jsonl")):
        plan["data_dir_status"] = "present — a real run would read from here"
    else:
        plan["data_dir_status"] = "absent — run `fetch` first"
    report["plan"] = plan
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return EXIT_OK


def cmd_smoke(args: argparse.Namespace) -> int:
    """Tiny run against tests/fixtures/: a couple of optimizer steps, proving wiring. Uses real
    cached BiomedBERT weights/tokenizer if `fetch` has already run; otherwise falls back to a
    small random-weight model + a fully local toy tokenizer built from the fixtures'
    vocabulary — either way, no pretrained download is triggered by this command."""
    import dataclasses

    from . import model as zebra_model

    fixture_path = FIXTURES_DIR / "toy_scifact.jsonl"
    if not fixture_path.exists():
        print(f"fixture file not found: {fixture_path}", file=sys.stderr)
        return 1

    raw_rows = _load_fixture_raw_examples(fixture_path)
    config = ZebraConfig()
    smoke_config = dataclasses.replace(
        config, epochs=1, physical_batch_size=2, effective_batch_size=2, output_dir=config.output_dir / "smoke"
    )

    used_real_weights = False
    tokenizer = None
    model = None
    try:
        tokenizer = zebra_model.build_tokenizer(smoke_config, local_files_only=True)
        model = zebra_model.build_model(smoke_config, randomly_initialized=True)
        used_real_weights = True
    except Exception:
        tokenizer = None
        model = None

    examples = build_dataset(
        raw_rows, smoke_config, tokenizer=tokenizer or _tokenizer_stub_for_budgeting(), source_split="smoke"
    )

    if not used_real_weights:
        model, tokenizer = zebra_model.build_toy_smoke_model_and_tokenizer(examples)
        # Re-tokenize evidence budgeting against the toy tokenizer's actual token counts.
        examples = build_dataset(raw_rows, smoke_config, tokenizer=tokenizer, source_split="smoke")

    result = zebra_model.train(smoke_config, examples, tokenizer=tokenizer, model=model)

    report = {
        "ok": True,
        "used_real_cached_weights": used_real_weights,
        "n_examples": len(examples),
        "per_epoch_loss": result.per_epoch_loss,
        "device": result.device,
        "wallclock_seconds": result.wallclock_seconds,
        "output_dir": str(result.output_dir),
    }
    if not used_real_weights:
        report["note"] = (
            "no cached BiomedBERT weights/tokenizer found offline — used a small random-weight "
            "model and a local toy tokenizer instead, purely to prove the training loop's wiring"
        )
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return EXIT_OK


class _BudgetingTokenizerStub:
    """Minimal stand-in exposing only what `fit_evidence_to_budget` needs (`.tokenize`), used
    when no real tokenizer is available yet and we haven't built the toy tokenizer's vocabulary.
    Whitespace-based, so token counts are approximate — fine for the smoke path, where the toy
    tokenizer is rebuilt and re-applied immediately afterward."""

    def tokenize(self, text: str) -> list[str]:
        return text.split()


def _tokenizer_stub_for_budgeting() -> _BudgetingTokenizerStub:
    return _BudgetingTokenizerStub()


def cmd_train(args: argparse.Namespace) -> int:
    """The real training job. Fails closed (exit 2) if either gate fails."""
    gate_exit = run_gates_or_exit()
    if gate_exit is not None:
        return gate_exit

    from . import model as zebra_model

    config = ZebraConfig()
    train_path = config.data_dir / "train.jsonl"
    if not train_path.exists():
        print(f"no training data at {train_path} — run `fetch` first", file=sys.stderr)
        return 1

    raw_rows = _load_jsonl_raw_examples(train_path)
    tokenizer = zebra_model.build_tokenizer(config)
    examples = build_dataset(raw_rows, config, tokenizer=tokenizer, source_split="train")

    manifest_hash = None
    if DATA_MANIFEST_PATH.exists():
        manifest_hash = hashlib.sha256(DATA_MANIFEST_PATH.read_bytes()).hexdigest()

    model = zebra_model.build_model(config)
    result = zebra_model.train(config, examples, tokenizer=tokenizer, model=model, data_manifest_hash=manifest_hash)
    print(json.dumps(result.to_dict(), indent=2, sort_keys=True, default=str))
    return EXIT_OK


def cmd_evaluate(args: argparse.Namespace) -> int:
    """The real evaluation job. Fails closed (exit 2) if either gate fails."""
    gate_exit = run_gates_or_exit()
    if gate_exit is not None:
        return gate_exit

    from . import model as zebra_model

    config = ZebraConfig()
    dev_path = config.data_dir / "dev.jsonl"
    model_dir = config.output_dir / "model"
    if not dev_path.exists():
        print(f"no eval data at {dev_path} — run `fetch` first", file=sys.stderr)
        return 1
    if not model_dir.exists():
        print(f"no trained model at {model_dir} — run `train` first", file=sys.stderr)
        return 1

    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))

    raw_rows = _load_jsonl_raw_examples(dev_path)
    examples = build_dataset(raw_rows, config, tokenizer=tokenizer, source_split="dev")
    result = zebra_model.evaluate(config, examples, tokenizer, model)

    out_path = config.output_dir / "eval-artifact.json"
    out_path.write_text(json.dumps(result, indent=2, sort_keys=True, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k not in ("logits", "probs")}, indent=2, sort_keys=True))
    print(f"full logits/probs written to {out_path}")
    return EXIT_OK


# --- fixture / jsonl loading -------------------------------------------------------------------


def _row_to_raw_example(row: dict):
    from .data import RawExample

    return RawExample(
        claim_id=row["claim_id"],
        abstract_id=row["abstract_id"],
        claim=row["claim"],
        title=row.get("title", ""),
        abstract=tuple(row["abstract"]),
        verdict=row["verdict"],
        evidence=tuple(row.get("evidence", ())),
    )


def _load_jsonl_raw_examples(path: Path) -> list:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(_row_to_raw_example(json.loads(line)))
    return rows


def _load_fixture_raw_examples(path: Path) -> list:
    return _load_jsonl_raw_examples(path)


# --- argparse wiring -------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="zebra", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("preflight", help="offline environment/config/gate self-check")
    p.set_defaults(func=cmd_preflight)

    p = sub.add_parser("fetch", help="download SciFact + BiomedBERT (the only networked command)")
    p.add_argument("--data-only", action="store_true")
    p.add_argument("--model-only", action="store_true")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("dry-run", help="resolve and validate the whole job without executing it")
    p.set_defaults(func=cmd_dry_run)

    p = sub.add_parser("smoke", help="tiny offline run against tests/fixtures/")
    p.set_defaults(func=cmd_smoke)

    p = sub.add_parser("train", help="the real training job")
    p.set_defaults(func=cmd_train)

    p = sub.add_parser("evaluate", help="the real evaluation job")
    p.set_defaults(func=cmd_evaluate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
