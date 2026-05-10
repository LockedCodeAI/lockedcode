import type { FileSensitivity } from "../types"

/** A sensitivity rule — a glob-like pattern mapped to a sensitivity level. */
interface SensitivityRule {
  readonly pattern: string
  readonly level: FileSensitivity
  readonly negative?: boolean
}

/** Default sensitivity rules, most specific first. */
const DEFAULT_RULES: SensitivityRule[] = [
  // Restricted — never send to LLM
  { pattern: "**/.env.example", level: "public", negative: true },
  { pattern: "**/.env.template", level: "public", negative: true },
  { pattern: "**/.env.sample", level: "public", negative: true },
  { pattern: "**/.env.dist", level: "public", negative: true },
  { pattern: "**/.env.local.example", level: "public", negative: true },
  { pattern: "**/.env*", level: "restricted" },
  { pattern: "**/credentials.json", level: "restricted" },
  { pattern: "**/credentials.yaml", level: "restricted" },
  { pattern: "**/credentials.yml", level: "restricted" },
  { pattern: "**/secrets.json", level: "restricted" },
  { pattern: "**/secrets.yaml", level: "restricted" },
  { pattern: "**/secrets.yml", level: "restricted" },
  { pattern: "**/*.key", level: "restricted" },
  { pattern: "**/*.pem", level: "restricted" },
  { pattern: "**/*.p12", level: "restricted" },
  { pattern: "**/*.pfx", level: "restricted" },
  { pattern: "**/*.jks", level: "restricted" },
  { pattern: "**/*.keystore", level: "restricted" },
  { pattern: "**/id_rsa", level: "restricted" },
  { pattern: "**/id_ed25519", level: "restricted" },
  { pattern: "**/id_ecdsa", level: "restricted" },
  { pattern: "**/config/production/**", level: "restricted" },

  // Confidential — redact before sending
  { pattern: "**/*.env.local", level: "confidential" },
  { pattern: "**/*.env.development", level: "confidential" },
  { pattern: "**/docker-compose.override.yml", level: "confidential" },
  { pattern: "**/docker-compose.override.yaml", level: "confidential" },
  { pattern: "**/application-local.properties", level: "confidential" },
  { pattern: "**/application-local.yml", level: "confidential" },
  { pattern: "**/application-local.yaml", level: "confidential" },
  { pattern: "**/local.settings.json", level: "confidential" },

  // Internal — warn and send
  { pattern: "**/*.config", level: "internal" },
  { pattern: "**/*.cfg", level: "internal" },
  { pattern: "**/*.ini", level: "internal" },
  { pattern: "**/docker-compose.yml", level: "internal" },
  { pattern: "**/docker-compose.yaml", level: "internal" },
  { pattern: "**/Dockerfile", level: "internal" },
]

/**
 * Simple glob matching.
 * Supports: *, **, ?  (no character classes, no alternation)
 */
function globMatch(pattern: string, filepath: string): boolean {
  const parts = pattern.split("/").filter(Boolean)
  const pathParts = filepath.split("/").filter(Boolean)

  return matchParts(parts, pathParts, 0, 0)
}

function matchParts(pattern: string[], path: string[], pi: number, ppi: number): boolean {
  // End of pattern
  if (pi >= pattern.length) {
    return ppi >= path.length
  }

  const p = pattern[pi]

  // Double-star matches everything
  if (p === "**") {
    for (let i = ppi; i <= path.length; i++) {
      if (matchParts(pattern, path, pi + 1, i)) return true
    }
    return false
  }

  if (ppi >= path.length) return false

  // Single-segment matching
  if (segmentMatch(p, path[ppi])) {
    return matchParts(pattern, path, pi + 1, ppi + 1)
  }

  return false
}

function segmentMatch(pattern: string, segment: string): boolean {
  let pi = 0
  let si = 0

  while (pi < pattern.length && si < segment.length) {
    const pc = pattern[pi]
    const sc = segment[si]

    if (pc === "*") {
      // Wildcard matches any chars within this segment
      if (pi + 1 < pattern.length) {
        const next = pattern[pi + 1]
        const nextIdx = segment.indexOf(next, si)
        if (nextIdx === -1) return false
        pi++
        si = nextIdx
      } else {
        // Trailing * matches everything remaining
        return true
      }
    } else if (pc === "?") {
      pi++
      si++
    } else if (pc === sc) {
      pi++
      si++
    } else {
      return false
    }
  }

  // Handle remaining pattern characters after segment ends
  while (pi < pattern.length) {
    // Only trailing stars are allowed after segment ends
    if (pattern[pi] === "*") {
      pi++
    } else {
      break
    }
  }

  return pi >= pattern.length && si >= segment.length
}

/**
 * Classify a filepath by sensitivity level.
 * Uses simple glob matching against default rules.
 * Custom rules from config can be provided.
 */
export function classifyFile(filepath: string, customRules?: SensitivityRule[]): FileSensitivity {
  const rules = customRules ?? DEFAULT_RULES
  const matchedLevels: Array<{ level: FileSensitivity; isNegative: boolean }> = []

  for (const rule of rules) {
    if (globMatch(rule.pattern, filepath)) {
      matchedLevels.push({ level: rule.level, isNegative: !!rule.negative })
    }
  }

  // If any negative rule matched, file is excluded from sensitivity rules
  if (matchedLevels.some((m) => m.isNegative)) return "public"

  // Take the last non-negative match (most specific wins)
  const lastPositive = matchedLevels.findLast((m) => !m.isNegative)
  return lastPositive?.level ?? "public"
}
