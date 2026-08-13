import { getPersonalisationContext, type Participant } from "@fracta-flow/participant-profile/core";
import type { PersonalisationAxis, StrategyTemplate } from "@fracta-flow/strategy-library/core";

/**
 * Axis -> Participant Profile field mapping from the Personalization
 * Architecture brief. Extend this (and the server's mirror in
 * strategy-library-server/src/axisData.ts) together if a new axis is
 * ever added — e.g. a `goals` axis reading from `Participant.goals`.
 *
 * Only ever includes fields for axes the template declares — this is
 * the client-side half of "no participant-identifying data ever leaves
 * the client, only de-identified profile field values relevant to the
 * declared personalisation axes". The server re-derives and re-checks
 * the same allowlist itself rather than trusting this (defense in
 * depth), but this is what keeps the request payload minimal in the
 * first place.
 */
export interface AxisPayload {
  interests?: { general: string[]; strengths: string[]; dislikes: string[] };
  communication_style?: { mode: string; indicatesNoOrDiscomfort: string };
}

export function buildAxisPayload(template: StrategyTemplate, participant: Participant): AxisPayload {
  const context = getPersonalisationContext(participant);
  const payload: AxisPayload = {};

  for (const axis of template.personalizationAxes as PersonalisationAxis[]) {
    if (axis === "interests") {
      payload.interests = {
        general: context.interests.general,
        strengths: context.interests.strengths,
        dislikes: context.interests.dislikes,
      };
    } else if (axis === "communication_style") {
      payload.communication_style = {
        mode: context.communication.mode,
        indicatesNoOrDiscomfort: context.communication.indicatesNoOrDiscomfort,
      };
    }
  }

  return payload;
}
