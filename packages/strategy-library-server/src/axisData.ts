import type { PersonalisationAxis } from "@fracta-flow/strategy-library";

/**
 * Axis -> Participant Profile field mapping from the brief. Extend this
 * (and the extraction below) if a new axis is ever added — e.g. a
 * `goals` axis reading from `Participant.goals`.
 */
export interface InterestsAxisData {
  general: string[];
  strengths: string[];
  dislikes: string[];
}

export interface CommunicationStyleAxisData {
  mode: string;
  indicatesNoOrDiscomfort: string;
}

export interface AxisDataMap {
  interests?: InterestsAxisData;
  communication_style?: CommunicationStyleAxisData;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Defense in depth: the client is responsible for only ever sending
 * de-identified field values for the strategy's declared axes (no
 * participant name/ID/etc.), but this server does not trust that. It
 * only ever reads the specific whitelisted subfields for axes the
 * template actually declares in `personalizationAxes` — anything else in
 * the request body's `axisData`, extra fields on a known axis, or an
 * axis the template didn't declare, is silently dropped and never
 * touches the prompt.
 */
export function extractAllowedAxisData(
  rawAxisData: unknown,
  allowedAxes: PersonalisationAxis[]
): AxisDataMap {
  const result: AxisDataMap = {};
  if (typeof rawAxisData !== "object" || rawAxisData === null) return result;
  const raw = rawAxisData as Record<string, unknown>;

  if (allowedAxes.includes("interests") && typeof raw.interests === "object" && raw.interests !== null) {
    const i = raw.interests as Record<string, unknown>;
    result.interests = {
      general: isStringArray(i.general) ? i.general : [],
      strengths: isStringArray(i.strengths) ? i.strengths : [],
      dislikes: isStringArray(i.dislikes) ? i.dislikes : [],
    };
  }

  if (
    allowedAxes.includes("communication_style") &&
    typeof raw.communication_style === "object" &&
    raw.communication_style !== null
  ) {
    const c = raw.communication_style as Record<string, unknown>;
    result.communication_style = {
      mode: typeof c.mode === "string" ? c.mode : "",
      indicatesNoOrDiscomfort: typeof c.indicatesNoOrDiscomfort === "string" ? c.indicatesNoOrDiscomfort : "",
    };
  }

  return result;
}

/** True if every requested axis ended up with no usable content at all. */
export function isEntirelyEmpty(axisData: AxisDataMap): boolean {
  const hasInterests =
    axisData.interests &&
    (axisData.interests.general.length > 0 ||
      axisData.interests.strengths.length > 0 ||
      axisData.interests.dislikes.length > 0);
  const hasCommunication =
    axisData.communication_style &&
    (axisData.communication_style.mode.trim() !== "" ||
      axisData.communication_style.indicatesNoOrDiscomfort.trim() !== "");
  return !hasInterests && !hasCommunication;
}
