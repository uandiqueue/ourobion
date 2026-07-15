#!/usr/bin/env node
// Worktree Isolation Manager for ourobion's multi-agent workflow. Node port of NUSPlan's
// tools/setup_agent_worktree.py.
//
// Creates an isolated git worktree for a parallel agent branch and configures the shared git hooks
// (core.hooksPath=.githooks) inside the new worktree, so the pre-push context check runs there too.
//
//   node tools/setup_agent_worktree.mjs --branch feat/m3-wearables/healthkit-read --path ../ourobion-wt-m3
//
// Session branches are always cut from dev-phase2 (the single integration line). Override with --base
// only for exceptional cases (e.g. a hotfix off main).
//
// Node stdlib + `git` only — no third-party deps.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--branch") args.branch = argv[++i];
    else if (a === "--path") args.path = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function usage() {
  console.log(
    "usage: node tools/setup_agent_worktree.mjs --branch <branch-name> --path <worktree-path>\n" +
      "\n" +
      "  --branch  branch name to create and check out in the new worktree\n" +
      "  --path    absolute or relative path at which to create the worktree (outside the repo)\n" +
      "  --base    start-point branch to cut from (default: dev-phase2)\n",
  );
}

function runCmd(cmd, cmdArgs, cwd) {
  const res = spawnSync(cmd, cmdArgs, { cwd, encoding: "utf8" });
  if (res.error) {
    console.error(`ERROR: could not run: ${cmd} ${cmdArgs.join(" ")}`);
    console.error(res.error.message);
    process.exit(127);
  }
  if (res.status !== 0) {
    console.error(`ERROR: command failed: ${cmd} ${cmdArgs.join(" ")}`);
    if (res.stderr) console.error(res.stderr.trim());
    process.exit(res.status ?? 1);
  }
  return (res.stdout || "").trim();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.branch || !args.path) {
    usage();
    process.exit(args.help ? 0 : 2);
  }

  const worktreePath = resolve(args.path);
  const branchName = args.branch;
  const baseBranch = args.base || "dev-phase2";

  console.log(
    `Setting up isolated worktree for branch '${branchName}' (cut from '${baseBranch}') at: ${worktreePath}`,
  );

  // 1. Create the worktree + branch, cut from the integration line (dev-phase2 by default).
  runCmd("git", ["worktree", "add", "-b", branchName, worktreePath, baseBranch], REPO_ROOT);

  // 2. Configure the shared hooks inside the new worktree so pre-push runs there too.
  runCmd("git", ["config", "core.hooksPath", ".githooks"], worktreePath);

  console.log("\nSUCCESS: Worktree created and hooks configured.");
  console.log(`Next: cd ${worktreePath}`);
}

main();
