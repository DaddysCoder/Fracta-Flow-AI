import assert from "node:assert/strict";
import test from "node:test";
import { DECLINE, answerContainsGold, evidenceContainsGold, hitAtK, rankMetrics, relationsForLabelPair, strictDecline } from "./metrics.mjs";
import { checkControlPreservation } from "./verify-comparison.mjs";

test("Hit@K measures any relevant hit and preserves multiple relevant IDs", () => {
  const hits = ["irrelevant", "one", "two"].map((id) => ({ chunk: { id } }));
  const gold = new Set(["one", "two"]);
  assert.equal(hitAtK(hits, gold, 1), 0);
  assert.equal(hitAtK(hits, gold, 2), 1);
  assert.equal(rankMetrics(hits, gold).mrrAt10, 0.5);
});

test("historical excerpt proxy is distinct from complete answer-body evidence", () => {
  assert.equal(evidenceContainsGold("Owners must submit the register.", "Owners must submit the register. The deadline is Friday."), true);
  assert.equal(answerContainsGold("Owners must submit the register.", "Owners must submit the register. The deadline is Friday."), false);
  assert.equal(evidenceContainsGold("", "Owners must submit the register."), false);
  assert.equal(answerContainsGold("The deadline is Friday. [1]", "The deadline is Friday."), true);
});

test("decline requires the specified message, no evidence, and low confidence", () => {
  assert.equal(strictDecline({ answer: DECLINE, evidence: [], confidence: "low" }), true);
  assert.equal(strictDecline({ answer: "No answer", evidence: [], confidence: "low" }), false);
  assert.equal(strictDecline({ answer: DECLINE, evidence: [], confidence: "high" }), false);
  assert.equal(strictDecline({ answer: DECLINE, evidence: [{}], confidence: "low" }), false);
});

test("unrelated corroboration cannot satisfy a labelled pair", () => {
  const labels = [{ docId: "one", evidence: "Owners must file the register." }, { docId: "two", evidence: "The register must be filed by owners." }];
  const result = {
    facts: [{ id: "a", documentId: "one", evidence: labels[0].evidence }, { id: "b", documentId: "two", evidence: "Staff must complete training." }, { id: "c", documentId: "two", evidence: labels[1].evidence }],
    relations: [{ kind: "same_rule", factIds: ["a", "b"] }, { kind: "likely_same_rule", factIds: ["c", "a"] }],
  };
  assert.deepEqual(relationsForLabelPair(result, ...labels), [result.relations[1]]);
});

test("control success cannot come from dropping previously extracted evidence", () => {
  const row = (left, right) => ({ id: "control", policyIntelligence: { control: { directLeftExtracted: left, directRightExtracted: right } } });
  assert.equal(checkControlPreservation([row(true, true)], [row(false, true)]).preserved, false);
  assert.equal(checkControlPreservation([row(true, false)], [row(true, true)]).preserved, true);
  assert.equal(checkControlPreservation([row(true, false)], []).preserved, false);
});
