"""Viceroy Causal-Language-Risk v0 — command-line entry point.

Subcommands: ``preflight | fetch | dry-run | splits | smoke | train | evaluate``.

``splits`` has no counterpart in the sibling Zebra bundle and exists because of what went wrong
there: it builds the folds, runs every leakage check, writes ``outputs/split-artifact.json``, and
prints the residual-leakage audit — **without training anything**. Inspect the split before
spending compute on it, not after.

Only ``fetch`` is allowed network access (it delegates to ``fetch_assets.py`` at the bundle root).
Every other subcommand must work fully offline.

Fail-closed gates (exit code 2, clear stderr message), enforced by ``preflight``, ``dry-run``,
``splits``, ``train``, and ``evaluate`` alike:
  - ``licence-approval.json`` missing, unreadable, ``status`` != ``"approved"``, or missing a
    complete GPL-3.0 determination (this model's data carries GPL-3.0 — a stricter gate than
    Zebra's, see ``check_licence_gate``);
  - any asset's SHA-256 disagreeing with what ``data-manifest.json`` recorded;
  - the scope boundary in ``viceroy.data.CONTRACT_MAP`` having been widened.

This module imports only ``viceroy.config``/``viceroy.data``/``viceroy.splits`` at module level
(all torch/transformers-free) so ``preflight`` stays fast and possible before the pinned ML stack
is installed. ``viceroy.model`` is imported lazily, only by the subcommands that actually need it.
"""

import argparse
import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from .config import ViceroyConfig, select_device
from .data import (
    CLASS_NAMES,
    RawExample,
    build_dataset,
    class_distribution_report,
    conflicting_label_report,
    preflight_check_scope_boundary,
    token_length_report,
)
from .splits import build_splits

# ``src/viceroy/cli.py`` -> parents[0]=src/viceroy, [1]=src, [2]=viceroy-training (bundle root).
_BUNDLE_ROOT = Path(__file__).resolve().parents[2]
LICENCE_APPROVAL_PATH = _BUNDLE_ROOT / "licence-approval.json"
DATA_MANIFEST_PATH = _BUNDLE_ROOT / "data-manifest.json"
FETCH_ASSETS_SCRIPT = _BUNDLE_ROOT / "fetch_assets.py"
FIXTURES_DIR = _BUNDLE_ROOT / "tests" / "fixtures"
CORPUS_FILENAME = "pubmed_causal_language_use.csv"

EXIT_OK = 0
EXIT_GATE_FAILED = 2

# The four questions the licence reviewer must answer in writing before any GPU is provisioned
# (training plan §4.2). Each must be a non-empty string in licence-approval.json.
GPL3_REQUIRED_FIELDS: tuple[str, ...] = (
    "covers_annotations_as_data",
    "weights_are_derivative_work",
    "accepts_obligations_for_non_distributed_research_artifact",
    "may_move_to_served_or_commercial_context",
)


def _fail_closed(message: str) -> int:
    print(f"GATE FAILED: {message}", file=sys.stderr)
    return EXIT_GATE_FAILED


# --- gate checks (shared by preflight / dry-run / splits / train / evaluate) ---------------------


def check_licence_gate() -> dict:
    """Returns a report dict; never raises. ``ok`` is False if the approval is missing,
    unreadable, not explicitly ``"approved"``, or missing a complete GPL-3.0 determination.

    **This gate is deliberately stricter than the Zebra bundle's.** Zebra's data is a public
    research dataset under a non-commercial restriction; this model's corpus repository is
    GPL-3.0, and whether copyleft on a data repository propagates to model weights is legally
    unsettled. The training plan therefore requires a written determination on four specific
    questions, and a bare ``"status": "approved"`` is not sufficient to start.

    Never fabricates an approval — an absent, partial, or malformed file is always a failure, not
    a default-allow.
    """
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

    determination = data.get("gpl3_determination")
    if not isinstance(determination, dict):
        return {
            "ok": False,
            "path": str(LICENCE_APPROVAL_PATH),
            "reason": (
                "no 'gpl3_determination' object. The corpus repository is GPL-3.0; the training "
                "plan §4.2 requires a written determination before any GPU is provisioned"
            ),
        }

    unanswered = [
        f
        for f in GPL3_REQUIRED_FIELDS
        if not isinstance(determination.get(f), str) or not determination.get(f, "").strip()
    ]
    if unanswered:
        return {
            "ok": False,
            "path": str(LICENCE_APPROVAL_PATH),
            "reason": (
                f"gpl3_determination is incomplete — unanswered: {unanswered}. All four §4.2 "
                "questions must be answered in writing by the reviewer"
            ),
        }

    if determination.get("permits_intended_use") is not True:
        return {
            "ok": False,
            "path": str(LICENCE_APPROVAL_PATH),
            "reason": (
                "gpl3_determination.permits_intended_use is not true — per the plan's stop "
                "conditions, an unavailable, contradictory, or negative determination blocks "
                "this model rather than proceeding under an assumption"
            ),
        }

    return {
        "ok": True,
        "path": str(LICENCE_APPROVAL_PATH),
        "approved_by": data.get("approved_by"),
        "date": data.get("date"),
        "gpl3_determined_by": determination.get("determined_by"),
        "gpl3_determination_date": determination.get("date"),
    }


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def check_data_manifest_gate() -> dict:
    """Returns a report dict; never raises. ``fetched`` is False when no manifest exists yet (an
    expected, non-failing state before ``fetch`` has run). ``ok`` is False only when the manifest
    exists AND at least one on-disk file's hash disagrees with what it recorded — a real integrity
    problem, not just "not fetched yet"."""
    if not DATA_MANIFEST_PATH.exists():
        return {"ok": True, "fetched": False, "reason": "no data-manifest.json yet (fetch not run)"}

    try:
        manifest = json.loads(DATA_MANIFEST_PATH.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "fetched": True, "reason": f"data-manifest.json unreadable: {exc!r}"}

    config = ViceroyConfig()
    mismatches = []
    checked = 0
    for key, root_dir in (("data_hashes", config.data_dir), ("model_hashes", config.cache_dir)):
        for relpath, info in manifest.get(key, {}).items():
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
    """Runs all fail-closed gates. Returns an exit code to use immediately if any fails, else
    None (proceed)."""
    scope = _scope_boundary_report()
    if not scope["ok"]:
        return _fail_closed(f"scope boundary — {scope['reason']}")
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
    """Environment summary, including which device a run would actually use.

    ``select_device`` imports torch. ``preflight`` is documented as working *before* the pinned ML
    stack is installed, so a missing torch has to degrade to a reported finding rather than a
    traceback — otherwise the one command you are told to run when unsure of the bundle's state is
    the one that crashes on a fresh machine.
    """
    try:
        device, device_reason = select_device()
    except ImportError as exc:
        device = "unknown"
        device_reason = (
            f"torch is not installed, so device selection could not run ({exc}). This is expected "
            "before setup-macos.sh; every other check in this report is still valid."
        )
    return {
        "python_version": sys.version.split()[0],
        "platform": sys.platform,
        "device": device,
        "device_reason": device_reason,
    }


def _config_report(config: ViceroyConfig) -> dict:
    return {"ok": True, "config_hash": config.config_hash(), "config": config.to_dict()}


def _scope_boundary_report() -> dict:
    try:
        preflight_check_scope_boundary()
        return {"ok": True}
    except ValueError as exc:
        return {"ok": False, "reason": str(exc)}


def _build_report(config: ViceroyConfig) -> dict:
    report = {
        "env": _env_report(),
        "config": _config_report(config),
        "scope_boundary": _scope_boundary_report(),
        "licence_gate": check_licence_gate(),
        "data_manifest_gate": check_data_manifest_gate(),
    }
    report["ok"] = bool(
        report["config"]["ok"]
        and report["scope_boundary"]["ok"]
        and report["licence_gate"]["ok"]
        and report["data_manifest_gate"]["ok"]
    )
    return report


def _gate_exit_from_report(report: dict) -> int | None:
    if not report["scope_boundary"]["ok"]:
        return _fail_closed(f"scope boundary — {report['scope_boundary']['reason']}")
    if not report["licence_gate"]["ok"]:
        return _fail_closed(
            f"licence approval — {report['licence_gate']['reason']} "
            f"(path: {report['licence_gate']['path']})"
        )
    if not report["data_manifest_gate"]["ok"]:
        detail = "; ".join(report["data_manifest_gate"].get("mismatches", ["unknown"]))
        return _fail_closed(f"data manifest — {detail}")
    return None


# --- corpus loading ----------------------------------------------------------------------------


def load_corpus(path: Path) -> list[RawExample]:
    """Reads the corpus CSV into RawExamples.

    The released file has exactly two columns, ``sentence`` and ``label``. A ``pmid`` column is
    read if present (the repository's unlabelled sample file has one) but is never required, and
    its absence is not an error here — it is handled where it matters, in
    ``viceroy.splits.build_groups`` under ``group_policy="pmid"``.
    """
    rows: list[RawExample] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header row")
        missing = {"sentence", "label"} - set(reader.fieldnames)
        if missing:
            raise ValueError(
                f"{path} is missing required column(s) {sorted(missing)}; found "
                f"{reader.fieldnames}"
            )
        for i, row in enumerate(reader):
            sentence = row.get("sentence")
            label = row.get("label")
            if sentence is None or label is None or str(label).strip() == "":
                raise ValueError(f"{path} row {i}: missing sentence or label")
            pmid = row.get("pmid")
            rows.append(
                RawExample(
                    row_id=i,
                    sentence=sentence,
                    native_label_id=int(label),
                    pmid=str(pmid) if pmid not in (None, "") else None,
                )
            )
    return rows


class _BudgetingTokenizerStub:
    """Minimal stand-in exposing only ``.tokenize``, used for token counting when no real
    tokenizer is available (``splits``/``dry-run`` must work before the model is cached).
    Whitespace-based, so counts are approximate — fine for a corpus report, and never used for
    the real ``train``/``evaluate`` path."""

    def tokenize(self, text: str) -> list[str]:
        return text.split()


def _split_hash(kept_row_ids, fold_of_row) -> str:
    """Stable hash of the fold assignment. Recorded in the train artifact so two runs over the
    same data manifest but different splits can never be silently compared."""
    payload = json.dumps(
        {"row_ids": list(kept_row_ids), "folds": list(fold_of_row)}, sort_keys=True
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _load_and_split(config: ViceroyConfig, corpus_path: Path, tokenizer=None):
    """Shared pipeline: load -> build rows -> build grouped folds. Returns
    ``(kept_examples, split_result)``."""
    raw_rows = load_corpus(corpus_path)
    examples = build_dataset(
        raw_rows, config, tokenizer=tokenizer or _BudgetingTokenizerStub()
    )
    return build_splits(examples, config)


# --- subcommands -----------------------------------------------------------------------------


def cmd_preflight(args: argparse.Namespace) -> int:
    """No network. Verifies env, device, config validity, the scope-boundary check, the licence
    gate (including the GPL-3.0 determination), and data-manifest presence/hashes when assets
    exist. Always prints the full JSON report; exits 2 if any fail-closed gate did not pass."""
    config = ViceroyConfig()
    report = _build_report(config)
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    gate_exit = _gate_exit_from_report(report)
    return gate_exit if gate_exit is not None else EXIT_OK


def cmd_fetch(args: argparse.Namespace) -> int:
    """The only subcommand allowed network access. Delegates to fetch_assets.py as a subprocess
    (kept as a standalone script so it can also be run directly per the README)."""
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
    return subprocess.run(cmd).returncode


def cmd_dry_run(args: argparse.Namespace) -> int:
    """Resolves and validates the whole job (config, gates, and — when assets are present — the
    corpus report) without executing training or building folds. Must work offline."""
    config = ViceroyConfig()
    report = _build_report(config)
    gate_exit = _gate_exit_from_report(report)
    if gate_exit is not None:
        print(json.dumps(report, indent=2, sort_keys=True, default=str))
        return gate_exit

    corpus_path = config.data_dir / CORPUS_FILENAME
    plan = {
        "would_read_corpus": str(corpus_path),
        "epochs": config.epochs,
        "effective_batch_size": config.effective_batch_size,
        "physical_batch_size": config.physical_batch_size,
        "gradient_accumulation_steps": config.gradient_accumulation_steps,
        "n_folds": config.n_folds,
        "group_policy": config.group_policy,
        "class_weighting": config.class_weighting,
        "output_dir": str(config.output_dir),
    }
    if corpus_path.exists():
        plan["corpus_status"] = "present — a real run would read from here"
        raw_rows = load_corpus(corpus_path)
        examples = build_dataset(raw_rows, config, tokenizer=_BudgetingTokenizerStub())
        plan["class_distribution"] = class_distribution_report(examples)
        plan["token_lengths"] = token_length_report(examples, config)
        plan["conflicting_labels"] = conflicting_label_report(examples)
    else:
        plan["corpus_status"] = "absent — run `fetch` first"
    report["plan"] = plan
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return EXIT_OK


def cmd_splits(args: argparse.Namespace) -> int:
    """Builds the grouped folds, runs every leakage check, and writes
    ``outputs/split-artifact.json`` — WITHOUT training anything.

    Run this and read its output before ``train``. The number to look at is
    ``leakage_audit.n_crossing_folds``: near-duplicate pairs below the grouping threshold that
    still ended up in different folds. It is the honest residual, and it will not be zero.
    """
    gate_exit = run_gates_or_exit()
    if gate_exit is not None:
        return gate_exit

    config = ViceroyConfig()
    corpus_path = config.data_dir / CORPUS_FILENAME
    if not corpus_path.exists():
        print(f"no corpus at {corpus_path} — run `fetch` first", file=sys.stderr)
        return 1

    kept, split = _load_and_split(config, corpus_path)

    artifact = {
        "config_hash": config.config_hash(),
        "split_hash": _split_hash(split.kept_row_ids, split.fold_of_row),
        "group_policy": split.group_policy,
        "n_rows_loaded": len(kept) + split.n_conflicting_rows_dropped,
        "n_rows_kept": len(kept),
        "n_conflicting_rows_dropped": split.n_conflicting_rows_dropped,
        "n_exact_duplicate_rows": split.n_exact_duplicate_rows,
        "n_near_duplicate_links": split.n_near_duplicate_links,
        "n_pmid_links": split.n_pmid_links,
        "n_groups": split.n_groups,
        "n_folds": split.n_folds,
        "fold_class_counts": split.fold_class_counts,
        "fold_group_counts": split.fold_group_counts,
        "class_distribution": class_distribution_report(kept),
        "leakage_audit": split.leakage_audit,
        "fold_of_row": list(split.fold_of_row),
        "kept_row_ids": list(split.kept_row_ids),
    }
    config.output_dir.mkdir(parents=True, exist_ok=True)
    out_path = config.output_dir / "split-artifact.json"
    out_path.write_text(json.dumps(artifact, indent=2, sort_keys=True, default=str), encoding="utf-8")

    summary = {k: v for k, v in artifact.items() if k not in ("fold_of_row", "kept_row_ids")}
    summary["leakage_audit"] = {
        k: v for k, v in split.leakage_audit.items() if k != "worst_examples"
    }
    print(json.dumps(summary, indent=2, sort_keys=True, default=str))
    print(f"\nfull split artifact (incl. per-row folds and worst residual pairs) -> {out_path}")
    return EXIT_OK


def cmd_smoke(args: argparse.Namespace) -> int:
    """Tiny run against tests/fixtures/: a couple of optimizer steps, proving wiring including the
    class-weighted loss. Uses real cached BiomedBERT weights/tokenizer if `fetch` has already run;
    otherwise falls back to a small random-weight model + a fully local toy tokenizer built from
    the fixtures' vocabulary — either way, no pretrained download is triggered."""
    import dataclasses

    from . import model as viceroy_model

    fixture_path = FIXTURES_DIR / "toy_causal_language.csv"
    if not fixture_path.exists():
        print(f"fixture file not found: {fixture_path}", file=sys.stderr)
        return 1

    raw_rows = load_corpus(fixture_path)
    config = ViceroyConfig()
    smoke_config = dataclasses.replace(
        config,
        epochs=1,
        physical_batch_size=2,
        effective_batch_size=2,
        output_dir=config.output_dir / "smoke",
    )

    used_real_weights = False
    tokenizer = None
    model = None
    try:
        tokenizer = viceroy_model.build_tokenizer(smoke_config, local_files_only=True)
        model = viceroy_model.build_model(smoke_config, randomly_initialized=True)
        used_real_weights = True
    except Exception:
        tokenizer = None
        model = None

    examples = build_dataset(
        raw_rows, smoke_config, tokenizer=tokenizer or _BudgetingTokenizerStub()
    )

    if not used_real_weights:
        model, tokenizer = viceroy_model.build_toy_smoke_model_and_tokenizer(examples)
        examples = build_dataset(raw_rows, smoke_config, tokenizer=tokenizer)

    result = viceroy_model.train(smoke_config, examples, tokenizer=tokenizer, model=model)

    report = {
        "ok": True,
        "used_real_cached_weights": used_real_weights,
        "n_examples": len(examples),
        "class_weights": result.class_weights,
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


def cmd_train(args: argparse.Namespace) -> int:
    """The real training job: trains on every fold except ``--fold`` (the held-out one).

    Fails closed (exit 2) if any gate fails. The split is rebuilt here from the same deterministic
    code path ``splits`` uses, so the two always agree; its hash goes into the train artifact.
    """
    gate_exit = run_gates_or_exit()
    if gate_exit is not None:
        return gate_exit

    from . import model as viceroy_model

    config = ViceroyConfig()
    corpus_path = config.data_dir / CORPUS_FILENAME
    if not corpus_path.exists():
        print(f"no corpus at {corpus_path} — run `fetch` first", file=sys.stderr)
        return 1
    if not (0 <= args.fold < config.n_folds):
        print(f"--fold must be in [0, {config.n_folds}), got {args.fold}", file=sys.stderr)
        return 1

    tokenizer = viceroy_model.build_tokenizer(config)
    kept, split = _load_and_split(config, corpus_path, tokenizer=tokenizer)

    train_examples = [e for e, f in zip(kept, split.fold_of_row) if f != args.fold]
    if not train_examples:
        print(f"fold {args.fold} holdout leaves no training rows", file=sys.stderr)
        return 1

    manifest_hash = None
    if DATA_MANIFEST_PATH.exists():
        manifest_hash = hashlib.sha256(DATA_MANIFEST_PATH.read_bytes()).hexdigest()

    model = viceroy_model.build_model(config)
    result = viceroy_model.train(
        config,
        train_examples,
        tokenizer=tokenizer,
        model=model,
        data_manifest_hash=manifest_hash,
        split_hash=_split_hash(split.kept_row_ids, split.fold_of_row),
    )
    payload = result.to_dict()
    payload["holdout_fold"] = args.fold
    payload["n_holdout_examples"] = len(kept) - len(train_examples)
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))
    return EXIT_OK


def cmd_evaluate(args: argparse.Namespace) -> int:
    """The real evaluation job: scores the model saved by ``train`` on the held-out fold.

    Fails closed the same way. Writes ``outputs/eval-artifact.json`` with full logits and
    probabilities, plus the group ids — so ``viceroy.metrics.bootstrap_ci_by_group`` can resample
    correctly instead of falling back to a row-level bootstrap that would understate variance.
    """
    gate_exit = run_gates_or_exit()
    if gate_exit is not None:
        return gate_exit

    from . import model as viceroy_model

    config = ViceroyConfig()
    corpus_path = config.data_dir / CORPUS_FILENAME
    model_dir = config.output_dir / "model"
    if not corpus_path.exists():
        print(f"no corpus at {corpus_path} — run `fetch` first", file=sys.stderr)
        return 1
    if not model_dir.exists():
        print(f"no trained model at {model_dir} — run `train` first", file=sys.stderr)
        return 1

    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))

    kept, split = _load_and_split(config, corpus_path, tokenizer=tokenizer)
    eval_pairs = [
        (e, g) for e, f, g in zip(kept, split.fold_of_row, split.group_ids) if f == args.fold
    ]
    if not eval_pairs:
        print(f"fold {args.fold} is empty; nothing to evaluate", file=sys.stderr)
        return 1
    eval_examples = [e for e, _g in eval_pairs]

    result = viceroy_model.evaluate(config, eval_examples, tokenizer, model)
    result["group_ids"] = [g for _e, g in eval_pairs]
    result["fold"] = args.fold
    result["split_hash"] = _split_hash(split.kept_row_ids, split.fold_of_row)
    result["class_names"] = list(CLASS_NAMES)

    config.output_dir.mkdir(parents=True, exist_ok=True)
    out_path = config.output_dir / "eval-artifact.json"
    out_path.write_text(json.dumps(result, indent=2, sort_keys=True, default=str), encoding="utf-8")
    print(
        json.dumps(
            {k: v for k, v in result.items() if k not in ("logits", "probs", "group_ids")},
            indent=2,
            sort_keys=True,
            default=str,
        )
    )
    print(f"full logits/probs/group_ids written to {out_path}")
    return EXIT_OK


# --- argparse wiring -------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="viceroy", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("preflight", help="offline environment/config/gate self-check")
    p.set_defaults(func=cmd_preflight)

    p = sub.add_parser(
        "fetch", help="download the corpus + BiomedBERT (the only networked command)"
    )
    p.add_argument("--data-only", action="store_true")
    p.add_argument("--model-only", action="store_true")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("dry-run", help="resolve and validate the whole job without executing it")
    p.set_defaults(func=cmd_dry_run)

    p = sub.add_parser(
        "splits", help="build folds + run every leakage check, WITHOUT training (read this first)"
    )
    p.set_defaults(func=cmd_splits)

    p = sub.add_parser("smoke", help="tiny offline run against tests/fixtures/")
    p.set_defaults(func=cmd_smoke)

    p = sub.add_parser("train", help="the real training job (holds out --fold)")
    p.add_argument("--fold", type=int, default=0, help="fold index to hold out (default 0)")
    p.set_defaults(func=cmd_train)

    p = sub.add_parser("evaluate", help="score the trained model on the held-out fold")
    p.add_argument("--fold", type=int, default=0, help="fold index to evaluate (default 0)")
    p.set_defaults(func=cmd_evaluate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
