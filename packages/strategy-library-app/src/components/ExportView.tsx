import { useState, type ReactNode } from "react";
import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { PersonalisationRecord } from "@fracta-flow/strategy-library/core";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { SEED_SOURCES, SEED_TEMPLATES, assembleExportText } = StrategyLibraryCore;

/**
 * Assembles, doesn't generate — matches the FBA tool's DocumentationExport
 * pattern. Offers copy-to-clipboard and a plain-text file download.
 * "Copy to clipboard" is this modal's one purple element; "Download" and
 * "Close" stay ink/outline.
 */
export function ExportView({ record, onClose }: { record: PersonalisationRecord; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const foundTemplate = SEED_TEMPLATES.find((t) => t.id === record.strategyTemplateId);

  if (!foundTemplate) {
    return (
      <Modal onClose={onClose}>
        <p className="text-sm text-brand-ink">Template not found for this record.</p>
      </Modal>
    );
  }

  const template = foundTemplate;
  const sources = SEED_SOURCES.filter((s) => template.sourceIds.includes(s.id));
  const text = assembleExportText(record, template, sources);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.id}-${record.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-base text-brand-ink">Plan-ready export</h3>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-brand border border-brand-border bg-brand-surface p-3 text-xs text-brand-ink">
        {text}
      </pre>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-brand bg-brand-purple px-3 py-1.5 text-xs font-medium text-white"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-brand border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-ink hover:border-brand-ink"
        >
          Download .txt
        </button>
        <button type="button" onClick={onClose} className="ml-auto rounded-brand px-3 py-1.5 text-xs text-brand-muted">
          Close
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-brand-ink/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-brand border border-brand-border bg-brand-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
