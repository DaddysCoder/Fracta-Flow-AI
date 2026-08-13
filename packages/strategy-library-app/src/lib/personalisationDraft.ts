/**
 * Client-local draft persistence so a failed or refused personalisation
 * call never forces re-entry: "The practitioner's typed profile answers
 * and selected strategy must persist client-side (or be recoverable)
 * regardless of which of the above occurs." Written on every change, not
 * just on submit, so even a page reload mid-flow recovers it.
 */
export interface PersonalisationDraft {
  capacityAdaptationNote: string;
  personalisedActivity: string;
  rationale: string;
  authoredBy: string;
}

function draftKey(participantId: string, templateId: string): string {
  return `fracta-flow.strategy-library.draft.${participantId}.${templateId}`;
}

export function loadDraft(participantId: string, templateId: string): PersonalisationDraft {
  const empty: PersonalisationDraft = {
    capacityAdaptationNote: "",
    personalisedActivity: "",
    rationale: "",
    authoredBy: "",
  };
  try {
    const raw = localStorage.getItem(draftKey(participantId, templateId));
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function saveDraft(participantId: string, templateId: string, draft: PersonalisationDraft): void {
  try {
    localStorage.setItem(draftKey(participantId, templateId), JSON.stringify(draft));
  } catch {
    // Best-effort — a full localStorage or private-browsing block
    // shouldn't crash the flow, it just loses the safety net.
  }
}

export function clearDraft(participantId: string, templateId: string): void {
  try {
    localStorage.removeItem(draftKey(participantId, templateId));
  } catch {
    // ignore
  }
}
