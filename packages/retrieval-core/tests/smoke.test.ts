import { describe, expect, it } from "vitest";
import { rankCandidates, type RetrievalCandidate } from "../src/lib/ranking";
import { chunkText, inspectText } from "../src/lib/documents";
import { excerptFor, buildExtractiveAnswer } from "../src/lib/retrieval";
import { encryptBytes, decryptBytes, blindIndexTokens } from "../src/lib/security";
import type { KnowledgeDocument } from "../src/lib/types";

function document(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: "doc-1",
    name: "test-document",
    originalName: "test-document.txt",
    mimeType: "text/plain",
    size: 100,
    contentHash: "hash",
    status: "approved",
    uploadedAt: "2024-01-01",
    effectiveDate: "2024-01-01",
    inspection: {
      wordCount: 20,
      possiblePersonalInfo: false,
      possibleSupersededLanguage: false,
      possibleSecrets: false,
      possiblePromptInjection: false,
      lowTextContent: false,
      notes: [],
    },
    ...overrides,
  };
}

describe("retrieval-core smoke tests (port sanity, not a replacement for the benchmark)", () => {
  it("rankCandidates finds an obviously relevant chunk", () => {
    const doc = document();
    const candidates: RetrievalCandidate[] = [
      { document: doc, chunk: { id: "c1", documentId: doc.id, index: 0, text: "The fire evacuation procedure requires staff to assemble at the front car park." } },
      { document: doc, chunk: { id: "c2", documentId: doc.id, index: 1, text: "Grants are administered under the procurement policy each financial year." } },
    ];
    const hits = rankCandidates("fire evacuation procedure", candidates, 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.id).toBe("c1");
  });

  it("chunkText produces at least one chunk for non-trivial text", () => {
    const chunks = chunkText("doc-1", "This is a short paragraph.\n\nThis is a second paragraph with more content in it.");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe("doc-1");
  });

  it("inspectText flags obvious secrets for quarantine", () => {
    const result = inspectText("api_key=sk-testsecretsecretsecretsecretsecretsecret1234567890");
    expect(result.possibleSecrets).toBe(true);
  });

  it("excerptFor and buildExtractiveAnswer produce query-relevant text", () => {
    const chunk = { id: "c1", documentId: "doc-1", index: 0, text: "Staff must complete the incident report within 24 hours. The report is reviewed by the safety officer." };
    const excerpt = excerptFor("incident report", chunk);
    expect(excerpt.toLowerCase()).toContain("incident report");

    const answer = buildExtractiveAnswer("incident report", [{ document: document(), chunk, score: 5 }]);
    expect(answer.answer).toContain("incident report");
    expect(answer.confidence).toBe("high");
  });

  it("buildExtractiveAnswer declines gracefully with no hits", () => {
    const answer = buildExtractiveAnswer("anything", []);
    expect(answer.answer).toBe("I couldn't find enough support for that in the approved documents.");
    expect(answer.confidence).toBe("low");
  });

  it("encryptBytes/decryptBytes round-trip with an injected key (no ambient key state)", () => {
    const key = Buffer.alloc(32, 7);
    const plain = Buffer.from("participant-specific evidence text");
    const encrypted = encryptBytes(key, plain);
    expect(decryptBytes(key, encrypted).toString()).toBe(plain.toString());
  });

  it("decryptBytes rejects the wrong key", () => {
    const key = Buffer.alloc(32, 7);
    const wrongKey = Buffer.alloc(32, 9);
    const encrypted = encryptBytes(key, Buffer.from("secret"));
    expect(() => decryptBytes(wrongKey, encrypted)).toThrow();
  });

  it("blindIndexTokens is deterministic per key and differs across keys", () => {
    const keyA = Buffer.alloc(32, 1);
    const keyB = Buffer.alloc(32, 2);
    const tokens = ["fire", "evacuation"];
    expect(blindIndexTokens(keyA, tokens)).toEqual(blindIndexTokens(keyA, tokens));
    expect(blindIndexTokens(keyA, tokens)).not.toEqual(blindIndexTokens(keyB, tokens));
  });
});
