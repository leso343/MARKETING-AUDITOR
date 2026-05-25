/**
 * Symmetric encryption helpers for at-rest secrets stored in the DB.
 *
 * Algorithm: AES-256-GCM with a 32-byte key derived from
 * AI_KEY_ENCRYPTION_SECRET (base64). Ciphertext format on disk:
 *
 *   `${ivBase64}:${ciphertextBase64}:${authTagBase64}`
 *
 * If AI_KEY_ENCRYPTION_SECRET is missing or wrong-length we throw at
 * module load — better to fail fast than silently store plaintext.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // bytes (256 bits)
const IV_LEN = 12; // GCM standard

function loadKey(): Buffer {
  const raw = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!raw) {
    throw new Error(
      "AI_KEY_ENCRYPTION_SECRET is not set. Generate one with:\n" +
        "  node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"\n" +
        "Then set it in your environment (Vercel: Production env vars).",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LEN) {
    throw new Error(
      `AI_KEY_ENCRYPTION_SECRET must decode to ${KEY_LEN} bytes (got ${key.length}). ` +
        "Regenerate with the command in the AI_KEY_ENCRYPTION_SECRET docstring.",
    );
  }
  return key;
}

export function isCryptoConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a string. Returns `iv:ciphertext:authTag` (all base64). */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${authTag.toString("base64")}`;
}

/** Decrypt the format produced by encryptSecret(). Throws on tamper/bad-key. */
export function decryptSecret(stored: string): string {
  const key = loadKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted value.");
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LEN) throw new Error("Bad IV length.");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return out.toString("utf8");
}

/**
 * Produce a UI-safe mask: "sk-ant-…abcd" where "abcd" is the last 4
 * chars. Never returns enough info to reconstruct the secret.
 */
export function maskSecret(secret: string): string {
  const tail = secret.slice(-4);
  return `sk-ant-…${tail}`;
}
