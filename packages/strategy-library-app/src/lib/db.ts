import Dexie, { type Table } from "dexie";
import type { Participant } from "@fracta-flow/participant-profile/core";
import type { PersonalisationRecord } from "@fracta-flow/strategy-library/core";

/**
 * Browser-local storage via IndexedDB (Dexie), matching the suite's
 * "SQLite/Dexie for local-only pieces" architecture note — the browser
 * can't run the better-sqlite3-backed repositories from
 * @fracta-flow/participant-profile / @fracta-flow/strategy-library
 * (native Node addon), so this app persists the exact same `Participant`
 * and `PersonalisationRecord` shapes via Dexie instead.
 *
 * StrategyTemplate/StrategySource content is NOT stored here — it's
 * centrally-hosted published content, read directly from
 * `SEED_TEMPLATES`/`SEED_SOURCES` (bundled, in-memory, read-only in this
 * app).
 *
 * KNOWN LIMITATION: this app's `Participant` records are local to this
 * browser and independent of any records created via the headless
 * @fracta-flow/participant-profile SQLite module — there is no sync
 * between the two storage backends yet. A full Participant Profile UI is
 * out of scope for the Strategy Library; the participant picker here is
 * a lightweight subset (age, culturalConstraints, interests,
 * communication mode) sufficient to demonstrate eligibility filtering
 * and personalisation-axis data-availability, not a replacement for it.
 */
export class StrategyLibraryDB extends Dexie {
  participants!: Table<Participant, string>;
  personalisationRecords!: Table<PersonalisationRecord, string>;

  constructor() {
    super("fracta-flow-strategy-library");
    this.version(1).stores({
      participants: "id, createdAt",
      personalisationRecords: "id, strategyTemplateId, participantRef, authoredAt",
    });
  }
}

export const db = new StrategyLibraryDB();
