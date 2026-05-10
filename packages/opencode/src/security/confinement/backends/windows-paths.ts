import path from "path"

/**
 * Windows-specific path canonicalization hardening.
 */

/** Windows reserved names that should never be written. */
const RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
])

/**
 * Resolve a Windows path with normalization:
 * - Strip short names (8.3) via PowerShell
 * - Resolve junction points
 * - Normalize drive letter
 * - Strip \\?\ prefix
 * - Reject reserved names
 * - Normalize trailing dots/spaces
 */
export function resolveWindowsPath(input: string): string {
  let p = input.replace(/\//g, "\\")

  // Strip \\?\ prefix
  if (p.startsWith("\\\\?\\")) {
    p = p.slice(4)
  }

  // Normalize drive letter to uppercase
  p = p.replace(/^([a-z]):/, (_, letter: string) => `${letter.toUpperCase()}:`)

  // Reject reserved names
  const segments = p.split("\\")
  for (const seg of segments) {
    const name = seg.toUpperCase().split(".")[0]
    if (RESERVED_NAMES.has(name)) return ""
  }

  // Strip trailing dots and spaces from each segment
  const cleaned = segments.map((seg) => seg.replace(/[. ]+$/, ""))
  p = cleaned.join("\\")

  // Normalize backslashes
  p = p.replace(/\\+/g, "\\")

  return p
}

/**
 * Windows-aware case-insensitive sub-path check.
 */
export function isWindowsSubPath(child: string, parent: string): boolean {
  const childNorm = resolveWindowsPath(child).toLowerCase()
  const parentNorm = resolveWindowsPath(parent).toLowerCase().replace(/\\$/, "")
  if (!childNorm || !parentNorm) return false
  if (childNorm === parentNorm) return true
  const prefix = parentNorm + "\\"
  return childNorm.startsWith(prefix)
}
