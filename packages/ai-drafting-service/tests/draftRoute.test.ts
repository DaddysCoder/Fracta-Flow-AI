import { describe, it, expect } from "vitest";
import request from "supertest";
import type Anthropic from "@anthropic-ai/sdk";
import type { StructuredKnowledgeRecord } from "@fracta-flow/evidence-layer";
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

function approvedRecord(overrides: Partial<StructuredKnowledgeRecord> = {}): StructuredKnowledgeRecord {
  return {
    id: "ev-1",
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: "current_participant_plan",
    participantRef: "participant-super-secret-id",
    sourceDocumentId: "doc-1",
    strategyType: "visual scheduling",
    behaviourRisk: "elopement near roadways",
    triggerContext: "unstructured transitions",
    earlyWarningSign: "pacing",
    staffAction: "offer a visual countdown before transitions",
    staffActionToAvoid: "physical guiding without warning",
    ...overrides,
  };
}

function hitFor(record: StructuredKnowledgeRecord) {
  return { record, tierIndex: 0, matchedCategories: [], workflowMultiplier: 1, baseScore: 1, finalScore: 1 };
}

describe("POST /api/draft", () => {
  it("400s when instruction is missing", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app).post("/api/draft").send({ evidenceHits: [hitFor(approvedRecord())] });
    expect(res.status).toBe(400);
  });

  it("400s when evidenceHits is missing or has nothing usable", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app).post("/api/draft").send({ instruction: "Draft a note.", evidenceHits: [] });
    expect(res.status).toBe(400);
  });

  it("400s when every evidence hit fails governance checks (e.g. not approved)", async () => {
    const app = appWith(async () => ({}));
    const res = await request(app)
      .post("/api/draft")
      .send({
        instruction: "Draft a note.",
        evidenceHits: [hitFor(approvedRecord({ approvalStatus: "needs_review" }))],
      });
    expect(res.status).toBe(400);
  });

  it("returns a success outcome with the draft, cited evidence ids, and a groundedness report", async () => {
    const app = appWith(async () => ({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "DRAFT: Offer a visual countdown before transitions.\nEVIDENCE_USED: ev-1",
        },
      ],
    }));

    const res = await request(app)
      .post("/api/draft")
      .send({ instruction: "Draft a staff briefing.", evidenceHits: [hitFor(approvedRecord())] });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("success");
    expect(res.body.draft).toBe("Offer a visual countdown before transitions.");
    expect(res.body.evidenceUsedIds).toEqual(["ev-1"]);
    expect(res.body.groundedness.clean).toBe(true);
  });

  it("returns a refusal outcome without a genuine-failure message when the model declines", async () => {
    const app = appWith(async () => ({ stop_reason: "refusal", content: [] }));
    const res = await request(app)
      .post("/api/draft")
      .send({ instruction: "Draft a note.", evidenceHits: [hitFor(approvedRecord())] });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("refusal");
  });

  it("returns a network_error outcome (not a 5xx) when the call throws a connection error", async () => {
    const app = appWith(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const res = await request(app)
      .post("/api/draft")
      .send({ instruction: "Draft a note.", evidenceHits: [hitFor(approvedRecord())] });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("network_error");
  });

  it("never sends participantRef or any identity field to the model, even when the client includes it in the request body", async () => {
    let capturedUserMessage = "";
    const app = appWith(async (args: unknown) => {
      capturedUserMessage = (args as { messages: { content: string }[] }).messages[0].content;
      return {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "DRAFT: x\nEVIDENCE_USED: ev-1" }],
      };
    });

    await request(app)
      .post("/api/draft")
      .send({
        instruction: "Draft a note about Jamie Doe's transport plan.",
        evidenceHits: [hitFor(approvedRecord())],
      });

    expect(capturedUserMessage).not.toContain("participant-super-secret-id");
  });

  it("flags a draft whose EVIDENCE_USED cites an id it was never given", async () => {
    const app = appWith(async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "DRAFT: Offer a countdown.\nEVIDENCE_USED: ev-1, ev-not-real" }],
    }));

    const res = await request(app)
      .post("/api/draft")
      .send({ instruction: "Draft a note.", evidenceHits: [hitFor(approvedRecord())] });

    expect(res.status).toBe(200);
    expect(res.body.groundedness.clean).toBe(false);
    expect(res.body.groundedness.invalidEvidenceIds).toEqual(["ev-not-real"]);
  });
});
