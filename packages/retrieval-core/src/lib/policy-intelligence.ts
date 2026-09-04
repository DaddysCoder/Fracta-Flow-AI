import { createHash } from "node:crypto";
import type { RetrievalHit } from "./types";

export type PolicyModality = "must" | "must-not" | "shall" | "shall-not" | "required" | "mandatory" | "scheduled" | "should" | "should-not" | "may" | "may-not";

export type PolicyFact = {
  id: string;
  documentId: string;
  documentName: string;
  chunkId: string;
  evidence: string;
  actor?: string;
  action?: string;
  subject?: string;
  topic?: string;
  modality: PolicyModality;
  timeframe?: string;
  recurrence?: string;
  numericThreshold?: string;
  effectiveDate?: string;
  documentType?: string;
  authority?: string;
  sourceKind?: "company_upload" | "regulatory";
  sourceUrl?: string;
  confidence: "high" | "medium";
  possiblySuperseded: boolean;
};

export type PolicyRelation = {
  kind: "same_rule" | "likely_same_rule" | "possible_conflict" | "unrelated";
  factIds: [string, string];
  differences: Array<"timeframe" | "modality" | "actor" | "numeric_threshold">;
  confidence: "high" | "medium";
};

export type UnresolvedPolicyEvidence = {
  documentId: string;
  chunkId: string;
  evidence: string;
  reason: "ambiguous_modality";
};

export type PolicyInsight = {
  factId: string;
  corroboratingFactIds: string[];
  possibleConflicts: Array<{ factId: string; differences: PolicyRelation["differences"] }>;
};

export type PolicyIntelligenceResult = {
  facts: PolicyFact[];
  relations: Array<Omit<PolicyRelation, "kind"> & { kind: Exclude<PolicyRelation["kind"], "unrelated"> }>;
  insights: PolicyInsight[];
  unresolved: UnresolvedPolicyEvidence[];
  notice: string;
};

const ROLE_WORDS = new Set(["authority", "committee", "contractor", "delegate", "department", "employee", "manager", "officer", "official", "owner", "person", "personnel", "staff", "team", "user", "worker"]);
const TOKEN_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "can", "do", "does", "for", "from", "have", "how", "in", "into", "is", "it", "must", "no", "not", "of", "on", "or", "policy", "procedure", "requirement", "rule", "shall", "should", "the", "their", "this", "through", "to", "what", "when", "where", "which", "who", "will", "with", "within"]);
const WORD_NUMBERS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };

function stableId(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("base64url").slice(0, 24);
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentences(text: string) {
  return text.replace(/\r/g, "").split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map(cleanSentence)
    .filter((sentence) => sentence.split(/\s+/).length >= 3 && /[.!?]$/.test(sentence));
}

function stem(value: string) {
  const lemma: Record<string, string> = {
    employees: "staff", employee: "staff", personnel: "staff", workers: "staff", worker: "staff",
    approves: "approve", approved: "approve", approving: "approve", approval: "approve",
    requires: "require", required: "require", requiring: "require",
    reports: "report", reported: "report", reporting: "report", notify: "report", notifies: "report", notified: "report", notification: "report",
    records: "record", recorded: "record", recording: "record", stores: "store", stored: "store", storing: "store",
    reviews: "review", reviewed: "review", reviewing: "review", holds: "hold", holding: "hold",
    available: "available", availability: "available",
  };
  if (lemma[value]) return lemma[value];
  let token = value;
  if (token.length > 5 && token.endsWith("ies")) token = `${token.slice(0, -3)}y`;
  else if (token.length > 5 && token.endsWith("ing")) token = token.slice(0, -3);
  else if (token.length > 4 && token.endsWith("ed")) token = token.slice(0, -2);
  else if (token.length > 4 && /(?:ch|sh|ss|x|z)es$/.test(token)) token = token.slice(0, -2);
  else if (token.length > 3 && token.endsWith("s")) token = token.slice(0, -1);
  if (token === "notify" || token === "notification") return "report";
  if (token === "employee" || token === "personnel" || token === "worker") return "staff";
  return token;
}

function normalizedTokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").trim().split(/\s+/)
    .filter(Boolean).map(stem).filter((token) => !TOKEN_STOP_WORDS.has(token));
}

function normalizeActor(value: string | undefined) {
  if (!value) return undefined;
  const head = value.replace(/,\s*$/, "").split(/\b(?:who|that|responsible|involved|holding)\b/i)[0];
  const tokens = normalizedTokens(head).filter((token) => token !== "any" && token !== "all" && token !== "only");
  return tokens.length ? [...new Set(tokens)].sort().join(" ") : undefined;
}

function looksLikeResponsibleRole(value: string) {
  return normalizedTokens(value).some((token) => ROLE_WORDS.has(token) || token === "staff" || /(?:or|er|ist|ian|ee|ant|ent)$/.test(token));
}

function findTimeframe(sentence: string) {
  const patterns = [
    /\bno later than\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:business\s+)?(?:hours?|days?|weeks?|months?)(?:\s+after\s+[^,.;]+)?/i,
    /\bwithin\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:business\s+)?(?:hours?|days?|weeks?|months?)(?:\s+after\s+[^,.;]+)?/i,
    /\b(?:before|after)\s+[^,.;]+/i,
    /\b(?:at least once (?:every|per)\s+[^,.;]+|every\s+(?:business\s+)?(?:day|week|month|quarter|year)|annually|quarterly|monthly|weekly|daily)\b/i,
    /\bimmediately\b/i,
  ];
  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (match) return match[0].trim();
  }
  return undefined;
}

function findRecurrence(timeframe: string | undefined) {
  return timeframe && /\b(?:every|per|annually|quarterly|monthly|weekly|daily)\b/i.test(timeframe) ? timeframe : undefined;
}

function findNumericThreshold(sentence: string, timeframe: string | undefined) {
  const match = (timeframe ? sentence.replace(timeframe, " ") : sentence).match(/\b(?:at least|more than|over|less than|fewer than|no more than|up to)\s+\$?\d+(?:\.\d+)?(?:%|\s+[a-z]+)?\b/i);
  if (!match || /\b(?:hours?|days?|weeks?|months?|years?|once)\b/i.test(match[0])) return undefined;
  return match[0].trim();
}

function removeTimeframe(value: string, timeframe: string | undefined) {
  const without = timeframe ? value.replace(timeframe, " ") : value;
  return without.replace(/\s+/g, " ").replace(/[ ,;:.!?]+$/, "").trim();
}

function topicFromAction(action: string | undefined, subject: string | undefined) {
  if (subject) return subject;
  if (!action) return undefined;
  const words = action.split(/\s+/);
  if (words.length < 2) return undefined;
  const topic = words.slice(1).join(" ").split(/\b(?:through|before|after)\b/i)[0].trim();
  return topic || undefined;
}

function policyFact(hit: RetrievalHit, evidence: string, modality: PolicyModality, input: { actor?: string; action?: string; subject?: string }, scopeText = evidence): PolicyFact {
  const timeframe = findTimeframe(scopeText);
  const action = input.action ? removeTimeframe(input.action, timeframe) : undefined;
  const actor = input.actor ? cleanSentence(input.actor.replace(/^(?:if|when|where|after|before|for|once)\b.*,\s*(?=(?:the\s+|all\s+|any\s+)?(?:staff|employees?|workers?|officials?|delegates?|department|responsible\s+business\s+area)\b)/i, "").replace(/,\s*$/, "")) : undefined;
  const subject = input.subject ? cleanSentence(input.subject) : undefined;
  const topic = topicFromAction(action, subject);
  const recurrence = findRecurrence(timeframe);
  const numericThreshold = findNumericThreshold(scopeText, timeframe);
  return {
    id: stableId([hit.document.id, hit.chunk.id, evidence, modality, action ?? subject ?? ""]), documentId: hit.document.id, documentName: hit.document.originalName, chunkId: hit.chunk.id, evidence,
    ...(actor ? { actor } : {}), ...(action ? { action } : {}), ...(subject ? { subject } : {}), ...(topic ? { topic } : {}),
    modality, ...(timeframe ? { timeframe } : {}), ...(recurrence ? { recurrence } : {}), ...(numericThreshold ? { numericThreshold } : {}),
    ...(hit.document.effectiveDate ? { effectiveDate: hit.document.effectiveDate } : {}),
    ...(hit.document.documentType ? { documentType: hit.document.documentType } : {}),
    ...(hit.document.source?.authority ? { authority: hit.document.source.authority } : {}),
    ...(hit.document.source?.kind ? { sourceKind: hit.document.source.kind } : {}),
    ...(hit.document.source?.sourceUrl ? { sourceUrl: hit.document.source.sourceUrl } : {}),
    confidence: (action || (subject && ["mandatory", "required", "scheduled"].includes(modality))) && (actor || subject) ? "high" : "medium",
    possiblySuperseded: hit.document.inspection.possibleSupersededLanguage,
  };
}

function extractSentence(hit: RetrievalHit, evidence: string): { facts: PolicyFact[]; unresolved?: UnresolvedPolicyEvidence } {
  if (/\b(?:may need to|may be required to|might|could)\b/i.test(evidence)) {
    return { facts: [], unresolved: { documentId: hit.document.id, chunkId: hit.chunk.id, evidence, reason: "ambiguous_modality" } };
  }
  const required = evidence.match(/^(.{1,220}?)\s+(?:is|are)\s+required\s+to\s+(.+?[.!?])$/i);
  if (required) return { facts: [policyFact(hit, evidence, "required", { actor: required[1], action: required[2] })] };
  const requiredStatement = evidence.match(/^(.{1,220}?)\s+(?:is|are)\s+required(?:\s+(.+?))?[.!?]$/i);
  if (requiredStatement) return { facts: [policyFact(hit, evidence, "required", { subject: requiredStatement[1], action: requiredStatement[2] })] };
  const mandatory = evidence.match(/^(.{1,220}?)\s+(?:is|are)\s+mandatory(?:\s+(.+?))?[.!?]$/i);
  if (mandatory) return { facts: [policyFact(hit, evidence, "mandatory", { subject: mandatory[1], action: mandatory[2] })] };
  const scheduled = evidence.match(/^(.{1,220}?)\s+(?:is|are)\s+(reviewed|audited|tested|renewed|reported|submitted|updated)\s+(annually|quarterly|monthly|weekly|daily|every\s+[^,.;]+)(?:\s+by\s+(.+?))?[.!?]$/i);
  if (scheduled) return { facts: [policyFact(hit, evidence, "scheduled", { subject: scheduled[1], action: `${scheduled[2]} ${scheduled[3]}`, actor: scheduled[4] })] };

  const modalPattern = /\b(must not|shall not|should not|may not|must|shall|should|may)\s+/gi;
  const allModals = [...evidence.matchAll(modalPattern)];
  const coordinated = allModals.filter((match, index) => index === 0 || /[,;]\s*(?:and\s+)?$/i.test(evidence.slice((allModals[index - 1].index ?? 0) + allModals[index - 1][0].length, match.index)));
  if (coordinated.length > 1) {
    const preModal = cleanSentence(evidence.slice(0, coordinated[0].index));
    const firstPredicate = cleanSentence(evidence.slice((coordinated[0].index ?? 0) + coordinated[0][0].length, coordinated[1].index).replace(/[,;]\s*(?:and\s+)?$/i, ""));
    const passive = /^(?:immediately\s+)?be\s+/i.test(firstPredicate);
    const facts = coordinated.map((match, index) => {
      const next = coordinated[index + 1];
      const predicate = cleanSentence(evidence.slice((match.index ?? 0) + match[0].length, next?.index ?? evidence.length).replace(/[,;]\s*(?:and\s+)?$/i, ""));
      const modality = match[1].toLowerCase().replace(/\s+/g, "-") as PolicyModality;
      const input = passive ? { subject: preModal, action: predicate } : { actor: preModal, action: predicate };
      return policyFact(hit, evidence, modality, input, predicate);
    });
    return { facts };
  }
  const modal = evidence.match(/^(.{1,420}?)\s+(must not|shall not|should not|may not|must|shall|should|may)\s+(.+?[.!?])$/i);
  if (!modal) return { facts: [] };
  const modality = modal[2].toLowerCase().replace(/\s+/g, "-") as PolicyModality;
  const preModal = cleanSentence(modal[1]);
  const predicate = cleanSentence(modal[3]);
  if (modality === "may" && (!looksLikeResponsibleRole(preModal) || /^(?:need|possibly|perhaps)\b/i.test(predicate))) {
    return { facts: [], unresolved: { documentId: hit.document.id, chunkId: hit.chunk.id, evidence, reason: "ambiguous_modality" } };
  }
  return /^(?:immediately\s+)?be\s+/i.test(predicate)
    ? { facts: [policyFact(hit, evidence, modality, { subject: preModal, action: predicate })] }
    : { facts: [policyFact(hit, evidence, modality, { actor: preModal, action: predicate })] };
}

export function extractPolicyFacts(hit: RetrievalHit): PolicyFact[] {
  if (hit.document.status !== "approved") return [];
  return sentences(hit.chunk.text).flatMap((sentence) => {
    const extracted = extractSentence(hit, sentence);
    return extracted.facts;
  });
}

function modalityGroup(modality: PolicyModality) {
  if (["must", "shall", "required", "mandatory"].includes(modality)) return "required";
  if (modality === "scheduled") return "scheduled";
  if (["must-not", "shall-not", "may-not"].includes(modality)) return "prohibited";
  if (modality === "should") return "recommended";
  if (modality === "should-not") return "discouraged";
  return "permitted";
}

type RuleStructure = {
  actor?: string;
  action?: string;
  object: string[];
  actorScope: string[];
  condition: string[];
  recipient: string[];
  channel: string[];
  contextualObject: boolean;
  continuation: string[];
  qualification?: string[];
  restrictedPermission?: boolean;
  qualifiedObjects?: string[][];
};

function contentTokens(value: string) {
  return [...new Set(normalizedTokens(value).filter((token) => !["any", "all", "only", "both", "it", "immediately", "additionally"].includes(token)))].sort();
}

function primaryClause(value: string) {
  return value.replace(/\s+(?:in accordance with|under|consistent with)\s+.+$/i, "")
    .replace(/,?\s+and\s*,?\s*(?:(?:where required|if so),?\s*)?(?:follow|notify|report|retain|record)\b.+$/i, "");
}

function ruleStructure(fact: PolicyFact): RuleStructure {
  let predicate = (fact.action ?? "").replace(/^(?:immediately|only|additionally)\s+/i, "");
  if (fact.numericThreshold) predicate = predicate.replace(fact.numericThreshold, " ");
  let actor = normalizeActor(fact.actor);
  const actorScope = contentTokens(fact.actor?.match(/\b(?:who|that|responsible|involved)\s+(.+)/i)?.[1] ?? "");
  const preModal = fact.evidence.split(/\b(?:must|shall|should|may|is required|are required)\b/i)[0];
  const condition = contentTokens(preModal.match(/^(?:if|when|where|once)\s+(.+),\s*/i)?.[1] ?? "");
  const passiveActor = predicate.match(/\s+by\s+(.+)$/i);
  if (fact.subject && passiveActor) {
    actor = normalizeActor(passiveActor[1]);
    predicate = predicate.slice(0, passiveActor.index);
  }
  predicate = predicate.replace(/^be\s+/i, "");
  const actionWord = predicate.match(/^([a-z-]+)\b/i)?.[1];
  const action = actionWord ? stem(actionWord.toLowerCase()) : undefined;
  let object = fact.subject ?? predicate.slice(actionWord?.length ?? 0).trim();
  const continuation = contentTokens(primaryClause(predicate.match(/\band\s*,?\s*(?:(?:where required|if so),?\s*)?((?:follow|notify|report|retain|record)\s+.+)$/i)?.[1] ?? ""));
  let contextualObject = false;
  const channelMatch = predicate.match(/\b(?:through|via)\s+(.+?)(?=,?\s+and\s+(?:follow|notify|report|retain|record)\b|$)/i);
  const channel = contentTokens((channelMatch?.[1] ?? "").replace(/\b[\w'-]+(?:'s|’s)\s+/g, ""));
  if (channelMatch && !fact.subject) object = object.replace(channelMatch[0], " ");
  const recipientMatch = action === "report" ? predicate.match(/\b(?:notify|notifies|notified)\s+(.+?)(?=\s+(?:through|via|of|about)\b|,?\s+and\b|$)|\bto\s+(.+?)(?=\s+(?:through|via)\b|,?\s+and\b|$)/i) : null;
  const recipient = contentTokens(recipientMatch?.[1] ?? recipientMatch?.[2] ?? "");
  if (recipientMatch && !fact.subject) object = object.replace(recipientMatch[1] ?? recipientMatch[2], " ").replace(/^to\s+/i, "");
  object = primaryClause(object);
  if (action === "report" && (!contentTokens(object).length || /^it\b/i.test(object))) {
    object = fact.actor?.match(/\b(?:identify|identifies|identified|aware of)\s+(.+)/i)?.[1] ?? "";
    contextualObject = true;
  }
  // A qualification required of an actor exercising a power is also expressed
  // as "Only actors holding X may exercise Y". Keep the power's object, so a
  // shared qualification alone cannot link unrelated permissions.
  const limitedPermission = fact.modality === "may" && fact.actor?.match(/^Only\s+.+?\s+(?:holding|with)\s+(.+)$/i);
  const requiredQualification = ["must", "shall", "required"].includes(fact.modality) && action === "hold" && fact.actor?.match(/\bwho\s+(\w+)\s+(.+)$/i);
  const qualifiedObjects = (value: string) => primaryClause(value).split(/,|\bor\b/i).map((part) => contentTokens(part.replace(/^\s*(?:approve|execute|perform|conduct|issue)\s+/i, ""))).filter((part) => part.length);
  if (limitedPermission) return { actor, actorScope, condition, action, object: contentTokens(primaryClause(object)), recipient, channel, contextualObject, continuation, qualification: contentTokens(limitedPermission[1]), restrictedPermission: true, qualifiedObjects: qualifiedObjects(object) };
  if (requiredQualification) return { actor, actorScope, condition, action: stem(requiredQualification[1].toLowerCase()), object: contentTokens(requiredQualification[2]), recipient, channel, contextualObject, continuation, qualification: contentTokens(object.split(/\b(?:covering|for)\b/i)[0]), restrictedPermission: false, qualifiedObjects: qualifiedObjects(requiredQualification[2]) };
  return { actor, actorScope, condition, action, object: contentTokens(object), recipient, channel, contextualObject, continuation };
}

function equivalentTokens(left: string[], right: string[]) {
  return left.length === right.length && left.every((token) => right.includes(token));
}

function sameTokens(left: string[], right: string[]) {
  return left.length > 0 && equivalentTokens(left, right);
}

function objectAlignment(left: string[], right: string[]) {
  if (sameTokens(left, right)) return 1;
  const shared = left.filter((token) => right.includes(token)).length;
  // Short objects need exact agreement: "loan applications" and "grant
  // applications" must never become the same obligation from one shared noun.
  return Math.min(left.length, right.length) >= 5 && shared >= 4
    ? shared / Math.max(left.length, right.length) : 0;
}

function structureAlignment(left: RuleStructure, right: RuleStructure) {
  if (!left.action || left.action !== right.action) return 0;
  if (left.condition.length && right.condition.length && !sameTokens(left.condition, right.condition)) return 0;
  if (left.qualification || right.qualification) {
    if (!left.qualification || !right.qualification || !sameTokens(left.qualification, right.qualification)) return 0;
    const genericActor = (actor: string | undefined) => actor && ["official", "person"].includes(actor);
    if (left.actor !== right.actor && (left.restrictedPermission === right.restrictedPermission || (!genericActor(left.actor) && !genericActor(right.actor)))) return 0;
    return left.qualifiedObjects?.some((object) => right.qualifiedObjects?.some((other) => sameTokens(object, other))) ? 0.9 : 0;
  }
  // Named recipients and channels are independently meaningful. Two known,
  // different recipients cannot corroborate merely because their verbs match.
  if (left.recipient.length && right.recipient.length && !sameTokens(left.recipient, right.recipient)) return 0;
  if (left.channel.length && right.channel.length && !sameTokens(left.channel, right.channel)) return 0;
  const differentActorScope = left.actorScope.length && right.actorScope.length && !sameTokens(left.actorScope, right.actorScope);
  if (differentActorScope && !(left.contextualObject && right.contextualObject && left.action === "report")) return 0;
  const objectMatch = objectAlignment(left.object, right.object);
  if (!differentActorScope && (objectMatch === 1 || (objectMatch >= 0.8 && sameTokens(left.continuation, right.continuation)))) return objectMatch;
  if (left.action === "report" && left.actor && left.actor === right.actor) {
    const matchingDestination = sameTokens(left.recipient, right.recipient) || sameTokens(left.channel, right.channel);
    if (matchingDestination && (!left.object.length || !right.object.length)) return 0.9;
    const eventTokens = (tokens: string[]) => tokens.filter((token) => !["actual", "suspect", "possible", "includ"].includes(token));
    const leftEvent = eventTokens(left.object); const rightEvent = eventTokens(right.object);
    const containedEvent = leftEvent.length && rightEvent.length && (leftEvent.every((token) => rightEvent.includes(token)) || rightEvent.every((token) => leftEvent.includes(token)));
    if (matchingDestination && left.contextualObject && right.contextualObject && containedEvent) return 0.9;
  }
  return 0;
}

function normalizedTimeframe(value: string | undefined) {
  if (!value) return undefined;
  let normalized = value.toLowerCase().replace(/[.;]+$/, "").replace(/\s+/g, " ").trim();
  for (const [word, number] of Object.entries(WORD_NUMBERS)) normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), number);
  return normalized;
}

function comparableDeadline(value: string | undefined) {
  const normalized = normalizedTimeframe(value);
  if (!normalized) return undefined;
  if (normalized === "immediately") return { kind: "immediate", amount: 0, unit: "instant", trigger: "" };
  const match = normalized.match(/^(within|no later than)\s+(\d+)\s+(business\s+)?(hour|day|week|month)s?/);
  return match ? { kind: "deadline", amount: Number(match[2]), unit: `${match[3] ?? ""}${match[4]}`.trim(), trigger: normalized.slice(match[0].length).trim() } : undefined;
}

function timeframeConflict(left: string | undefined, right: string | undefined) {
  const a = comparableDeadline(left); const b = comparableDeadline(right);
  if (!a || !b) return false;
  if (a.kind === "immediate" || b.kind === "immediate") return a.kind !== b.kind;
  return a.kind === b.kind && a.unit === b.unit && a.trigger === b.trigger && a.amount !== b.amount;
}

function materialModalityDifference(left: PolicyModality, right: PolicyModality) {
  const a = modalityGroup(left); const b = modalityGroup(right);
  return a !== b && (a === "prohibited" || b === "prohibited" || a === "required" || b === "required" || a === "discouraged" || b === "discouraged");
}

export function comparePolicyFacts(left: PolicyFact, right: PolicyFact): PolicyRelation {
  const factIds: [string, string] = [left.id, right.id];
  if (left.documentId === right.documentId || left.possiblySuperseded || right.possiblySuperseded) return { kind: "unrelated", factIds, differences: [], confidence: "high" };
  const leftStructure = ruleStructure(left); const rightStructure = ruleStructure(right);
  const ruleSimilarity = structureAlignment(leftStructure, rightStructure);
  if (ruleSimilarity < 0.8) return { kind: "unrelated", factIds, differences: [], confidence: "high" };
  if (leftStructure.qualification && rightStructure.qualification) return { kind: "likely_same_rule", factIds, differences: [], confidence: "medium" };
  const differences: PolicyRelation["differences"] = [];
  if (materialModalityDifference(left.modality, right.modality)) differences.push("modality");
  if (timeframeConflict(left.timeframe, right.timeframe)) differences.push("timeframe");
  const leftActor = leftStructure.actor; const rightActor = rightStructure.actor;
  if (leftActor && rightActor && leftActor !== rightActor) {
    if (ruleSimilarity !== 1) return { kind: "unrelated", factIds, differences: [], confidence: "high" };
    differences.push("actor");
  }
  const leftThreshold = left.numericThreshold?.toLowerCase(); const rightThreshold = right.numericThreshold?.toLowerCase();
  if (leftThreshold && rightThreshold && leftThreshold !== rightThreshold) differences.push("numeric_threshold");
  if (differences.length) return { kind: "possible_conflict", factIds, differences, confidence: ruleSimilarity >= 0.96 ? "high" : "medium" };
  const leftDeadline = comparableDeadline(left.timeframe); const rightDeadline = comparableDeadline(right.timeframe);
  const equivalentTimeframe = normalizedTimeframe(left.timeframe) === normalizedTimeframe(right.timeframe)
    || (leftDeadline && rightDeadline && leftDeadline.kind === rightDeadline.kind && leftDeadline.unit === rightDeadline.unit && leftDeadline.amount === rightDeadline.amount && leftDeadline.trigger === rightDeadline.trigger);
  if ((left.timeframe && right.timeframe && !equivalentTimeframe) || modalityGroup(left.modality) !== modalityGroup(right.modality)) return { kind: "unrelated", factIds, differences: [], confidence: "high" };
  const sameValues = equivalentTimeframe && leftActor === rightActor && leftThreshold === rightThreshold
    && sameTokens(leftStructure.object, rightStructure.object)
    && equivalentTokens(leftStructure.actorScope, rightStructure.actorScope)
    && equivalentTokens(leftStructure.condition, rightStructure.condition)
    && equivalentTokens(leftStructure.recipient, rightStructure.recipient)
    && equivalentTokens(leftStructure.channel, rightStructure.channel);
  return ruleSimilarity >= 0.95 && sameValues
    ? { kind: "same_rule", factIds, differences: [], confidence: "high" }
    : { kind: "likely_same_rule", factIds, differences: [], confidence: "medium" };
}

function questionRelevance(question: string, fact: PolicyFact) {
  const query = new Set(normalizedTokens(question));
  if (!query.size) return 0;
  const evidence = new Set(normalizedTokens(`${fact.evidence} ${fact.topic ?? ""}`));
  return [...query].filter((token) => evidence.has(token)).length;
}

function buildInsights(facts: PolicyFact[], relations: PolicyIntelligenceResult["relations"]): PolicyInsight[] {
  const activeFacts = facts.filter((fact) => !fact.possiblySuperseded);
  const activeIds = new Set(activeFacts.map((fact) => fact.id));
  const visited = new Set<string>(); const insights: PolicyInsight[] = [];
  for (const fact of activeFacts) {
    if (visited.has(fact.id)) continue;
    const corroboratingFactIds = new Set<string>(); const possibleConflicts: PolicyInsight["possibleConflicts"] = [];
    for (const relation of relations) {
      if (!relation.factIds.includes(fact.id)) continue;
      const relatedId = relation.factIds[0] === fact.id ? relation.factIds[1] : relation.factIds[0];
      if (!activeIds.has(relatedId)) continue;
      if (relation.kind === "possible_conflict") possibleConflicts.push({ factId: relatedId, differences: relation.differences });
      else corroboratingFactIds.add(relatedId);
      visited.add(relatedId);
    }
    corroboratingFactIds.forEach((id) => visited.add(id));
    insights.push({ factId: fact.id, corroboratingFactIds: [...corroboratingFactIds], possibleConflicts });
    visited.add(fact.id);
  }
  return insights;
}

export function analyzePolicyIntelligence(question: string, hits: RetrievalHit[]): PolicyIntelligenceResult {
  const candidateFacts: PolicyFact[] = []; const unresolved: UnresolvedPolicyEvidence[] = [];
  const seenFacts = new Set<string>(); const seenUnresolved = new Set<string>();
  const queryTokens = normalizedTokens(question);
  for (const hit of hits) {
    if (hit.document.status !== "approved") continue;
    for (const evidence of sentences(hit.chunk.text)) {
      const extracted = extractSentence(hit, evidence);
      for (const fact of extracted.facts) {
        if (questionRelevance(question, fact) < Math.min(2, queryTokens.length)) continue;
        const key = `${fact.documentId}\u001f${fact.evidence.toLowerCase()}\u001f${fact.modality}\u001f${fact.action ?? fact.subject ?? ""}`;
        if (!seenFacts.has(key)) { candidateFacts.push(fact); seenFacts.add(key); }
      }
      if (extracted.unresolved && queryTokens.some((token) => normalizedTokens(evidence).includes(token))) {
        const key = `${extracted.unresolved.documentId}\u001f${extracted.unresolved.evidence.toLowerCase()}`;
        if (!seenUnresolved.has(key)) { unresolved.push(extracted.unresolved); seenUnresolved.add(key); }
      }
    }
  }
  const strongestMatch = Math.max(0, ...candidateFacts.map((fact) => questionRelevance(question, fact)));
  const strongestFacts = candidateFacts.filter((fact) => questionRelevance(question, fact) === strongestMatch);
  const relevantIds = new Set(strongestFacts.map((fact) => fact.id));
  // A paraphrase may use fewer literal query words than the leading passage.
  // Include it only when its rule structure corroborates or conflicts with a
  // strongest match, never merely because its document was retrieved.
  const frontier = [...strongestFacts];
  while (frontier.length) {
    const related = frontier.shift()!;
    for (const fact of candidateFacts) {
      if (relevantIds.has(fact.id) || comparePolicyFacts(related, fact).kind === "unrelated") continue;
      relevantIds.add(fact.id);
      frontier.push(fact);
    }
  }
  const facts = candidateFacts.filter((fact) => relevantIds.has(fact.id));
  const relations: PolicyIntelligenceResult["relations"] = [];
  for (let left = 0; left < facts.length; left += 1) for (let right = left + 1; right < facts.length; right += 1) {
    const relation = comparePolicyFacts(facts[left], facts[right]);
    if (relation.kind !== "unrelated") relations.push(relation as PolicyIntelligenceResult["relations"][number]);
  }
  return {
    facts, relations, insights: buildInsights(facts, relations), unresolved,
    notice: "Derived governance intelligence only, not authoritative legal interpretation. Exact source sentences are the evidence; verify the source document before acting.",
  };
}
