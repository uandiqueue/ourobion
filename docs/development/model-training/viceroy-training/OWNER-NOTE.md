# Note for the owner of the machine

A short, honest account of what this job does to the machine. Hand this to whoever owns it.

**What it is:** fine-tuning a small open-source language model (BiomedBERT, 110M parameters — tiny
by current standards) on a public research dataset of 3,061 sentences taken from published medical
paper conclusions. A non-commercial research experiment.

## Disk — about 2.5 GB, fully removable

| Item | Size |
|---|---|
| Python environment + libraries (PyTorch, transformers) | ~550 MB |
| Model weights, downloaded once | ~420 MB |
| Dataset (public research corpus) | ~0.4 MB |
| Training output / checkpoint | 420 MB – 1.3 GB |
| Logs and results | <50 MB |

Everything lives inside **this one folder**, including the Python environment (`.venv`). Deleting
the folder removes 100% of it. No system files are touched, no installer runs, nothing needs
`sudo`.

The only exception: if Python 3.10 is not already present, the setup script **stops and tells you**
rather than installing anything itself.

## Memory — peaks around 3–5 GB

Unified memory, during training only (roughly 25–30% of a 16 GB machine). Nothing runs before or
after; there is no background service, no login item, no autostart.

## Compute time — under an hour, mostly idle

- One-time setup and downloads: 10–20 min, almost entirely network wait
- Building and auditing the data split: about **1 second** (measured; no GPU, no ML libraries)
- Actual training: **~10 minutes** on the GPU, or ~35 min if it falls back to CPU
- Evaluation: 1–3 min

The machine is genuinely under load for about **15–40 minutes**. The fan may spin up during the
training minutes.

*The training and evaluation timings are estimates from model size and corpus size, not yet
measured on this hardware. The corpus is 3,061 rows, so even a substantially wrong estimate stays
inside the hour.*

## Network — ~550 MB down, nothing up

Python packages (~130 MB), model weights (~420 MB), dataset (0.4 MB). One time. **Nothing is
uploaded**, no account or login is required, and no telemetry is enabled.

The dataset is downloaded from a specific pinned version of a public GitHub repository, and its
checksum is verified against a known value before use.

## Privacy and safety

- **No personal data, no user data, no credentials, no secrets.** The dataset is a public research
  corpus of sentences from published paper conclusions; the model is MIT-licensed from Microsoft.
- No cloud services, no API keys, no external accounts.
- No background services, no login items, no autostart, no system configuration changes.
- Everything is contained in this folder.

## One thing worth knowing before you agree

The dataset's repository is licensed **GPL-3.0**. Whether that licence extends to a model trained
on the data is an unsettled legal question, so this bundle **refuses to run** until a human has
recorded a written decision about it. That is deliberate. It means the job cannot start by
accident, and it also means someone has to make that call before anything is trained.

## Cleanup

```bash
rm -rf /path/to/viceroy-training
```

That returns the machine to exactly its prior state. If you'd rather keep the folder but reclaim
the space, `rm -rf .venv assets .cache outputs` recovers almost all of it.

## If anything looks wrong

Stop it with `Ctrl-C`; there is no cleanup step to remember and nothing is left running. Any
partial download or checkpoint lives in this folder and is safe to delete.
