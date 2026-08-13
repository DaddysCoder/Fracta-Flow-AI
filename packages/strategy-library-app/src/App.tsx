import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { hasAcknowledgedConsent } from "./lib/consent";
import { db } from "./lib/db";
import { ConsentGate } from "./components/ConsentGate";
import { ParticipantPicker } from "./components/ParticipantPicker";
import { StrategyBrowser } from "./components/StrategyBrowser";
import { TemplateDetail } from "./components/TemplateDetail";
import { RecordsList } from "./components/RecordsList";

type View = { name: "browse" } | { name: "template"; templateId: string } | { name: "records" };

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
    <div className="flex min-h-screen">
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h1 className="text-base font-semibold text-slate-900">Strategy Library</h1>
          <p className="mt-0.5 text-xs text-slate-500">Decision support, not diagnostic.</p>
        </div>

        <ParticipantPicker activeParticipantId={activeParticipantId} onSelect={setActiveParticipantId} />

        <nav className="space-y-1 p-4">
          <NavButton active={view.name === "browse"} onClick={() => setView({ name: "browse" })}>
            Browse strategies
          </NavButton>
          <NavButton active={view.name === "records"} onClick={() => setView({ name: "records" })}>
            My records
          </NavButton>
        </nav>
      </aside>

      <main className="flex-1 p-6">
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
      className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
