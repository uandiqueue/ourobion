import assert from 'node:assert/strict';
import test from 'node:test';
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
  assert.match(first, /\| Nodes \| 4 \|/);
  assert.match(first, /\| Communities \| 3 \|/);
  assert.match(first, /\| Dangling hyperedge members \| 1 \|/);
  assert.match(first, /Identity/);
  assert.match(first, /Bridge nodes/);
  assert.match(first, /Complete community directory \(3\)/);
  assert.ok(first.endsWith('\n'));
  assert.ok(!first.endsWith('\n\n'));
});

test('rejects malformed graph shapes', () => {
  assert.throws(() => renderGraphView({ nodes: [] }), /graph\.links must be an array/);
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
