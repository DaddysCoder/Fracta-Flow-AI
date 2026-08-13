import type Database from "better-sqlite3";
import type {
  CapacityConsideration,
  EvidenceTier,
  PersonalisationAxis,
  StrategyCategory,
  StrategySource,
  StrategyTemplate,
  StrategyTemplateWithSources,
} from "./types";
import { resolveCurrentTemplate } from "./supersede";

interface SourceRow {
  id: string;
  title: string;
  authors: string;
  publication_year: number;
  url_or_doi: string | null;
  publisher_type: StrategySource["publisherType"];
}

interface TemplateRow {
  id: string;
  version: number;
  technique_name: string;
  description: string;
  mechanism: string;
  strategy_category: string;
  is_responsive: number;
  population: string;
  evidence_tier: EvidenceTier;
  evidence_summary: string;
  source_ids: string;
  prerequisites: string;
  capacity_considerations: string;
  capacity_considerations_note: string;
  contraindications: string;
  safety_boundary: string | null;
  measurement_guidance: string;
  delivery_format: string;
  personalization_axes: string;
  superseded_by: string | null;
}

function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToSource(row: SourceRow): StrategySource {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    publicationYear: row.publication_year,
    urlOrDoi: row.url_or_doi,
    publisherType: row.publisher_type,
  };
}

function rowToTemplate(row: TemplateRow): StrategyTemplate {
  return {
    id: row.id,
    version: row.version,
    techniqueName: row.technique_name,
    description: row.description,
    mechanism: row.mechanism,
    strategyCategory: parseJson<StrategyCategory[]>(row.strategy_category, []),
    isResponsive: !!row.is_responsive,
    population: parseJson<string[]>(row.population, []),
    evidenceTier: row.evidence_tier,
    evidenceSummary: row.evidence_summary,
    sourceIds: parseJson<string[]>(row.source_ids, []),
    prerequisites: row.prerequisites,
    capacityConsiderations: parseJson<CapacityConsideration[]>(row.capacity_considerations, []),
    capacityConsiderationsNote: row.capacity_considerations_note,
    contraindications: row.contraindications,
    safetyBoundary: row.safety_boundary,
    measurementGuidance: row.measurement_guidance,
    deliveryFormat: row.delivery_format,
    personalizationAxes: parseJson<PersonalisationAxis[]>(row.personalization_axes, []),
    supersededBy: row.superseded_by,
  };
}

export interface TemplateFilter {
  /** Match if the template has ANY of these categories. Ignored for responsive templates unless includeResponsive is also requested. */
  categories?: StrategyCategory[];
  evidenceTier?: EvidenceTier[];
  /**
   * true: only responsive strategies. false: only the six proactive
   * categories. undefined: both — but callers building a category filter
   * UI should pass false, since Responsive renders in its own section,
   * never mixed into the category filter.
   */
  isResponsive?: boolean;
}

export class StrategyTemplateRepository {
  constructor(private readonly db: Database.Database) {}

  getSource(id: string): StrategySource | null {
    const row = this.db.prepare(`SELECT * FROM strategy_sources WHERE id = ?`).get(id) as
      | SourceRow
      | undefined;
    return row ? rowToSource(row) : null;
  }

  get(id: string): StrategyTemplate | null {
    const row = this.db.prepare(`SELECT * FROM strategy_templates WHERE id = ?`).get(id) as
      | TemplateRow
      | undefined;
    return row ? rowToTemplate(row) : null;
  }

  getWithSources(id: string): StrategyTemplateWithSources | null {
    const template = this.get(id);
    if (!template) return null;
    return { ...template, sources: this.resolveSources(template.sourceIds) };
  }

  list(filter: TemplateFilter = {}): StrategyTemplate[] {
    const rows = this.db.prepare(`SELECT * FROM strategy_templates`).all() as TemplateRow[];
    return rows
      .map(rowToTemplate)
      .filter((template) => this.matchesFilter(template, filter));
  }

  listWithSources(filter: TemplateFilter = {}): StrategyTemplateWithSources[] {
    return this.list(filter).map((template) => ({
      ...template,
      sources: this.resolveSources(template.sourceIds),
    }));
  }

  /**
   * Follows the `supersededBy` chain to the current (non-superseded)
   * template. Hard UI rule from the brief: a superseded figure must never
   * be displayed without the newer result shown alongside or instead of
   * it — callers should use this to fetch what to show *instead of*, and
   * still surface the original for the "alongside" case via `get()`.
   */
  resolveCurrent(id: string): StrategyTemplate | null {
    return resolveCurrentTemplate(id, new Map(this.list().map((t) => [t.id, t])));
  }

  private resolveSources(sourceIds: string[]): StrategySource[] {
    return sourceIds
      .map((id) => this.getSource(id))
      .filter((source): source is StrategySource => source !== null);
  }

  private matchesFilter(template: StrategyTemplate, filter: TemplateFilter): boolean {
    if (filter.isResponsive !== undefined && template.isResponsive !== filter.isResponsive) {
      return false;
    }
    if (filter.categories && filter.categories.length > 0) {
      const hasMatch = template.strategyCategory.some((c) => filter.categories!.includes(c));
      if (!hasMatch) return false;
    }
    if (filter.evidenceTier && filter.evidenceTier.length > 0) {
      if (!filter.evidenceTier.includes(template.evidenceTier)) return false;
    }
    return true;
  }
}
