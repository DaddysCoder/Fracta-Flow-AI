import { promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("PRAG1", "ascii");

/**
 * Ported from rag-work's src/lib/security.ts, with the key-custody model
 * removed. rag-work holds one unlocked master key in a `globalThis`
 * singleton, which assumes exactly one workspace/tenant per process — that
 * doesn't fit a multi-organisation, multi-participant host. Every function
 * here instead takes the 32-byte data key as an explicit parameter; owning
 * that key's lifecycle (unlock/lock/rotation, per organisation) is the host
 * app's responsibility, not this package's. The crypto formats (AES-256-GCM
 * envelope, HMAC blind-index tokens, HMAC keyed fingerprints) are unchanged
 * from rag-work so the security properties are identical.
 */

function assertKey(key: Buffer) {
  if (key.length !== 32) throw new Error("Invalid data encryption key: expected 32 bytes.");
}

function keyedFingerprint(key: Buffer, label: string, value: string, length: number) {
  assertKey(key);
  const derivedKey = createHmac("sha256", key).update(label).digest();
  try {
    return createHmac("sha256", derivedKey).update(value).digest("base64url").slice(0, length);
  } finally {
    derivedKey.fill(0);
  }
}

export function blindIndexTokens(key: Buffer, tokens: string[]) {
  assertKey(key);
  const indexKey = createHmac("sha256", key).update("private-rag-blind-index-v1").digest();
  try {
    return [...new Set(tokens)]
      .filter(Boolean)
      .map((token) => createHmac("sha256", indexKey).update(token).digest("base64url").slice(0, 24));
  } finally {
    indexKey.fill(0);
  }
}

export function privacyHash(key: Buffer, value: string) {
  return keyedFingerprint(key, "private-rag-audit-hash-v1", value, 20);
}

export function contentFingerprint(key: Buffer, contentHash: string) {
  return keyedFingerprint(key, "private-rag-content-fingerprint-v1", contentHash, 43);
}

export function encryptBytes(key: Buffer, plain: Buffer) {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptBytes(key: Buffer, payload: Buffer) {
  assertKey(key);
  if (payload.length < MAGIC.length + 12 + 16 || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Encrypted data format is invalid or unsupported.");
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + 12;
  const dataStart = tagStart + 16;
  const iv = payload.subarray(ivStart, tagStart);
  const tag = payload.subarray(tagStart, dataStart);
  const ciphertext = payload.subarray(dataStart);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function encryptedWrite(key: Buffer, filePath: string, bytes: Buffer) {
  const encrypted = encryptBytes(key, bytes);
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, encrypted, { mode: 0o600 });
  try { await fs.chmod(temp, 0o600); } catch { /* best effort */ }
  await fs.rename(temp, filePath);
}

export async function encryptedRead(key: Buffer, filePath: string) {
  const encrypted = await fs.readFile(filePath);
  return decryptBytes(key, encrypted);
}
