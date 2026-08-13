import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/storage/db";
import { StrategyTemplateRepository } from "../src/templateRepository";
import { isEligible } from "../src/eligibility";
import { SEED_TEMPLATES } from "../src/seed/templates";
import type { EligibilityFilters } from "@fracta-flow/participant-profile";

describe("ageAppropriateness / culturalSafetyFlag (optional, practitioner-authored)", () => {
  let dbFile: string;
  let db: Database.Database;
  let repo: StrategyTemplateRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "age-cultural-")), "test.db");
    db = openDatabase(dbFile);
    repo = new StrategyTemplateRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("leaves both fields unset on all 15 seed entries — no backfilled/guessed values", () => {
    for (const template of SEED_TEMPLATES) {
      expect(template.ageAppropriateness).toBeUndefined();
      expect(template.culturalSafetyFlag).toBeUndefined();
    }
  });

  it("stays unset through a round trip when never set", () => {
    const template = repo.get("visual-scheduling")!;
    expect(template.ageAppropriateness).toBeUndefined();
    expect(template.culturalSafetyFlag).toBeUndefined();
  });

  it("persists ageAppropriateness through a round trip when a later content edit sets it", () => {
    db.prepare(
      `UPDATE strategy_templates SET version = version + 1, age_appropriateness = ? WHERE id = ?`
    ).run(JSON.stringify({ minAge: 12, note: "developed for adult presentation" }), "visual-scheduling");

    const reloaded = repo.get("visual-scheduling")!;
    expect(reloaded.ageAppropriateness).toEqual({ minAge: 12, note: "developed for adult presentation" });
  });

  it("persists culturalSafetyFlag through a round trip when a later content edit sets it", () => {
    db.prepare(
      `UPDATE strategy_templates SET version = version + 1, cultural_safety_flag = ? WHERE id = ?`
    ).run(JSON.stringify({ hasConsiderations: true, note: "Review with a cultural consultant." }), "visual-scheduling");

    const reloaded = repo.get("visual-scheduling")!;
    expect(reloaded.culturalSafetyFlag).toEqual({
      hasConsiderations: true,
      note: "Review with a cultural consultant.",
    });
  });

  it("does not affect isEligible()'s output whether ageAppropriateness is set or not", () => {
    const eligibility: EligibilityFilters = { age: 9, culturalConstraints: "" };
    const withoutAge = repo.get("visual-scheduling")!;
    const withAge = {
      ...withoutAge,
      ageAppropriateness: { minAge: 12, note: "developed for adult presentation" },
    };

    expect(isEligible(withoutAge, eligibility)).toBe(isEligible(withAge, eligibility));
    expect(isEligible(withAge, eligibility)).toBe(true);
  });

  it("does not affect isEligible()'s output whether culturalSafetyFlag is set or not", () => {
    const eligibility: EligibilityFilters = { age: null, culturalConstraints: "No physical touch." };
    const withoutFlag = repo.get("visual-scheduling")!;
    const withFlag = {
      ...withoutFlag,
      culturalSafetyFlag: { hasConsiderations: true, note: "Review with a cultural consultant." },
    };

    expect(isEligible(withoutFlag, eligibility)).toBe(isEligible(withFlag, eligibility));
    expect(isEligible(withFlag, eligibility)).toBe(true);
  });
});
