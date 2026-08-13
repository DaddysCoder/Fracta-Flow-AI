import type { AxisPayload } from "./axisPayload";

/**
 * Server-side API calls only — this is the one place in the app that
 * talks to strategy-library-server, which is the one place that talks
 * to Anthropic. The client never calls the model directly and never
 * holds an API key. See strategy-library-server's README for why.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

export type PersonalizeResult =
  | { outcome: "success"; personalisedActivity: string; keptFixedStatement: string; mechanism: string; safetyBoundary: string | null; citations: string[] }
  | { outcome: "refusal" }
  | { outcome: "network_error"; message: string }
  | { outcome: "api_error"; message: string };

export async function requestPersonalisation(
  strategyTemplateId: string,
  axisData: AxisPayload
): Promise<PersonalizeResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyTemplateId, axisData }),
    });
  } catch (error) {
    // fetch itself throwing means the backend was unreachable — a
    // genuine network/infrastructure failure, not something the backend
    // had a chance to classify.
    return {
      outcome: "network_error",
      message: error instanceof Error ? error.message : "Could not reach the personalisation service.",
    };
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // ignore — keep the generic message
    }
    return { outcome: "api_error", message };
  }

  const body = await response.json();
  return body as PersonalizeResult;
}
