import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type {
  PersonalisationRecord,
  PersonalisationRecordInput,
  PersonalisationRecordUpdate,
} from "./types";

interface RecordRow {
  id: string;
  strategy_template_id: string;
  template_version_used: number;
  participant_ref: string;
  personalised_activity: string;
  rationale: string;
  authored_by: string;
  authored_at: string;
  status: PersonalisationRecord["status"];
}

function rowToRecord(row: RecordRow): PersonalisationRecord {
  return {
    id: row.id,
    strategyTemplateId: row.strategy_template_id,
    templateVersionUsed: row.template_version_used,
    participantRef: row.participant_ref,
    personalisedActivity: row.personalised_activity,
    rationale: row.rationale,
    authoredBy: row.authored_by,
    authoredAt: row.authored_at,
    status: row.status,
  };
}

/**
 * Local, participant-linked, practitioner-authored records. Always a
 * practitioner act — the system never fills `personalisedActivity` or
 * `rationale` on its own.
 */
export class PersonalisationRecordRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: PersonalisationRecordInput): PersonalisationRecord {
    const id = uuid();
    const authoredAt = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO personalisation_records (
          id, strategy_template_id, template_version_used, participant_ref,
          personalised_activity, rationale, authored_by, authored_at, status
        ) VALUES (
          @id, @strategy_template_id, @template_version_used, @participant_ref,
          @personalised_activity, @rationale, @authored_by, @authored_at, @status
        )`
      )
      .run({
        id,
        strategy_template_id: input.strategyTemplateId,
        template_version_used: input.templateVersionUsed,
        participant_ref: input.participantRef,
        personalised_activity: input.personalisedActivity,
        rationale: input.rationale,
        authored_by: input.authoredBy,
        authored_at: authoredAt,
        status: input.status,
      });

    return this.getOrThrow(id);
  }

  get(id: string): PersonalisationRecord | null {
    const row = this.db.prepare(`SELECT * FROM personalisation_records WHERE id = ?`).get(id) as
      | RecordRow
      | undefined;
    return row ? rowToRecord(row) : null;
  }

  getOrThrow(id: string): PersonalisationRecord {
    const record = this.get(id);
    if (!record) throw new Error(`PersonalisationRecord not found: ${id}`);
    return record;
  }

  listForParticipant(participantRef: string): PersonalisationRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM personalisation_records WHERE participant_ref = ? ORDER BY authored_at`)
      .all(participantRef) as RecordRow[];
    return rows.map(rowToRecord);
  }

  update(id: string, update: PersonalisationRecordUpdate): PersonalisationRecord {
    const existing = this.getOrThrow(id);
    const merged: PersonalisationRecord = { ...existing, ...update };

    this.db
      .prepare(
        `UPDATE personalisation_records SET
          personalised_activity = @personalised_activity,
          rationale = @rationale,
          authored_by = @authored_by,
          status = @status
        WHERE id = @id`
      )
      .run({
        id,
        personalised_activity: merged.personalisedActivity,
        rationale: merged.rationale,
        authored_by: merged.authoredBy,
        status: merged.status,
      });

    return this.getOrThrow(id);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM personalisation_records WHERE id = ?`).run(id);
  }
}
