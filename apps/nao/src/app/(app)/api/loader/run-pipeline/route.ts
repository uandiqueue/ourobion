// ourobion nao — "Run analysis" relay (O11/O12 seam, run-2 U6).
//
// POST → invokes the U5 `run-pipeline` edge function (compute-baselines →
// evaluate-signals → generate-insights, service-role gated) SERVER-SIDE and relays its
// per-stage summary JSON to the page verbatim.
//
// SECRET HANDLING: run-pipeline requires `Authorization: Bearer <service-role-key>`.
// The key is read from server env only — SUPABASE_SERVICE_ROLE_KEY in apps/nao/.env
// (projected into .dev.vars locally by scripts/gen-env.mjs; a Worker secret in prod).
// It is NEVER NEXT_PUBLIC_-prefixed and never reaches the browser: the client only
// ever sees this route's relayed stage summaries. The request must still come from an
// authenticated session (middleware gates every (app) route; we re-check here because
// this handler spends service-role power).
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Supabase project URL for the functions endpoint (server env first, public mirror ok — the URL is public). */
function supabaseUrl(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

export async function POST(): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const url = supabaseUrl();
  if (!url) {
    return json({ error: 'server misconfiguration: SUPABASE_URL unavailable' }, 500);
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is not configured on the server — add it to apps/nao/.env ' +
          '(dev) or the Worker secrets (prod). It must never be NEXT_PUBLIC_.',
      },
      501,
    );
  }

  try {
    const res = await fetch(`${url}/functions/v1/run-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        // The gateway (Kong locally) requires an apikey header in addition to the
        // Authorization bearer; run-pipeline itself only compares Authorization.
        apikey: serviceRoleKey,
      },
      body: '{}',
    });
    const text = await res.text();
    // Relay run-pipeline's JSON (and its 200/502 semantics) verbatim; wrap non-JSON honestly.
    try {
      return json(JSON.parse(text), res.status);
    } catch {
      return json({ ok: false, status: res.status, raw: text.slice(0, 2000) }, res.ok ? 502 : res.status);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
}
