import { useState, type ReactNode } from "react";
import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { PersonalisationRecord } from "@fracta-flow/strategy-library/core";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { SEED_SOURCES, SEED_TEMPLATES, assembleExportText } = StrategyLibraryCore;

/**
 * Assembles, doesn't generate — matches the FBA tool's DocumentationExport
 * pattern. Offers copy-to-clipboard and a plain-text file download.
 */
export function ExportView({ record, onClose }: { record: PersonalisationRecord; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const foundTemplate = SEED_TEMPLATES.find((t) => t.id === record.strategyTemplateId);

  if (!foundTemplate) {
    return (
      <Modal onClose={onClose}>
        <p className="text-sm text-red-600">Template not found for this record.</p>
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
      <h3 className="text-sm font-semibold text-slate-900">Plan-ready export</h3>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-800">
        {text}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Download .txt
        </button>
        <button type="button" onClick={onClose} className="ml-auto rounded px-3 py-1.5 text-xs text-slate-500">
          Close
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
