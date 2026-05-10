import { createHash } from "crypto"

/**
 * Generate a SHA-256 hex digest of the given content.
 * Uses Node.js built-in crypto module.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex")
}

/**
 * JSON-stringify an object with sorted keys for deterministic hashing,
 * then return the SHA-256 digest.
 */
export function hashObject(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort())
  return createHash("sha256").update(sorted, "utf-8").digest("hex")
}
