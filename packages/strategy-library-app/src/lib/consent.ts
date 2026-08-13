const CONSENT_KEY = "fracta-flow.strategy-library.consent-ack.v1";

export function hasAcknowledgedConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function acknowledgeConsent(): void {
  localStorage.setItem(CONSENT_KEY, "true");
}
