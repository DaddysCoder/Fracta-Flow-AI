import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/storage/db";
import { StrategyTemplateRepository } from "../src/templateRepository";
import { SEED_TEMPLATES } from "../src/seed/templates";

describe("StrategyTemplateRepository", () => {
  let dbFile: string;
  let db: Database.Database;
  let repo: StrategyTemplateRepository;

  beforeEach(() => {
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "strategy-library-")), "test.db");
    db = openDatabase(dbFile);
    repo = new StrategyTemplateRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
  });

  it("seeds all 15 templates and 3 sources on open", () => {
    expect(repo.list()).toHaveLength(SEED_TEMPLATES.length);
    expect(repo.getSource("crates-spicer-2012")).not.toBeNull();
    expect(repo.getSource("hassiotis-2018")).not.toBeNull();
    expect(repo.getSource("paulauskaite-2019")).not.toBeNull();
  });

  it("resolves a template with its sources joined", () => {
    const withSources = repo.getWithSources("differential-reinforcement");
    expect(withSources).not.toBeNull();
    expect(withSources!.sources.map((s) => s.id).sort()).toEqual([
      "crates-spicer-2012",
      "hassiotis-2018",
    ]);
  });

  it("filters templates by category", () => {
    const environmental = repo.list({ categories: ["environmental"] });
    expect(environmental.map((t) => t.id).sort()).toEqual(
      ["ecological-strategies", "visual-scheduling", "antecedent-control-strategies", "time-based-reinforcement"].sort()
    );
  });

  it("filters templates by evidence tier", () => {
    const rcts = repo.list({ evidenceTier: ["rct"] });
    expect(rcts.length).toBeGreaterThan(0);
    for (const t of rcts) expect(t.evidenceTier).toBe("rct");
  });

  it("keeps Responsive strategies out of the category filter and in their own section", () => {
    const proactive = repo.list({ isResponsive: false });
    const responsive = repo.list({ isResponsive: true });

    expect(proactive.some((t) => t.isResponsive)).toBe(false);
    expect(responsive.every((t) => t.isResponsive)).toBe(true);
    expect(responsive.map((t) => t.id).sort()).toEqual(
      ["nonaversive-reactive-strategies", "reactive-strategies"].sort()
    );
  });

  it("resolves the supersededBy chain to the current template", () => {
    const current = repo.resolveCurrent("positive-behaviour-support");
    expect(current?.id).toBe("differential-reinforcement");
  });

  it("returns the template itself when nothing supersedes it", () => {
    const current = repo.resolveCurrent("skills-teaching");
    expect(current?.id).toBe("skills-teaching");
  });

  it("upsert seeding never downgrades a locally-ahead template version", () => {
    db.prepare(`UPDATE strategy_templates SET version = 99, technique_name = 'Locally Edited' WHERE id = ?`).run(
      "ecological-strategies"
    );

    // Re-opening (which re-seeds) must not clobber the locally-ahead row.
    openDatabase(dbFile);

    const template = repo.get("ecological-strategies");
    expect(template?.version).toBe(99);
    expect(template?.techniqueName).toBe("Locally Edited");
  });
});
