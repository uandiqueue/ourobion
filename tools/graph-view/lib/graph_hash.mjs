import crypto from 'node:crypto';

const compare = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
const endpoint = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : value?.id != null ? String(value.id) : '';

/**
 * Canonical content hash for a Graphify graph, shared by both renderers so the Markdown and HTML
 * views can never disagree about which graph they were built from.
 *
 * Nodes, links and hyperedges are sorted before hashing, so the hash depends on graph CONTENT and
 * not on the order Graphify happened to emit. That reorder-invariance is what lets `--check` treat a
 * differing hash as a real change rather than incidental churn.
 */
export function graphContentSha256(graph) {
  if (!graph || !Array.isArray(graph.nodes)) throw new TypeError('graph.nodes must be an array');
  if (!Array.isArray(graph.links)) throw new TypeError('graph.links must be an array');
  const nodes = graph.nodes.map((node) => ({ ...node })).sort((a, b) => compare(a.id, b.id));
  const links = graph.links
    .map((link) => ({ ...link, source: endpoint(link.source), target: endpoint(link.target) }))
    .sort((a, b) => compare(`${a.source}\0${a.target}\0${a.relation ?? ''}`, `${b.source}\0${b.target}\0${b.relation ?? ''}`));
  const rawHyperedges = graph.hyperedges ?? graph.graph?.hyperedges ?? [];
  if (!Array.isArray(rawHyperedges)) throw new TypeError('graph.hyperedges must be an array');
  const hyperedges = rawHyperedges.map((edge, index) => {
    if (!edge || typeof edge !== 'object') throw new TypeError(`graph.hyperedges[${index}] must be an object`);
    if (!Array.isArray(edge.nodes)) throw new TypeError(`graph.hyperedges[${index}].nodes must be an array`);
    return { ...edge, nodes: edge.nodes.map(String).sort(compare) };
  }).sort((a, b) => compare(a.id ?? a.label, b.id ?? b.label));
  return crypto.createHash('sha256')
    .update(JSON.stringify({ directed: Boolean(graph.directed), multigraph: Boolean(graph.multigraph), nodes, links, hyperedges }))
    .digest('hex');
}
