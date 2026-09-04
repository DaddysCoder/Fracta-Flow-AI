import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import mammoth from "mammoth";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import type { Chunk, KnowledgeDocument } from "./types";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?61|0)[2-478](?:[ -]?\d){8}\b/;
const NDIS_LIKE = /\b(?:NDIS|participant)\s*(?:number|no\.?|#)?\s*[:#-]?\s*\d{6,12}\b/i;
const SUPERSEDED = /\b(?:superseded|obsolete|archived|replaced by|no longer current)\b/i;
const PROMPT_INJECTION = /\b(?:ignore (?:all |the )?(?:previous|prior) instructions|system prompt|developer message|do not follow|override instructions)\b/i;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\b(?:password|passwd|secret|api[_ -]?key)\s*[:=]\s*[^\s]{8,}/i,
];

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".csv"]);
const execFileAsync = promisify(execFile);

function clamConfigFromEnvironment() {
  const configuredPath = process.env.CLAMD_CONFIG?.trim();
  const host = process.env.CLAMD_HOST?.trim();
  if (!host) return { path: configuredPath || "/etc/clamav/clamd-client.conf", temporary: false };

  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new Error("CLAMD_HOST contains invalid characters.");
  const port = Number(process.env.CLAMD_PORT?.trim() || "3310");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CLAMD_PORT is invalid.");

  return {
    path: path.join(os.tmpdir(), `private-rag-clamd-${randomUUID()}.conf`),
    temporary: true,
    content: `TCPSocket ${port}\nTCPAddr ${host}\n`,
  };
}

export async function scanWithClamAvIfEnabled(bytes: Buffer) {
  if (process.env.PRIVATE_RAG_CLAMAV !== "1") return;

  const tempPath = path.join(os.tmpdir(), `private-rag-scan-${randomUUID()}.bin`);
  const config = clamConfigFromEnvironment();
  await fs.writeFile(tempPath, bytes, { mode: 0o600, flag: "wx" });

  try {
    if (config.temporary && config.content) {
      await fs.writeFile(config.path, config.content, { mode: 0o600, flag: "wx" });
    }

    await execFileAsync(
      "clamdscan",
      ["--stream", `--config-file=${config.path}`, "--no-summary", tempPath],
      { timeout: 90_000, maxBuffer: 256 * 1024 },
    );
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

    if (code === "1") {
      throw new Error("Malware was detected in this file. Upload blocked.");
    }

    throw new Error("Malware scanner is unavailable or misconfigured. Upload blocked until ClamAV is reachable.");
  } finally {
    try { await fs.unlink(tempPath); } catch { /* best effort */ }
    if (config.temporary) {
      try { await fs.unlink(config.path); } catch { /* best effort */ }
    }
  }
}

export function safeDisplayName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "document";
}

export function contentHash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateFileEnvelope(fileName: string, bytes: Buffer) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD or CSV.");
  if (bytes.length === 0) throw new Error("The file is empty.");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Upload limit is 10 MB.");

  if (ext === ".pdf" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The file extension says PDF but the file signature is not a PDF.");
  }
  if (ext === ".docx") {
    const sig = bytes.subarray(0, 4);
    if (!(sig[0] === 0x50 && sig[1] === 0x4b && (sig[2] === 0x03 || sig[2] === 0x05 || sig[2] === 0x07))) {
      throw new Error("The file extension says DOCX but the file signature is not a valid ZIP container.");
    }
  }
  if ([".txt", ".md", ".csv"].includes(ext) && bytes.includes(0)) {
    throw new Error("Text files containing binary/null bytes are blocked.");
  }
  return ext;
}

export async function extractText(fileName: string, mimeType: string, bytes: Buffer) {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      if (result.text.length > 5_000_000) throw new Error("Extracted text is too large for this workspace.");
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    if (result.value.length > 5_000_000) throw new Error("Extracted text is too large for this workspace.");
    return result.value;
  }

  if ([".txt", ".md", ".csv"].includes(ext) || mimeType.startsWith("text/")) {
    const text = bytes.toString("utf8");
    if (text.length > 5_000_000) throw new Error("Extracted text is too large for this workspace.");
    return text;
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD or CSV.");
}

export function inspectText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const wordCount = clean ? clean.split(" ").length : 0;
  const possiblePersonalInfo = EMAIL.test(clean) || PHONE.test(clean) || NDIS_LIKE.test(clean);
  const possibleSupersededLanguage = SUPERSEDED.test(clean);
  const possibleSecrets = SECRET_PATTERNS.some((pattern) => pattern.test(clean));
  const possiblePromptInjection = PROMPT_INJECTION.test(clean);
  const lowTextContent = wordCount < 80;
  const notes: string[] = [];

  if (possibleSecrets) notes.push("Possible credential/private key detected: document is quarantined.");
  if (possiblePersonalInfo) notes.push("Possible personal or participant information detected; review before approval.");
  if (possibleSupersededLanguage) notes.push("Document may contain superseded/obsolete wording; confirm the current version.");
  if (possiblePromptInjection) notes.push("Instruction-like text detected; review before future use with any generative model.");
  if (lowTextContent) notes.push("Very little extractable text; check scan quality or document content.");
  if (!notes.length) notes.push("No obvious inspection flags detected.");

  return {
    wordCount,
    possiblePersonalInfo,
    possibleSupersededLanguage,
    possibleSecrets,
    possiblePromptInjection,
    lowTextContent,
    notes,
  };
}

export function chunkText(documentId: string, text: string): Chunk[] {
  const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const targetChars = 1200;
  const overlapChars = 180;
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > targetChars) {
      chunks.push(current.trim());
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = `${overlap}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length === 1 && chunks[0].length > targetChars * 2) {
    const words = chunks[0].split(/\s+/);
    const rebuilt: string[] = [];
    let part = "";
    for (const word of words) {
      if (part.length + word.length + 1 > targetChars) {
        rebuilt.push(part);
        const overlapWords = part.split(/\s+/).slice(-30).join(" ");
        part = overlapWords ? `${overlapWords} ${word}` : word;
      } else {
        part = part ? `${part} ${word}` : word;
      }
    }
    if (part) rebuilt.push(part);
    return rebuilt.map((chunk, index) => ({ id: crypto.randomUUID(), documentId, index, text: chunk }));
  }

  return chunks.map((chunk, index) => ({ id: crypto.randomUUID(), documentId, index, text: chunk }));
}

export function buildDocument(input: {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  hash: string;
  inspection: KnowledgeDocument["inspection"];
}): KnowledgeDocument {
  const originalName = safeDisplayName(input.fileName);
  return {
    id: input.id,
    name: originalName.replace(/\.[^.]+$/, ""),
    originalName,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.size,
    contentHash: input.hash,
    status: input.inspection.possibleSecrets ? "quarantined" : "needs_review",
    uploadedAt: new Date().toISOString(),
    inspection: input.inspection,
  };
}
