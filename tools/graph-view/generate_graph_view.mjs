#!/usr/bin/env node

import crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { graphContentSha256, renderGraphView } from './lib/render_graph_view.mjs';
import { renderGraphHtml } from './lib/render_graph_html.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'graphify-out', 'graph.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'docs', 'graph', 'semantic-graph.md');
// The interactive HTML view is a machine-local convenience, not repo truth. It lands in the gitignored
// graphify-out/ beside graph.json, so it cannot drift from the tracked Markdown, cannot bloat the repo
// with a ~1.3MB generated blob, and is never the thing an agent is pointed at (agents cannot read it).
const LOCAL_HTML_OUTPUT = path.join(REPO_ROOT, 'graphify-out', 'semantic-graph.html');
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
  const markdownFiles = readdirSync(graphDocsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(graphDocsDirectory, entry.name));
  const canonical = path.resolve(output);
  // docs/graph is the layer that travels across machines and agents, so it carries exactly one
  // generated view and that view must be readable text. A semantic-graph.html here is a regression.
  const strayViews = readdirSync(graphDocsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith('semantic-graph.'))
    .map((entry) => path.join(graphDocsDirectory, entry.name))
    .filter((file) => path.resolve(file) !== canonical);
  if (strayViews.length) {
    const found = strayViews.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/')).join(', ');
    throw new Error(`docs/graph tracks only the Markdown view; the interactive HTML belongs in graphify-out/. Remove: ${found}`);
  }
  const unexpectedMarkdown = markdownFiles.filter((file) => {
    const resolved = path.resolve(file);
    return path.basename(file) !== 'README.md' && resolved !== canonical;
  });
  if (unexpectedMarkdown.length) {
    const found = unexpectedMarkdown.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/')).join(', ');
    throw new Error(`docs/graph permits one index and one human graph view; unexpected Markdown: ${found}`);
  }

  const generatedViews = markdownFiles
    .filter((file) => /\ngenerated_by:\s*tools\/graph-view\/generate_graph_view\.mjs\s*\n/.test(`\n${readFileSync(file, 'utf8')}`));

  if (generatedViews.length !== 1 || path.resolve(generatedViews[0] ?? '') !== canonical) {
    const found = generatedViews.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/')).join(', ') || 'none';
    throw new Error(`expected exactly one generated human graph view at docs/graph/semantic-graph.md; found: ${found}`);
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
  // Best-effort local companion. A failure here must not block the tracked view, but it must be loud.
  try {
    writeFileSync(LOCAL_HTML_OUTPUT, renderGraphHtml(graph, {
      updatedDate: VIEW_SCHEMA_UPDATED,
      sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
      contentSha256: graphContentSha256(graph),
    }), 'utf8');
    console.log(`graph-view: wrote ${path.relative(REPO_ROOT, LOCAL_HTML_OUTPUT).replace(/\\/g, '/')} (local only, gitignored)`);
  } catch (error) {
    console.warn(`graph-view: tracked view written, but the local HTML companion failed: ${error.message}`);
  }
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
