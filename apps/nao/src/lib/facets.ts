// ourobion nao — facet dimension table (shared by the facet rail + active chips).
//
// Maps each facet dimension to its FacetCounts key, its URL search param, and its
// display label. Plain constants with no server imports, so both Client
// Components (Facets, ActiveChips) and the server page can read it. The set + order
// mirror the approved design's facet rail.

export type FacetKey =
  | 'topicTags'
  | 'oaStatus'
  | 'retrievability'
  | 'workType'
  | 'status'
  | 'discoveredVia'
  | 'method';

export interface FacetDim {
  key: FacetKey;
  /** URL search param name */
  param: string;
  label: string;
}

export const FACET_DIMS: ReadonlyArray<FacetDim> = [
  { key: 'topicTags', param: 'topic', label: 'Topic seed' },
  { key: 'oaStatus', param: 'oa', label: 'Open access' },
  { key: 'retrievability', param: 'retr', label: 'Retrievability' },
  { key: 'workType', param: 'type', label: 'Work type' },
  { key: 'status', param: 'status', label: 'Pipeline status' },
  { key: 'discoveredVia', param: 'via', label: 'Discovery source' },
  { key: 'method', param: 'method', label: 'Extraction method' },
];

/** All facet param names (used to enumerate active filters / clear them). */
export const FACET_PARAMS: ReadonlyArray<string> = FACET_DIMS.map((d) => d.param);
