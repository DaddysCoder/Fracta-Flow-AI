import type { StrategyTemplate } from "./types";

/**
 * Pure, storage-agnostic version of the `supersededBy` chain walk used by
 * `StrategyTemplateRepository.resolveCurrent` — usable anywhere a list of
 * StrategyTemplate is already in memory (e.g. browser code holding the
 * bundled seed content, with no SQLite access). Hard UI rule from the
 * brief: a superseded figure must never be shown without the newer
 * result shown alongside or instead of it.
 */
export function resolveCurrentTemplate(
  id: string,
  templates: StrategyTemplate[] | Map<string, StrategyTemplate>
): StrategyTemplate | null {
  const byId = templates instanceof Map ? templates : new Map(templates.map((t) => [t.id, t]));

  const seen = new Set<string>();
  let current = byId.get(id) ?? null;
  while (current?.supersededBy && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.supersededBy);
    if (!next) break;
    current = next;
  }
  return current;
}
