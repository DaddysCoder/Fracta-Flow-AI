const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from", "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where", "which", "who", "with", "we", "our", "do", "does", "must", "should",
]);

// NDIS/PBS domain acronyms.
const NDIS_ACRONYMS = new Set(["rp", "ot", "fba", "fca", "bsp", "pbs", "ndis", "ndia"]);

// Australian Government / public sector acronyms.
const GOVERNMENT_ACRONYMS = new Set([
  "aps", "ags", "anao", "apsc", "cpr", "cprs", "pgpa", "foi", "oaic", "pspf", "ism", "dta",
  "rft", "rfq", "eoi", "rfi", "sme", "kpi", "mou", "sla",
]);

const DOMAIN_ACRONYMS = new Set([...NDIS_ACRONYMS, ...GOVERNMENT_ACRONYMS]);

// NDIS/PBS domain token expansions.
const NDIS_TOKEN_EXPANSIONS: Record<string, string[]> = {
  onboarding: ["commencement", "intake", "referral", "start"],
  commencement: ["onboarding", "intake", "referral", "start"],
  intake: ["onboarding", "commencement", "referral"],
  referral: ["intake", "onboarding", "commencement"],
  template: ["form"],
  form: ["template"],
  agreement: ["contract", "consent"],
  contract: ["agreement"],
  incident: ["report", "notify", "notification"],
  notification: ["notify", "report", "incident"],
  consent: ["permission", "authorisation", "authorization", "agreement"],
  permission: ["consent", "authorisation", "authorization"],
  authorisation: ["authorization", "consent", "permission"],
  authorization: ["authorisation", "consent", "permission"],
  procedure: ["process", "steps", "workflow"],
  process: ["procedure", "steps", "workflow"],
  workflow: ["procedure", "process", "steps"],
  policy: ["procedure", "requirement", "guideline"],
  guideline: ["policy", "requirement"],
  staff: ["worker", "employee", "practitioner", "team"],
  worker: ["staff", "employee", "practitioner"],
  practitioner: ["staff", "worker", "employee"],
  behaviour: ["behavior"],
  behavior: ["behaviour"],
  restrictive: ["restriction", "restraint", "seclusion"],
  restriction: ["restrictive", "restraint", "seclusion"],
  restraint: ["restrictive", "restriction", "seclusion"],
  breach: ["exposure", "exposed", "privacy"],
  exposure: ["breach", "exposed", "privacy"],
  exposed: ["breach", "exposure", "privacy"],
  complaint: ["grievance", "feedback", "dissatisfied", "unhappy"],
  grievance: ["complaint", "feedback", "dissatisfied"],
  dissatisfied: ["complaint", "grievance", "feedback", "unhappy"],
  unhappy: ["complaint", "grievance", "feedback", "dissatisfied"],
  backup: ["restore", "recovery"],
  restore: ["backup", "recover", "recovery"],
  recover: ["restore", "backup", "recovery"],
  recovery: ["restore", "backup", "recover"],
  hazard: ["risk", "safety"],
  safety: ["hazard", "risk"],
};

// Government / Australian public sector token expansions.
const GOVERNMENT_TOKEN_EXPANSIONS: Record<string, string[]> = {
  agency: ["department", "entity", "commonwealth"],
  department: ["agency", "entity", "commonwealth"],
  procurement: ["tender", "purchasing", "sourcing", "cpr", "cprs"],
  tender: ["procurement", "rft", "rfq", "eoi", "rfi"],
  contract: ["agreement", "procurement"],
  delegate: ["delegation", "authoriser", "approver"],
  brief: ["briefing", "ministerial"],
  ministerial: ["brief", "briefing", "minister"],
  policy: ["procedure", "requirement", "guideline", "guidance"],
  procedure: ["process", "steps", "workflow", "guidance"],
  guidance: ["policy", "procedure", "guideline"],
  governance: ["assurance", "oversight", "compliance"],
  assurance: ["governance", "compliance", "audit"],
  compliance: ["governance", "assurance", "audit"],
  record: ["records", "recordkeeping", "documentation"],
  records: ["record", "recordkeeping", "documentation"],
  privacy: ["personal", "information", "confidentiality"],
  information: ["security", "classification"],
  security: ["classification", "protective", "information"],
  classification: ["official", "protected", "security", "pspf"],
  official: ["classification", "protected"],
  protected: ["classification", "official"],
  foi: ["freedom", "information", "disclosure"],
  pgpa: ["governance", "accountability", "performance"],
  risk: ["hazard", "safety", "assurance"],
  audit: ["assurance", "compliance", "anao"],
  stakeholder: ["consultation", "engagement"],
  consultation: ["stakeholder", "engagement"],
  service: ["delivery", "program"],
  delivery: ["service", "program"],
  program: ["service", "delivery", "grant"],
  grant: ["grants", "funding", "agreement"],
  grants: ["grant", "funding", "agreement"],
  decision: ["approval", "determination"],
  approval: ["decision", "delegate", "delegation", "sign", "signoff"],
  instrument: ["legislation", "delegation"],
  legislation: ["instrument", "act", "regulation"],
  commonwealth: ["australian", "government", "federal"],
  government: ["commonwealth", "public", "sector"],
  cabinet: ["confidential", "classification"],
};

// All token expansions, merged additively by domain (arrays combined, not overwritten, when a
// key appears in more than one domain).
function mergeTokenExpansions(...groups: Record<string, string[]>[]) {
  const merged: Record<string, string[]> = {};
  for (const group of groups) {
    for (const [key, values] of Object.entries(group)) {
      merged[key] = [...new Set([...(merged[key] ?? []), ...values])];
    }
  }
  return merged;
}

const TOKEN_EXPANSIONS: Record<string, string[]> = mergeTokenExpansions(NDIS_TOKEN_EXPANSIONS, GOVERNMENT_TOKEN_EXPANSIONS);

type ConceptDefinition = {
  aliases: readonly string[];
  signatures: readonly (readonly string[])[];
  triggers?: readonly (readonly string[])[];
};

// NDIS/PBS domain concept groups.
const NDIS_CONCEPTS: readonly ConceptDefinition[] = [
  { aliases: ["fba", "functional behaviour assessment", "functional behavior assessment", "functional behavioural assessment", "functional behavioral assessment"], signatures: [["fba"], ["behaviour", "assessment"], ["behavior", "assessment"], ["behavioural", "assessment"], ["behavioral", "assessment"]], triggers: [["behaviour", "happen"], ["behavior", "happen"], ["behaviour", "function"], ["behavior", "function"], ["behaviour", "cause"], ["behavior", "cause"]] },
  { aliases: ["fca", "functional capacity assessment"], signatures: [["fca"], ["capacity", "assessment"]] },
  { aliases: ["bsp", "behaviour support plan", "behavior support plan", "positive behaviour support plan", "positive behavior support plan"], signatures: [["bsp"], ["behaviour", "support", "plan"], ["behavior", "support", "plan"]] },
  { aliases: ["pbs", "positive behaviour support", "positive behavior support"], signatures: [["pbs"], ["positive", "behaviour", "support"], ["positive", "behavior", "support"]] },
  { aliases: ["rp", "restrictive practice", "restrictive practices"], signatures: [["rp"], ["restrictive", "practice"], ["restriction"], ["restraint"], ["seclusion"]] },
  { aliases: ["ndis", "national disability insurance scheme"], signatures: [["ndis"], ["insurance", "scheme"]] },
  { aliases: ["ndia", "national disability insurance agency"], signatures: [["ndia"], ["insurance", "agency"]] },
  { aliases: ["data breach", "privacy breach", "information breach", "personal information breach"], signatures: [["data", "breach"], ["privacy", "breach"], ["information", "breach"], ["exposure"]] },
  { aliases: ["implementing provider", "implementation provider", "implementer"], signatures: [["implementer"], ["implementing", "provider"], ["implementation", "provider"]] },
  { aliases: ["complaint", "service complaint", "grievance", "customer feedback"], signatures: [["complaint"], ["grievance"], ["feedback"]], triggers: [["unhappy", "service"], ["dissatisfied", "service"]] },
  { aliases: ["backup", "restore", "disaster recovery", "data recovery"], signatures: [["backup"], ["restore"], ["recovery"]], triggers: [["data", "loss"], ["system", "recover"], ["system", "recovery"]] },
  { aliases: ["hazard", "risk assessment", "workplace safety", "work health safety"], signatures: [["hazard"], ["risk"], ["safety"]], triggers: [["workplace", "hazard"], ["workplace", "risk"]] },
];

// Government / Australian public sector concept groups.
const GOVERNMENT_CONCEPTS: readonly ConceptDefinition[] = [
  { aliases: ["aps", "australian public service"], signatures: [["aps"], ["public", "service"]] },
  { aliases: ["cpr", "cprs", "commonwealth procurement rules"], signatures: [["cpr"], ["cprs"], ["procurement", "rules"], ["commonwealth", "procurement"]] },
  { aliases: ["pgpa", "pgpa act", "pgpa framework", "public governance performance and accountability act"], signatures: [["pgpa"], ["governance", "performance", "accountability"]] },
  { aliases: ["foi", "freedom of information"], signatures: [["foi"], ["freedom", "information"]] },
  { aliases: ["pspf", "protective security policy framework"], signatures: [["pspf"], ["protective", "security", "policy"]] },
  { aliases: ["ism", "information security manual"], signatures: [["ism"], ["information", "security", "manual"]] },
  { aliases: ["procurement", "tendering", "tender", "rft", "rfq", "eoi", "rfi"], signatures: [["procurement"], ["tender"], ["rft"], ["rfq"], ["eoi"], ["rfi"]], triggers: [["go", "tender"], ["before", "tender"], ["purchase", "approve"], ["approve", "purchase"]] },
  { aliases: ["delegation", "delegated authority", "financial delegation"], signatures: [["delegation"], ["delegated", "authority"], ["delegate"]], triggers: [["who", "approve"], ["sign", "off"], ["approve", "purchase"]] },
  { aliases: ["government records", "recordkeeping", "records management"], signatures: [["record"], ["records"], ["recordkeeping"]], triggers: [["keep", "record"], ["retain", "record"], ["how", "long", "record"]] },
  { aliases: ["government privacy", "personal information", "privacy breach"], signatures: [["privacy"], ["personal", "information"]], triggers: [["personal", "information", "exposed"], ["personal", "information", "expose"], ["information", "exposed"]] },
  { aliases: ["policy", "procedure", "guidance"], signatures: [["policy"], ["procedure"], ["guidance"]] },
  { aliases: ["ministerial", "executive briefing", "brief"], signatures: [["ministerial"], ["brief"], ["briefing"]] },
  { aliases: ["governance", "assurance"], signatures: [["governance"], ["assurance"]] },
  { aliases: ["grant administration", "grants administration", "grant agreement"], signatures: [["grant"], ["grants"], ["grant", "agreement"]], triggers: [["sign", "grant"], ["approve", "grant"]] },
];

// All concept groups, merged additively by domain.
const CONCEPTS: readonly ConceptDefinition[] = [...NDIS_CONCEPTS, ...GOVERNMENT_CONCEPTS];

function normaliseText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsPhrase(normalised: string, phrase: string) {
  const target = normaliseText(phrase);
  return (` ${normalised} `).includes(` ${target} `);
}

export function stemToken(token: string) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 5 && /(sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function baseTokens(text: string) {
  return normaliseText(text).split(/\s+/).filter(Boolean).filter((token) => (token.length > 2 || DOMAIN_ACRONYMS.has(token)) && !STOP.has(token)).map(stemToken);
}

function expansionsForToken(token: string) {
  const expanded: string[] = [];
  for (const [source, aliases] of Object.entries(TOKEN_EXPANSIONS)) {
    if (baseTokens(source)[0] !== token) continue;
    for (const alias of aliases) expanded.push(...baseTokens(alias));
  }
  return expanded;
}

function triggerMatches(queryTokens: Set<string>, trigger: readonly string[]) {
  const required = trigger.flatMap((part) => baseTokens(part));
  return required.length > 0 && required.every((token) => queryTokens.has(token));
}

export function queryConceptGroups(query: string) {
  const normalisedQuery = normaliseText(query);
  const tokenSet = new Set(baseTokens(query));
  return CONCEPTS.filter((concept) => concept.aliases.some((alias) => containsPhrase(normalisedQuery, alias)) || (concept.triggers ?? []).some((trigger) => triggerMatches(tokenSet, trigger))).map((concept) => ({
    tokens: [...new Set(concept.aliases.flatMap((alias) => baseTokens(alias)))],
    signatures: concept.signatures.map((signature) => [...new Set(signature.flatMap((part) => baseTokens(part)))])
  }));
}

export function queryTokens(query: string) {
  const original = baseTokens(query);
  const expanded = [...original];
  for (const token of original) expanded.push(...expansionsForToken(token));
  for (const concept of queryConceptGroups(query)) expanded.push(...concept.tokens);
  return [...new Set(expanded)];
}
