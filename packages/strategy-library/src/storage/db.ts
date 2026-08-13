import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { SEED_SOURCES } from "../seed/sources";
import { SEED_TEMPLATES } from "../seed/templates";

/**
 * StrategySource and StrategyTemplate are centrally owned/hosted published
 * content, not participant data — practitioners get read access to browse
 * a local cache of it, seeded here from ../seed. PersonalisationRecord is
 * local participant-linked data, same privacy posture as the Participant
 * Profile module and the FBA tool.
 *
 * Both live in the same SQLite file for simplicity of local deployment,
 * but are logically separate: the seed tables are re-seeded (upserted) on
 * every open, so editing ../seed content and restarting is how the
 * "centrally hosted" content updates locally for now — no separate sync
 * mechanism exists yet.
 */
export function openDatabase(filePath: string): Database.Database {
  const dir = path.dirname(filePath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS strategy_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      publication_year INTEGER NOT NULL,
      url_or_doi TEXT,
      publisher_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategy_templates (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      technique_name TEXT NOT NULL,
      description TEXT NOT NULL,
      mechanism TEXT NOT NULL DEFAULT '',
      strategy_category TEXT NOT NULL DEFAULT '[]',
      is_responsive INTEGER NOT NULL DEFAULT 0,
      population TEXT NOT NULL DEFAULT '[]',
      evidence_tier TEXT NOT NULL,
      evidence_summary TEXT NOT NULL,
      source_ids TEXT NOT NULL DEFAULT '[]',
      prerequisites TEXT NOT NULL DEFAULT '',
      capacity_considerations TEXT NOT NULL DEFAULT '[]',
      capacity_considerations_note TEXT NOT NULL DEFAULT '',
      contraindications TEXT NOT NULL DEFAULT '',
      safety_boundary TEXT,
      measurement_guidance TEXT NOT NULL DEFAULT '',
      delivery_format TEXT NOT NULL DEFAULT '',
      personalization_axes TEXT NOT NULL DEFAULT '[]',
      superseded_by TEXT
    );

    CREATE TABLE IF NOT EXISTS personalisation_records (
      id TEXT PRIMARY KEY,
      strategy_template_id TEXT NOT NULL,
      template_version_used INTEGER NOT NULL,
      participant_ref TEXT NOT NULL,
      personalised_activity TEXT NOT NULL,
      rationale TEXT NOT NULL DEFAULT '',
      authored_by TEXT NOT NULL,
      authored_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_personalisation_records_participant_ref
      ON personalisation_records(participant_ref);
  `);
}

/**
 * Upserts seed sources/templates, only overwriting an existing row when
 * the incoming content is a newer version — so a stale seed build never
 * downgrades a locally-cached template that's already ahead.
 */
function seed(db: Database.Database): void {
  const upsertSource = db.prepare(`
    INSERT INTO strategy_sources (id, title, authors, publication_year, url_or_doi, publisher_type)
    VALUES (@id, @title, @authors, @publicationYear, @urlOrDoi, @publisherType)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      authors = excluded.authors,
      publication_year = excluded.publication_year,
      url_or_doi = excluded.url_or_doi,
      publisher_type = excluded.publisher_type
  `);

  const upsertTemplate = db.prepare(`
    INSERT INTO strategy_templates (
      id, version, technique_name, description, mechanism, strategy_category, is_responsive,
      population, evidence_tier, evidence_summary, source_ids, prerequisites,
      capacity_considerations, capacity_considerations_note, contraindications,
      safety_boundary, measurement_guidance, delivery_format, personalization_axes,
      superseded_by
    ) VALUES (
      @id, @version, @techniqueName, @description, @mechanism, @strategyCategory, @isResponsive,
      @population, @evidenceTier, @evidenceSummary, @sourceIds, @prerequisites,
      @capacityConsiderations, @capacityConsiderationsNote, @contraindications,
      @safetyBoundary, @measurementGuidance, @deliveryFormat, @personalizationAxes,
      @supersededBy
    )
    ON CONFLICT(id) DO UPDATE SET
      version = excluded.version,
      technique_name = excluded.technique_name,
      description = excluded.description,
      mechanism = excluded.mechanism,
      strategy_category = excluded.strategy_category,
      is_responsive = excluded.is_responsive,
      population = excluded.population,
      evidence_tier = excluded.evidence_tier,
      evidence_summary = excluded.evidence_summary,
      source_ids = excluded.source_ids,
      prerequisites = excluded.prerequisites,
      capacity_considerations = excluded.capacity_considerations,
      capacity_considerations_note = excluded.capacity_considerations_note,
      contraindications = excluded.contraindications,
      safety_boundary = excluded.safety_boundary,
      measurement_guidance = excluded.measurement_guidance,
      delivery_format = excluded.delivery_format,
      personalization_axes = excluded.personalization_axes,
      superseded_by = excluded.superseded_by
    WHERE excluded.version > strategy_templates.version
  `);

  const run = db.transaction(() => {
    for (const source of SEED_SOURCES) {
      upsertSource.run(source);
    }
    for (const template of SEED_TEMPLATES) {
      upsertTemplate.run({
        ...template,
        strategyCategory: JSON.stringify(template.strategyCategory),
        isResponsive: template.isResponsive ? 1 : 0,
        population: JSON.stringify(template.population),
        sourceIds: JSON.stringify(template.sourceIds),
        capacityConsiderations: JSON.stringify(template.capacityConsiderations),
        personalizationAxes: JSON.stringify(template.personalizationAxes),
      });
    }
  });

  run();
}
