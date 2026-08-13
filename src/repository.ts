import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type {
  BehaviourOfConcern,
  Participant,
  ParticipantInput,
  ParticipantUpdate,
} from "./types";

interface ParticipantRow {
  id: string;
  created_at: string;
  updated_at: string;
  age: number | null;
  cultural_constraints: string;
  interests_general: string;
  interests_strengths: string;
  interests_dislikes: string;
  communication_mode: string;
  communication_indicates_no_or_discomfort: string;
  cognitive_capacity_notes: string;
  cognitive_processing_speed: string;
  cognitive_attention_span: string;
  physical_mobility: string;
  physical_stamina: string;
  physical_sensory: string;
  health_diagnosis: string;
  health_other_notes: string;
  context_living_support_situation: string;
  context_environmental_constraints: string;
  goals: string;
}

interface BehaviourRow {
  id: string;
  participant_id: string;
  name: string;
  brief_description: string;
  linked_fba_record_id: string | null;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function fromJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToParticipant(row: ParticipantRow, behaviours: BehaviourRow[]): Participant {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    age: row.age,
    culturalConstraints: row.cultural_constraints,
    interests: {
      general: fromJson(row.interests_general, []),
      strengths: fromJson(row.interests_strengths, []),
      dislikes: fromJson(row.interests_dislikes, []),
    },
    communication: {
      mode: row.communication_mode,
      indicatesNoOrDiscomfort: row.communication_indicates_no_or_discomfort,
    },
    cognitive: {
      capacityNotes: row.cognitive_capacity_notes,
      processingSpeed: row.cognitive_processing_speed,
      attentionSpan: row.cognitive_attention_span,
    },
    physical: {
      mobility: row.physical_mobility,
      stamina: row.physical_stamina,
      sensory: row.physical_sensory,
    },
    health: {
      diagnosis: fromJson(row.health_diagnosis, []),
      otherNotes: row.health_other_notes,
    },
    context: {
      livingSupportSituation: row.context_living_support_situation,
      environmentalConstraints: row.context_environmental_constraints,
    },
    goals: fromJson(row.goals, []),
    behavioursOfConcern: behaviours.map(
      (b): BehaviourOfConcern => ({
        id: b.id,
        name: b.name,
        briefDescription: b.brief_description,
        linkedFbaRecordId: b.linked_fba_record_id,
      })
    ),
  };
}

export class ParticipantRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: ParticipantInput): Participant {
    const now = new Date().toISOString();
    const id = uuid();

    this.db
      .prepare(
        `INSERT INTO participants (
          id, created_at, updated_at, age, cultural_constraints,
          interests_general, interests_strengths, interests_dislikes,
          communication_mode, communication_indicates_no_or_discomfort,
          cognitive_capacity_notes, cognitive_processing_speed, cognitive_attention_span,
          physical_mobility, physical_stamina, physical_sensory,
          health_diagnosis, health_other_notes,
          context_living_support_situation, context_environmental_constraints,
          goals
        ) VALUES (
          @id, @created_at, @updated_at, @age, @cultural_constraints,
          @interests_general, @interests_strengths, @interests_dislikes,
          @communication_mode, @communication_indicates_no_or_discomfort,
          @cognitive_capacity_notes, @cognitive_processing_speed, @cognitive_attention_span,
          @physical_mobility, @physical_stamina, @physical_sensory,
          @health_diagnosis, @health_other_notes,
          @context_living_support_situation, @context_environmental_constraints,
          @goals
        )`
      )
      .run({
        id,
        created_at: now,
        updated_at: now,
        age: input.age,
        cultural_constraints: input.culturalConstraints ?? "",
        interests_general: toJson(input.interests.general),
        interests_strengths: toJson(input.interests.strengths),
        interests_dislikes: toJson(input.interests.dislikes),
        communication_mode: input.communication.mode,
        communication_indicates_no_or_discomfort: input.communication.indicatesNoOrDiscomfort,
        cognitive_capacity_notes: input.cognitive.capacityNotes,
        cognitive_processing_speed: input.cognitive.processingSpeed,
        cognitive_attention_span: input.cognitive.attentionSpan,
        physical_mobility: input.physical.mobility,
        physical_stamina: input.physical.stamina,
        physical_sensory: input.physical.sensory,
        health_diagnosis: toJson(input.health.diagnosis),
        health_other_notes: input.health.otherNotes,
        context_living_support_situation: input.context.livingSupportSituation,
        context_environmental_constraints: input.context.environmentalConstraints,
        goals: toJson(input.goals),
      });

    for (const b of input.behavioursOfConcern ?? []) {
      this.insertBehaviour(id, b);
    }

    return this.getOrThrow(id);
  }

  get(id: string): Participant | null {
    const row = this.db
      .prepare(`SELECT * FROM participants WHERE id = ?`)
      .get(id) as ParticipantRow | undefined;
    if (!row) return null;

    const behaviours = this.db
      .prepare(`SELECT * FROM behaviours_of_concern WHERE participant_id = ?`)
      .all(id) as BehaviourRow[];

    return rowToParticipant(row, behaviours);
  }

  getOrThrow(id: string): Participant {
    const participant = this.get(id);
    if (!participant) throw new Error(`Participant not found: ${id}`);
    return participant;
  }

  list(): Participant[] {
    const rows = this.db.prepare(`SELECT * FROM participants ORDER BY created_at`).all() as ParticipantRow[];
    return rows.map((row) => {
      const behaviours = this.db
        .prepare(`SELECT * FROM behaviours_of_concern WHERE participant_id = ?`)
        .all(row.id) as BehaviourRow[];
      return rowToParticipant(row, behaviours);
    });
  }

  update(id: string, update: ParticipantUpdate): Participant {
    const existing = this.getOrThrow(id);
    const merged: Participant = {
      ...existing,
      ...update,
      interests: { ...existing.interests, ...update.interests },
      communication: { ...existing.communication, ...update.communication },
      cognitive: { ...existing.cognitive, ...update.cognitive },
      physical: { ...existing.physical, ...update.physical },
      health: { ...existing.health, ...update.health },
      context: { ...existing.context, ...update.context },
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE participants SET
          updated_at = @updated_at,
          age = @age,
          cultural_constraints = @cultural_constraints,
          interests_general = @interests_general,
          interests_strengths = @interests_strengths,
          interests_dislikes = @interests_dislikes,
          communication_mode = @communication_mode,
          communication_indicates_no_or_discomfort = @communication_indicates_no_or_discomfort,
          cognitive_capacity_notes = @cognitive_capacity_notes,
          cognitive_processing_speed = @cognitive_processing_speed,
          cognitive_attention_span = @cognitive_attention_span,
          physical_mobility = @physical_mobility,
          physical_stamina = @physical_stamina,
          physical_sensory = @physical_sensory,
          health_diagnosis = @health_diagnosis,
          health_other_notes = @health_other_notes,
          context_living_support_situation = @context_living_support_situation,
          context_environmental_constraints = @context_environmental_constraints,
          goals = @goals
        WHERE id = @id`
      )
      .run({
        id,
        updated_at: merged.updatedAt,
        age: merged.age,
        cultural_constraints: merged.culturalConstraints,
        interests_general: toJson(merged.interests.general),
        interests_strengths: toJson(merged.interests.strengths),
        interests_dislikes: toJson(merged.interests.dislikes),
        communication_mode: merged.communication.mode,
        communication_indicates_no_or_discomfort: merged.communication.indicatesNoOrDiscomfort,
        cognitive_capacity_notes: merged.cognitive.capacityNotes,
        cognitive_processing_speed: merged.cognitive.processingSpeed,
        cognitive_attention_span: merged.cognitive.attentionSpan,
        physical_mobility: merged.physical.mobility,
        physical_stamina: merged.physical.stamina,
        physical_sensory: merged.physical.sensory,
        health_diagnosis: toJson(merged.health.diagnosis),
        health_other_notes: merged.health.otherNotes,
        context_living_support_situation: merged.context.livingSupportSituation,
        context_environmental_constraints: merged.context.environmentalConstraints,
        goals: toJson(merged.goals),
      });

    if (update.behavioursOfConcern) {
      this.db.prepare(`DELETE FROM behaviours_of_concern WHERE participant_id = ?`).run(id);
      for (const b of update.behavioursOfConcern) {
        this.insertBehaviour(id, b.id ? b : { ...b });
      }
    }

    return this.getOrThrow(id);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM participants WHERE id = ?`).run(id);
  }

  addBehaviourOfConcern(
    participantId: string,
    behaviour: Omit<BehaviourOfConcern, "id"> & { id?: string }
  ): Participant {
    this.insertBehaviour(participantId, behaviour);
    this.touch(participantId);
    return this.getOrThrow(participantId);
  }

  removeBehaviourOfConcern(participantId: string, behaviourId: string): Participant {
    this.db.prepare(`DELETE FROM behaviours_of_concern WHERE id = ? AND participant_id = ?`).run(
      behaviourId,
      participantId
    );
    this.touch(participantId);
    return this.getOrThrow(participantId);
  }

  private insertBehaviour(
    participantId: string,
    behaviour: Omit<BehaviourOfConcern, "id"> & { id?: string }
  ): void {
    this.db
      .prepare(
        `INSERT INTO behaviours_of_concern (id, participant_id, name, brief_description, linked_fba_record_id)
         VALUES (@id, @participant_id, @name, @brief_description, @linked_fba_record_id)`
      )
      .run({
        id: behaviour.id ?? uuid(),
        participant_id: participantId,
        name: behaviour.name,
        brief_description: behaviour.briefDescription,
        linked_fba_record_id: behaviour.linkedFbaRecordId ?? null,
      });
  }

  private touch(participantId: string): void {
    this.db
      .prepare(`UPDATE participants SET updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), participantId);
  }
}
