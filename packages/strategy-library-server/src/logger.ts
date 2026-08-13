/**
 * Server-side logging so refusal patterns can be tracked and raised with
 * Anthropic — never logs profile field values or anything participant-
 * identifying, only the strategy/axis shape of the request.
 */
export interface RefusalLogEntry {
  strategyTemplateId: string;
  axesRequested: string[];
  httpStatus: number | null;
}

export function logRefusal(entry: RefusalLogEntry): void {
  console.warn(
    JSON.stringify({
      event: "personalisation_refusal",
      timestamp: new Date().toISOString(),
      strategyTemplateId: entry.strategyTemplateId,
      axesRequested: entry.axesRequested,
      httpStatus: entry.httpStatus,
    })
  );
}

export interface ErrorLogEntry {
  strategyTemplateId: string;
  outcome: "network_error" | "api_error";
  message: string;
  status: number | null;
}

export function logGenerationError(entry: ErrorLogEntry): void {
  console.error(
    JSON.stringify({
      event: "personalisation_error",
      timestamp: new Date().toISOString(),
      strategyTemplateId: entry.strategyTemplateId,
      outcome: entry.outcome,
      message: entry.message,
      status: entry.status,
    })
  );
}
