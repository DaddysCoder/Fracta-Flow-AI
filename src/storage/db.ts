import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

/**
 * Local-first storage: a single SQLite file owned by the practitioner,
 * consistent with the FBA tool's architecture. No network calls, no
 * vendor hosting.
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
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      age INTEGER,
      cultural_constraints TEXT NOT NULL DEFAULT '',

      interests_general TEXT NOT NULL DEFAULT '[]',
      interests_strengths TEXT NOT NULL DEFAULT '[]',
      interests_dislikes TEXT NOT NULL DEFAULT '[]',

      communication_mode TEXT NOT NULL DEFAULT '',
      communication_indicates_no_or_discomfort TEXT NOT NULL DEFAULT '',

      cognitive_capacity_notes TEXT NOT NULL DEFAULT '',
      cognitive_processing_speed TEXT NOT NULL DEFAULT '',
      cognitive_attention_span TEXT NOT NULL DEFAULT '',

      physical_mobility TEXT NOT NULL DEFAULT '',
      physical_stamina TEXT NOT NULL DEFAULT '',
      physical_sensory TEXT NOT NULL DEFAULT '',

      health_diagnosis TEXT NOT NULL DEFAULT '[]',
      health_other_notes TEXT NOT NULL DEFAULT '',

      context_living_support_situation TEXT NOT NULL DEFAULT '',
      context_environmental_constraints TEXT NOT NULL DEFAULT '',

      goals TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS behaviours_of_concern (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      brief_description TEXT NOT NULL DEFAULT '',
      linked_fba_record_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_behaviours_of_concern_participant_id
      ON behaviours_of_concern(participant_id);
  `);
}
