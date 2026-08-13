/**
 * Both output formats derive from the same generation call's content —
 * this is a client-side/template transformation only, never a second API
 * call, per the brief.
 */
export interface FormatInput {
  techniqueName: string;
  personalisedActivity: string;
  keptFixedStatement?: string;
  citations: string[];
}

export function formatForPlan(input: FormatInput): string {
  const lines = [`Strategy: ${input.techniqueName}`, "", input.personalisedActivity];
  if (input.citations.length > 0) {
    lines.push("", `Source: ${input.citations.join("; ")}`);
  }
  return lines.join("\n");
}

export function formatForSessionLog(input: FormatInput): string {
  const timestamp = new Date().toLocaleDateString();
  const lines = [
    `${timestamp} — ${input.techniqueName}`,
    input.personalisedActivity,
  ];
  if (input.keptFixedStatement) {
    lines.push(`(${input.keptFixedStatement})`);
  }
  return lines.join("\n");
}
