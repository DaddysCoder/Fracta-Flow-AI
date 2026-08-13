import { useMemo, useState, type ReactNode } from "react";
import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { EvidenceTier, StrategyCategory, StrategyTemplate } from "@fracta-flow/strategy-library/core";
import * as ParticipantProfileCore from "@fracta-flow/participant-profile/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  EVIDENCE_TIER_LABELS,
  EVIDENCE_TIER_ORDER,
  ESCALATION_PHASES,
  ESCALATION_PHASE_LABELS,
  type EscalationPhase,
} from "../lib/constants";
import { SupersededBanner } from "./SupersededBanner";

// See ParticipantPicker.tsx for why these are namespace imports rather
// than named imports.
const { SEED_TEMPLATES, filterEligibleTemplates } = StrategyLibraryCore;
const { getEligibilityFilters } = ParticipantProfileCore;

/**
 * Responsive strategies render in their own section, never mixed into
 * the category filter — the brief calls this out as a hard requirement.
 *
 * No purple on this screen: it's a browse view with no single primary
 * action, so there's nothing here that should claim the one-purple-per-
 * screen budget.
 */
export function StrategyBrowser({
  activeParticipant,
  onSelectTemplate,
}: {
  activeParticipant: Participant | null;
  onSelectTemplate: (id: string) => void;
}) {
  const [tab, setTab] = useState<"proactive" | "responsive">("proactive");
  const [categories, setCategories] = useState<StrategyCategory[]>([]);
  const [tiers, setTiers] = useState<EvidenceTier[]>([]);
  const [escalationPhase, setEscalationPhase] = useState<EscalationPhase>("baseline");

  const eligibility = useMemo(
    () => (activeParticipant ? getEligibilityFilters(activeParticipant) : { age: null, culturalConstraints: "" }),
    [activeParticipant]
  );

  const templates = useMemo(() => {
    const byTab = SEED_TEMPLATES.filter((t) => t.isResponsive === (tab === "responsive"));
    const eligible = filterEligibleTemplates(byTab, eligibility);
    if (tab === "responsive") return eligible;
    return eligible.filter((t) => {
      if (categories.length > 0 && !t.strategyCategory.some((c) => categories.includes(c))) return false;
      if (tiers.length > 0 && !tiers.includes(t.evidenceTier)) return false;
      return true;
    });
  }, [tab, categories, tiers, eligibility]);

  function toggleCategory(c: StrategyCategory) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function toggleTier(t: EvidenceTier) {
    setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-2 border-b border-brand-border">
        <button
          type="button"
          onClick={() => setTab("proactive")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "proactive" ? "border-b-2 border-brand-ink text-brand-ink" : "text-brand-muted"
          }`}
        >
          Proactive strategies
        </button>
        <button
          type="button"
          onClick={() => setTab("responsive")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "responsive" ? "border-b-2 border-brand-ink text-brand-ink" : "text-brand-muted"
          }`}
        >
          Responsive strategies
        </button>
      </div>

      {tab === "proactive" ? (
        <div className="flex flex-wrap gap-6">
          <FilterGroup label="Category">
            {CATEGORY_ORDER.map((c) => (
              <FilterChip key={c} active={categories.includes(c)} onClick={() => toggleCategory(c)}>
                {CATEGORY_LABELS[c]}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Evidence tier">
            {EVIDENCE_TIER_ORDER.map((t) => (
              <FilterChip key={t} active={tiers.includes(t)} onClick={() => toggleTier(t)}>
                {EVIDENCE_TIER_LABELS[t]}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      ) : (
        <div className="space-y-2 rounded-brand border border-brand-border bg-brand-surface p-4">
          <p className="text-xs text-brand-muted">
            Responsive strategies scale against the current escalation-cycle phase and the
            participant's safety/capacity — this selection is informational context only, it does
            not filter or rank the list below.
          </p>
          <div className="flex flex-wrap gap-2">
            {ESCALATION_PHASES.map((phase) => (
              <FilterChip key={phase} active={escalationPhase === phase} onClick={() => setEscalationPhase(phase)}>
                {ESCALATION_PHASE_LABELS[phase]}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {!activeParticipant && (
        <p className="rounded-brand border border-brand-border bg-brand-paper p-4 text-sm text-brand-muted">
          Select or create a participant to check eligibility filtering against their profile.
        </p>
      )}

      <div className="grid gap-4">
        {templates.length === 0 && (
          <p className="text-sm text-brand-muted">No strategies match the current filters.</p>
        )}
        {templates.map((t) => (
          <StrategyCard key={t.id} template={t} onClick={() => onSelectTemplate(t.id)} />
        ))}
      </div>
    </div>
  );
}

function StrategyCard({ template, onClick }: { template: StrategyTemplate; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-brand border border-brand-border bg-brand-paper p-4 text-left transition hover:border-brand-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-brand-ink">{template.techniqueName}</h3>
        <span className="whitespace-nowrap rounded-full bg-brand-surface px-2 py-0.5 text-xs text-brand-muted">
          {EVIDENCE_TIER_LABELS[template.evidenceTier]}
        </span>
      </div>
      {template.strategyCategory.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {template.strategyCategory.map((c) => (
            <span key={c} className="rounded bg-brand-surface px-1.5 py-0.5 text-xs text-brand-ink">
              {CATEGORY_LABELS[c]}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-sm text-brand-muted">{template.evidenceSummary}</p>
      {template.supersededBy && (
        <div className="mt-2">
          <SupersededBanner template={template} />
        </div>
      )}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-brand-ink bg-brand-ink text-white"
          : "border-brand-border bg-brand-paper text-brand-muted hover:border-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}
