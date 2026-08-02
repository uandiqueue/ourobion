import { graphContentSha256 } from './graph_hash.mjs';

export { graphContentSha256 };

const DEFAULT_MAP_COMMUNITIES = 18;
const DEFAULT_MAP_EDGES = 28;
const DEFAULT_CROSS_PAIRS = 50;
const DEFAULT_BRIDGES = 50;

function text(value, fallback = 'unknown') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function compareText(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

function compareCommunityId(a, b) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  return compareText(a, b);
}

function markdown(value, maxLength = 180) {
  const cleaned = text(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, maxLength - 1)}…`;
}

function inlineCode(value) {
  return `\`${text(value).replace(/`/g, '′')}\``;
}

function mermaid(value, maxLength = 52) {
  const cleaned = text(value)
    .replace(/["{}\[\]<>]/g, '')
    .replace(/&/g, 'and');
  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, maxLength - 1)}…`;
}

function endpointId(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && value.id != null) return String(value.id);
  return '';
}

function communityId(node) {
  return node?.community == null ? 'unassigned' : String(node.community);
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedCounts(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]));
}

function pickCommunityName(nameCounts, id) {
  return sortedCounts(nameCounts)[0]?.[0] ?? (id === 'unassigned' ? 'Unassigned' : `Community ${id}`);
}

function nodeLabel(node) {
  return text(node?.label ?? node?.id);
}

function sourceLabel(node) {
  return text(node?.source_file, 'no source');
}

function renderCountTable(title, counts, total) {
  const rows = sortedCounts(counts);
  if (!rows.length) return `### ${title}\n\n_No entries._\n`;
  return [
    `### ${title}`,
    '',
    '| Kind | Count | Share |',
    '|---|---:|---:|',
    ...rows.map(([kind, count]) => `| ${markdown(kind)} | ${count} | ${total ? ((count / total) * 100).toFixed(1) : '0.0'}% |`),
    '',
  ].join('\n');
}

export function renderGraphView(graph, options = {}) {
  if (!graph || typeof graph !== 'object') throw new TypeError('graph must be an object');
  if (!Array.isArray(graph.nodes)) throw new TypeError('graph.nodes must be an array');
  if (!Array.isArray(graph.links)) throw new TypeError('graph.links must be an array');

  const nodes = graph.nodes;
  const links = graph.links;
  const hyperedges = Array.isArray(graph.hyperedges)
    ? graph.hyperedges
    : Array.isArray(graph.graph?.hyperedges)
      ? graph.graph.hyperedges
      : [];
  const updatedDate = options.updatedDate ?? '1970-01-01';
  const sourceSha256 = options.sourceSha256 ?? graphContentSha256(graph);
  const contentSha256 = options.contentSha256 ?? graphContentSha256(graph);
  const builtAtCommit = text(graph.built_at_commit, 'not recorded');

  const byId = new Map();
  const degree = new Map();
  const fileTypes = new Map();
  const origins = new Map();
  const sourceFiles = new Set();
  const communities = new Map();

  for (const node of nodes) {
    const id = text(node?.id);
    byId.set(id, node);
    degree.set(id, 0);
    increment(fileTypes, text(node?.file_type, 'unspecified'));
    increment(origins, text(node?._origin, 'unspecified'));
    if (node?.source_file) sourceFiles.add(String(node.source_file));

    const idCommunity = communityId(node);
    let community = communities.get(idCommunity);
    if (!community) {
      community = {
        id: idCommunity,
        nodes: [],
        nameCounts: new Map(),
        sourceCounts: new Map(),
        internalLinks: 0,
        crossLinks: 0,
        inferredLinks: 0,
      };
      communities.set(idCommunity, community);
    }
    community.nodes.push(node);
    if (node?.community_name) increment(community.nameCounts, text(node.community_name));
    if (node?.source_file) increment(community.sourceCounts, String(node.source_file));
  }

  const confidenceCounts = new Map();
  const relationCounts = new Map();
  const crossPairs = new Map();
  const neighborCommunities = new Map();
  const crossDegree = new Map();
  let danglingLinks = 0;

  for (const link of links) {
    const sourceId = endpointId(link?.source);
    const targetId = endpointId(link?.target);
    const sourceNode = byId.get(sourceId);
    const targetNode = byId.get(targetId);
    increment(confidenceCounts, text(link?.confidence, 'unspecified'));
    increment(relationCounts, text(link?.relation, 'unspecified'));

    if (!sourceNode || !targetNode) {
      danglingLinks += 1;
      continue;
    }

    degree.set(sourceId, (degree.get(sourceId) ?? 0) + 1);
    degree.set(targetId, (degree.get(targetId) ?? 0) + 1);
    const sourceCommunityId = communityId(sourceNode);
    const targetCommunityId = communityId(targetNode);
    const sourceCommunity = communities.get(sourceCommunityId);
    const targetCommunity = communities.get(targetCommunityId);
    const inferred = String(link?.confidence ?? '').toUpperCase() === 'INFERRED';

    if (sourceCommunityId === targetCommunityId) {
      sourceCommunity.internalLinks += 1;
      if (inferred) sourceCommunity.inferredLinks += 1;
      continue;
    }

    sourceCommunity.crossLinks += 1;
    targetCommunity.crossLinks += 1;
    if (inferred) {
      sourceCommunity.inferredLinks += 1;
      targetCommunity.inferredLinks += 1;
    }
    const pair = [sourceCommunityId, targetCommunityId].sort(compareCommunityId);
    const pairKey = `${pair[0]}\u0000${pair[1]}`;
    increment(crossPairs, pairKey);
    increment(crossDegree, sourceId);
    increment(crossDegree, targetId);
    if (!neighborCommunities.has(sourceId)) neighborCommunities.set(sourceId, new Set());
    if (!neighborCommunities.has(targetId)) neighborCommunities.set(targetId, new Set());
    neighborCommunities.get(sourceId).add(targetCommunityId);
    neighborCommunities.get(targetId).add(sourceCommunityId);
  }

  const communityRows = [...communities.values()].map((community) => {
    const rankedNodes = [...community.nodes].sort((a, b) => {
      const degreeDifference = (degree.get(text(b.id)) ?? 0) - (degree.get(text(a.id)) ?? 0);
      return degreeDifference || compareText(nodeLabel(a), nodeLabel(b)) || compareText(text(a.id), text(b.id));
    });
    return {
      ...community,
      name: pickCommunityName(community.nameCounts, community.id),
      keyNodes: rankedNodes.slice(0, 4).map(nodeLabel),
      sources: sortedCounts(community.sourceCounts).slice(0, 3).map(([source]) => source),
    };
  }).sort((a, b) => b.nodes.length - a.nodes.length || compareCommunityId(a.id, b.id));
  const communityById = new Map(communityRows.map((community) => [community.id, community]));

  const crossPairRows = [...crossPairs.entries()].map(([key, count]) => {
    const [leftId, rightId] = key.split('\u0000');
    return {
      leftId,
      rightId,
      left: communityById.get(leftId),
      right: communityById.get(rightId),
      count,
    };
  }).sort((a, b) => b.count - a.count || compareCommunityId(a.leftId, b.leftId) || compareCommunityId(a.rightId, b.rightId));

  const bridgeRows = [...crossDegree.entries()].map(([id, count]) => ({
    id,
    count,
    neighborCount: neighborCommunities.get(id)?.size ?? 0,
    node: byId.get(id),
  })).sort((a, b) =>
    b.neighborCount - a.neighborCount ||
    b.count - a.count ||
    compareText(nodeLabel(a.node), nodeLabel(b.node)) ||
    compareText(a.id, b.id),
  );

  const mapCommunities = communityRows.slice(0, DEFAULT_MAP_COMMUNITIES);
  const mapIds = new Set(mapCommunities.map((community) => community.id));
  const mapPairs = crossPairRows
    .filter((pair) => mapIds.has(pair.leftId) && mapIds.has(pair.rightId))
    .slice(0, DEFAULT_MAP_EDGES);
  const mermaidLines = ['```mermaid', 'flowchart LR'];
  for (const community of mapCommunities) {
    const safeId = `C_${community.id.replace(/[^A-Za-z0-9_]/g, '_')}`;
    mermaidLines.push(`  ${safeId}["${mermaid(community.name)}<br/>${community.nodes.length} nodes"]`);
  }
  for (const pair of mapPairs) {
    const left = `C_${pair.leftId.replace(/[^A-Za-z0-9_]/g, '_')}`;
    const right = `C_${pair.rightId.replace(/[^A-Za-z0-9_]/g, '_')}`;
    mermaidLines.push(`  ${left} ---|"${pair.count}"| ${right}`);
  }
  mermaidLines.push('```');

  let danglingHyperedgeMembers = 0;
  const hyperedgeRows = hyperedges.map((hyperedge) => {
    const members = Array.isArray(hyperedge?.nodes) ? hyperedge.nodes.map(String) : [];
    const missing = members.filter((member) => !byId.has(member)).length;
    danglingHyperedgeMembers += missing;
    return {
      id: text(hyperedge?.id),
      label: text(hyperedge?.label ?? hyperedge?.id),
      relation: text(hyperedge?.relation, 'unspecified'),
      members: members.length,
      missing,
      confidence: text(hyperedge?.confidence, 'unspecified'),
      source: text(hyperedge?.source_file, 'no source'),
    };
  }).sort((a, b) => b.members - a.members || compareText(a.label, b.label) || compareText(a.id, b.id));

  const lines = [
    '---',
    'title: Semantic graph — generated human view',
    'summary: Deterministic, human-readable community map and directory generated from the machine-local Graphify graph; a lossy projection for orientation, not architecture truth.',
    'type: reference',
    'scope: repo',
    'status: generated',
    'generated_by: tools/graph-view/generate_graph_view.mjs',
    `updated: ${updatedDate}`,
    '---',
    '',
    '# Semantic graph — generated human view',
    '',
    '> **GENERATED FILE — do not hand-edit.** Run `npm run graph:view:write` after Graphify updates.',
    '> The machine graph is a rebuildable semantic projection; curated architecture and contracts remain truth.',
    '',
    'This is the repository’s single tracked human-readable view of `graphify-out/graph.json`. It compresses',
    'the graph into communities, cross-community connections, bridge nodes, and hyperedges. It is deliberately',
    'lossy: use `graphify query`, `graphify path`, or `graphify explain` for node-level investigation.',
    '',
    '## Snapshot',
    '',
    '| Measure | Value |',
    '|---|---:|',
    `| Nodes | ${nodes.length} |`,
    `| Pair links | ${links.length} |`,
    `| Hyperedges | ${hyperedges.length} |`,
    `| Communities | ${communityRows.length} |`,
    `| Source files represented | ${sourceFiles.size} |`,
    `| Dangling pair-link endpoints | ${danglingLinks} |`,
    `| Dangling hyperedge members | ${danglingHyperedgeMembers} |`,
    '',
    `- Graphify revision stamp: ${inlineCode(builtAtCommit)}`,
    `- Exact source-file SHA-256: ${inlineCode(sourceSha256)}`,
    `- Semantic-content SHA-256 (revision metadata excluded): ${inlineCode(contentSha256)}`,
    '',
    '## Main community topology',
    '',
    `The ${mapCommunities.length} largest communities are shown. Edge labels are aggregated pair-link counts;`,
    'an absent line does not mean two areas have no path through smaller communities.',
    '',
    ...mermaidLines,
    '',
    '## Graph composition',
    '',
    renderCountTable('Node types', fileTypes, nodes.length).trimEnd(),
    '',
    renderCountTable('Node origins', origins, nodes.length).trimEnd(),
    '',
    renderCountTable('Pair-link confidence', confidenceCounts, links.length).trimEnd(),
    '',
    '### Most common pair-link relations',
    '',
    '| Relation | Links |',
    '|---|---:|',
    ...sortedCounts(relationCounts).slice(0, 30).map(([relation, count]) => `| ${markdown(relation)} | ${count} |`),
    '',
    '## Strongest cross-community connections',
    '',
    '| Community A | Community B | Pair links |',
    '|---|---|---:|',
    ...crossPairRows.slice(0, DEFAULT_CROSS_PAIRS).map((pair) =>
      `| ${inlineCode(pair.leftId)} ${markdown(pair.left?.name)} | ${inlineCode(pair.rightId)} ${markdown(pair.right?.name)} | ${pair.count} |`,
    ),
    '',
    '## Bridge nodes',
    '',
    'Bridge nodes touch several communities. They are useful starting points for blast-radius questions,',
    'but high degree can also reflect generic infrastructure or documentation hubs.',
    '',
    '| Node | Community | Neighbor communities | Cross links | Source |',
    '|---|---|---:|---:|---|',
    ...bridgeRows.slice(0, DEFAULT_BRIDGES).map((bridge) => {
      const idCommunity = communityId(bridge.node);
      const community = communityById.get(idCommunity);
      return `| ${markdown(nodeLabel(bridge.node))} | ${inlineCode(idCommunity)} ${markdown(community?.name)} | ${bridge.neighborCount} | ${bridge.count} | ${inlineCode(sourceLabel(bridge.node))} |`;
    }),
    '',
    '## Hyperedges',
    '',
    'Hyperedges express one relationship spanning three or more nodes. A non-zero missing-member count is',
    'an integrity defect in the machine graph and should be resolved before treating that hyperedge as usable.',
    '',
    '| Hyperedge | Relation | Members | Missing | Confidence | Source |',
    '|---|---|---:|---:|---|---|',
    ...hyperedgeRows.map((hyperedge) =>
      `| ${markdown(hyperedge.label)} | ${markdown(hyperedge.relation)} | ${hyperedge.members} | ${hyperedge.missing} | ${markdown(hyperedge.confidence)} | ${inlineCode(hyperedge.source)} |`,
    ),
    '',
    '<details>',
    `<summary><strong>Complete community directory (${communityRows.length})</strong></summary>`,
    '',
    'Communities are ordered by node count. “Cross links” counts incidences, so each connection contributes',
    'once to each endpoint community.',
    '',
    '| ID | Community | Nodes | Internal links | Cross links | Inferred incidences | Key nodes | Representative sources |',
    '|---:|---|---:|---:|---:|---:|---|---|',
    ...communityRows.map((community) =>
      `| ${markdown(community.id)} | ${markdown(community.name)} | ${community.nodes.length} | ${community.internalLinks} | ${community.crossLinks} | ${community.inferredLinks} | ${community.keyNodes.map((label) => markdown(label, 70)).join(' · ')} | ${community.sources.map((source) => inlineCode(source)).join('<br/>')} |`,
    ),
    '',
    '</details>',
    '',
    '## Interpretation limits',
    '',
    '- Community labels and inferred links are probabilistic; they are navigation aids, not reviewed facts.',
    '- Node and link counts depend on Graphify’s extractors and ignore rules, not just repository size.',
    '- This view does not replace `docs/implemented/biotope/architecture-context.md`, `shared/` contracts, migrations,',
    '  `docs/graph/couplings.yaml`, memory records, or accepted ADRs.',
    '- Historical `docs/archive/` material and this generated file are excluded through `.graphifyignore`.',
    '',
  ];

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
