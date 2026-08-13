import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import {
  openDatabase as openParticipantDb,
  ParticipantRepository,
  getEligibilityFilters,
  emptyInterests,
  emptyCommunication,
  emptyCognitive,
  emptyPhysical,
  emptyHealth,
  emptyContext,
} from "@fracta-flow/participant-profile";
import { openDatabase as openStrategyDb } from "../src/storage/db";
import { StrategyTemplateRepository } from "../src/templateRepository";
import { filterEligibleTemplates } from "../src/eligibility";

describe("eligibility integration with the Participant Profile module", () => {
  let participantDbFile: string;
  let strategyDbFile: string;
  let participantDb: Database.Database;
  let strategyDb: Database.Database;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eligibility-"));
    participantDbFile = path.join(dir, "participant.db");
    strategyDbFile = path.join(dir, "strategy.db");
    participantDb = openParticipantDb(participantDbFile);
    strategyDb = openStrategyDb(strategyDbFile);
  });

  afterEach(() => {
    participantDb.close();
    strategyDb.close();
    fs.rmSync(path.dirname(participantDbFile), { recursive: true, force: true });
  });

  it("reads eligibility filters from the Participant Profile module rather than re-implementing participant access", () => {
    const participants = new ParticipantRepository(participantDb);
    const participant = participants.create({
      age: 9,
      culturalConstraints: "No physical touch as part of any activity.",
      interests: emptyInterests(),
      communication: emptyCommunication(),
      cognitive: emptyCognitive(),
      physical: emptyPhysical(),
      health: emptyHealth(),
      context: emptyContext(),
      goals: [],
    });

    const eligibility = getEligibilityFilters(participant);
    expect(eligibility.age).toBe(9);
    expect(eligibility.culturalConstraints).toBe("No physical touch as part of any activity.");

    const templates = new StrategyTemplateRepository(strategyDb);
    const eligible = filterEligibleTemplates(templates.list(), eligibility);

    // No template-level exclusion fields exist yet in the v2 schema (see
    // eligibility.ts) — filtering is a documented pass-through, not silently
    // dropped strategies. This test pins that contract so a future change
    // to isEligible is a deliberate decision, not an accident.
    expect(eligible).toHaveLength(templates.list().length);
  });
});
