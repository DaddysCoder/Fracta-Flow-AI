import Anthropic, { APIError, APIConnectionError } from "@anthropic-ai/sdk";
import type { BuiltPrompt, ParsedGeneration } from "./promptBuilder";
import { parseGenerationResponse } from "./promptBuilder";

export type GenerationOutcome =
  | { outcome: "success"; result: ParsedGeneration }
  | { outcome: "refusal" }
  | { outcome: "network_error"; message: string }
  | { outcome: "api_error"; message: string; status: number | null };

/**
 * Calls the Anthropic API server-side and classifies the result into
 * exactly the categories the brief requires the backend to distinguish:
 * a genuine network/infrastructure failure, an HTTP error from the API
 * with a message, or a content refusal. The client only ever needs to
 * branch on "refusal" vs. "everything else failed" vs. "success", but
 * the finer-grained class here is what gets logged server-side.
 */
export async function runPersonalisationGeneration(
  client: Anthropic,
  model: string,
  prompt: BuiltPrompt
): Promise<GenerationOutcome> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
  } catch (error) {
    return classifyThrownError(error);
  }

  // Newer Claude models can decline within an otherwise-successful HTTP
  // response via stop_reason "refusal" rather than throwing — this is
  // the primary path we expect the demo-reported refusals to surface
  // through in production.
  if ((response.stop_reason as string) === "refusal") {
    return { outcome: "refusal" };
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = parseGenerationResponse(text);
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
 * Best-effort: some content-policy declines surface as a thrown 400
 * `invalid_request_error` rather than a successful response with
 * `stop_reason: "refusal"`. There is no fully reliable signal for this
 * from the API today — this is exactly the moderation-tuning gap flagged
 * in the brief as needing a direct conversation with Anthropic before
 * this ships as a real product. Until then, this heuristic keyword check
 * is a best-effort classification, not a guarantee.
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
