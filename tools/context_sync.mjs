#!/usr/bin/env node
// Enforced context maintenance for the biotope repo. Node port of NUSPlan's tools/context_sync.py.
//
// Two modes, wired so the in-repo agent context (sessions, memory, couplings) can never silently
// drift from reality:
//
//   --session-start  Print a resume briefing: latest session logs, the memory index, and a staleness
//                    flag. Informational; always exits 0. (Wired to the Claude Code SessionStart hook
//                    in .claude/settings.json.)
//
//   --check          Run the enforcement checks. Exits non-zero on any violation. Wired to the
//                    .githooks/pre-push hook AND re-run in CI (the non-bypassable backstop, since
//                    local hooks are skippable with --no-verify). Checks:
//                      a. Session coverage  — a docs/sessions/ entry is added/changed in the commits
//                         being pushed (<upstream>..HEAD, falling back to origin/main..HEAD).
//                      b. Memory index      — docs/memory/README.md <-> docs/memory/*.md
//                         (no dangling links, no unindexed files).
//                      c. Couplings         — every docs/graph/couplings.yaml `guard:` exists on disk.
//
// Node stdlib + `git` via child_process only — no third-party deps, so it runs anywhere Node 18+ is
// present. The structural dependency graph is DEFERRED in biotope (see docs/graph/README.md), so —
// unlike the NUSPlan original — there is no deps.json check here.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SESSIONS_DIR = join(REPO_ROOT, "docs", "sessions");
const MEMORY_DIR = join(REPO_ROOT, "docs", "memory");
const MEMORY_INDEX = join(MEMORY_DIR, "README.md");
const COUPLINGS = join(REPO_ROOT, "docs", "graph", "couplings.yaml");

const STALE_DAYS = 21;
const MD_LINK = /\]\(([^)]+)\)/g;
const TS_PREFIX = /^(\d{8})T(\d{6})Z/;
const GUARD_LINE = /^[ \t]*guard:[ \t]*(\S.*?)\s*$/gm;

function read(path) {
  return readFileSync(path, "utf8");
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function sessionFiles() {
  if (!isDir(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort();
}

function parseSessionTs(name) {
  const m = TS_PREFIX.exec(name);
  if (!m) return null;
  const [, d, t] = m;
  // YYYYMMDD + HHMMSS -> a UTC Date.
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T` +
    `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Returns { code, out }. code 127 if git is not on PATH.
function git(...args) {
  const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (res.error) return { code: 127, out: "" };
  return { code: res.status ?? 1, out: (res.stdout || "").trim() };
}

// --------------------------------------------------------------------------- session-start

function sessionStart() {
  const bar = "=".repeat(72);
  console.log(bar);
  console.log("biotope — session resume briefing (tools/context_sync.mjs --session-start)");
  console.log(bar);

  const sessions = sessionFiles();
  if (sessions.length === 0) {
    console.log("\n[sessions] none yet — this is the first session.");
  } else {
    const latest = sessions.slice(-3).reverse();
    console.log(`\n[sessions] ${sessions.length} total. Most recent (read these to resume):`);
    for (const name of latest) console.log(`  - docs/sessions/${name}`);
    const newestTs = parseSessionTs(sessions[sessions.length - 1]);
    if (newestTs) {
      const ageDays = Math.floor((Date.now() - newestTs.getTime()) / 86_400_000);
      const flag = ageDays > STALE_DAYS ? "  <-- STALE" : "";
      console.log(`\n[freshness] newest session is ${ageDays} day(s) old${flag}.`);
    }
  }

  if (isFile(MEMORY_INDEX)) {
    console.log("\n[memory] docs/memory index:");
    for (const line of read(MEMORY_INDEX).split(/\r?\n/)) {
      const s = line.trim();
      if (s.startsWith("- [")) console.log(`  ${s}`);
    }
  } else {
    console.log("\n[memory] docs/memory/README.md missing.");
  }

  console.log("\nNext: read the latest session file(s) above before changing anything.\n");
  return 0;
}

// --------------------------------------------------------------------------- check helpers

function checkMemoryIndex(errors) {
  if (!isFile(MEMORY_INDEX)) {
    errors.push("docs/memory/README.md (index) is missing.");
    return;
  }
  const linked = new Set();
  const indexText = read(MEMORY_INDEX);
  for (const m of indexText.matchAll(MD_LINK)) {
    let target = m[1].split("#", 1)[0].trim();
    if (!target || target.includes("://")) continue;
    linked.add(target);
    if (!isFile(join(MEMORY_DIR, target))) {
      errors.push(`docs/memory/README.md links to missing file: ${target}`);
    }
  }
  const onDisk = isDir(MEMORY_DIR)
    ? readdirSync(MEMORY_DIR).filter((n) => n.endsWith(".md") && n !== "README.md")
    : [];
  for (const name of onDisk.sort()) {
    if (!linked.has(name)) {
      errors.push(`docs/memory/${name} exists but is not indexed in README.md`);
    }
  }
}

function checkCouplings(errors) {
  if (!isFile(COUPLINGS)) {
    errors.push("docs/graph/couplings.yaml is missing.");
    return;
  }
  const text = read(COUPLINGS);
  const guards = [...text.matchAll(GUARD_LINE)].map((m) => m[1].trim());
  if (guards.length === 0) {
    errors.push("docs/graph/couplings.yaml declares no `guard:` edges.");
  }
  for (const g of guards) {
    if (!isFile(join(REPO_ROOT, g))) {
      errors.push(`couplings.yaml guard does not exist: ${g}`);
    }
  }
}

// Best-effort "commits being pushed" range, e.g. "origin/main..HEAD". null if undeterminable.
function pushRange() {
  for (const refExpr of ["@{push}", "@{upstream}"]) {
    const { code, out } = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", refExpr);
    if (code === 0 && out && out !== refExpr) return `${out}..HEAD`;
  }
  const { code } = git("rev-parse", "--verify", "--quiet", "origin/main");
  if (code === 0) return "origin/main..HEAD";
  return null;
}

function checkSessionCoverage(errors) {
  const rng = pushRange();
  if (rng === null) {
    console.log("[check] session-coverage: no upstream/origin to diff against - skipped.");
    return;
  }
  const { code, out: shas } = git("rev-list", rng);
  if (code !== 0) {
    console.log(`[check] session-coverage: could not compute ${rng} - skipped.`);
    return;
  }
  if (!shas.trim()) {
    console.log("[check] session-coverage: nothing to push.");
    return;
  }
  const { out: changed } = git("diff", "--name-only", rng);
  const touchesSession = changed
    .split(/\r?\n/)
    .some((line) => line.startsWith("docs/sessions/"));
  if (!touchesSession) {
    const n = shas.split(/\s+/).filter(Boolean).length;
    errors.push(
      `${n} commit(s) in ${rng} but no docs/sessions/ entry added/updated — ` +
        "write a session log covering this work.",
    );
  }
}

function runCheck() {
  const errors = [];
  checkSessionCoverage(errors);
  checkMemoryIndex(errors);
  checkCouplings(errors);

  if (errors.length > 0) {
    console.error("\ncontext_sync --check FAILED:\n");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nFix the above, then push again.\n");
    return 1;
  }
  console.log("context_sync --check passed: sessions, memory, and couplings are consistent.");
  return 0;
}

function main(argv) {
  const wantStart = argv.includes("--session-start");
  const wantCheck = argv.includes("--check");
  if (wantStart === wantCheck) {
    // either both or neither
    console.error("usage: node tools/context_sync.mjs (--session-start | --check)");
    return 2;
  }
  return wantStart ? sessionStart() : runCheck();
}

process.exit(main(process.argv.slice(2)));
