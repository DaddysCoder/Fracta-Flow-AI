import { describe, expect, it } from "vitest";
import type { EvidenceChunkRecord, EvidenceHit, StructuredKnowledgeRecord } from "@fracta-flow/evidence-layer";
import { extractAllowedEvidence, extractAllowedEvidenceItem } from "../src/evidenceAllowlist";

/** Wraps a record the way rankEvidence's output shape does, without depending on its scoring/matching behaviour. */
function hitFor(record: StructuredKnowledgeRecord | EvidenceChunkRecord): EvidenceHit {
  return { record, tierIndex: 0, matchedCategories: [], workflowMultiplier: 1, baseScore: 1, finalScore: 1 };
}

function structuredRecord(
  overrides: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id" | "evidenceAuthorityTier">
): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    participantRef: "participant-super-secret-id",
    sourceDocumentId: `doc-${overrides.id}`,
    strategyType: "generic strategy",
    behaviourRisk: "elopement risk near roadways",
    triggerContext: "unstructured transitions",
    earlyWarningSign: "pacing",
    staffAction: "offer a visual countdown before transitions",
    staffActionToAvoid: "physical guiding without warning",
    ...overrides,
  };
}

function chunkRecord(
  overrides: Partial<EvidenceChunkRecord> & Pick<EvidenceChunkRecord, "id" | "evidenceAuthorityTier">
): EvidenceChunkRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    participantRef: null,
    sourceDocumentId: `doc-${overrides.id}`,
    chunk: { id: `${overrides.id}-chunk`, documentId: `doc-${overrides.id}`, index: 0, text: "seatbelt reminder before the vehicle moves" },
    document: {
      id: `doc-${overrides.id}`,
      name: "Transport Safety Procedure",
      originalName: "transport-safety.pdf",
      mimeType: "application/pdf",
      size: 100,
      contentHash: "hash",
      status: "approved",
      uploadedAt: "2024-01-01",
      documentType: "org_procedure",
      inspection: {
        wordCount: 500,
        possiblePersonalInfo: false,
        possibleSupersededLanguage: false,
        possibleSecrets: false,
        possiblePromptInjection: false,
        lowTextContent: false,
        notes: [],
      },
    },
    ...overrides,
  };
}

describe("extractAllowedEvidenceItem", () => {
  it("extracts a structured record's allowlisted fields and never carries participantRef", () => {
    const hit = hitFor(structuredRecord({ id: "s1", evidenceAuthorityTier: "current_participant_plan" }));

    const item = extractAllowedEvidenceItem(hit);
    expect(item).not.toBeNull();
    expect(item?.id).toBe("s1");
    expect(item?.kind).toBe("structured");
    expect(item?.staffAction).toBe("offer a visual countdown before transitions");
    expect(JSON.stringify(item)).not.toContain("participant-super-secret-id");
    expect(JSON.stringify(item)).not.toMatch(/participantRef/);
  });

  it("extracts a chunk record's excerpt and document metadata, dropping sourceDocumentId", () => {
    const hit = hitFor(chunkRecord({ id: "c1", evidenceAuthorityTier: "org_procedure_current" }));

    const item = extractAllowedEvidenceItem(hit);
    expect(item).not.toBeNull();
    expect(item?.kind).toBe("chunk");
    expect(item?.excerpt).toContain("seatbelt reminder");
    expect(item?.documentName).toBe("Transport Safety Procedure");
    expect(JSON.stringify(item)).not.toMatch(/sourceDocumentId/);
  });

  it("drops a record whose approvalStatus is not 'approved', even if the caller claims otherwise", () => {
    const rawHit = {
      record: { ...structuredRecord({ id: "s2", evidenceAuthorityTier: "current_participant_plan" }), approvalStatus: "needs_review" },
    };
    expect(extractAllowedEvidenceItem(rawHit)).toBeNull();
  });

  it("drops a superseded (current: false) record", () => {
    const rawHit = {
      record: { ...structuredRecord({ id: "s3", evidenceAuthorityTier: "current_participant_plan" }), current: false },
    };
    expect(extractAllowedEvidenceItem(rawHit)).toBeNull();
  });

  it("drops a chunk record whose source document is flagged for possible personal info", () => {
    const record = chunkRecord({ id: "c2", evidenceAuthorityTier: "org_procedure_current" });
    record.document.inspection.possiblePersonalInfo = true;
    expect(extractAllowedEvidenceItem({ record })).toBeNull();
  });

  it("drops a chunk record whose source document is flagged for possible prompt injection", () => {
    const record = chunkRecord({ id: "c3", evidenceAuthorityTier: "org_procedure_current" });
    record.document.inspection.possiblePromptInjection = true;
    expect(extractAllowedEvidenceItem({ record })).toBeNull();
  });

  it("returns null for malformed or garbage input rather than throwing", () => {
    expect(extractAllowedEvidenceItem(null)).toBeNull();
    expect(extractAllowedEvidenceItem("not an object")).toBeNull();
    expect(extractAllowedEvidenceItem({})).toBeNull();
    expect(extractAllowedEvidenceItem({ record: { participantRef: "p1", id: "x" } })).toBeNull();
  });

  it("never has a participantRef field on its output type, structurally — a caller cannot get identity through even by injecting one into the raw hit", () => {
    const rawHit = {
      record: structuredRecord({ id: "s4", evidenceAuthorityTier: "current_participant_plan" }),
      // an attacker-controlled hit could add anything else here too
      participantRef: "participant-super-secret-id",
      participantName: "Jamie Doe",
    };
    const item = extractAllowedEvidenceItem(rawHit);
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("participant-super-secret-id");
    expect(serialized).not.toContain("Jamie Doe");
  });
});

describe("extractAllowedEvidence", () => {
  it("filters an array, dropping ungoverned items and keeping the rest", () => {
    const hits = [
      hitFor(structuredRecord({ id: "keep-1", evidenceAuthorityTier: "current_participant_plan" })),
      hitFor({ ...structuredRecord({ id: "drop-1", evidenceAuthorityTier: "current_participant_plan" }), approvalStatus: "needs_review" }),
      hitFor(structuredRecord({ id: "keep-2", evidenceAuthorityTier: "current_participant_plan" })),
    ];

    const extracted = extractAllowedEvidence(hits);
    expect(extracted.map((item) => item.id)).toEqual(["keep-1", "keep-2"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(extractAllowedEvidence(undefined)).toEqual([]);
    expect(extractAllowedEvidence({ not: "an array" })).toEqual([]);
  });

  it("caps the number of items at maxItems", () => {
    const rawHits = Array.from({ length: 20 }, (_, i) => ({
      record: structuredRecord({ id: `s${i}`, evidenceAuthorityTier: "current_participant_plan" }),
    }));
    const extracted = extractAllowedEvidence(rawHits, 5);
    expect(extracted.length).toBe(5);
  });
});
