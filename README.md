# Biotope

Single-repository project — Flutter mobile app + Supabase backend.

## 📚 Documentation

**Start with [`AGENTS.md`](AGENTS.md) — the single source of truth** for agents and humans. It points
to everything else:

- `docs/PROJECT-CONTEXT.md` — project principles, goals, phases
- `docs/ARCHITECTURE-CONTEXT.md` — system architecture and data flows
- `docs/STRUCTURE-CONTEXT.md` — repository layout rules
- `shared/SHARED-CONTEXT.md` — shared TypeScript/Dart type contracts
- `docs/ui-context/UI-DESIGN-CONTEXT.md` — design tokens, component specs
- `docs/AGENT-PROTOCOL.md` — AI routing table, truth hierarchy, PR review checklist
- `docs/dev-workflow.md` — the full human dev cycle (Issue → … → Merge)
- `docs/PHASE2-PLAN.md` — the Phase 2 plan: goals, workstreams, two-track sequence, stress-test gate
- `docs/INSIGHTS-ENGINE-DESIGN.md` — the data-driven insights-engine contract (Phase 2 Track B)
- `docs/human-briefs/` — plain-language stakeholder briefs of significant plans

## 🧠 Context engineering — building biotope with AI agents

biotope is built largely by **AI coding agents** (Claude Code, Codex, Gemini CLI) working alongside human
teammates — sometimes several on the same machine. Agents start every session blank: their working memory
is ephemeral, doesn't survive a restart, and doesn't travel between tools or laptops. Unmanaged, that
produces the three failure modes of agent-driven development — **drift** (docs and code disagree),
**duplicated or colliding work**, and **silent contract breakage** across the Dart / TypeScript / SQL
seams.

So this repo treats **context as a first-class, version-controlled, automatically-enforced artifact**:
the project carries its own durable memory, and the rules that keep it honest are checked by machines,
not by trust. The human-facing *why* lives here; the agent-facing *how* is [`AGENTS.md`](AGENTS.md) — the
single instruction file every AI tool reads, kept deliberately lean so it never overloads an agent.

### Design principles

1. **The repository is the single source of truth — nothing important lives in a tool's head.**
   Device-local agent memory (`~/.claude`, `~/.gemini`) doesn't travel, so everything durable lives in
   git. One file, `AGENTS.md`, is authoritative; the per-tool files (`CLAUDE.md`, `GEMINI.md`) are thin
   pointers to it, so guidance can't drift between Claude, Codex, and Gemini.
2. **Separate what's stable from what's in motion.** A *constant* layer (architecture, contracts,
   conventions — changes only at phase boundaries) is kept apart from a *variable* layer (what happened,
   what's next). Mixing the two is what makes documentation rot.
3. **Distinguish truth from derived ("two-tier truth").** Hand-authored inputs — migrations, raw user
   rows, shared contracts, rule blueprints — are **truth**. Anything a job can recompute — baselines,
   insight cards, the knowledge graph — is a **rebuildable projection**, never hand-edited. To change a
   derived value you fix the input and re-run.
4. **Append-only, one file per session.** Parallel agents and teammates never edit a shared status file
   (the road to merge conflicts and silent overwrites). Each session writes a single immutable log, so
   history is conflict-free by construction.
5. **Make implicit contracts executable.** The couplings a compiler can't see — a TypeScript type ↔ a
   Postgres column ↔ a Dart model, or a metric key reused across the stack — are pinned by **guard
   tests**, so drift fails a test instead of surfacing as a runtime bug.
6. **Enforce automatically, don't rely on discipline.** People and agents forget, and local hooks can be
   skipped — so a pre-push hook *and* CI re-run the same checks (a session was logged, the memory index
   resolves, every coupling's guard exists) as a non-bypassable backstop.
7. **Isolate concurrent work.** Every session runs in its own issue + branch + **git worktree**, so two
   agents on the same laptop can't trip over each other's working tree.
8. **Fight context overload.** A semantic knowledge graph (graphify — see *Code navigation* below) lets an
   agent pull only the relevant slice of a growing codebase instead of re-reading everything.

### How it's built

| Piece | What it is | Principle |
|---|---|---|
| [`AGENTS.md`](AGENTS.md) | The single, tool-agnostic instruction file; `CLAUDE.md` / `GEMINI.md` are thin pointers | 1 |
| `docs/*-CONTEXT.md` | The **constant** layer — product principles, module graph, contracts | 2 |
| `docs/sessions/` | The **variable** layer — one append-only log per session (*Attempted / Changed / Decided / Left / Blockers*) | 2, 4 |
| `docs/memory/` | Durable, one-fact-per-file decisions, indexed | 1, 2 |
| `docs/graph/couplings.yaml` | Cross-language data contracts, each made executable by a named guard test | 5 |
| `graphify-out/` (graphify) | A regenerated semantic graph of the repo for agent navigation | 3, 8 |
| `tools/context_sync.mjs` | Session-start briefing + the pre-push/CI check that enforces all of the above | 6 |
| `tools/setup_agent_worktree.mjs` | One isolated worktree + branch per session | 7 |

### How a session runs

1. **Start** — `node tools/context_sync.mjs --session-start` prints the latest sessions, the memory
   index, and a staleness flag; the agent reads the recent `docs/sessions/` entries to resume.
2. **Isolate** — open a GitHub issue and cut a short-lived branch in its own worktree off `dev-phase2`
   (`tools/setup_agent_worktree.mjs`).
3. **Work** — code, capturing durable decisions as `docs/memory/` facts and executable `couplings.yaml`
   edges as you go.
4. **Close** — write exactly one `docs/sessions/<UTC>-<device>-<agent>-<slug>.md` log and open a PR into
   `dev-phase2`. The pre-push hook + CI refuse the push unless the session is logged, the memory index
   resolves, and every coupling guard exists.

`dev-phase2` is the **single integration line for this phase**: session branches merge into it, it stays
continuously integrable, and only `dev-phase2` merges to `main` at phase completion — after which the
next phase is cut fresh from `main`. `main` stays always-deployable. *(One-time per clone:*
`git config core.hooksPath .githooks` *enables the shared hooks; the worktree tool does this automatically.)*

---

## 🛠 Development Setup

### Prerequisites

| Tool | Version | Where |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Flutter | 3.11+ | [flutter.dev](https://docs.flutter.dev/get-started/install) |
| Android Studio | Latest | [developer.android.com/studio](https://developer.android.com/studio) |

> **Windows users:** install only **Docker Desktop + Git**, then run `.\scripts\setup.ps1` — it
> installs Node, the JDK, Flutter, and the Android SDK *bounded to this project* (no global
> installs, no WSL). See the [Windows](#windows) section. The table above applies to Linux/macOS.

---

### Linux

```bash
# Clone
git clone https://github.com/uandiqueue/biotope.git && cd biotope

# Install Node.js (if not installed)
sudo apt install nodejs npm
# or use nvm: https://github.com/nvm-sh/nvm

# Install Flutter (if not installed)
sudo snap install flutter --classic

# Install Docker (if not installed)
sudo apt install docker.io && sudo usermod -aG docker $USER

# Run setup script
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Configure Android SDK after installing Android Studio
flutter doctor --android-licenses

# Start Supabase and run migrations
npx supabase start
npx supabase db push # use db reset if on docker

# Run the app
cd src && flutter run
```

---

### macOS

```bash
# Clone
git clone https://github.com/uandiqueue/biotope.git && cd biotope

# Install prerequisites via Homebrew (if not installed)
brew install node
brew install --cask flutter
brew install --cask docker
brew install --cask android-studio

# Run setup script
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Configure Android SDK after opening Android Studio once
flutter config --android-sdk ~/Library/Android/sdk
flutter doctor --android-licenses

# Start Supabase and run migrations
npx supabase start
npx supabase db push # use db reset if on docker

# Run the app
cd src && flutter run
```

---

### Windows

Windows runs **natively — no WSL terminal, no port-forwarding.** Docker Desktop runs the
Supabase stack and maps it to Windows `localhost`, and the **entire toolchain is installed
bounded to this project** (in a sibling `..\biotope-toolchain\` folder, via Miniconda) so
nothing touches your global PATH. One script does it all.

#### Prerequisites (install yourself first)

- **Docker Desktop** — started. Runs local Supabase. [docker.com](https://www.docker.com/products/docker-desktop/)
- **Git**.

> That's it. Node, the JDK, Flutter, and the Android SDK are installed *bounded to biotope* by
> the setup script below — you do **not** need a global Node, Flutter, or Android Studio install.

#### Step 1 — Clone and run the bounded setup

In **PowerShell**, from the repo root:

```powershell
git clone https://github.com/uandiqueue/biotope.git
cd biotope

# Installs (into ..\biotope-toolchain): Miniconda -> conda env "biotope" (Node + JDK 17),
# Flutter SDK, Android SDK + emulator + an AVD; configures Flutter; creates env files;
# installs deps. Idempotent — safe to re-run. Takes a while on first run (large downloads).
.\scripts\setup.ps1
```

#### Step 2 — Activate the toolchain (every new shell)

The toolchain is **session-scoped**: dot-source this in each new PowerShell window to put
`node`, `flutter`, `adb`, the emulator, and the conda JDK on PATH for that session only.

```powershell
. .\scripts\biotope-env.ps1
```

> Override the toolchain location with `$env:BIOTOPE_TOOLCHAIN` before sourcing if you put it
> elsewhere.

#### Step 3 — Start Supabase (Docker Desktop)

```powershell
npx supabase start          # first run pulls the Docker images
npx supabase db reset       # apply migrations to the local DB
```

`supabase start` prints an **anon key** — paste it into `src\.env.public` as `SUPABASE_ANON_KEY`.
The URL is already set for the emulator:

```
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_ANON_KEY=<anon key from supabase start>
```

> `10.0.2.2` is the Android emulator's alias for the host's `localhost`, where Docker Desktop
> maps Supabase. **On a physical phone**, set it to your PC's LAN IP (from `ipconfig` →
> Wireless LAN adapter Wi-Fi → IPv4) instead, and make sure phone + PC share a WiFi network.

#### Step 4 — Run on the Android emulator

```powershell
flutter emulators --launch biotope_pixel   # boot the bundled AVD
flutter devices                            # confirm it's listed
cd src; flutter run                        # build + run (first Gradle build is slow)
```

---

## 📦 Where dependencies live — dev toolchain vs. app

A common question: *"the toolchain is in a sibling folder outside the repo — so what gets deployed?"*

The sibling **`..\biotope-toolchain\`** (Miniconda env, Flutter SDK, Android SDK, JDK) is **only a
local build/dev environment**. It is **build tooling, not runtime dependency** — it is never deployed,
never committed, and is fully disposable (delete it and re-run `scripts/setup.ps1` to recreate it).
Nothing on a server or in a release artifact reads from it.

The dependencies that actually travel are all **declared inside the repo** and resolved fresh wherever
they're needed:

| Layer | Declared in (repo) | Where it ends up at deploy time |
|---|---|---|
| Flutter app (Dart) | `src/pubspec.yaml` + `pubspec.lock` | **Compiled into the build artifact** — `flutter build apk` / `appbundle` / `ipa` / `web`. The artifact is self-contained; the target device/host needs **no** Flutter SDK. |
| Shared TS contracts | `shared/package.json` + lockfile | Type-checked in CI; bundled into edge functions that use them. |
| Backend logic | `supabase/functions/*` (Deno/TS) | `supabase functions deploy` → runs on **Supabase's** managed infra (Deno runtime). No Node server of yours. |
| Database schema | `supabase/migrations/*.sql` | `supabase db push` → applied to the **hosted Postgres**. |
| Dev/build CLIs | `package.json` (`supabase` devDep) | Installed fresh by `npm ci` in CI; not shipped. |

So **biotope has no "web server" hosting the app**: the **Android/iOS app is a compiled binary**
(deps baked in), and the **backend is hosted by Supabase** (Postgres + Deno edge functions). If you
ever serve the **Flutter *web*** build, `flutter build web` emits **static files** (`build/web/`) that
any web server (nginx, Netlify, etc.) serves directly — again, the Flutter SDK stays on the build
machine, not the server.

**CI proves this:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) installs Node + Flutter
from scratch each run (via `setup-node` / `flutter-action`) and `npm ci` / `flutter pub get` from the
lockfiles — it never references the local toolchain folder.

---

## 🧭 Code navigation — graphify (semantic context graph)

biotope indexes its **own source** into a queryable semantic graph with
[graphify](https://github.com/safishamsi/graphify), so an AI assistant (or you) can ask *"what connects
auth to the database?"* and get a small, relevant slice instead of grepping the whole tree. It is **dev
tooling** — not part of the app, and not part of the insights engine.

### Install / rebuild

graphify is **bounded to the project toolchain** (like Node/Flutter) — a venv in
`..\biotope-toolchain\graphify-venv`, never global, never committed.

- **Auto-installed** by `scripts/setup.ps1` (Windows) and `scripts/setup.sh` (macOS/Linux/Git Bash) —
  no separate step on a new device.
- **Rebuild after code changes:**
  - Windows: `.\scripts\graphify-build.ps1`
  - macOS/Linux: `bash scripts/graphify-build.sh`
- Output lands in `graphify-out/` — **gitignored and rebuildable; never copy or commit it.**
- On Windows, `graphify` is on PATH after `. .\scripts\biotope-env.ps1` (otherwise call the venv's
  `graphify` directly).

### Does it run automatically?

The **automatic** behaviour — the assistant consulting the graph before grepping/reading source — is
**pre-wired (committed in the repo) for Claude Code, Codex, and Gemini CLI**. Each has a PreToolUse hook
plus a graphify block in the file that tool reads. Any other tool runs graphify **manually** — it's just
a CLI.

| You are using… | How graphify works |
|---|---|
| **Claude Code** | **Pre-wired.** Hook `.claude/settings.json` + `## graphify` block in `CLAUDE.md` + a **`/graphify` skill** (`.claude/skills/graphify/`). Type **`/graphify`** to build/query in-session (incl. the semantic pass — see below). |
| **Codex** (OpenAI / GPT) | **Pre-wired.** Hook `.codex/hooks.json` + graphify guidance in `AGENTS.md`. |
| **Gemini CLI** | **Pre-wired.** Hook `.gemini/settings.json` + `## graphify` block in `GEMINI.md`. |
| **Another AI tool** (Cursor, Copilot, …) | Not pre-wired. Either **run it yourself** (CLI below), or install that tool's integration: `graphify <tool> install` (e.g. `graphify cursor install`) — that edits *that* tool's config. |
| **No AI / plain terminal** | **Run it yourself** with the CLI below. |

In all pre-wired cases the semantic pass uses the **host assistant's session model — no API key** — and
graphify must be on PATH (Windows: `. .\scripts\biotope-env.ps1`). The hooks/blocks travel with the repo,
so a fresh clone is pre-wired after the toolchain is installed.

**Query it yourself (any platform):**

```bash
graphify query "<question>"      # the relevant subgraph for a question
graphify path "<A>" "<B>"        # shortest relationship between two symbols
graphify explain "<concept>"     # a node and its neighbours
```

### Richer graph: the semantic pass (optional)

The commands above build the **AST graph** (structure + call edges — local, deterministic, no key). A
second **semantic pass** uses an LLM to add cross-file/cross-language *inferred* edges, merge concepts
across Dart/TS, ingest docs/PDFs, and name communities. Run it either way:

- **In Claude Code (no key):** type **`/graphify .`** — the skill runs the full pipeline using the
  session model.
- **Headless:** `graphify extract . --backend ollama` (local model, no key) or `--backend claude|gemini`
  with that provider's API key (`--mode deep` for more aggressive inferred edges).

The semantic layer is **inferred (probabilistic)** — for *enforced* cross-language data contracts (e.g.
metric keys), rely on [`docs/graph/couplings.yaml`](docs/graph/couplings.yaml), not the graph.

**API keys / cost:** the AST graph needs **no key** anywhere. The semantic pass is free in Claude Code
(host session model) or local via `ollama`; other hosted backends need that provider's key
(`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`).

More detail: [`docs/graph/README.md`](docs/graph/README.md) and
[`docs/memory/0008-graphify-context-tool.md`](docs/memory/0008-graphify-context-tool.md).

---

## 📱 Running on Android

You can use either a **physical Android phone** or an **Android emulator** (AVD). Both work the same way with `flutter run`.

### Option A — Physical Phone (all platforms)

**On your phone:**
1. Settings → About Phone → tap **Build Number** 7 times
2. Settings → Developer Options → enable **USB Debugging**
3. Plug phone into PC via USB — tap **Allow** on the phone prompt

**Verify connection:**

```bash
# Linux / macOS / WSL2
flutter devices

# Windows PowerShell
flutter devices
```

Your phone should appear in the list before running `flutter run`.

### Option B — Android Emulator (macOS / Linux / Windows)

> Recommended for desktop dev — no USB needed.

**Windows (bounded toolchain):** `scripts/setup.ps1` already created an AVD named `biotope_pixel`.
After `. .\scripts\biotope-env.ps1`:

```powershell
flutter emulators --launch biotope_pixel   # boot it
flutter devices                            # confirm it's listed
cd src; flutter run
```

The emulator reaches the Docker-hosted Supabase at `http://10.0.2.2:54321` (already set in
`src\.env.public`) — no WSL, no port-forwarding.

**macOS / Linux (via Android Studio):**

1. Open **Android Studio** → **More Actions → Virtual Device Manager**
2. **Create Device** → pick a phone (e.g. Pixel 8) → a system image (e.g. **API 35**) → Finish
3. Click ▶️ to boot it, then:
   ```bash
   flutter devices        # emulator should appear
   cd src && flutter run
   ```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| `flutter` / `node` / `adb` not recognized (Windows) | Dot-source the toolchain first: `. .\scripts\biotope-env.ps1` |
| Phone not detected | Re-enable USB Debugging, try a different USB cable |
| `flutter doctor` shows Android SDK missing | Re-run `flutter config --android-sdk` with correct path |
| Emulator can't reach Supabase | Confirm `SUPABASE_URL=http://10.0.2.2:54321` in `src/.env.public` and that `npx supabase start` is running |
| Supabase connection refused on physical phone | Set `SUPABASE_URL` to your PC's LAN IP (not `10.0.2.2`); confirm phone + PC on same WiFi |
| `flutter pub get` fails | Check the toolchain is active (`. .\scripts\biotope-env.ps1`) and `src/pubspec.yaml` exists |
| Docker not running | Start Docker Desktop before running `npx supabase start` |
