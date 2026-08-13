import type { PersonalisationRecord, StrategySource, StrategyTemplate } from "./types";

/**
 * Assembles a plan-ready text block from a PersonalisationRecord and the
 * exact StrategyTemplate version it was pinned against — matches the FBA
 * tool's DocumentationExport pattern: this assembles practitioner-authored
 * content into a fixed format, it never generates or edits that content.
 *
 * `template` must be the version-pinned template the record was created
 * against (fetch by `record.strategyTemplateId` and confirm
 * `template.version === record.templateVersionUsed` at the call site if a
 * newer template version may have since landed) — this function does not
 * reconstruct historical versions on its own.
 */
export function assembleExportText(
  record: PersonalisationRecord,
  template: StrategyTemplate,
  sources: StrategySource[]
): string {
  const lines: string[] = [];

  lines.push(`Technique: ${template.techniqueName}`);
  lines.push(`Status: ${record.status}`);
  lines.push("");
  lines.push("Personalised activity:");
  lines.push(record.personalisedActivity);
  lines.push("");
  lines.push("Rationale:");
  lines.push(record.rationale);

  if (template.safetyBoundary) {
    lines.push("");
    lines.push(`Safety boundary (never crossed): ${template.safetyBoundary}`);
  }

  if (template.version !== record.templateVersionUsed) {
    lines.push("");
    lines.push(
      `Note: this record was authored against template version ${record.templateVersionUsed}; the current template is version ${template.version}. Review before relying on the evidence summary below.`
    );
  }

  lines.push("");
  lines.push(`Evidence tier: ${template.evidenceTier}`);
  lines.push(`Evidence summary: ${template.evidenceSummary}`);

  if (sources.length > 0) {
    lines.push("");
    lines.push("Sources:");
    for (const source of sources) {
      const citation = `${source.authors} (${source.publicationYear}). ${source.title}.`;
      lines.push(source.urlOrDoi ? `- ${citation} ${source.urlOrDoi}` : `- ${citation}`);
    }
  }

  lines.push("");
  lines.push(`Authored by: ${record.authoredBy} on ${record.authoredAt}`);

  return lines.join("\n");
}
