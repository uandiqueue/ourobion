#!/usr/bin/env node

import crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { graphContentSha256, renderGraphView } from './lib/render_graph_view.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'graphify-out', 'graph.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'docs', 'graph', 'semantic-graph.html');
// Front-matter date for the renderer schema, not the machine-local graph snapshot. Keeping it explicit
// makes --write/--check deterministic even in sandboxes where Node cannot spawn `git show`.
const VIEW_SCHEMA_UPDATED = '2026-07-26';

function parseArgs(argv) {
  const options = { mode: 'stdout', input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.mode = 'write';
    else if (argument === '--check') options.mode = 'check';
    else if (argument === '--input' && argv[index + 1]) options.input = path.resolve(argv[++index]);
    else if (argument.startsWith('--input=')) options.input = path.resolve(argument.slice(8));
    else if (argument === '--output' && argv[index + 1]) options.output = path.resolve(argv[++index]);
    else if (argument.startsWith('--output=')) options.output = path.resolve(argument.slice(9));
    else throw new Error(`unknown or incomplete option: ${argument}`);
  }
  return options;
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}

function validateSingleHumanView(output) {
  const graphDocsDirectory = path.join(REPO_ROOT, 'docs', 'graph');
  const candidateFiles = readdirSync(graphDocsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:md|html)$/i.test(entry.name))
    .map((entry) => path.join(graphDocsDirectory, entry.name));
  const canonical = path.resolve(output);
  const unexpectedViews = candidateFiles.filter((file) => {
    const resolved = path.resolve(file);
    return resolved !== canonical && (path.basename(file).startsWith('semantic-graph.') || /generated_by[^>\n]{0,90}tools\/graph-view\/generate_graph_view\.mjs/i.test(readFileSync(file, 'utf8')));
  });
  if (unexpectedViews.length) {
    const found = unexpectedViews.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/')).join(', ');
    throw new Error(`expected exactly one generated human graph view; unexpected candidates: ${found}`);
  }

  const generatedViews = candidateFiles
    .filter((file) => /generated_by[^>\n]{0,90}tools\/graph-view\/generate_graph_view\.mjs/i.test(readFileSync(file, 'utf8')));

  if (generatedViews.length !== 1 || path.resolve(generatedViews[0] ?? '') !== canonical) {
    const found = generatedViews.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/')).join(', ') || 'none';
    throw new Error(`expected exactly one generated human graph view at docs/graph/semantic-graph.html; found: ${found}`);
  }
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`graph-view: ${error.message}`);
  process.exit(2);
}

if (options.mode === 'check') {
  try {
    validateSingleHumanView(options.output);
  } catch (error) {
    console.error(`graph-view: ${error.message}`);
    process.exit(1);
  }
}

if (!existsSync(options.input)) {
  if (options.mode === 'check') {
    console.log('graph-view: canonical view exists and is unique; content comparison skipped because the machine-local graph is absent');
    process.exit(0);
  }
  console.error(`graph-view: missing input ${path.relative(REPO_ROOT, options.input)}`);
  process.exit(1);
}

let raw;
let graph;
try {
  raw = readFileSync(options.input);
  graph = JSON.parse(raw.toString('utf8'));
} catch (error) {
  console.error(`graph-view: cannot read graph JSON: ${error.message}`);
  process.exit(1);
}

let rendered;
try {
  rendered = renderGraphView(graph, {
    updatedDate: VIEW_SCHEMA_UPDATED,
    sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    contentSha256: graphContentSha256(graph),
  });
} catch (error) {
  console.error(`graph-view: invalid graph: ${error.message}`);
  process.exit(1);
}

const outputRelative = path.relative(REPO_ROOT, options.output).replace(/\\/g, '/');
if (options.mode === 'write') {
  writeFileSync(options.output, rendered, 'utf8');
  console.log(`graph-view: wrote ${outputRelative}`);
} else if (options.mode === 'check') {
  if (!existsSync(options.output)) {
    console.error(`graph-view: ${outputRelative} is missing; run npm run graph:view:write`);
    process.exit(1);
  }
  const existing = normalizeNewlines(readFileSync(options.output, 'utf8'));
  if (existing !== rendered) {
    console.error(`graph-view: ${outputRelative} is stale; run npm run graph:view:write`);
    process.exit(1);
  }
  console.log(`graph-view: ${outputRelative} matches graphify-out/graph.json`);
} else {
  process.stdout.write(rendered);
}
