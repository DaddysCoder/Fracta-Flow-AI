import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/storage/db";
import { ParticipantRepository } from "../src/repository";
import {
  emptyInterests,
  emptyCommunication,
  emptyCognitive,
  emptyPhysical,
  emptyHealth,
  emptyContext,
  type ParticipantInput,
} from "../src/types";
import {
  getEligibilityFilters,
  getPersonalisationContext,
  getBehaviourRelevanceTags,
} from "../src/strategyLibraryView";

function baseInput(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    age: 12,
    culturalConstraints: "No physical touch as part of any activity.",
    interests: { ...emptyInterests(), general: ["dinosaurs", "trains"] },
    communication: { ...emptyCommunication(), mode: "AAC" },
    cognitive: emptyCognitive(),
    physical: emptyPhysical(),
    health: emptyHealth(),
    context: emptyContext(),
    goals: ["Increase independent requesting"],
    ...overrides,
  };
}

describe("ParticipantRepository", () => {
  let dbFile: string;
  let db: Database.Database;
  let repo: ParticipantRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "participant-profile-")), "test.db");
    db = openDatabase(dbFile);
    repo = new ParticipantRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("creates and retrieves a participant with nested fields intact", () => {
    const created = repo.create(baseInput());

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toEqual(created.updatedAt);
    expect(created.age).toBe(12);
    expect(created.interests.general).toEqual(["dinosaurs", "trains"]);
    expect(created.communication.mode).toBe("AAC");
    expect(created.goals).toEqual(["Increase independent requesting"]);
    expect(created.behavioursOfConcern).toEqual([]);

    const fetched = repo.get(created.id);
    expect(fetched).toEqual(created);
  });

  it("creates a participant with a behaviour-of-concern pointer", () => {
    const created = repo.create(
      baseInput({
        behavioursOfConcern: [
          {
            name: "Elopement",
            briefDescription: "Leaves the immediate area during transitions.",
            linkedFbaRecordId: null,
          },
        ],
      })
    );

    expect(created.behavioursOfConcern).toHaveLength(1);
    expect(created.behavioursOfConcern[0].name).toBe("Elopement");
    expect(created.behavioursOfConcern[0].id).toBeTruthy();
  });

  it("updates top-level and nested fields without clobbering untouched siblings", () => {
    const created = repo.create(baseInput());

    const updated = repo.update(created.id, {
      age: 13,
      interests: { general: ["dinosaurs", "trains"], strengths: ["puzzles"], dislikes: [] },
    });

    expect(updated.age).toBe(13);
    expect(updated.interests.strengths).toEqual(["puzzles"]);
    expect(updated.communication.mode).toBe("AAC"); // untouched sibling preserved
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime()
    );
  });

  it("adds and removes a behaviour of concern independently of full update", () => {
    const created = repo.create(baseInput());

    const withBehaviour = repo.addBehaviourOfConcern(created.id, {
      name: "Refusal",
      briefDescription: "Declines to start non-preferred tasks.",
    });
    expect(withBehaviour.behavioursOfConcern).toHaveLength(1);

    const behaviourId = withBehaviour.behavioursOfConcern[0].id;
    const cleared = repo.removeBehaviourOfConcern(created.id, behaviourId);
    expect(cleared.behavioursOfConcern).toHaveLength(0);
  });

  it("lists all participants", () => {
    repo.create(baseInput());
    repo.create(baseInput({ age: 8 }));

    expect(repo.list()).toHaveLength(2);
  });

  it("deletes a participant and cascades its behaviours", () => {
    const created = repo.create(
      baseInput({
        behavioursOfConcern: [{ name: "Elopement", briefDescription: "x", linkedFbaRecordId: null }],
      })
    );

    repo.delete(created.id);

    expect(repo.get(created.id)).toBeNull();
    const remaining = db
      .prepare(`SELECT * FROM behaviours_of_concern WHERE participant_id = ?`)
      .all(created.id);
    expect(remaining).toHaveLength(0);
  });

  it("throws when updating or fetching-or-throwing a missing participant", () => {
    expect(() => repo.getOrThrow("missing")).toThrow();
    expect(() => repo.update("missing", { age: 1 })).toThrow();
  });
});

describe("Strategy Library view helpers", () => {
  let dbFile: string;
  let db: Database.Database;
  let repo: ParticipantRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "participant-profile-")), "test.db");
    db = openDatabase(dbFile);
    repo = new ParticipantRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("keeps eligibility filters and personalisation context disjoint", () => {
    const participant = repo.create(
      baseInput({
        behavioursOfConcern: [{ name: "Elopement", briefDescription: "x", linkedFbaRecordId: null }],
      })
    );

    const eligibility = getEligibilityFilters(participant);
    const personalisation = getPersonalisationContext(participant);
    const behaviours = getBehaviourRelevanceTags(participant);

    // culturalConstraints and age must never appear in the personalisation context.
    expect(personalisation).not.toHaveProperty("culturalConstraints");
    expect(personalisation).not.toHaveProperty("age");
    expect(eligibility.culturalConstraints).toBe(participant.culturalConstraints);
    expect(eligibility.age).toBe(participant.age);

    expect(behaviours).toEqual([
      {
        id: participant.behavioursOfConcern[0].id,
        name: "Elopement",
        briefDescription: "x",
        linkedFbaRecordId: null,
      },
    ]);
  });
});
