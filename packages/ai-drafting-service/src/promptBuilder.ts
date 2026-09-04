import type { AllowedEvidenceItem } from "./evidenceAllowlist";

export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * One bounded generation call, mirroring strategy-library-server's
 * `buildPersonalisationPrompt`: explicit "preserve this, never invent
 * that" framing in the system prompt, a forced output format, and the
 * user turn built only from the allowlisted evidence items — never from
 * raw request fields.
 *
 * `instruction` is the practitioner's free-text drafting request (e.g.
 * "draft a staff briefing combining these strategies", "explain why this
 * strategy applies here"). It is never a substitute for evidence — the
 * model is told repeatedly that facts must come only from the evidence
 * list, and the forced `EVIDENCE_USED` line lets the caller (and the
 * groundedness guard in guard.ts) check which evidence the draft actually
 * relied on.
 */
export function buildDraftingPrompt(instruction: string, evidence: AllowedEvidenceItem[]): BuiltPrompt {
  const system = [
    "You draft PBS (Positive Behaviour Support) practitioner documentation from a fixed, pre-selected set of approved evidence items. You never invent, infer, or add a clinical claim, behaviour, risk, trigger, or staff action that is not present in the evidence below.",
    "",
    "Rules:",
    "- Use only the evidence items listed below. Every factual statement in your draft must be traceable to at least one evidence item by its id.",
    "- Never invent new evidence, statistics, diagnoses, medication information, or risk assessments. If the evidence given is insufficient to complete the request, say so explicitly instead of filling the gap.",
    "- You were not given any participant name, ID, date of birth, or other identifying information. Do not invent or infer any — write generically (\"the participant\") if the drafting request implies a person.",
    "- Preserve the exact meaning of staff actions, triggers, early warning signs, and safety information from the evidence. You may rephrase for clarity or combine evidence items, but never change what an action, risk, or trigger means.",
    "- Respond with exactly this format, nothing before or after it:",
    "DRAFT: <the drafted text>",
    "EVIDENCE_USED: <comma-separated ids of the evidence items you actually relied on, or 'none' if the draft could not be grounded in the evidence>",
  ].join("\n");

  const userLines: string[] = [`Drafting request: ${instruction}`, "", "Approved evidence (use only this):"];

  evidence.forEach((item, index) => {
    userLines.push(`Evidence [${item.id}] (tier: ${item.evidenceAuthorityTier}):`);
    if (item.kind === "structured") {
      userLines.push(`- Strategy type: ${item.strategyType}`);
      userLines.push(`- Behaviour/risk: ${item.behaviourRisk}`);
      userLines.push(`- Trigger context: ${item.triggerContext}`);
      if (item.earlyWarningSign) userLines.push(`- Early warning sign: ${item.earlyWarningSign}`);
      userLines.push(`- Staff action: ${item.staffAction}`);
      if (item.staffActionToAvoid) userLines.push(`- Staff action to avoid: ${item.staffActionToAvoid}`);
    } else {
      if (item.documentName) userLines.push(`- Source: ${item.documentName}${item.documentType ? ` (${item.documentType})` : ""}`);
      userLines.push(`- Excerpt: ${item.excerpt}`);
    }
    if (index < evidence.length - 1) userLines.push("");
  });

  userLines.push("", "Draft the requested content now, grounded only in the evidence above.");

  return { system, user: userLines.join("\n") };
}

export interface ParsedDraft {
  draft: string;
  evidenceUsedIds: string[];
}

/** Returns null if the model didn't follow the required response format. */
export function parseDraftResponse(text: string): ParsedDraft | null {
  const draftMatch = text.match(/DRAFT:\s*([\s\S]*?)(?:\nEVIDENCE_USED:|$)/);
  const evidenceMatch = text.match(/EVIDENCE_USED:\s*([\s\S]*)$/);

  const draft = draftMatch?.[1]?.trim();
  const evidenceUsedRaw = evidenceMatch?.[1]?.trim();

  if (!draft || !evidenceUsedRaw) return null;

  const evidenceUsedIds =
    evidenceUsedRaw.toLowerCase() === "none"
      ? []
      : evidenceUsedRaw
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0);

  return { draft, evidenceUsedIds };
}
