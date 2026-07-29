import { INTERNAL_SECRET_HEADER_WIRE } from "./internal_auth.ts"

export type EngineStage = "compute-baselines" | "evaluate-signals" | "generate-insights"

/** Build and execute one authenticated same-stack engine request. */
export function fetchEngineStage(
  fetchFn: typeof fetch,
  supabaseUrl: string,
  stage: EngineStage,
  publishableKey: string,
  internalSecret: string,
): Promise<Response> {
  return fetchFn(`${supabaseUrl}/functions/v1/${stage}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      [INTERNAL_SECRET_HEADER_WIRE]: internalSecret,
    },
    body: "{}",
  })
}
