#!/usr/bin/env node
// Enforced context maintenance for the ourobion repo. Node port of NUSPlan's tools/context_sync.py.
//
// Three modes, wired so the in-repo agent context (sessions, memory, decisions, the doc map, and
// couplings) can never silently drift from reality:
//
//   --session-start  Print a resume briefing: latest session logs, the memory index, and a staleness
//                    flag. Informational; always exits 0. (Wired to the Claude Code SessionStart hook
//                    in .claude/settings.json.)
//
//   --fix-index      Regenerate the marker-delimited GENERATED sections of docs/INDEX.md,
//                    docs/memory/README.md, and docs/development/decisions/README.md from each doc's
//                    front-matter. Run this before pushing; the --check freshness gate (f) fails if
//                    you forget. Creates the three files with a template if missing.
//
//   --check          Run the enforcement checks. Exits non-zero on any violation. Wired to the
//                    .githooks/pre-push hook AND re-run in CI (the non-bypassable backstop, since
//                    local hooks are skippable with --no-verify). Checks:
//                      a. Session coverage  — a docs/sessions/ entry is added/changed in the push.
//                      b. Memory index      — docs/memory/README.md <-> docs/memory/*.md.
//                      c. Couplings         — every docs/graph/couplings.yaml `guard:` exists on disk.
//                      d. Front-matter      — memory/ + decisions/ entries carry a valid record header
//                         (id/title/summary/status/updated; id matches NNNN- prefix; unique+monotonic).
//                      e. Supersede links   — status: superseded requires a resolving superseded_by,
//                         with no back-cycle.
//                      f. Index freshness   — the three GENERATED sections match `--fix-index` output.
//                      g. Edit honesty      — a modified memory/decisions entry must bump `updated:`;
//                         an `accepted` decision's body is immutable (supersede instead).
//                      h. Session memory-delta — every touched session log declares a `memory:` line;
//                         if the push changes memory/decisions but all say `memory: none`, fail.
//                      i. INDEX coverage    — every doc under docs/{shared,nao,biotope} is a resolving
//                         link in docs/INDEX.md, and every INDEX link resolves.
//                      j. Archive containment — no active doc (docs/{shared,nao,biotope}, AGENTS.md,
//                         README.md) links into docs/archive/ (links flow archive -> active only).
//
// Node stdlib + `git` via child_process only — no third-party deps, so it runs anywhere Node 18+ is
// present. The structural dependency graph is DEFERRED in ourobion (see docs/graph/README.md).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SESSIONS_DIR = join(REPO_ROOT, "docs", "sessions");
const MEMORY_DIR = join(REPO_ROOT, "docs", "memory");
const MEMORY_INDEX = join(MEMORY_DIR, "README.md");
const DECISIONS_DIR = join(REPO_ROOT, "docs", "development", "decisions");
const DECISIONS_INDEX = join(DECISIONS_DIR, "README.md");
const DOCS_INDEX = join(REPO_ROOT, "docs", "INDEX.md");
const COUPLINGS = join(REPO_ROOT, "docs", "graph", "couplings.yaml");
// Active ground-truth doc roots (relative to repo root) that INDEX must cover + archive-containment guards.
const GROUND_TRUTH_RELDIRS = ["docs/implemented", "docs/development", "docs/hackathon"];
const ARCHIVE_REL = "docs/archive/";

const STALE_DAYS = 21;
const MD_LINK = /\]\(([^)]+)\)/g;
const TS_PREFIX = /^(\d{8})T(\d{6})Z/;
const GUARD_LINE = /^[ \t]*guard:[ \t]*(\S.*?)\s*$/gm;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const NNNN_PREFIX = /^(\d{4})-/;
const GEN_BEGIN = "<!-- BEGIN GENERATED -->";
const GEN_END = "<!-- END GENERATED -->";
const RECORD_STATUS = new Set(["accepted", "superseded"]);
// Session logs from this date on must carry a `memory:` line (check h); older logs predate the convention.
const MEMORY_LINE_SINCE = "20260713";

function read(path) {
  return readFileSync(path, "utf8");
}

function isFile(path) {
  try { return statSync(path).isFile(); } catch { return false; }
}

function isDir(path) {
  try { return statSync(path).isDirectory(); } catch { return false; }
}

// Minimal flat YAML front-matter parser (our schema is flat scalar keys). Returns {} when absent.
function frontMatter(text) {
  const m = FRONT_MATTER.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

// Body = everything after the front-matter block (for immutability comparison).
function bodyAfterFrontMatter(text) {
  const m = FRONT_MATTER.exec(text);
  return m ? text.slice(m[0].length) : text;
}

function mdFilesIn(dir) {
  if (!isDir(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".md") && n !== "README.md").sort();
}

function walkMd(dir, out = []) {
  if (!isDir(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    // `ai-assets/` is an asset-generation working subsystem (per-asset prompts, reviews,
    // manifests, progress) — not prose ground truth. Exempt it from the doc map + coverage check.
    if (name === "ai-assets") continue;
    const p = join(dir, name);
    if (isDir(p)) walkMd(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function sessionFiles() {
  if (!isDir(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR).filter((name) => name.endsWith(".md")).sort();
}

function parseSessionTs(name) {
  const m = TS_PREFIX.exec(name);
  if (!m) return null;
  const [, d, t] = m;
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
  console.log("ourobion — session resume briefing (tools/context_sync.mjs --session-start)");
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

  if (isFile(DOCS_INDEX)) {
    console.log("\n[map] docs/INDEX.md is the doc map — read it first to route to any doc.");
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

// --------------------------------------------------------------------------- index generation

// Build "- [title](relPath) — summary (status)" lines from record front-matter in a directory.
function recordIndexLines(dir, { fromDir }) {
  const lines = [];
  for (const name of mdFilesIn(dir)) {
    const fm = frontMatter(read(join(dir, name))) || {};
    const title = fm.title || name.replace(/\.md$/, "");
    const summary = fm.summary || "";
    const status = fm.status || "";
    const rel = fromDir === dir ? name : relative(fromDir, join(dir, name)).replace(/\\/g, "/");
    const tail = summary ? ` — ${summary}` : "";
    const flag = status === "superseded" ? ` _(superseded → ${fm.superseded_by || "?"})_` : "";
    const label = status === "superseded" ? `~~${title}~~` : title;
    lines.push(`- [${label}](${rel})${tail}${flag}`);
  }
  return lines;
}

// Build the docs/INDEX.md GENERATED body: active docs grouped by ground-truth root.
function docsIndexLines() {
  const out = [];
  for (const relDir of GROUND_TRUTH_RELDIRS) {
    const abs = join(REPO_ROOT, relDir);
    const files = walkMd(abs).filter((p) => !/README\.md$/.test(p));
    if (files.length === 0) continue;
    out.push(`\n### ${relDir}`);
    for (const p of files) {
      const fm = frontMatter(read(p)) || {};
      const rel = relative(join(REPO_ROOT, "docs"), p).replace(/\\/g, "/");
      const title = fm.title || rel;
      const summary = fm.summary ? ` — ${fm.summary}` : "";
      const status = fm.status && fm.status !== "canonical" ? ` \`${fm.status}\`` : "";
      out.push(`- [${title}](${rel})${summary}${status}`);
    }
  }
  return out;
}

// Replace (or append) the GENERATED block in a file. Creates the file from a template if missing.
function writeGeneratedBlock(path, generatedLines, headerIfNew) {
  const block = `${GEN_BEGIN}\n${generatedLines.join("\n")}\n${GEN_END}`;
  let text;
  if (isFile(path)) {
    text = read(path);
    if (text.includes(GEN_BEGIN) && text.includes(GEN_END)) {
      text = text.replace(new RegExp(`${GEN_BEGIN}[\\s\\S]*?${GEN_END}`), block);
    } else {
      text = text.replace(/\s*$/, "\n\n") + block + "\n";
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    text = `${headerIfNew}\n\n${block}\n`;
  }
  writeFileSync(path, text);
}

function fixIndex() {
  writeGeneratedBlock(
    MEMORY_INDEX,
    recordIndexLines(MEMORY_DIR, { fromDir: MEMORY_DIR }),
    "# Memory index\n\nOne durable fact per file. This list is generated — run `node tools/context_sync.mjs --fix-index`.",
  );
  writeGeneratedBlock(
    DECISIONS_INDEX,
    recordIndexLines(DECISIONS_DIR, { fromDir: DECISIONS_DIR }),
    "# Insight-engine architecture decisions (ADRs)\n\nGenerated — run `node tools/context_sync.mjs --fix-index`.",
  );
  writeGeneratedBlock(
    DOCS_INDEX,
    docsIndexLines(),
    "# Documentation index\n\nThe machine + human map of every active doc. Generated from front-matter — run\n`node tools/context_sync.mjs --fix-index`. Archive lives at `docs/archive/` (excluded from agent crawl via `.aiignore`); session logs are under `docs/sessions/`.",
  );
  console.log("context_sync --fix-index: regenerated docs/INDEX.md, docs/memory/README.md, docs/development/decisions/README.md.");
  return 0;
}

// Extract just the GENERATED block content from a file's text (null if absent).
function generatedBlockOf(text) {
  // Tolerate CRLF: git autocrlf checks the working tree out with \r\n on Windows.
  const m = new RegExp(`${GEN_BEGIN}\\r?\\n([\\s\\S]*?)\\r?\\n${GEN_END}`).exec(text);
  return m ? m[1] : null;
}

// --------------------------------------------------------------------------- check helpers

function checkMemoryIndex(errors) {
  if (!isFile(MEMORY_INDEX)) {
    errors.push("docs/memory/README.md (index) is missing.");
    return;
  }
  const linked = new Set();
  for (const m of read(MEMORY_INDEX).matchAll(MD_LINK)) {
    let target = m[1].split("#", 1)[0].trim();
    if (!target || target.includes("://")) continue;
    linked.add(target);
    if (!isFile(join(MEMORY_DIR, target))) {
      errors.push(`docs/memory/README.md links to missing file: ${target}`);
    }
  }
  for (const name of mdFilesIn(MEMORY_DIR)) {
    if (!linked.has(name)) errors.push(`docs/memory/${name} exists but is not indexed in README.md`);
  }
}

function checkCouplings(errors) {
  if (!isFile(COUPLINGS)) {
    errors.push("docs/graph/couplings.yaml is missing.");
    return;
  }
  const guards = [...read(COUPLINGS).matchAll(GUARD_LINE)].map((m) => m[1].trim());
  if (guards.length === 0) errors.push("docs/graph/couplings.yaml declares no `guard:` edges.");
  for (const g of guards) {
    if (!isFile(join(REPO_ROOT, g))) errors.push(`couplings.yaml guard does not exist: ${g}`);
  }
}

// (d) + (e): record front-matter validity + supersede reciprocity for memory/ and decisions/.
function checkRecordFrontMatter(errors) {
  for (const [dir, label] of [[MEMORY_DIR, "docs/memory"], [DECISIONS_DIR, "docs/development/decisions"]]) {
    const seenIds = new Set();
    let lastId = 0;
    for (const name of mdFilesIn(dir)) {
      const rel = `${label}/${name}`;
      const fm = frontMatter(read(join(dir, name)));
      if (!fm) { errors.push(`${rel}: missing YAML front-matter (need id/title/summary/status/updated).`); continue; }
      for (const key of ["id", "title", "summary", "status", "updated"]) {
        if (!fm[key]) errors.push(`${rel}: front-matter missing required field \`${key}\`.`);
      }
      if (fm.status && !RECORD_STATUS.has(fm.status)) {
        errors.push(`${rel}: status \`${fm.status}\` not in {accepted, superseded}.`);
      }
      const pref = NNNN_PREFIX.exec(name);
      if (pref) {
        if (fm.id && fm.id !== pref[1]) errors.push(`${rel}: front-matter id \`${fm.id}\` != filename prefix \`${pref[1]}\`.`);
        const n = Number(pref[1]);
        if (seenIds.has(pref[1])) errors.push(`${rel}: duplicate id ${pref[1]}.`);
        seenIds.add(pref[1]);
        lastId = Math.max(lastId, n);
      } else {
        errors.push(`${rel}: filename lacks a NNNN- numeric prefix.`);
      }
      // (e) supersede reciprocity
      if (fm.status === "superseded") {
        if (!fm.superseded_by) {
          errors.push(`${rel}: status superseded but no \`superseded_by\`.`);
        } else {
          const targetAbs = join(REPO_ROOT, fm.superseded_by.replace(/^\.?\//, ""));
          const localAbs = join(dir, fm.superseded_by);
          if (!isFile(targetAbs) && !isFile(localAbs)) {
            errors.push(`${rel}: superseded_by target does not exist: ${fm.superseded_by}`);
          }
        }
      }
    }
  }
}

// (f): the three GENERATED index sections must match what --fix-index would produce.
function checkIndexFreshness(errors) {
  const want = {
    "docs/memory/README.md": recordIndexLines(MEMORY_DIR, { fromDir: MEMORY_DIR }).join("\n"),
    "docs/development/decisions/README.md": recordIndexLines(DECISIONS_DIR, { fromDir: DECISIONS_DIR }).join("\n"),
    "docs/INDEX.md": docsIndexLines().join("\n"),
  };
  for (const [rel, wanted] of Object.entries(want)) {
    const abs = join(REPO_ROOT, rel);
    if (!isFile(abs)) { errors.push(`${rel} is missing — run \`node tools/context_sync.mjs --fix-index\`.`); continue; }
    const have = generatedBlockOf(read(abs));
    if (have === null) { errors.push(`${rel} has no GENERATED block — run --fix-index.`); continue; }
    // Compare line-ending-agnostically (working tree may be CRLF on Windows, generated output is LF).
    if (have.replace(/\r/g, "").trim() !== wanted.replace(/\r/g, "").trim()) {
      errors.push(`${rel} generated index is stale — run \`node tools/context_sync.mjs --fix-index\`.`);
    }
  }
}

// (i): docs/INDEX.md must cover every active ground-truth doc, and all its links must resolve.
function checkIndexCoverage(errors) {
  if (!isFile(DOCS_INDEX)) { errors.push("docs/INDEX.md is missing (the doc map)."); return; }
  const indexText = read(DOCS_INDEX);
  const linked = new Set();
  for (const m of indexText.matchAll(MD_LINK)) {
    const target = m[1].split("#", 1)[0].trim();
    if (!target || target.includes("://")) continue;
    const abs = join(REPO_ROOT, "docs", target);
    linked.add(resolve(abs));
    if (!isFile(abs)) errors.push(`docs/INDEX.md links to missing file: ${target}`);
  }
  for (const relDir of GROUND_TRUTH_RELDIRS) {
    for (const p of walkMd(join(REPO_ROOT, relDir))) {
      if (/README\.md$/.test(p)) continue; // per-folder READMEs are indexes, not content
      if (!linked.has(resolve(p))) {
        errors.push(`${relative(REPO_ROOT, p).replace(/\\/g, "/")} is not listed in docs/INDEX.md (run --fix-index).`);
      }
    }
  }
}

// (j): no active doc may link into docs/archive/ (links flow archive -> active only).
function checkArchiveContainment(errors) {
  const activeFiles = [];
  for (const relDir of GROUND_TRUTH_RELDIRS) activeFiles.push(...walkMd(join(REPO_ROOT, relDir)));
  for (const root of ["AGENTS.md", "README.md"]) {
    if (isFile(join(REPO_ROOT, root))) activeFiles.push(join(REPO_ROOT, root));
  }
  for (const p of activeFiles) {
    const relP = relative(REPO_ROOT, p).replace(/\\/g, "/");
    if (relP === "docs/INDEX.md") continue; // INDEX may carry a single pointer to the archive root
    const dir = dirname(p);
    for (const m of read(p).matchAll(MD_LINK)) {
      const target = m[1].split("#", 1)[0].trim();
      if (!target || target.includes("://")) continue;
      const resolved = relative(REPO_ROOT, resolve(dir, target)).replace(/\\/g, "/");
      if (resolved.startsWith(ARCHIVE_REL)) {
        errors.push(`${relP} links into docs/archive/ (${target}) — active docs must not link to archive.`);
      }
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

function checkSessionCoverage(errors, ctx) {
  const rng = ctx.range;
  if (rng === null) { console.log("[check] session-coverage: no upstream/origin to diff against - skipped."); return; }
  const { code, out: shas } = git("rev-list", rng);
  if (code !== 0) { console.log(`[check] session-coverage: could not compute ${rng} - skipped.`); return; }
  if (!shas.trim()) { console.log("[check] session-coverage: nothing to push."); ctx.nothingToPush = true; return; }
  const touchesSession = ctx.changed.some((line) => line.startsWith("docs/sessions/"));
  if (!touchesSession) {
    const n = shas.split(/\s+/).filter(Boolean).length;
    errors.push(`${n} commit(s) in ${rng} but no docs/sessions/ entry added/updated — write a session log covering this work.`);
  }
}

// (h): every touched session log declares a `memory:` line; if memory/decisions changed but every
//      touched session says `memory: none`, fail (undeclared durable-fact change).
function checkSessionMemoryDelta(errors, ctx) {
  if (ctx.range === null || ctx.nothingToPush) return;
  const touchedSessions = ctx.changed.filter((l) => l.startsWith("docs/sessions/") && l.endsWith(".md"));
  if (touchedSessions.length === 0) return; // session-coverage already flags the missing-log case
  const MEM_LINE = /^memory:\s*(.+)$/im;
  let anyDeclaresChange = false;
  for (const rel of touchedSessions) {
    const abs = join(REPO_ROOT, rel);
    if (!isFile(abs)) continue;
    // Pre-convention logs (before the memory: line was introduced) are exempt — otherwise a
    // full-history fold to the default branch would flag every legacy session log at once.
    const stamp = TS_PREFIX.exec(rel.split("/").pop() || "");
    const preConvention = stamp && stamp[1] < MEMORY_LINE_SINCE;
    const m = MEM_LINE.exec(read(abs));
    if (!m) { if (!preConvention) errors.push(`${rel}: missing a \`memory:\` line (use \`memory: none\` or \`memory: added 00NN; superseded 00MM\`).`); continue; }
    if (m[1].trim().toLowerCase() !== "none") anyDeclaresChange = true;
  }
  const changedRecords = ctx.changed.some((l) =>
    (l.startsWith("docs/memory/") || l.startsWith("docs/development/decisions/")) && l.endsWith(".md") && !l.endsWith("README.md"));
  if (changedRecords && !anyDeclaresChange) {
    errors.push("push adds/modifies memory or decisions records but every touched session log says `memory: none` — declare the change.");
  }
}

// (g): a MODIFIED memory/decisions record must bump `updated:`; an `accepted` decision body is immutable.
function checkEditHonesty(errors, ctx) {
  if (ctx.range === null || ctx.nothingToPush) return;
  const base = ctx.range.split("..")[0];
  const { code, out } = git("diff", "--name-status", ctx.range, "--", "docs/memory", "docs/development/decisions");
  if (code !== 0) return;
  for (const line of out.split(/\r?\n/)) {
    const m = /^([AMD])\t(.+)$/.exec(line.trim());
    if (!m) continue;
    const [, kind, rel] = m;
    if (kind !== "M" || rel.endsWith("README.md") || !rel.endsWith(".md")) continue;
    const abs = join(REPO_ROOT, rel);
    if (!isFile(abs)) continue;
    const curText = read(abs);
    const baseText = git("show", `${base}:${rel}`).out;
    if (!baseText) continue;
    const curFm = frontMatter(curText) || {};
    const baseFm = frontMatter(baseText) || {};
    if (curFm.updated && baseFm.updated && curFm.updated === baseFm.updated) {
      errors.push(`${rel}: modified but \`updated:\` not bumped (was ${baseFm.updated}).`);
    }
    if (rel.startsWith("docs/development/decisions/") && baseFm.status === "accepted") {
      if (bodyAfterFrontMatter(curText).trim() !== bodyAfterFrontMatter(baseText).trim()) {
        errors.push(`${rel}: an accepted decision's body is immutable — supersede it instead of editing.`);
      }
    }
  }
}

function runCheck() {
  const errors = [];
  const range = pushRange();
  const changed = range ? (git("diff", "--name-only", range).out.split(/\r?\n/).filter(Boolean)) : [];
  const ctx = { range, changed, nothingToPush: false };

  checkSessionCoverage(errors, ctx);
  checkMemoryIndex(errors);
  checkCouplings(errors);
  checkRecordFrontMatter(errors);
  checkIndexFreshness(errors);
  checkIndexCoverage(errors);
  checkArchiveContainment(errors);
  checkSessionMemoryDelta(errors, ctx);
  checkEditHonesty(errors, ctx);

  if (errors.length > 0) {
    console.error("\ncontext_sync --check FAILED:\n");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nFix the above, then push again.\n");
    return 1;
  }
  console.log("context_sync --check passed: sessions, memory, decisions, index, and couplings are consistent.");
  return 0;
}

function main(argv) {
  const wantStart = argv.includes("--session-start");
  const wantCheck = argv.includes("--check");
  const wantFix = argv.includes("--fix-index");
  const n = [wantStart, wantCheck, wantFix].filter(Boolean).length;
  if (n !== 1) {
    console.error("usage: node tools/context_sync.mjs (--session-start | --check | --fix-index)");
    return 2;
  }
  if (wantStart) return sessionStart();
  if (wantFix) return fixIndex();
  return runCheck();
}

process.exit(main(process.argv.slice(2)));
