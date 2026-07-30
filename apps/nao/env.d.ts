// ourobion nao — Cloudflare bindings type surface.
//
// Server code reads bindings via `getCloudflareContext().env` from
// '@opennextjs/cloudflare'. Augment CloudflareEnv (the type that call resolves to)
// with this app's bindings so server modules get typed access without casts.
//
// CORPUS = R2 bucket (manifest/papers.jsonl + meta/<uid>.json); DB = D1 (FTS5 index).
// SUPABASE_URL is a .dev.vars / Worker secret (mirrored from NEXT_PUBLIC_SUPABASE_URL
// by scripts/gen-env.mjs) used for edge JWKS verification.
//
// The R2Bucket / D1Database ambient globals come from @cloudflare/workers-types
// (the Workers runtime type surface). OpenNext's own cloudflare-context.d.ts also
// relies on these globals; reference them here — env.d.ts is included project-wide
// by tsconfig — so both `tsc` and `next build` resolve the bindings without casts.
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  CORPUS: R2Bucket;
  DB: D1Database;
  SUPABASE_URL: string;
  /** Fine-grained GitHub PAT, "Actions: Read and write" scoped to this repo only. */
  GH_ACTIONS_TOKEN: string;
  /** "owner/repo", e.g. "uandiqueue/ourobion". */
  GH_REPO: string;
  /** Branch/ref the brain-ingest workflow dispatches against. Optional — defaults to "dev-phase2-run4". */
  GH_ACTIONS_REF?: string;
}
