# Note for the owner of the Mac Mini

A short, honest account of what this job does to the machine. Hand this to whoever owns it.

**What it is:** fine-tuning a small open-source language model (BiomedBERT, 110M parameters — tiny by
current standards) on a public scientific dataset of 919 text examples. A non-commercial research
experiment.

## Disk — about 2.5 GB, fully removable

| Item | Size |
|---|---|
| Python environment + libraries (PyTorch, transformers) | ~600 MB |
| Model weights, downloaded once | ~420 MB |
| Dataset (SciFact, public) | ~5 MB |
| Training output / checkpoint | 420 MB – 1.3 GB |
| Logs and results | <50 MB |

Everything lives inside **this one folder**, including the Python environment (`.venv`). Deleting the
folder removes 100% of it. No system files are touched, no installer runs, nothing needs `sudo`.

The only exception: if Python 3.10 is not already present, the setup script **stops and tells you**
rather than installing anything itself.

## Memory — peaks around 3–5 GB

Unified memory, during training only (roughly 25–30% of a 16 GB machine). Nothing runs before or after;
there is no background service, no login item, no autostart.

## Compute time — under an hour, mostly idle

- One-time setup and downloads: 15–25 min, almost entirely network wait
- Actual training: **~4 minutes** on the GPU, or ~15 min if it falls back to CPU
- Evaluation: 2–5 min

The machine is genuinely under load for about **20–30 minutes**. The fan may spin up during the
training minutes.

*These timings are estimates from the model size and dataset size, not yet measured on this hardware.
The dataset is 919 rows, so even a substantially wrong estimate stays inside the hour.*

## Network — ~600 MB down, nothing up

Python packages (~150 MB), model weights (~420 MB), dataset (~5 MB). One time. **Nothing is uploaded**,
no account or login is required, and no telemetry is enabled.

## Privacy and safety

- **No personal data, no user data, no credentials, no secrets.** The dataset is a public research
  corpus of scientific claims; the model is MIT-licensed from Microsoft.
- No cloud services, no API keys, no external accounts.
- No background services, no login items, no autostart, no system configuration changes.
- Everything is contained in this folder.

## Cleanup

```bash
rm -rf /path/to/zebra-training
```

That returns the machine to exactly its prior state. If you'd rather keep the folder but reclaim the
space, `rm -rf .venv assets` recovers almost all of it.

## If anything looks wrong

Stop it with `Ctrl-C`; there is no cleanup step to remember and nothing is left running. Any partial
download or checkpoint lives in this folder and is safe to delete.
