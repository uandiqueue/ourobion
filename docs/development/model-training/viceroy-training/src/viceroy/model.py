"""Viceroy Causal-Language-Risk v0 — model construction and train/eval loops.

Heavy ML imports (``torch``, ``transformers``) are lazy, inside the functions that need them —
never at module level — so ``import viceroy.model`` stays fast and possible even before the pinned
ML stack is installed, mirroring the convention in ``viceroy.config`` (see that module's
docstring). This is what keeps ``python -m viceroy.cli preflight`` importable and quick offline.

Device and precision
---------------------
Uses ``viceroy.config.select_device()`` (MPS verified with a real smoke matmul, else CPU). The
preregistered recipe was authored assuming BF16 on an H100 (see the training plan §8); that
assumption does not hold on a laptop-class Apple Silicon Mac Mini, so this module defaults to fp32
and never silently substitutes fp16/bf16. Whichever device and precision a run actually used is
written into the run's JSON artifact (``precision_deviation`` explains why), not just left as a
comment here — a downstream reader of the artifact must be able to see the deviation without
reading source.

Class-weighted loss
--------------------
This is the one substantive modelling difference from the sibling Zebra bundle. The corpus is
imbalanced ~6.4:1 (``no_relationship`` 1,356 vs ``conditional_causal`` 213), so the loss is
weighted by inverse class frequency. Two rules make that honest rather than a knob:

  * weights are computed from the **training split's** distribution only, never the eval split's,
    and never hand-tuned — see ``class_weights``;
  * the weights actually used are recorded in the run artifact, so a reader can reproduce them.

Because HuggingFace's ``model(..., labels=...)`` path applies an *unweighted* cross-entropy
internally, this module computes logits and applies the weighted loss itself. Passing ``labels``
to the model and separately applying weights would silently compute the wrong thing.
"""

import json
import math
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from .config import ViceroyConfig, select_device, set_seed
from .data import CLASS_NAMES, ProcessedExample

NUM_LABELS: int = len(CLASS_NAMES)
LABEL_TO_ID: dict[str, int] = {c: i for i, c in enumerate(CLASS_NAMES)}
ID_TO_LABEL: dict[int, str] = {i: c for c, i in LABEL_TO_ID.items()}


class ModelError(RuntimeError):
    """Raised when model construction or a train/eval loop cannot proceed safely (e.g. an empty
    example list, or a class entirely absent from the training split) — loud failure rather than a
    silently-produced, meaningless artifact."""


@dataclass
class TrainResult:
    output_dir: Path
    per_epoch_loss: list[float]
    wallclock_seconds: dict[str, float]
    device: str
    device_reason: str
    precision: str
    precision_deviation: str | None
    seed: int
    config_hash: str
    data_manifest_hash: str | None
    split_hash: str | None
    class_weights: dict[str, float] | None
    n_train_examples: int
    package_versions: dict[str, str]

    def to_dict(self) -> dict:
        return {
            "output_dir": str(self.output_dir),
            "per_epoch_loss": self.per_epoch_loss,
            "wallclock_seconds": self.wallclock_seconds,
            "device": self.device,
            "device_reason": self.device_reason,
            "precision": self.precision,
            "precision_deviation": self.precision_deviation,
            "seed": self.seed,
            "config_hash": self.config_hash,
            "data_manifest_hash": self.data_manifest_hash,
            "split_hash": self.split_hash,
            "class_weights": self.class_weights,
            "n_train_examples": self.n_train_examples,
            "package_versions": self.package_versions,
        }


# --- class weights ---------------------------------------------------------------------------------


def class_weights(train_examples: Sequence[ProcessedExample]) -> dict[str, float]:
    """Inverse-frequency class weights, normalized to mean 1.0, from the TRAINING split only.

    ``weight_c = n_total / (n_classes * n_c)`` — the standard "balanced" weighting. Normalizing to
    mean 1.0 keeps the overall loss scale comparable to an unweighted run, so the per-epoch loss
    curve stays readable against the unweighted baseline.

    Raises ``ModelError`` if any class has zero rows: a zero-support class would produce an
    infinite weight, and more importantly it means the split is broken (every fold is asserted to
    hold at least ``min_per_class_per_fold`` rows of every class in ``viceroy.splits``).
    """
    if not train_examples:
        raise ModelError("cannot compute class weights from an empty training split")

    counts = {cls: 0 for cls in CLASS_NAMES}
    for e in train_examples:
        counts[e.label] += 1

    missing = [cls for cls, n in counts.items() if n == 0]
    if missing:
        raise ModelError(
            f"class(es) {missing} have zero rows in the training split; refusing to compute an "
            "infinite weight. This means fold assignment is broken — viceroy.splits asserts a "
            "per-class minimum in every fold"
        )

    n_total = len(train_examples)
    raw = {cls: n_total / (NUM_LABELS * n) for cls, n in counts.items()}
    mean_weight = sum(raw.values()) / NUM_LABELS
    return {cls: w / mean_weight for cls, w in raw.items()}


# --- construction ---------------------------------------------------------------------------------


def _package_versions() -> dict[str, str]:
    import torch
    import transformers

    return {"torch": torch.__version__, "transformers": transformers.__version__}


def build_tokenizer(config: ViceroyConfig, *, local_files_only: bool = False):
    """Loads the real BiomedBERT tokenizer. ``local_files_only=True`` never touches the network
    (used by ``preflight``/``smoke`` fallbacks that must stay offline)."""
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(
        config.model_name, cache_dir=str(config.cache_dir), local_files_only=local_files_only
    )


def build_model(config: ViceroyConfig, *, randomly_initialized: bool = False):
    """Builds BiomedBERT + a 4-class sequence-classification head.

    ``randomly_initialized=True`` builds only the architecture (random weights, no download) —
    used by the smoke path when cached pretrained weights are not available offline.
    """
    from transformers import AutoConfig, AutoModelForSequenceClassification

    hf_config = AutoConfig.from_pretrained(
        config.model_name,
        num_labels=NUM_LABELS,
        cache_dir=str(config.cache_dir),
        local_files_only=randomly_initialized,
    )
    hf_config.id2label = ID_TO_LABEL
    hf_config.label2id = LABEL_TO_ID

    if randomly_initialized:
        return AutoModelForSequenceClassification.from_config(hf_config)
    return AutoModelForSequenceClassification.from_pretrained(
        config.model_name, config=hf_config, cache_dir=str(config.cache_dir)
    )


class ToySmokeTokenizer:
    """A tiny, fully local, deterministic whitespace tokenizer used ONLY as a fallback for
    ``cli.py smoke`` when no cached real HF tokenizer is available offline (i.e. before ``fetch``
    has ever run). It exists purely to prove the training loop's wiring — batching, truncation,
    gradient accumulation, the weighted loss, the optimizer step — without any network access or
    pretrained asset. It is never used for the real ``train``/``evaluate`` path; those always call
    ``build_tokenizer``, which loads the genuine BiomedBERT tokenizer.
    """

    def __init__(self, vocab: Sequence[str]):
        self.vocab: dict[str, int] = {}
        for tok in sorted(set(vocab)):
            self.vocab[tok] = len(self.vocab)
        self.pad_id = len(self.vocab)
        self.vocab["[PAD]"] = self.pad_id
        self.unk_id = len(self.vocab)
        self.vocab["[UNK]"] = self.unk_id
        self.cls_id = len(self.vocab)
        self.vocab["[CLS]"] = self.cls_id
        self.sep_id = len(self.vocab)
        self.vocab["[SEP]"] = self.sep_id

    @property
    def vocab_size(self) -> int:
        return len(self.vocab)

    def tokenize(self, text: str) -> list[str]:
        return text.split()

    def num_special_tokens_to_add(self, pair: bool = False) -> int:
        return 3 if pair else 2

    def convert_tokens_to_string(self, tokens: Sequence[str]) -> str:
        return " ".join(tokens)

    def _ids(self, tokens: Sequence[str]) -> list[int]:
        return [self.vocab.get(t, self.unk_id) for t in tokens]

    def __call__(
        self,
        text: Sequence[str],
        *,
        truncation: bool = True,
        max_length: int = 256,
        padding: bool = True,
        return_tensors: str = "pt",
    ) -> dict:
        import torch

        encoded_rows = []
        for item in text:
            ids = [self.cls_id] + self._ids(self.tokenize(item)) + [self.sep_id]
            if truncation:
                ids = ids[:max_length]
            encoded_rows.append(ids)

        max_len = max(len(r) for r in encoded_rows) if padding else max_length
        input_ids, attention_mask = [], []
        for r in encoded_rows:
            pad_n = max_len - len(r)
            input_ids.append(r + [self.pad_id] * pad_n)
            attention_mask.append([1] * len(r) + [0] * pad_n)

        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
        }


def build_toy_smoke_model_and_tokenizer(examples: Sequence[ProcessedExample]):
    """Builds a tiny random-weight BERT-family classifier plus a ``ToySmokeTokenizer`` whose
    vocabulary is drawn from the given (fixture) examples. Fully local: no network, no cached
    pretrained asset required. Used by ``cli.py smoke`` when real cached weights/tokenizer are
    unavailable offline."""
    from transformers import BertConfig, BertForSequenceClassification

    vocab: set[str] = set()
    for ex in examples:
        vocab.update(ex.sentence_text.split())
    tokenizer = ToySmokeTokenizer(sorted(vocab))

    tiny_config = BertConfig(
        vocab_size=tokenizer.vocab_size,
        hidden_size=32,
        num_hidden_layers=2,
        num_attention_heads=2,
        intermediate_size=64,
        max_position_embeddings=512,
        num_labels=NUM_LABELS,
    )
    tiny_config.id2label = ID_TO_LABEL
    tiny_config.label2id = LABEL_TO_ID
    model = BertForSequenceClassification(tiny_config)
    return model, tokenizer


# --- batch encoding --------------------------------------------------------------------------------


def _encode_batch(tokenizer, examples: Sequence[ProcessedExample], max_seq_len: int):
    """Single-sequence encoding — unlike Zebra's (claim, evidence) pair, this model's input is one
    conclusion sentence, so there is no second segment and no pair truncation policy."""
    sentences = [e.sentence_text for e in examples]
    encoded = tokenizer(
        sentences,
        truncation=True,
        max_length=max_seq_len,
        padding=True,
        return_tensors="pt",
    )
    labels = [LABEL_TO_ID[e.label] for e in examples]
    return encoded, labels


# --- train loop --------------------------------------------------------------------------------


def train(
    config: ViceroyConfig,
    train_examples: Sequence[ProcessedExample],
    *,
    tokenizer=None,
    model=None,
    output_dir: Path | None = None,
    data_manifest_hash: str | None = None,
    split_hash: str | None = None,
) -> TrainResult:
    """Fine-tunes ``model`` (built from ``config`` if not supplied) on ``train_examples``.

    Gradient accumulation reaches ``config.effective_batch_size`` from
    ``config.physical_batch_size`` (see ``ViceroyConfig.gradient_accumulation_steps``); linear
    warmup over ``config.warmup_ratio`` of total optimizer steps; gradients clipped to
    ``config.grad_clip``; a fixed ``config.epochs`` epoch count; class-weighted cross-entropy when
    ``config.class_weighting`` is set. Writes a JSON artifact (``train-artifact.json``) recording
    device, seed, config hash, data-manifest hash, **split hash**, the class weights actually
    applied, package versions, per-epoch loss, and wall-clock seconds for every phase.

    ``split_hash`` is recorded because the split is a *result of this bundle's own code*, not an
    inherited given. Two runs with the same data manifest but different split hashes are not
    comparable, and that must be visible from the artifact alone.
    """
    import torch
    from torch.optim import AdamW
    from transformers import get_linear_schedule_with_warmup

    if len(train_examples) == 0:
        raise ModelError("train_examples is empty; refusing to run a train loop over nothing")

    wallclock: dict[str, float] = {}
    t_setup0 = time.perf_counter()

    set_seed(config.seed)
    device, device_reason = select_device()
    precision = "fp32"
    precision_deviation = None
    if device == "mps":
        precision_deviation = (
            "Preregistered recipe assumed BF16 on an H100. Running fp32 on MPS instead: bf16/fp16 "
            "support in PyTorch's MPS backend is not verified safe for this model/task from the "
            "(offline, non-Mac) environment this bundle was authored in. Recorded here rather "
            "than silently applied — revisit once measured on-device."
        )

    if tokenizer is None:
        tokenizer = build_tokenizer(config)
    if model is None:
        model = build_model(config)
    model.to(device)

    weights_by_class = class_weights(train_examples) if config.class_weighting else None
    weight_tensor = None
    if weights_by_class is not None:
        weight_tensor = torch.tensor(
            [weights_by_class[cls] for cls in CLASS_NAMES], dtype=torch.float32, device=device
        )
    loss_fn = torch.nn.CrossEntropyLoss(weight=weight_tensor)

    optimizer = AdamW(model.parameters(), lr=config.lr, weight_decay=config.weight_decay)

    n_examples = len(train_examples)
    steps_per_epoch = math.ceil(n_examples / config.physical_batch_size)
    accumulation = config.gradient_accumulation_steps
    optimizer_steps_per_epoch = math.ceil(steps_per_epoch / accumulation)
    total_optimizer_steps = max(1, optimizer_steps_per_epoch * config.epochs)
    warmup_steps = int(total_optimizer_steps * config.warmup_ratio)
    scheduler = get_linear_schedule_with_warmup(optimizer, warmup_steps, total_optimizer_steps)

    wallclock["setup_seconds"] = time.perf_counter() - t_setup0

    per_epoch_loss: list[float] = []
    shuffle_rng = random.Random(config.seed)
    row_order = list(range(n_examples))

    t_train0 = time.perf_counter()
    model.train()
    for epoch in range(config.epochs):
        t_epoch0 = time.perf_counter()
        shuffle_rng.shuffle(row_order)
        running_loss = 0.0
        n_batches = 0
        optimizer.zero_grad()
        for batch_start in range(0, n_examples, config.physical_batch_size):
            batch_row_idx = row_order[batch_start : batch_start + config.physical_batch_size]
            batch_examples = [train_examples[i] for i in batch_row_idx]
            encoded, labels = _encode_batch(tokenizer, batch_examples, config.max_seq_len)
            encoded = {k: v.to(device) for k, v in encoded.items()}
            labels_t = torch.tensor(labels, dtype=torch.long, device=device)

            # NOTE: labels are deliberately NOT passed to the model — HF would then apply its own
            # unweighted cross-entropy and the class weighting would silently do nothing.
            outputs = model(**encoded)
            loss = loss_fn(outputs.logits, labels_t)
            (loss / accumulation).backward()
            running_loss += loss.item()
            n_batches += 1

            is_last_batch = batch_start + config.physical_batch_size >= n_examples
            if n_batches % accumulation == 0 or is_last_batch:
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

        per_epoch_loss.append(running_loss / max(1, n_batches))
        wallclock[f"epoch_{epoch + 1}_seconds"] = time.perf_counter() - t_epoch0

    wallclock["train_total_seconds"] = time.perf_counter() - t_train0

    out_dir = Path(output_dir) if output_dir is not None else config.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    t_save0 = time.perf_counter()
    model_dir = out_dir / "model"
    model.save_pretrained(str(model_dir))
    save_tokenizer = getattr(tokenizer, "save_pretrained", None)
    if save_tokenizer is not None:
        save_tokenizer(str(model_dir))
    wallclock["save_seconds"] = time.perf_counter() - t_save0

    result = TrainResult(
        output_dir=out_dir,
        per_epoch_loss=per_epoch_loss,
        wallclock_seconds=wallclock,
        device=device,
        device_reason=device_reason,
        precision=precision,
        precision_deviation=precision_deviation,
        seed=config.seed,
        config_hash=config.config_hash(),
        data_manifest_hash=data_manifest_hash,
        split_hash=split_hash,
        class_weights=weights_by_class,
        n_train_examples=n_examples,
        package_versions=_package_versions(),
    )
    artifact_path = out_dir / "train-artifact.json"
    artifact_path.write_text(
        json.dumps(result.to_dict(), indent=2, sort_keys=True), encoding="utf-8"
    )
    return result


# --- eval loop -----------------------------------------------------------------------------------


def evaluate(
    config: ViceroyConfig,
    eval_examples: Sequence[ProcessedExample],
    tokenizer,
    model,
) -> dict:
    """Runs inference over ``eval_examples`` and returns raw logits + softmax probabilities
    alongside the true labels and device/timing info. Metric computation itself lives in
    ``viceroy.metrics``, not here — this function's job is only to produce the numbers metrics are
    computed from."""
    import torch

    if len(eval_examples) == 0:
        raise ModelError("eval_examples is empty; refusing to run eval over nothing")

    device, device_reason = select_device()
    model.to(device)
    model.eval()

    all_logits: list[list[float]] = []
    all_probs: list[list[float]] = []

    t0 = time.perf_counter()
    with torch.no_grad():
        for batch_start in range(0, len(eval_examples), config.physical_batch_size):
            batch = eval_examples[batch_start : batch_start + config.physical_batch_size]
            encoded, _labels = _encode_batch(tokenizer, batch, config.max_seq_len)
            encoded = {k: v.to(device) for k, v in encoded.items()}
            outputs = model(**encoded)
            all_logits.extend(outputs.logits.detach().cpu().tolist())
            all_probs.extend(torch.softmax(outputs.logits, dim=-1).detach().cpu().tolist())
    elapsed = time.perf_counter() - t0

    return {
        "logits": all_logits,
        "probs": all_probs,
        "labels": [e.label for e in eval_examples],
        "example_ids": [e.example_id for e in eval_examples],
        "row_ids": [e.row_id for e in eval_examples],
        "device": device,
        "device_reason": device_reason,
        "wallclock_seconds": elapsed,
    }
