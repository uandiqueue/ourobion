/**
 * Server-side GitHub Actions control for the bounded brain pipeline.
 *
 * The operator UI can ask GitHub to run the pipeline, but never receives the
 * Actions token or chooses the repository, workflow, or ref.  A workflow can
 * only receive workflow_dispatch events after it exists on the repository's
 * default branch, so every dispatch starts with that fail-closed preflight.
 */

import type { BrainPipelineRun } from './brainPipelineControl.ts';

const GH_API_BASE = 'https://api.github.com';
const WORKFLOW_FILE = 'brain-pipeline.yml';
const API_VERSION = '2026-03-10';

export type BrainPipelineInspection =
  | {
      ok: true;
      dispatchability: 'active';
      defaultBranch: string;
      runs: BrainPipelineRun[];
    }
  | {
      ok: true;
      dispatchability: 'not_on_default_branch' | 'unregistered_or_invalid';
      defaultBranch: string;
      runs: [];
    }
  | {
      ok: false;
      dispatchability: 'unknown';
      error: string;
      runs: [];
    };

export type BrainPipelineDispatchInputs = object;

export type BrainPipelineDispatchResult =
  | {
      ok: true;
      outcome: 'accepted';
      defaultBranch: string;
      run: { id: number; apiUrl: string; htmlUrl: string } | null;
    }
  | {
      ok: false;
      outcome: 'rejected' | 'unknown';
      error: string;
    };

interface Config {
  token: string;
  repo: string;
}

function config(): Config | null {
  const token = process.env.GH_ACTIONS_TOKEN;
  const repo = process.env.GH_REPO;
  if (typeof token !== 'string' || token.length === 0 || typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return null;
  }
  return { token, repo };
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'content-type': 'application/json',
    'User-Agent': 'ourobion-nao',
  };
}

function githubUrl(repo: string, suffix: string): string {
  return `${GH_API_BASE}/repos/${repo}${suffix}`;
}

/**
 * Name the failing preflight step and its HTTP status, and nothing else.
 *
 * Every inspection failure used to collapse into one of two fixed sentences,
 * so an operator staring at a disabled form could not tell a transport failure
 * from a 401 from a 403 — and neither could anyone reading the panel later.
 * The step name and the numeric status are our own, not remote content: no
 * response body and no configured secret can reach this string, which is what
 * the redaction test pins.
 */
function stepFailure(step: string, response: Response | null): string {
  return response === null
    ? `GitHub could not be reached while checking ${step}.`
    : `GitHub returned HTTP ${response.status} while checking ${step}.`;
}

async function request(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isRunApiUrl(value: unknown, repo: string, id: number): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'api.github.com'
      && url.pathname === `/repos/${repo}/actions/runs/${id}`;
  } catch {
    return false;
  }
}

function isRunHtmlUrl(value: unknown, repo: string, id: number): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname === `/${repo}/actions/runs/${id}`;
  } catch {
    return false;
  }
}

function asRun(value: unknown, repo: string): BrainPipelineRun | null {
  const item = object(value);
  const id = item?.id;
  if (!item || typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || !isRunHtmlUrl(item.html_url, repo, id) || typeof item.status !== 'string') {
    return null;
  }
  return {
    id,
    status: item.status,
    conclusion: typeof item.conclusion === 'string' ? item.conclusion : null,
    htmlUrl: item.html_url,
    createdAt: typeof item.created_at === 'string' ? item.created_at : null,
    updatedAt: typeof item.updated_at === 'string' ? item.updated_at : null,
  };
}

/** Inspect registration at the actual default branch, then show recent runs. */
export async function inspectBrainPipeline(): Promise<BrainPipelineInspection> {
  const settings = config();
  if (!settings) {
    return { ok: false, dispatchability: 'unknown', error: 'GitHub Actions is not configured.', runs: [] };
  }

  const init = { headers: headers(settings.token) };
  const repoResponse = await request(githubUrl(settings.repo, ''), init);
  if (!repoResponse || !repoResponse.ok) {
    return { ok: false, dispatchability: 'unknown', error: stepFailure('the repository', repoResponse), runs: [] };
  }
  const repoInfo = object(await json(repoResponse));
  const defaultBranch = repoInfo?.default_branch;
  if (typeof defaultBranch !== 'string' || defaultBranch.length === 0) {
    return { ok: false, dispatchability: 'unknown', error: 'GitHub did not provide a default branch.', runs: [] };
  }

  const workflowResponse = await request(
    githubUrl(settings.repo, `/actions/workflows/${WORKFLOW_FILE}`),
    init,
  );
  if (!workflowResponse) {
    return { ok: false, dispatchability: 'unknown', error: stepFailure('the workflow', null), runs: [] };
  }

  if (workflowResponse.status === 404) {
    const contentsResponse = await request(
      githubUrl(settings.repo, `/contents/.github/workflows/${WORKFLOW_FILE}?ref=${encodeURIComponent(defaultBranch)}`),
      init,
    );
    if (!contentsResponse) {
      return { ok: false, dispatchability: 'unknown', error: stepFailure('the default-branch workflow file', null), runs: [] };
    }
    if (contentsResponse.status === 404) {
      return { ok: true, dispatchability: 'not_on_default_branch', defaultBranch, runs: [] };
    }
    if (!contentsResponse.ok) {
      return {
        ok: false,
        dispatchability: 'unknown',
        error: stepFailure('the default-branch workflow file', contentsResponse),
        runs: [],
      };
    }
    return { ok: true, dispatchability: 'unregistered_or_invalid', defaultBranch, runs: [] };
  }
  if (!workflowResponse.ok) {
    return { ok: false, dispatchability: 'unknown', error: stepFailure('the workflow', workflowResponse), runs: [] };
  }

  const workflow = object(await json(workflowResponse));
  if (workflow?.state !== 'active') {
    return { ok: true, dispatchability: 'unregistered_or_invalid', defaultBranch, runs: [] };
  }

  // Registration is now settled: the workflow exists on the default branch and
  // GitHub reports it active, which is the whole fail-closed question. Listing
  // recent runs is reporting, not a gate — it used to return `unknown` and
  // disable the form whenever this one cosmetic query failed, so a throttled or
  // transiently failing history lookup could present itself as "this workflow
  // cannot be dispatched". An empty list is already a valid, expected state
  // (the panel says so), and a workflow that has never run must stay
  // dispatchable. Failure here degrades the list, never the verdict.
  const runsResponse = await request(
    githubUrl(settings.repo, `/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=10`),
    init,
  );
  const runsPayload = runsResponse !== null && runsResponse.ok ? object(await json(runsResponse)) : null;
  const runs = Array.isArray(runsPayload?.workflow_runs)
    ? runsPayload.workflow_runs.map((item) => asRun(item, settings.repo)).filter((item): item is BrainPipelineRun => item !== null)
    : [];
  return { ok: true, dispatchability: 'active', defaultBranch, runs };
}

/**
 * Dispatch only after the default-branch registration check succeeds. GitHub
 * normally returns 204, but supports a 200 body when run details are requested.
 */
export async function dispatchBrainPipeline(inputs: BrainPipelineDispatchInputs): Promise<BrainPipelineDispatchResult> {
  const preflight = await inspectBrainPipeline();
  if (!preflight.ok) {
    // `preflight.error` is composed here, from a step name and a numeric
    // status — never from a remote body — so passing it on stays redacted.
    return {
      ok: false,
      outcome: 'unknown',
      error: `Brain pipeline dispatch could not be confirmed. ${preflight.error}`,
    };
  }
  if (preflight.dispatchability !== 'active') {
    return {
      ok: false,
      outcome: 'rejected',
      error: `Brain pipeline is not dispatchable: ${preflight.dispatchability}.`,
    };
  }
  const settings = config();
  if (!settings) {
    return { ok: false, outcome: 'rejected', error: 'GitHub Actions is not configured.' };
  }

  const response = await request(
    githubUrl(settings.repo, `/actions/workflows/${WORKFLOW_FILE}/dispatches`),
    {
      method: 'POST',
      headers: headers(settings.token),
      body: JSON.stringify({ ref: preflight.defaultBranch, inputs, return_run_details: true }),
    },
  );
  if (!response) {
    return { ok: false, outcome: 'unknown', error: 'GitHub dispatch outcome is unknown.' };
  }
  if (response.status === 204) {
    return { ok: true, outcome: 'accepted', defaultBranch: preflight.defaultBranch, run: null };
  }
  if (response.status === 200) {
    const payload = object(await json(response));
    const id = payload?.workflow_run_id;
    const apiUrl = payload?.run_url;
    const htmlUrl = payload?.html_url;
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && isRunApiUrl(apiUrl, settings.repo, id) && isRunHtmlUrl(htmlUrl, settings.repo, id)) {
      return { ok: true, outcome: 'accepted', defaultBranch: preflight.defaultBranch, run: { id, apiUrl, htmlUrl } };
    }
    return { ok: false, outcome: 'unknown', error: 'GitHub returned an unrecognised dispatch response.' };
  }
  if (response.status >= 400 && response.status < 500) {
    return { ok: false, outcome: 'rejected', error: `GitHub rejected the pipeline dispatch (${response.status}).` };
  }
  return { ok: false, outcome: 'unknown', error: `GitHub dispatch outcome is unknown (${response.status}).` };
}
