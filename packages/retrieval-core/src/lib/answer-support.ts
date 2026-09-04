// Answer validation only. Retrieval tokens, candidates and scores remain unchanged.
export type FacetKind = "general" | "action" | "actor" | "timeframe" | "record" | "location";
export type QueryFacet = { question: string; kind: FacetKind; terms: string[]; actions: string[]; context: string[]; actors: string[]; subject?: string[]; alternatives?: string[][]; documentTerms?: string[]; scopeTerms?: string[]; thresholds?: Array<{ operator: string; amount: string }>; without?: string[][] };
export type PassageSupport = { coverage: number; direct: boolean; shape: boolean; actor: boolean; action: boolean; modality: boolean; score: number };

const STOP = new Set("a an and are as at be been being by can could did do does for from had has have how i if in into is it its may might must of on or our shall should that the their them then there these they this those to was we were what when where which who why will with would you your about after before within during through upon than each any all also such whether both other under without once".split(" "));
const GENERIC = new Set("approved guidance policy policies procedure procedures rule rules requirement requirements required require need needs needed needing happen happens part parts apply applies according become becomes often".split(" "));
const ALIASES: Record<string, string> = {
  shall: "must", required: "must", mandatory: "must", employees: "staff", employee: "staff", personnel: "staff", workers: "staff", worker: "staff",
  notification: "notify", notified: "notify", notifying: "notify", notifications: "notify",
  approval: "approve", approvals: "approve", assessment: "assess", assessments: "assess",
  permission: "permit", permitted: "permit", allowed: "permit", authorised: "authorise", authorized: "authorise",
  retention: "retain", deletion: "delete", submission: "submit", submitted: "submit", submitting: "submit",
  renewal: "renew", renewaldate: "renew", issuance: "issue", revocation: "revoke",
  documentation: "document", recorded: "record", recording: "record", records: "record",
  responsibilities: "responsible", responsibility: "responsible", deadlines: "deadline", timeframes: "timeframe",
  tell: "notify", inform: "notify", informed: "notify", informing: "notify",
  disposal: "dispose", destruction: "destroy", authorisation: "authorise", authorization: "authorise",
  used: "use", using: "use",
  confirmation: "confirm", likelihood: "likely", taking: "participate",
  doubt: "uncertain", unsure: "uncertain",
};

export function wordStem(raw: string): string {
  const word = raw.toLowerCase().replace(/['’]s$/, "");
  let token = ALIASES[word] ?? word;
  if (token.length > 5 && token.endsWith("ly")) token = token.slice(0, -2);
  if (token.length > 4 && token.endsWith("ies")) token = `${token.slice(0, -3)}y`;
  else if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) token = token.slice(0, -1);
  if (token.length > 5 && token.endsWith("ing")) {
    token = token.slice(0, -3);
    if (/([b-df-hj-np-tv-z])\1$/.test(token)) token = token.slice(0, -1);
  } else if (token.length > 4 && token.endsWith("ied")) token = `${token.slice(0, -3)}y`;
  else if (token.length > 4 && token.endsWith("ed")) {
    token = token.slice(0, -2);
    if (/([b-df-hj-np-rtv-z])\1$/.test(token)) token = token.slice(0, -1);
  }
  if (token.length > 8 && token.endsWith("ification")) token = `${token.slice(0, -7)}y`;
  else if (token.length > 7 && token.endsWith("ation")) token = token.slice(0, -3);
  else if (token.length > 7 && token.endsWith("tion")) token = token.slice(0, -3);
  return token.length > 3 ? token.replace(/e$/, "") : token;
}

const ACTIONS = new Set("access approve assess audit authorise capture check collect complete confirm consult contact coordinate create declare delete destroy direct disclose document encrypt ensure escalate execute identify inform investigate issue keep limit maintain notify obtain pay perform preserve process protect provide provision publish receive record register release remove renew report request retain review revoke secure send share sign store submit track train update use verify".split(" ").map(wordStem));
const ROLES = new Set("staff manager inspector applicant officer owner delegate department team committee contractor official user supervisor authority person".split(" ").map(wordStem));
const QUESTION_SHAPE = new Set("deadline timeframe long soon often quickly frequently responsible responsibility".split(" ").map(wordStem));

export function terms(value: string, includeGeneric = false): string[] {
  return [...new Set((value.toLowerCase().replace(/['’]s\b/g, "").match(/[a-z]+|\d+(?:\.\d+)?/g) ?? [])
    .filter((token) => !STOP.has(token) && (includeGeneric || !GENERIC.has(token)))
    .map(wordStem)
    .filter((token) => token !== "must"))];
}

function kindFor(question: string): FacetKind {
  if (/^(?:when|how\s+(?:long|soon|often|quickly|frequently))\b|\b(?:deadline|timeframe|due date)\b/i.test(question)) return "timeframe";
  if (/^who\b|\bwho is responsible\b/i.test(question)) return "actor";
  if (/^where\b/i.test(question)) return "location";
  if (/\b(?:what|which)\b[^?]*\b(?:records?|recorded|documented|evidence)\b/i.test(question)) return "record";
  if (/\b(?:what|which)\b.*\b(?:must|shall|should)\b/i.test(question)) return "action";
  return "general";
}

function questionFocus(question: string): string {
  return question
    .replace(/^(what|which)\s+(?:does|do)\s+.+?\b(?:manual|guide|policy|procedure|standard|code|framework)\s+(?:say|state|specify|require)\s+(?:about|for)?\s*/i, "$1 ")
    .replace(/^(what|which)\s+(?:counts?|qualifies?)\s+as\s+/i, "$1 ")
    .replace(/^(what|which)\s+(?:triggers?|causes?)\s+/i, "$1 ")
    .replace(/^how\s+(?:quickly|frequently)\s+/i, "when ")
    // Focus nouns name the answer slot. The same words elsewhere can be actual
    // policy objects: "which records" asks for a list; "destroy records" does not.
    .replace(/^(what|which)\s+(?:(?:is|are)\s+)?(?:the\s+)?(?:steps?|actions?|approach|process|checks?|conditions?|circumstances?|situations?|matters?|requirements?|responsibilities|obligations?|records?|evidence|information)\b/i, "$1")
    .replace(/\b(?:is|are)\s+(?:needed|necessary|required)\b/gi, "")
    .replace(/\b(?:is|are)\s+responsible\s+for\b/gi, "")
    .replace(/\b(?:is|are)\s+(?:taken|followed|used|covered)\s+(?:to|by|in|for)?\s*/gi, "")
    .replace(/\b(?:is|are)\s+(?:allowed|permitted|authorised|authorized)\s+to\s+/gi, "may ")
    .replace(/\b(?:carry|carrying|carried)\s+out\b/gi, "")
    .replace(/\b(?:perform|performing|conduct|conducting|undertake|undertaking)\s+(?=\w+(?:\s+\w+)?(?:tion|ing)s?\b)/gi, "")
    .replace(/\b(?:follow|take|use)\s+(?=to\b)/gi, "")
    .replace(/^how\s+(?:should|must|do|does|can)\s+(.+?)\s+(?:handle|deal with)\s+/i, "how $1 ")
    .replace(/\bclassification\s+approach\b/gi, "classification")
    .replace(/\bapproach\b/gi, "")
    .replace(/\bsomething\b/gi, "")
    .replace(/\bperiod\b/gi, "")
    .replace(/\bevery\s+time\b/gi, "every")
    .replace(/\bmeant\s+to\s+be\s+handled\b/gi, "")
    .replace(/\b(?:be\s+)?handl(?:ed|ing)\b/gi, "")
    .replace(/\bregarding\b/gi, "")
    .replace(/\bmust\s+occur\s+before\b[^?]*$/gi, "")
    .replace(/\binvolve\b(?=\s*[?]?\s*$)/gi, "")
    .replace(/\bbe\s+raised\b/gi, "");
}

const COMPARISON = /\b(no more than|no less than|at least|at most|more than|less than|not exceeding|up to|over|under|above|below|exactly)\s+(?:\$\s*)?(\d[\d,]*(?:\.\d+)?)(%?)/gi;
const COMPARATORS: Record<string, string> = { "no more than": "<=", "at most": "<=", "not exceeding": "<=", "up to": "<=", "no less than": ">=", "at least": ">=", "more than": ">", over: ">", above: ">", "less than": "<", under: "<", below: "<", exactly: "=" };

function thresholds(value: string): Array<{ operator: string; amount: string }> {
  return [...value.matchAll(COMPARISON)].map((match) => ({ operator: COMPARATORS[match[1].toLowerCase()], amount: `${match[2].replace(/,/g, "")}${match[3]}` }));
}

function withoutObjects(value: string): string[][] {
  return [...value.matchAll(/\bwithout\s+([^,.;?!]+?)(?=\s+(?:and|or|before|after|when|if|within|may|must|shall)\b|$)/gi)]
    .map((match) => terms(match[1])).filter((object) => object.length > 0);
}

function alternativeTerms(value: string): string[][] {
  // Explicit single-word alternatives retain the shared noun phrase. This is
  // deliberately not a synonym table: lost OR stolen can match either stated
  // condition, while lost AND stolen still requires both.
  return [...value.matchAll(/\b([a-z]+)\s+or\s+([a-z]+)\b/gi)]
    .map((match) => [wordStem(match[1]), wordStem(match[2])])
    .filter((group) => group.every((term) => !STOP.has(term)) && group[0] !== group[1]);
}

function requestedActions(question: string, own: readonly string[], kind: FacetKind): string[] {
  const primary = question.split(/\b(?:before|after|if|once|unless|while)\b/i)[0];
  const passive = primary.match(/\b(?:be|is|are)\s+(?:not\s+)?([a-z]+)\b/i);
  const modalTail = primary.match(/\b(?:must|shall|should|may|can|could|will|would)\s+(.+)$/i)?.[1];
  const modalWords = modalTail?.match(/[a-z]+/gi) ?? [];
  const main = passive && ACTIONS.has(wordStem(passive[1])) ? wordStem(passive[1])
    : modalWords.map(wordStem).find((term, index, words) => ACTIONS.has(term) && !ROLES.has(words[index + 1]));
  const infinitives = [...primary.matchAll(/\bto\s+(?:be\s+)?(?:not\s+)?([a-z]+)\b/gi)].map((match) => wordStem(match[1]));
  const nominal = !main && ["timeframe", "actor"].includes(kind) ? own.find((term) => ACTIONS.has(term)) : undefined;
  return [...new Set([main, nominal, ...infinitives].filter((term): term is string => Boolean(term && ACTIONS.has(term) && own.includes(term))))];
}

export function decomposeQuery(query: string): QueryFacet[] {
  // Split explicit questions, retaining their shared condition and subject. An
  // unresolved pronoun receives subject context, never an invented answer.
  const starts = [...query.matchAll(/\b(?:what|which|who|when|where|how)\b/gi)]
    .filter((match) => match.index === 0 || /(?:[,;:]|\band|\bor)\s*$/i.test(query.slice(0, match.index)));
  const prefix = starts.length ? query.slice(0, starts[0].index).replace(/[,;:]\s*$/, "") : "";
  const clauses = starts.length ? starts.map((start, i) => query.slice(start.index, starts[i + 1]?.index ?? query.length).replace(/[,;?\s]+$|\s+(?:and|or)\s*$/gi, "").trim()) : [query];
  const shared = terms(questionFocus(query)).filter((token) => !ACTIONS.has(token) && !ROLES.has(token) && !QUESTION_SHAPE.has(token));
  return clauses.map((question) => {
    const kind = kindFor(question);
    const organisationScope = question.match(/\bat\s+([A-Z][A-Z0-9&-]{1,})(?=\s*[?.,;]*$)/)?.[1]
      ?? question.match(/\bdoes\s+([A-Z][A-Z0-9&-]{1,})\s+use(?=\s*[?.,;]*$)/)?.[1];
    const contextualDocument = question.match(/\bunder\s+(?:the\s+)?([^?.,;]+?\b(?:manual|guide|policy|procedure|standard|code|framework))(?=\s*[?.,;]*$)/i)?.[1];
    const topical = questionFocus(question)
      .replace(/\bat\s+[A-Z][A-Z0-9&-]{1,}(?=\s*[?.,;]*$)/, "")
      .replace(/\blevels?\s+does\s+[A-Z][A-Z0-9&-]{1,}\s+use(?=\s*[?.,;]*$)/, "")
      .replace(/\bunder\s+(?:the\s+)?[^?.,;]+?\b(?:manual|guide|policy|procedure|standard|code|framework)(?=\s*[?.,;]*$)/i, "")
      .replace(COMPARISON, (_match, _operator, amount: string, suffix: string) => `${amount.replace(/,/g, "")}${suffix}`);
    const own = terms(topical).filter((token) => !QUESTION_SHAPE.has(token));
    // A content word can be either a noun or verb (access, records, approval).
    // Require action alignment only for explicit verbal uses and nominal actions
    // in time/actor questions; object nouns remain ordinary required concepts.
    const actions = requestedActions(topical, own, kind);
    const subject = own.filter((token) => !actions.includes(token) && !ROLES.has(token));
    const context = terms(prefix).filter((token) => !ACTIONS.has(token) && !ROLES.has(token));
    if (!subject.length && !context.length) context.push(...shared);
    const actors = kind === "actor" ? [] : own.filter((token) =>
      ROLES.has(token)
      && (token !== wordStem("authority") || /\bauthority\s+(?:must|shall|should|may|can|will|approve|review|issue|decide)\b/i.test(topical)),
    );
    const namedDocument = question.match(/\b(?:does|do)\s+(.+?\b(?:manual|guide|policy|procedure|standard|code|framework))\s+(?:say|state|specify|require)\b/i)?.[1] ?? contextualDocument;
    return { question, kind, terms: own, actions, subject, context: [...new Set(context)], actors, alternatives: alternativeTerms(`${prefix} ${topical}`), documentTerms: namedDocument ? terms(namedDocument, true) : [], scopeTerms: organisationScope ? terms(organisationScope, true) : [], thresholds: thresholds(`${prefix} ${question}`), without: withoutObjects(`${prefix} ${question}`) };
  });
}

export function passageSentences(text: string, title = ""): string[] {
  const normalizedTitle = title.replace(/\.[^.]+$/, "").toLowerCase().trim();
  return text.split(/\r?\n+/).filter((line) => {
    const value = line.trim();
    return value && value.toLowerCase() !== normalizedTitle && !/^\d+(?:\.\d+)*\.?\s+[^.!?]+$/.test(value);
  }).flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.split(/\s+/).length >= 3 && !/^(?:synthetic\s+)?(?:demo|demonstration) document(?:\s+only)?[.!?]?$/i.test(line));
}

export function linkedPassage(sentences: readonly string[], start: number, length: number): string | undefined {
  const selected = sentences.slice(start, start + length);
  if (selected.length !== length) return undefined;
  for (let i = 1; i < selected.length; i++) {
    // Context is admissible for an explicit antecedent or enumeration only.
    // Proximity alone cannot transfer a rule from one object to another.
    if (!/^(?:this|these|those|such|it|they|its|their)\b/i.test(selected[i]) && !/(?:[:]|\bas follows[.:]|\bthe following[.:])\s*$/i.test(selected[i - 1])) return undefined;
  }
  return selected.join(" ");
}

function fraction(required: readonly string[], present: Set<string>): number {
  return required.length ? required.filter((term) => present.has(term)).length / required.length : 0;
}

function hasTimeframe(text: string): boolean {
  return /\b(?:within|before|after|until|by|no later than)\s+\S|\b(?:immediately|annually|quarterly|monthly|weekly|daily|every|per)\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:business\s+)?(?:hours?|days?|weeks?|months?|years?)\b/i.test(text);
}

function shapeSupported(facet: QueryFacet, text: string): boolean {
  if (facet.kind === "timeframe") return hasTimeframe(text)
    || (/^when\b/i.test(facet.question) && /\b(?:if|where|once|upon|unless|involving|in the event)\b/i.test(text))
    || (/^when\b/i.test(facet.question) && /\b(?:requires?|required\s+for|for\s+(?:high|low|material|significant|urgent|exceptional)[-\s])/i.test(text));
  if (facet.kind === "record") return /\b(?:record(?:ed|s)?|document(?:ed|ation)?|register|log|evidence|retain(?:ed)?|keep|capture(?:d)?)\b/i.test(text);
  if (facet.kind === "actor") {
    const hasActorShape = /\b(?:by|to|only)\s+\S|\b\S+\s+(?:must|shall|should|may|will|requires?|is responsible|are responsible)\b/i.test(text);
    const words = text.match(/[a-z]+/gi) ?? [];
    const requestedActionIsPredicate = facet.actions.every((action) => words.some((word) =>
      wordStem(word) === action && !/(?:ment|tion|ance|ence|al)$/i.test(word),
    ));
    return hasActorShape && requestedActionIsPredicate;
  }
  if (facet.kind === "location") return /\b(?:in|at|to|through|within|using)\s+\S/i.test(text);
  return true;
}

export function antecedentPassage(sentences: readonly string[], index: number): string | undefined {
  if (index < 1) return undefined;
  const previous = sentences[index - 1];
  const current = sentences[index];
  const first = terms(current, true)[0];
  const lexicalAntecedent = Boolean(first && new Set(terms(previous, true)).has(first));
  const explicit = /^(?:this|these|those|such|it|they|its|their)\b/i.test(current)
    || /\byour\b/i.test(current)
    || lexicalAntecedent;
  if (!explicit) return undefined;
  let start = index - 1;
  if (lexicalAntecedent && start > 0 && first && new Set(terms(sentences[start - 1], true)).has(first)) start -= 1;
  return `${sentences.slice(start, index).join(" ")} ${current}`;
}

function actorAligned(facet: QueryFacet, text: string): boolean {
  if (!facet.actors.length || !facet.actions.length) return true;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return facet.actions.every((action) => {
    const index = words.findIndex((word) => wordStem(word) === action);
    if (index < 0) return false;
    // Passive provisions may name the actor after 'by'. Recipients after 'to'
    // do not acquire the actor's responsibility.
    // Restrict ownership to the action's clause. An actor in a preceding
    // condition or in a request's recipient does not own the following action.
    const characterIndex = [...text.toLowerCase().matchAll(/[a-z]+/g)][index].index;
    const lead = text.slice(0, characterIndex);
    const clauses = lead.split(/[,;.]|\b(?:and|but|then)\b/i);
    let clause = clauses.at(-1) ?? lead;
    // Coordinated verbs inherit an explicit actor from the previous clause
    // only when they do not introduce a different actor of their own.
    if (!terms(clause, true).some((token) => ROLES.has(token)) && clauses.length > 1 && !/[.!?]\s*[^.!?]*$/.test(lead)) clause = clauses.slice(-2).join(" ");
    const before = terms(clause, true);
    if (/\b(?:ask|tell|require|instruct|allow|permit)(?:s|ed)?\b.+\bto\s*$/i.test(clause)) return false;
    const after = words.slice(index + 1);
    const by = after.indexOf("by");
    const actorTokens = new Set([...before, ...(by >= 0 ? after.slice(by + 1).map(wordStem) : [])]);
    return facet.actors.every((actor) => actorTokens.has(actor));
  });
}

export function validateSupport(facet: QueryFacet, text: string, stage: "retrieval" | "sentence", context = ""): PassageSupport {
  const present = new Set(terms(text.replace(COMPARISON, (_match, _operator, amount: string, suffix: string) => `${amount.replace(/,/g, "")}${suffix}`), true));
  if (/\b(?:this|the|these)\s+(?:policy|procedure|manual|guide|document|standard)\b/i.test(text)) {
    for (const term of terms(context, true)) present.add(term);
  }
  // Titles can bind an inherited topic, but cannot supply an explicit question
  // concept or action missing from the evidence sentence itself.
  const contextual = new Set([...present, ...terms(context, true)]);
  const alternatives = facet.alternatives ?? [];
  const effective = (values: readonly string[], available: Set<string>) => values.filter((term) => !alternatives.some((group) => group.includes(term) && !available.has(term) && group.some((choice) => available.has(choice))));
  const own = effective(facet.terms, present);
  const subject = effective(facet.subject ?? own.filter((term) => !ACTIONS.has(term) && !ROLES.has(term)), present);
  const sharedContext = effective(facet.context, contextual);
  const required = [...new Set([...own, ...sharedContext])];
  const coverage = required.length ? (own.filter((term) => present.has(term)).length + sharedContext.filter((term) => !own.includes(term) && contextual.has(term)).length) / required.length : 0;
  const ownCoverage = fraction(own, present);
  const subjectCoverage = subject.length ? fraction(subject, present) : fraction(sharedContext, contextual);
  const action = !facet.actions.length || effective(facet.actions, present).every((term) => present.has(term));
  const actor = stage === "retrieval" || actorAligned(facet, text);
  const shape = stage === "retrieval" || shapeSupported(facet, text);
  const asksObligation = /\b(?:must|shall|required|mandatory)\b/i.test(facet.question);
  const asksPermission = /\b(?:allowed|permitted|authorised|authorized|may|can)\b/i.test(facet.question);
  const obligationAligned = !asksObligation || /\b(?:must|shall|requir(?:e|es|ed|ing)|mandatory|only|prohibited|cannot)\b/i.test(text);
  const permissionAligned = !asksPermission || /\b(?:may(?:\s+not)?|only|permitted|allowed|authorised|authorized|prohibited|cannot|must\s+not|shall\s+not)\b/i.test(text);
  const modality = obligationAligned && permissionAligned;
  const excludesScope = /\b(?:outside|out of)\b[^.!?]*\bscope\b|\b(?:does|do) not (?:apply|cover|address)\b|\bnot (?:covered|addressed|specified|defined)\b/i.test(text);
  const sourceThresholds = thresholds(text);
  const thresholdAligned = (facet.thresholds ?? []).every((requested) => sourceThresholds.some((source) => source.operator === requested.operator && source.amount === requested.amount));
  const sourceWithout = withoutObjects(text);
  const conditionAligned = (facet.without ?? []).every((requested) =>
    sourceWithout.some((source) => requested.every((term) => source.includes(term)))
    || (/\bunless\b/i.test(text) && requested.every((term) => present.has(term))),
  );
  const scopeSource = stage === "retrieval" ? contextual : new Set(terms(context, true));
  const documentAligned = (facet.documentTerms ?? []).every((term) => scopeSource.has(term));
  const scopeAligned = (facet.scopeTerms ?? []).every((term) => scopeSource.has(term));
  // Whole chunks can establish context, but only a directly aligned sentence
  // can answer a facet. A high retrieval score cannot override these gates.
  const direct = required.length > 0 && action && actor && shape && modality && thresholdAligned && conditionAligned && documentAligned && scopeAligned && (stage === "retrieval" || !excludesScope)
    && ownCoverage >= (own.length ? 0.6 : 0)
    && coverage >= 0.6
    && (!(subject.length || sharedContext.length) || subjectCoverage >= 1);
  return { coverage, direct, action, actor, shape, modality, score: coverage * 4 + ownCoverage * 2 + subjectCoverage + Number(shape) * 0.3 };
}

export function evidenceKey(text: string): string {
  // Preserve conditions, polarity, numbers and operators; token similarity must
  // never collapse 'may' and 'may not', or distinct limits, into one rule.
  return text.toLowerCase().replace(/\bshall\b/g, "must").replace(/\bis required to\b/g, "must").replace(/\b(?:a|an|the)\s+/g, "").replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
}
