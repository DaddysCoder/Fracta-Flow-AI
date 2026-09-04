/**
 * Server-side logging so refusal patterns and groundedness flags can be
 * tracked — never logs evidence content or drafted text, only shape:
 * evidence ids/tiers involved and counts. Same intent as
 * strategy-library-server/src/logger.ts.
 */
export interface RefusalLogEntry {
  evidenceIds: string[];
  httpStatus: number | null;
}

export function logRefusal(entry: RefusalLogEntry): void {
  console.warn(
    JSON.stringify({
      event: "drafting_refusal",
      timestamp: new Date().toISOString(),
      evidenceIds: entry.evidenceIds,
      httpStatus: entry.httpStatus,
    })
  );
}

export interface ErrorLogEntry {
  evidenceIds: string[];
  outcome: "network_error" | "api_error";
  message: string;
  status: number | null;
}

export function logGenerationError(entry: ErrorLogEntry): void {
  console.error(
    JSON.stringify({
      event: "drafting_error",
      timestamp: new Date().toISOString(),
      evidenceIds: entry.evidenceIds,
      outcome: entry.outcome,
      message: entry.message,
      status: entry.status,
    })
  );
}

export interface GroundednessWarningEntry {
  evidenceIds: string[];
  invalidEvidenceIds: string[];
  suspiciousTermCount: number;
}

export function logGroundednessWarning(entry: GroundednessWarningEntry): void {
  console.warn(
    JSON.stringify({
      event: "drafting_groundedness_warning",
      timestamp: new Date().toISOString(),
      evidenceIds: entry.evidenceIds,
      invalidEvidenceIds: entry.invalidEvidenceIds,
      suspiciousTermCount: entry.suspiciousTermCount,
    })
  );
}
