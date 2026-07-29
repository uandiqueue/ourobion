// shared/brain/trust_labels.typetest.ts
//
// Compile-time guard for the ONE copy trust_labels.ts is allowed to make.
//
// `trust_labels.ts` is imported directly by Deno edge functions, so it may not import the rest of
// shared/brain (see its header). It therefore restates the string unions it labels. This file —
// which nothing imports at runtime and which exists only to be typechecked — asserts each
// restated union is EXACTLY the contract union it mirrors. Add a member to `ClaimKind` without
// adding it to `TrustLabelClaimKind` and `tsc` fails here, so the label maps can never silently
// go partial.
//
// Same `Exact<>` form as relationships.schema.ts and shared/rules/_assert.ts: conditional-generic
// identity rather than mutual assignability, so an `any`-degraded type fails instead of passing.

import type {
  ArtifactPosture,
  ClaimKind,
  EvidenceTier,
  RelationKind,
  Verdict,
} from './relationships';
import type { DispositionStatus, ExpertDisposition } from './provenance';
import type {
  TrustLabelClaimKind,
  TrustLabelDisposition,
  TrustLabelDispositionStatus,
  TrustLabelPosture,
  TrustLabelRelationKind,
  TrustLabelStudyDesignTier,
  TrustLabelVerdict,
} from './trust_labels';

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

// If any line errors, trust_labels.ts has drifted from the contract it labels.
const _claimKind: Exact<TrustLabelClaimKind, ClaimKind> = true;
const _relationKind: Exact<TrustLabelRelationKind, RelationKind> = true;
const _verdict: Exact<TrustLabelVerdict, Verdict> = true;
const _tier: Exact<TrustLabelStudyDesignTier, EvidenceTier> = true;
const _posture: Exact<TrustLabelPosture, ArtifactPosture> = true;
const _disposition: Exact<TrustLabelDisposition, ExpertDisposition> = true;
const _dispositionStatus: Exact<TrustLabelDispositionStatus, DispositionStatus> = true;

void _claimKind;
void _relationKind;
void _verdict;
void _tier;
void _posture;
void _disposition;
void _dispositionStatus;
