#!/usr/bin/env node
// Shared Memory Coordinator for biotope's multi-agent workflow. Node port of NUSPlan's
// tools/shared_memory.py.
//
// Manages the .agents/session-log.json file to coordinate task claims across agents on the same
// device and prevent duplicate effort.
//
//   node tools/shared_memory.mjs list
//   node tools/shared_memory.mjs claim --task "<name>" --agent "<agent>" --device "<device>"
//   node tools/shared_memory.mjs release --task "<name>"
//
// Node stdlib only — no third-party deps.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_DIR = join(REPO_ROOT, ".agents");
const SESSION_LOG = join(AGENTS_DIR, "session-log.json");

function initDb() {
  if (!existsSync(AGENTS_DIR)) mkdirSync(AGENTS_DIR, { recursive: true });
  if (!existsSync(SESSION_LOG)) {
    writeFileSync(SESSION_LOG, JSON.stringify({ claims: {}, history: [] }, null, 2));
  }
}

function loadDb() {
  initDb();
  return JSON.parse(readFileSync(SESSION_LOG, "utf8"));
}

function saveDb(db) {
  writeFileSync(SESSION_LOG, JSON.stringify(db, null, 2));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--task") args.task = argv[++i];
    else if (a === "--agent") args.agent = argv[++i];
    else if (a === "--device") args.device = argv[++i];
    else args._.push(a);
  }
  return args;
}

function cmdList() {
  const db = loadDb();
  const bar = "=".repeat(60);
  console.log(bar);
  console.log("biotope — current agent task claims & shared state");
  console.log(bar);
  const tasks = Object.keys(db.claims);
  if (tasks.length === 0) {
    console.log("\nNo active task claims.");
  } else {
    for (const task of tasks) {
      const claim = db.claims[task];
      console.log(`\nTask:  ${task}`);
      console.log(`Agent: ${claim.agent} @ ${claim.device}`);
      console.log(`Since: ${claim.timestamp}`);
    }
  }
  console.log(`\n${bar}`);
}

function cmdClaim(args) {
  if (!args.task || !args.agent || !args.device) {
    console.error("ERROR: claim requires --task, --agent, and --device.");
    process.exit(2);
  }
  const db = loadDb();
  const task = args.task.trim();
  const agent = args.agent.trim();
  const device = args.device.trim();

  const existing = db.claims[task];
  if (existing && (existing.agent !== agent || existing.device !== device)) {
    console.error(
      `ERROR: Task '${task}' is already CLAIMED by ${existing.agent} @ ${existing.device} ` +
        `since ${existing.timestamp}.`,
    );
    process.exit(1);
  }

  const timestamp = new Date().toISOString();
  db.claims[task] = { agent, device, timestamp };
  db.history.push({ action: "claim", task, agent, device, timestamp });
  saveDb(db);
  console.log(`SUCCESS: Claimed task '${task}' for ${agent} @ ${device}.`);
}

function cmdRelease(args) {
  if (!args.task) {
    console.error("ERROR: release requires --task.");
    process.exit(2);
  }
  const db = loadDb();
  const task = args.task.trim();
  if (!db.claims[task]) {
    console.log(`WARNING: Task '${task}' is not currently claimed.`);
    return;
  }
  const claim = db.claims[task];
  delete db.claims[task];
  db.history.push({
    action: "release",
    task,
    agent: claim.agent,
    device: claim.device,
    timestamp: new Date().toISOString(),
  });
  saveDb(db);
  console.log(`SUCCESS: Released task '${task}' from ${claim.agent} @ ${claim.device}.`);
}

function usage() {
  console.log(
    "usage: node tools/shared_memory.mjs <command>\n" +
      "\n" +
      "  list                                   list current active claims\n" +
      "  claim --task T --agent A --device D     claim a task\n" +
      "  release --task T                        release a claimed task\n",
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === "list") cmdList();
  else if (command === "claim") cmdClaim(args);
  else if (command === "release") cmdRelease(args);
  else {
    usage();
    process.exit(command ? 2 : 0);
  }
}

main();
