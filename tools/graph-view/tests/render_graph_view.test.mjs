import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { graphContentSha256, renderGraphView } from '../lib/render_graph_view.mjs';

const graph = {
  directed: true,
  multigraph: false,
  built_at_commit: 'abc1234',
  nodes: [
    { id: 'a', label: 'Auth Gate', file_type: 'code', _origin: 'ast', community: 1, community_name: 'Identity', source_file: 'auth.dart' },
    { id: 'b', label: 'User Contract', file_type: 'concept', _origin: 'semantic', community: 1, community_name: 'Identity', source_file: 'shared.ts' },
    { id: 'c', label: 'Daily Rows', file_type: 'code', _origin: 'ast', community: 2, community_name: 'Logging', source_file: 'rows.sql' },
    { id: 'd', label: 'Insight Cards', file_type: 'document', _origin: 'semantic', community: 3, community_name: 'Insights', source_file: 'design.md' },
  ],
  links: [
    { source: 'a', target: 'b', relation: 'references', confidence: 'EXTRACTED' },
    { source: 'b', target: 'c', relation: 'maps_to', confidence: 'INFERRED' },
    { source: 'c', target: 'd', relation: 'feeds', confidence: 'EXTRACTED' },
  ],
  hyperedges: [
    { id: 'h1', label: 'Insight flow', relation: 'forms', confidence: 'INFERRED', nodes: ['a', 'c', 'd'], source_file: 'design.md' },
    { id: 'h2', label: 'Broken flow', relation: 'forms', confidence: 'INFERRED', nodes: ['a', 'missing'], source_file: 'broken.md' },
  ],
};

test('renders a deterministic community-level graph view', () => {
  const options = { updatedDate: '2026-07-26', sourceSha256: 'f'.repeat(64), contentSha256: graphContentSha256(graph) };
  const first = renderGraphView(graph, options);
  const reordered = { ...graph, nodes: [...graph.nodes].reverse(), links: [...graph.links].reverse(), hyperedges: [...graph.hyperedges].reverse() };
  const second = renderGraphView(reordered, { ...options, contentSha256: graphContentSha256(graph) });

  assert.equal(first, second);
  assert.match(first, /<!doctype html>/i);
  assert.match(first, /<canvas id="graph"/);
  assert.match(first, /id="search"/);
  assert.match(first, /graph-content-sha256/);
  assert.match(first, /4 nodes, 3 pair links, 3 communities/);
  assert.match(first, /2 hyperedges summarized but not drawn, and 1 dangling hyperedge members/);
  assert.match(first, /Show communities containing this node type/);
  assert.match(first, /whole community/);
  assert.match(first, /Identity/);
  assert.match(first, /Textual fallback and snapshot/);
  assert.match(first, /\.layout>\*,\.graph,\.panel\{min-width:0;max-width:100%\}/);
  assert.match(first, /@media\(max-width:800px\)/);
  assert.match(first, /\.controls\{left:\.5rem;right:\.5rem;display:flex;flex-direction:column;align-items:stretch/);
  assert.match(first, /\.controls>\*\{display:block;flex:none;width:100%;min-width:0;max-width:100%\}/);
  assert.match(first, /\.controls label\{display:flex;flex-direction:column;align-items:stretch/);
  assert.match(first, /\.controls input,\.controls select,\.controls button\{display:block;width:100%;min-width:0;max-width:100%\}/);
  assert.match(first, /header p,#details,\.meta,\.fallback\{max-width:100%;white-space:normal;overflow-wrap:anywhere/);
  assert.doesNotMatch(first, /overflow-x:hidden/);
  assert.doesNotMatch(first, /[Ââ\uFFFD]/u, 'generated HTML must not contain common mojibake markers');
  assert.ok(first.endsWith('\n'));
  assert.ok(!first.endsWith('\n\n'));
});

test('rejects malformed graph shapes', () => {
  assert.throws(() => renderGraphView({ nodes: [] }), /graph\.links must be an array/);
  assert.throws(() => renderGraphView({ nodes: [{ id: 'same' }, { id: 'same' }], links: [] }), /duplicate id/);
  assert.throws(() => renderGraphView({ nodes: [], links: [], hyperedges: {} }), /graph\.hyperedges must be an array/);
  assert.throws(() => renderGraphView({ nodes: [], links: [], hyperedges: [{}] }), /graph\.hyperedges\[0\]\.nodes must be an array/);
});

test('embeds graph data safely without executable markup', () => {
  const hostile = {
    nodes: [{ id: 'a', label: '</script><img src=x onerror=alert(1)>', community: 1 }],
    links: [],
  };
  const rendered = renderGraphView(hostile, { sourceSha256: 'a'.repeat(64), contentSha256: 'b'.repeat(64) });
  assert.ok(rendered.includes('\\u003c/script\\u003e'));
  assert.ok(!rendered.includes('</script><img'));
});

test('emits an inline runtime script that compiles', () => {
  const rendered = renderGraphView(graph);
  const scripts = [...rendered.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const executable = scripts.at(-1)?.[1];
  assert.ok(executable, 'expected an executable inline script');
  assert.doesNotThrow(() => new vm.Script(executable));
  assert.match(executable, /function displayedEdges\(\)/);
  assert.match(executable, /e\.key==='ArrowRight'/);
  assert.match(executable, /if\(!ctx\)/);
  assert.match(executable, /typeof ResizeObserver==='function'/);
  assert.match(executable, /matches\.length/);
});

test('includes hyperedges and members in the canonical content hash', () => {
  const original = graphContentSha256(graph);
  const changedMember = { ...graph, hyperedges: graph.hyperedges.map((edge, index) => index ? edge : { ...edge, nodes: ['a', 'b', 'd'] }) };
  const changedHyperedge = { ...graph, hyperedges: graph.hyperedges.slice(0, 1) };
  assert.notEqual(graphContentSha256(changedMember), original);
  assert.notEqual(graphContentSha256(changedHyperedge), original);
});

test('uses stable IDs to resolve equal-degree and equal-label ordering ties', () => {
  const tied = {
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: 'z-tie', label: 'Same label', file_type: 'concept', _origin: 'semantic', community: 1, community_name: 'Identity', source_file: 'z.md' },
      { id: 'a-tie', label: 'Same label', file_type: 'concept', _origin: 'semantic', community: 1, community_name: 'Identity', source_file: 'a.md' },
    ],
  };
  const options = { updatedDate: '2026-07-26', sourceSha256: 'a'.repeat(64), contentSha256: 'b'.repeat(64) };
  const forward = renderGraphView(tied, options);
  const reversed = renderGraphView({
    ...tied,
    nodes: [...tied.nodes].reverse(),
    links: [...tied.links].reverse(),
    hyperedges: [...tied.hyperedges].reverse(),
  }, options);

  assert.equal(forward, reversed);
});
