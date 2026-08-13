import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/storage/db";
import { PersonalisationRecordRepository } from "../src/personalisationRepository";
import { StrategyTemplateRepository } from "../src/templateRepository";

describe("PersonalisationRecordRepository", () => {
  let dbFile: string;
  let db: Database.Database;
  let repo: PersonalisationRecordRepository;
  let templates: StrategyTemplateRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "strategy-library-")), "test.db");
    db = openDatabase(dbFile);
    repo = new PersonalisationRecordRepository(db);
    templates = new StrategyTemplateRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("creates a record pinned to the template version at creation time", () => {
    const template = templates.get("visual-scheduling")!;

    const record = repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-local-id-123",
      personalisedActivity: "Use a picture schedule with the participant's preferred train images.",
      rationale: "Participant's interests include trains; supports predictability during transitions.",
      authoredBy: "practitioner-1",
      status: "draft",
    });

    expect(record.id).toBeTruthy();
    expect(record.templateVersionUsed).toBe(template.version);
    expect(record.authoredAt).toBeTruthy();
    expect(record.status).toBe("draft");
  });

  it("does not silently follow a later template version bump", () => {
    const template = templates.get("visual-scheduling")!;
    const record = repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-local-id-123",
      personalisedActivity: "Use a picture schedule.",
      rationale: "Supports predictability.",
      authoredBy: "practitioner-1",
      status: "active",
    });

    // Simulate a content correction bumping the template's version.
    db.prepare(`UPDATE strategy_templates SET version = version + 1 WHERE id = ?`).run(template.id);

    const reloaded = repo.getOrThrow(record.id);
    const currentTemplate = templates.get(template.id)!;

    expect(reloaded.templateVersionUsed).toBe(template.version);
    expect(currentTemplate.version).toBe(template.version + 1);
  });

  it("updates the practitioner-editable fields without touching the pinned linkage", () => {
    const template = templates.get("visual-scheduling")!;
    const record = repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-local-id-123",
      personalisedActivity: "Draft activity text.",
      rationale: "Draft rationale.",
      authoredBy: "practitioner-1",
      status: "draft",
    });

    const updated = repo.update(record.id, {
      personalisedActivity: "Finalised activity text.",
      status: "active",
    });

    expect(updated.personalisedActivity).toBe("Finalised activity text.");
    expect(updated.status).toBe("active");
    expect(updated.strategyTemplateId).toBe(template.id);
    expect(updated.templateVersionUsed).toBe(template.version);
    expect(updated.participantRef).toBe("participant-local-id-123");
  });

  it("lists records scoped to a single participant", () => {
    const template = templates.get("visual-scheduling")!;
    repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-a",
      personalisedActivity: "x",
      rationale: "x",
      authoredBy: "practitioner-1",
      status: "draft",
    });
    repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-b",
      personalisedActivity: "y",
      rationale: "y",
      authoredBy: "practitioner-1",
      status: "draft",
    });

    expect(repo.listForParticipant("participant-a")).toHaveLength(1);
    expect(repo.listForParticipant("participant-b")).toHaveLength(1);
    expect(repo.listForParticipant("participant-c")).toHaveLength(0);
  });

  it("deletes a record", () => {
    const template = templates.get("visual-scheduling")!;
    const record = repo.create({
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: "participant-a",
      personalisedActivity: "x",
      rationale: "x",
      authoredBy: "practitioner-1",
      status: "draft",
    });

    repo.delete(record.id);
    expect(repo.get(record.id)).toBeNull();
  });
});
