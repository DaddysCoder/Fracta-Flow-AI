import { describe, it, expect } from "vitest";
import request from "supertest";
import type Anthropic from "@anthropic-ai/sdk";
import { createApp } from "../src/app";

function fakeAnthropic(create: (...args: unknown[]) => unknown): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

function appWith(create: (...args: unknown[]) => unknown) {
  return createApp({
    anthropicApiKey: "test-key",
    anthropicModel: "claude-sonnet-4-5",
    allowedOrigin: "http://localhost:5173",
    anthropicClient: fakeAnthropic(create),
  });
}

describe("POST /api/personalize", () => {
  it("400s when strategyTemplateId is missing", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app).post("/api/personalize").send({});
    expect(res.status).toBe(400);
  });

  it("404s for an unknown strategyTemplateId", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app)
      .post("/api/personalize")
      .send({ strategyTemplateId: "does-not-exist", axisData: {} });
    expect(res.status).toBe(404);
  });

  it("400s for a strategy with no declared personalisation axes", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app)
      .post("/api/personalize")
      .send({ strategyTemplateId: "ecological-strategies", axisData: { interests: { general: ["x"] } } });
    expect(res.status).toBe(400);
  });

  it("400s when the declared axes have no usable data", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app)
      .post("/api/personalize")
      .send({ strategyTemplateId: "visual-scheduling", axisData: {} });
    expect(res.status).toBe(400);
  });

  it("returns a success outcome with mechanism/citations alongside the personalised text", async () => {
    const app = appWith(async () => ({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "PERSONALISED_ACTIVITY: Train-themed picture schedule.\nKEPT_FIXED: Visual sequencing kept intact.",
        },
      ],
    }));

    const res = await request(app)
      .post("/api/personalize")
      .send({
        strategyTemplateId: "visual-scheduling",
        axisData: { interests: { general: ["trains"], strengths: [], dislikes: [] } },
      });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("success");
    expect(res.body.personalisedActivity).toBe("Train-themed picture schedule.");
    expect(res.body.mechanism).toBeTruthy();
    expect(Array.isArray(res.body.citations)).toBe(true);
    expect(res.body.citations.length).toBeGreaterThan(0);
  });

  it("returns a refusal outcome without a genuine-failure message when the model declines", async () => {
    const app = appWith(async () => ({ stop_reason: "refusal", content: [] }));
    const res = await request(app)
      .post("/api/personalize")
      .send({
        strategyTemplateId: "visual-scheduling",
        axisData: { interests: { general: ["trains"], strengths: [], dislikes: [] } },
      });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("refusal");
  });

  it("returns a network_error outcome (not a 5xx) when the call throws a connection error", async () => {
    const app = appWith(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const res = await request(app)
      .post("/api/personalize")
      .send({
        strategyTemplateId: "visual-scheduling",
        axisData: { interests: { general: ["trains"], strengths: [], dislikes: [] } },
      });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("network_error");
  });

  it("never includes participant-identifying fields the client didn't send in the declared axis shape", async () => {
    let capturedUserMessage = "";
    const app = appWith(async (args: unknown) => {
      capturedUserMessage = (args as { messages: { content: string }[] }).messages[0].content;
      return {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "PERSONALISED_ACTIVITY: x\nKEPT_FIXED: y" }],
      };
    });

    await request(app)
      .post("/api/personalize")
      .send({
        strategyTemplateId: "visual-scheduling",
        axisData: {
          interests: { general: ["trains"], strengths: [], dislikes: [] },
          // Not a declared axis for this template — must never reach the prompt.
          communication_style: { mode: "verbal", indicatesNoOrDiscomfort: "shouting" },
        },
      });

    expect(capturedUserMessage).toContain("trains");
    expect(capturedUserMessage).not.toContain("shouting");
  });
});
