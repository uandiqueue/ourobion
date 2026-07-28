/**
 * Trigger a real ingestion run via GitHub Actions `workflow_dispatch`.
 *
 * nao (a Cloudflare Worker) cannot run the ingestion CLI itself — it does
 * long-running network fetches + PDF parsing that would blow through any
 * Worker's execution-time ceiling (see docs/nao/brain-ingestion-design.md §8.1
 * for the full reasoning). Dispatching a GitHub Actions workflow run
 * (`.github/workflows/brain-ingest.yml`) gives the job real, persistent
 * compute on GitHub's own runners, with the chosen seed/limit passed straight
 * through as workflow inputs — no queued-request mailbox needed for this part.
 *
 * Auth: a fine-grained GitHub personal access token, scoped to just this repo
 * with "Actions: Read and write" permission, stored as the `GH_ACTIONS_TOKEN`
 * Worker secret (never committed — see the README for how to mint one).
 */

const GH_API_BASE = 'https://api.github.com';
const WORKFLOW_FILE = 'brain-ingest.yml';

export interface DispatchIngestOptions {
  seed?: string;
  limit?: number;
}

export type DispatchIngestResult =
  | { ok: true }
  | { ok: false; outcome: 'rejected' | 'unknown'; error: string };

function requiredEnv(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Fire a `workflow_dispatch` event for `.github/workflows/brain-ingest.yml`.
 * Returns a tagged negative result. Missing configuration and 4xx responses
 * are authoritative rejections. A thrown transport error, 5xx, or unexpected
 * non-204 status is `outcome: 'unknown'` because GitHub may have accepted the
 * dispatch before the response was lost.
 */
export async function dispatchIngestWorkflow(opts: DispatchIngestOptions): Promise<DispatchIngestResult> {
  const token = requiredEnv('GH_ACTIONS_TOKEN');
  const repo = requiredEnv('GH_REPO'); // e.g. "uandiqueue/ourobion"
  const ref = process.env.GH_ACTIONS_REF ?? 'dev-phase2';

  if (!token || !repo) {
    return {
      ok: false,
      outcome: 'rejected',
      error: 'GH_ACTIONS_TOKEN / GH_REPO not configured on this deployment',
    };
  }

  const inputs: Record<string, string> = {};
  if (opts.seed !== undefined) inputs.seed = opts.seed;
  if (opts.limit !== undefined) inputs.limit = String(opts.limit);

  let res: Response;
  try {
    res = await fetch(`${GH_API_BASE}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'content-type': 'application/json',
        // GitHub's API 403s every request without one ("Request forbidden by
        // administrative rules") — Workers' fetch doesn't set a usable default.
        'User-Agent': 'ourobion-nao',
      },
      body: JSON.stringify({ ref, inputs }),
    });
  } catch (err) {
    return {
      ok: false,
      outcome: 'unknown',
      error: `network error calling GitHub: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.status === 204) {
    return { ok: true };
  }

  // Only a 4xx response is authoritative evidence that GitHub rejected the
  // request. A 5xx (or an unexpected non-204 status) may arrive after the
  // workflow was accepted/enqueued, and workflow_dispatch exposes no
  // operation-id lookup that could resolve that ambiguity here.
  if (res.status < 400 || res.status >= 500) {
    return {
      ok: false,
      outcome: 'unknown',
      error: `GitHub API returned indeterminate status ${res.status}`,
    };
  }

  const body = await res.text().catch(() => '');
  return {
    ok: false,
    outcome: 'rejected',
    error: `GitHub API ${res.status}: ${body.slice(0, 300)}`,
  };
}
