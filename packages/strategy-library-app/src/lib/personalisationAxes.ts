import * as ParticipantProfileCore from "@fracta-flow/participant-profile/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import type { PersonalisationAxis } from "@fracta-flow/strategy-library/core";

// See components/ParticipantPicker.tsx for why this is a namespace
// import rather than a named import.
const { getPersonalisationContext } = ParticipantProfileCore;

/**
 * Per the brief: which declared axis actually gets used for a given
 * participant is a data-availability check (does this field have real
 * content, yes/no) — not a judgement call. This is that check.
 */
export function hasAxisData(participant: Participant, axis: PersonalisationAxis): boolean {
  const context = getPersonalisationContext(participant);
  switch (axis) {
    case "interests":
      return (
        context.interests.general.length > 0 ||
        context.interests.strengths.length > 0 ||
        context.interests.dislikes.length > 0
      );
    case "communication_style":
      return context.communication.mode.trim() !== "" || context.communication.indicatesNoOrDiscomfort.trim() !== "";
    default:
      return false;
  }
}

export const AXIS_LABELS: Record<PersonalisationAxis, string> = {
  interests: "Interests",
  communication_style: "Communication style",
};
