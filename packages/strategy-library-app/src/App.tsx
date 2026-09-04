import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { hasAcknowledgedConsent } from "./lib/consent";
import { db } from "./lib/db";
import { ConsentGate } from "./components/ConsentGate";
import { ParticipantPicker } from "./components/ParticipantPicker";
import { StrategyBrowser } from "./components/StrategyBrowser";
import { TemplateDetail } from "./components/TemplateDetail";
import { RecordsList } from "./components/RecordsList";
import { EvidenceSearch } from "./components/EvidenceSearch";
import { BrandLockup } from "./components/BrandLockup";

type View =
  | { name: "browse" }
  | { name: "template"; templateId: string }
  | { name: "records" }
  | { name: "evidence" };

export default function App() {
  const [acknowledged, setAcknowledged] = useState(hasAcknowledgedConsent());
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "browse" });

  // undefined while loading — see ParticipantPicker/RecordsList for why
  // that distinction matters (the FBA tool's known useLiveQuery bug).
  const activeParticipant = useLiveQuery(
    () => (activeParticipantId ? db.participants.get(activeParticipantId) : undefined),
    [activeParticipantId]
  );

  if (!acknowledged) {
    return <ConsentGate onAcknowledge={() => setAcknowledged(true)} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-paper md:flex-row">
      {/*
        Sidebar chrome (participant picker, nav) stays ink-only, never
        purple — it's persistent alongside every screen's main content,
        so keeping it purple-free is what guarantees "one purple element
        per screen" actually holds once you count the whole layout, not
        just whatever's in <main>.
      */}
      <aside className="w-full shrink-0 border-b border-brand-border bg-brand-paper md:w-72 md:border-b-0 md:border-r">
        <div className="border-b border-brand-border p-6">
          <BrandLockup />
          <p className="mt-2 text-xs text-brand-muted">Strategy Library — decision support, not diagnostic.</p>
        </div>

        <ParticipantPicker activeParticipantId={activeParticipantId} onSelect={setActiveParticipantId} />

        <nav className="space-y-1 p-6">
          <NavButton active={view.name === "browse"} onClick={() => setView({ name: "browse" })}>
            Browse strategies
          </NavButton>
          <NavButton active={view.name === "records"} onClick={() => setView({ name: "records" })}>
            My records
          </NavButton>
          <NavButton active={view.name === "evidence"} onClick={() => setView({ name: "evidence" })}>
            Evidence
          </NavButton>
        </nav>
      </aside>

      {/*
        §4/§5 of the brand kit: cap body-copy line length, don't run text
        edge to edge on wide screens. A single max-w constraint here
        covers every screen rather than patching individual paragraphs —
        768px comfortably fits TemplateDetail's two-column field grid
        while still keeping prose readable.
      */}
      <main className="flex-1 p-8 md:p-16">
        <div className="mx-auto max-w-3xl">
          {view.name === "browse" && (
            <StrategyBrowser
              activeParticipant={activeParticipant ?? null}
              onSelectTemplate={(templateId) => setView({ name: "template", templateId })}
            />
          )}
          {view.name === "template" && (
            <TemplateDetail
              templateId={view.templateId}
              activeParticipant={activeParticipant ?? null}
              onBack={() => setView({ name: "browse" })}
            />
          )}
          {view.name === "records" && <RecordsList activeParticipant={activeParticipant ?? null} />}
          {view.name === "evidence" && <EvidenceSearch activeParticipant={activeParticipant ?? null} />}
        </div>
      </main>
    </div>
  );
}

function NavButton({
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
      className={`w-full rounded-brand px-3 py-2 text-left text-sm font-medium ${
        active ? "bg-brand-ink text-white" : "text-brand-muted hover:bg-brand-surface"
      }`}
    >
      {children}
    </button>
  );
}
