import type { StrategyTemplate } from "@fracta-flow/strategy-library";
import type { AxisDataMap } from "./axisData";

export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * One bounded generation call. No separate "relevance check" pre-call —
 * that was considered and rejected (see brief). Thin/unusual profile
 * detail is handled by instruction ("use lightly, don't force it to
 * dominate"), not by filtering it out beforehand or gatekeeping it here.
 *
 * Deliberately does NOT take the practitioner's capacity-adaptation note
 * (Step 2 in the brief) as input. Step 2 is explicitly "practitioner
 * judgement, recorded as a note — not an AI call", and Step 3's payload
 * is spelled out as exactly: fixed mechanism, safety boundary, and the
 * declared axes' profile fields — nothing else. The capacity note stays
 * a client-local annotation the practitioner keeps alongside the result,
 * never sent to the model.
 */
export function buildPersonalisationPrompt(template: StrategyTemplate, axisData: AxisDataMap): BuiltPrompt {
  const system = [
    "You personalise the SURFACE and THEME of an already-selected, evidence-based behaviour support strategy for one participant. You never invent or substitute a different technique.",
    "",
    `Fixed mechanism (do not change what this technique does or how it works): ${template.mechanism}`,
    template.safetyBoundary
      ? `Hard safety constraint (never cross this, under any personalisation): ${template.safetyBoundary}`
      : null,
    "",
    "Rules:",
    "- Keep the mechanism above completely intact. Only vary surface details: theme, examples, language, imagery, framing.",
    "- If honoring the profile details below would require changing the mechanism itself, keep the mechanism and personalise what you can within it — never swap in a different technique.",
    "- Use each profile detail proportionately. A single brief or unusual interest should flavour the output lightly, not dominate or force-fit every sentence around it.",
    "- Do not reference or infer anything about the participant beyond the specific field values given below. No names, no diagnoses beyond what's stated, no identifying detail.",
    "- Respond with exactly this format, nothing before or after it:",
    "PERSONALISED_ACTIVITY: <the personalised activity text, written for a participant plan>",
    "KEPT_FIXED: <one line stating which mechanism elements you kept fixed>",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const userLines: string[] = [
    `Technique: ${template.techniqueName}`,
    `Mechanism to keep fixed: ${template.mechanism}`,
  ];

  if (axisData.interests) {
    const { general, strengths, dislikes } = axisData.interests;
    userLines.push("Participant interests (de-identified):");
    if (general.length) userLines.push(`- General interests: ${general.join(", ")}`);
    if (strengths.length) userLines.push(`- Strengths: ${strengths.join(", ")}`);
    if (dislikes.length) userLines.push(`- Dislikes: ${dislikes.join(", ")}`);
  }

  if (axisData.communication_style) {
    const { mode, indicatesNoOrDiscomfort } = axisData.communication_style;
    userLines.push("Participant communication style (de-identified):");
    if (mode.trim()) userLines.push(`- Mode: ${mode.trim()}`);
    if (indicatesNoOrDiscomfort.trim()) userLines.push(`- Indicates no/discomfort by: ${indicatesNoOrDiscomfort.trim()}`);
  }

  userLines.push("Personalise this strategy's surface/theme for this participant now.");

  return { system, user: userLines.join("\n") };
}

export interface ParsedGeneration {
  personalisedActivity: string;
  keptFixedStatement: string;
}

/** Returns null if the model didn't follow the required response format. */
export function parseGenerationResponse(text: string): ParsedGeneration | null {
  const activityMatch = text.match(/PERSONALISED_ACTIVITY:\s*([\s\S]*?)(?:\nKEPT_FIXED:|$)/);
  const keptFixedMatch = text.match(/KEPT_FIXED:\s*([\s\S]*)$/);

  const personalisedActivity = activityMatch?.[1]?.trim();
  const keptFixedStatement = keptFixedMatch?.[1]?.trim();

  if (!personalisedActivity || !keptFixedStatement) return null;
  return { personalisedActivity, keptFixedStatement };
}
