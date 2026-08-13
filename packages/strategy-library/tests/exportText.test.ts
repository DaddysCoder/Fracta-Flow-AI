import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/storage/db";
import { StrategyTemplateRepository } from "../src/templateRepository";
import { PersonalisationRecordRepository } from "../src/personalisationRepository";
import { assembleExportText } from "../src/exportText";

describe("assembleExportText", () => {
  let dbFile: string;
  let db: Database.Database;
  let templates: StrategyTemplateRepository;
  let records: PersonalisationRecordRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "strategy-library-")), "test.db");
    db = openDatabase(dbFile);
    templates = new StrategyTemplateRepository(db);
    records = new PersonalisationRecordRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("assembles practitioner-authored content into a plan-ready block, unchanged", () => {
    const template = templates.getWithSources("visual-scheduling")!;
    const record = records.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-a",
      personalisedActivity: "Use a picture schedule with the participant's preferred train images.",
      rationale: "Supports predictability during transitions.",
      authoredBy: "practitioner-1",
      status: "active",
    });

    const text = assembleExportText(record, template, template.sources);

    expect(text).toContain("Technique: Visual Scheduling");
    expect(text).toContain(record.personalisedActivity);
    expect(text).toContain(record.rationale);
    expect(text).toContain("Evidence tier: single_study");
    expect(text).toContain("Crates, N., & Spicer, M. (2012)");
    expect(text).not.toContain("undefined");
  });

  it("flags when the record's pinned version has drifted from the current template", () => {
    const template = templates.getWithSources("visual-scheduling")!;
    const record = records.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-a",
      personalisedActivity: "x",
      rationale: "x",
      authoredBy: "practitioner-1",
      status: "active",
    });

    const bumpedTemplate = { ...template, version: template.version + 1 };
    const text = assembleExportText(record, bumpedTemplate, template.sources);

    expect(text).toContain("this record was authored against template version");
  });

  it("never omits a safety boundary when one is set", () => {
    const template = templates.getWithSources("visual-scheduling")!;
    const withBoundary = { ...template, safetyBoundary: "Never physically redirect the participant." };
    const record = records.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-a",
      personalisedActivity: "x",
      rationale: "x",
      authoredBy: "practitioner-1",
      status: "active",
    });

    const text = assembleExportText(record, withBoundary, template.sources);
    expect(text).toContain("Safety boundary (never crossed): Never physically redirect the participant.");
  });
});
