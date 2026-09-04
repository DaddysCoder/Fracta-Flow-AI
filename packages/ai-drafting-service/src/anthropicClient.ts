import Anthropic, { APIError, APIConnectionError } from "@anthropic-ai/sdk";
import type { BuiltPrompt, ParsedDraft } from "./promptBuilder";
import { parseDraftResponse } from "./promptBuilder";

export type GenerationOutcome =
  | { outcome: "success"; result: ParsedDraft }
  | { outcome: "refusal" }
  | { outcome: "network_error"; message: string }
  | { outcome: "api_error"; message: string; status: number | null };

/**
 * Calls the Anthropic API server-side and classifies the result the same
 * four ways strategy-library-server's `runPersonalisationGeneration` does:
 * success, refusal, network_error, api_error. See that file for the
 * reasoning behind keeping network_error and api_error distinct
 * server-side (for logging) while the client only needs refusal vs.
 * everything-else-failed vs. success.
 */
export async function runDraftGeneration(client: Anthropic, model: string, prompt: BuiltPrompt): Promise<GenerationOutcome> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
  } catch (error) {
    return classifyThrownError(error);
  }

  // Newer Claude models can decline within an otherwise-successful HTTP
  // response via stop_reason "refusal" rather than throwing.
  if ((response.stop_reason as string) === "refusal") {
    return { outcome: "refusal" };
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = parseDraftResponse(text);
  if (!parsed) {
    return { outcome: "api_error", message: "Model response did not match the expected format.", status: null };
  }

  return { outcome: "success", result: parsed };
}

function classifyThrownError(error: unknown): GenerationOutcome {
  if (error instanceof APIConnectionError) {
    return { outcome: "network_error", message: error.message };
  }

  if (error instanceof APIError) {
    if (looksLikeContentPolicyRefusal(error)) {
      return { outcome: "refusal" };
    }
    return { outcome: "api_error", message: error.message, status: error.status ?? null };
  }

  return {
    outcome: "network_error",
    message: error instanceof Error ? error.message : "Unknown error contacting the model API.",
  };
}

/**
 * Best-effort, same heuristic and same caveat as strategy-library-server's
 * `looksLikeContentPolicyRefusal`: there is no fully reliable signal for a
 * content-policy decline that surfaces as a thrown 400 rather than a
 * successful response with `stop_reason: "refusal"`.
 */
function looksLikeContentPolicyRefusal(error: APIError): boolean {
  if (error.status !== 400) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("usage_policy") ||
    message.includes("usage policy") ||
    message.includes("content_policy") ||
    message.includes("content policy") ||
    message.includes("blocked")
  );
}
