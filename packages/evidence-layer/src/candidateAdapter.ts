import type { Chunk, KnowledgeDocument, RetrievalCandidate } from "@fracta-flow/retrieval-core";
import { isEvidenceChunkRecord, isStructuredKnowledgeRecord, type EvidenceRecord } from "./types";

/**
 * Both evidence record shapes are scored through the exact same
 * retrieval-core `rankCandidates` engine, so tier/workflow weighting (in
 * ranking.ts) is the only thing that behaves differently between them — the
 * base relevance scoring stays one code path, not two. A
 * StructuredKnowledgeRecord has no chunked source text, so it's wrapped in a
 * synthetic single-chunk "document" built from its own fields; an
 * EvidenceChunkRecord already carries a real chunk/document pair from
 * ingestion and is passed through unchanged.
 */
function structuredRecordText(record: Extract<EvidenceRecord, { strategyType: string }>): string {
  return [
    record.strategyType,
    record.behaviourRisk,
    record.triggerContext,
    record.earlyWarningSign,
    record.staffAction,
    record.staffActionToAvoid,
  ]
    .filter(Boolean)
    .join(". ");
}

export function toRetrievalCandidate(record: EvidenceRecord): RetrievalCandidate {
  if (isEvidenceChunkRecord(record)) {
    return { chunk: record.chunk, document: record.document };
  }
  if (isStructuredKnowledgeRecord(record)) {
    const chunk: Chunk = {
      id: record.id,
      documentId: record.sourceDocumentId,
      index: 0,
      text: structuredRecordText(record),
    };
    const document: KnowledgeDocument = {
      id: record.sourceDocumentId,
      name: record.strategyType,
      originalName: record.strategyType,
      mimeType: "text/plain",
      size: chunk.text.length,
      contentHash: record.id,
      status: record.approvalStatus,
      uploadedAt: record.effectiveDate,
      effectiveDate: record.effectiveDate,
      inspection: {
        wordCount: chunk.text.split(/\s+/).filter(Boolean).length,
        possiblePersonalInfo: false,
        possibleSupersededLanguage: !record.current,
        possibleSecrets: false,
        possiblePromptInjection: false,
        lowTextContent: false,
        notes: [],
      },
    };
    return { chunk, document };
  }
  throw new Error("Unrecognised evidence record shape.");
}
