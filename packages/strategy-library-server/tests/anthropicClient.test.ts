import { describe, it, expect } from "vitest";
import Anthropic, { APIError, APIConnectionError } from "@anthropic-ai/sdk";
import { runPersonalisationGeneration } from "../src/anthropicClient";
import type { BuiltPrompt } from "../src/promptBuilder";

const prompt: BuiltPrompt = { system: "system prompt", user: "user prompt" };

function fakeClient(create: (...args: unknown[]) => unknown): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

describe("runPersonalisationGeneration", () => {
  it("returns success and parses the response on a well-formed reply", async () => {
    const client = fakeClient(async () => ({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "PERSONALISED_ACTIVITY: Do the thing with trains.\nKEPT_FIXED: Mechanism unchanged.",
        },
      ],
    }));

    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toEqual({
      outcome: "success",
      result: { personalisedActivity: "Do the thing with trains.", keptFixedStatement: "Mechanism unchanged." },
    });
  });

  it("classifies stop_reason 'refusal' as a refusal, not an error", async () => {
    const client = fakeClient(async () => ({ stop_reason: "refusal", content: [] }));
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toEqual({ outcome: "refusal" });
  });

  it("classifies a malformed successful response as api_error, not a crash", async () => {
    const client = fakeClient(async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I can't help with that in this format." }],
    }));
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result.outcome).toBe("api_error");
  });

  it("classifies a thrown APIConnectionError as network_error", async () => {
    const client = fakeClient(async () => {
      throw new APIConnectionError({ message: "fetch failed" });
    });
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toEqual({ outcome: "network_error", message: "fetch failed" });
  });

  it("classifies a thrown non-policy APIError (e.g. 500) as api_error with status", async () => {
    const client = fakeClient(async () => {
      throw new APIError(500, { message: "internal server error" }, "internal server error", undefined);
    });
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toMatchObject({ outcome: "api_error", status: 500 });
  });

  it("classifies a thrown 400 with content-policy language as a refusal", async () => {
    const client = fakeClient(async () => {
      throw new APIError(
        400,
        { message: "Output blocked by content filtering policy" },
        "Output blocked by content filtering policy",
        undefined
      );
    });
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toEqual({ outcome: "refusal" });
  });

  it("classifies a thrown ordinary 400 (our own bad request) as api_error, not a refusal", async () => {
    const client = fakeClient(async () => {
      throw new APIError(400, { message: "max_tokens must be positive" }, "max_tokens must be positive", undefined);
    });
    const result = await runPersonalisationGeneration(client, "claude-sonnet-4-5", prompt);
    expect(result).toMatchObject({ outcome: "api_error", status: 400 });
  });
});
