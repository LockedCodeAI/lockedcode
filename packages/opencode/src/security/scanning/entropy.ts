import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "./scanner"

const log = Log.create({ service: "scanning.entropy" })

/** File extensions and their entropy thresholds. */
const EXT_THRESHOLDS: Record<string, number> = {
  ".ts": 4.5,
  ".tsx": 4.5,
  ".js": 4.5,
  ".jsx": 4.5,
  ".mjs": 4.5,
  ".cjs": 4.5,
  ".py": 4.5,
  ".go": 4.5,
  ".java": 4.5,
  ".rs": 4.5,
  ".rb": 4.5,
  ".php": 4.5,
  ".c": 4.5,
  ".cpp": 4.5,
  ".h": 4.5,
  ".hpp": 4.5,
  ".swift": 4.5,
  ".kt": 4.5,
  ".scala": 4.5,
  ".json": 4.0,
  ".yaml": 4.0,
  ".yml": 4.0,
  ".toml": 4.0,
  ".xml": 4.0,
  ".html": 4.0,
  ".css": 4.0,
  ".sh": 4.0,
  ".bash": 4.0,
  ".zsh": 4.0,
  ".md": 3.8,
  ".txt": 3.8,
}

/** Extensions to skip entirely (binary-adjacent). */
const SKIP_EXTENSIONS = new Set([
  ".wasm", ".o", ".obj", ".exe", ".dll", ".so", ".dylib",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".pyc", ".class", ".jar",
])

/** UUID pattern (8-4-4-4-12 hex). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Hash digest patterns (all hex, common lengths). */
const HASH_LENGTHS = new Set([32, 40, 64, 128, 256])

/** URL pattern. */
const URL_RE = /^https?:\/\/.+/i

/**
 * Calculate Shannon entropy of a string.
 * H = -Σ (freq/N) * log2(freq/N) for each unique byte value.
 */
function shannonEntropy(s: string): number {
  const len = s.length
  if (len === 0) return 0

  const freq = new Map<number, number>()
  for (let i = 0; i < len; i++) {
    const code = s.charCodeAt(i)
    freq.set(code, (freq.get(code) ?? 0) + 1)
  }

  let entropy = 0
  for (const count of freq.values()) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

/** Extract string literals from a line of source code. */
function extractStringLiterals(line: string): Array<{ literal: string; start: number }> {
  const results: Array<{ literal: string; start: number }> = []
  let inString = false
  let inTemplate = false
  let quoteChar = ""
  let current = ""
  let startIdx = 0

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    const prev = i > 0 ? line[i - 1] : ""

    if (!inString && !inTemplate) {
      if ((c === '"' || c === "'" || c === "`") && prev !== "\\") {
        inString = true
        quoteChar = c
        current = ""
        startIdx = i + 1
      }
    } else if (inString) {
      if (c === quoteChar && prev !== "\\") {
        if (current.length > 0) {
          results.push({ literal: current, start: startIdx })
        }
        inString = false
      } else {
        current += c
      }
    }
  }

  return results
}

/** Check if a string looks like a UUID. */
function isUUID(s: string): boolean {
  return UUID_RE.test(s)
}

/** Check if a string looks like a hash digest. */
function isHashDigest(s: string): boolean {
  if (/^[0-9a-f]+$/i.test(s) && HASH_LENGTHS.has(s.length)) return true
  if (/^[0-9a-f]{32,}$/i.test(s)) return true // any long hex string
  return false
}

/** Check if a string looks like a URL. */
function isURL(s: string): boolean {
  return URL_RE.test(s)
}

/** Check if a string is an import path. */
function isImportPath(s: string): boolean {
  return s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("@")
}

/**
 * Create an entropy scanner instance.
 * Pure TypeScript — no external dependencies.
 */
export function EntropyScanner(config: {
  enabled: boolean
  threshold: number
  minStringLength: number
}): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    const isAvailable = Effect.fn("Entropy.isAvailable")(function* () {
      return true
    })

    const scan = Effect.fn("Entropy.scan")(function* (content: string, metadata: ScanMetadata) {
      if (content.length === 0) return [] as ScanFinding[]

      const ext = metadata.extension ?? ""
      if (SKIP_EXTENSIONS.has(ext)) return []

      const threshold = EXT_THRESHOLDS[ext] ?? config.threshold
      const findings: ScanFinding[] = []
      const lines = content.split("\n")

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const literals = extractStringLiterals(line)

        for (const { literal, start } of literals) {
          if (literal.length < config.minStringLength) continue
          if (isUUID(literal)) continue
          if (isHashDigest(literal)) continue
          if (isURL(literal)) continue
          if (isImportPath(literal)) continue

          const entropy = shannonEntropy(literal)
          if (entropy > threshold) {
            const sev: Severity = entropy > threshold + 1.0 ? "high" : "warning"
            findings.push({
              severity: sev,
              ruleId: sev === "high" ? "entropy-high-string" : "entropy-suspicious-string",
              scanner: "entropy",
              matchedContent: literal.slice(0, 40),
              lineNumber: lineIdx + 1,
              confidence: sev === "high" ? "high" : "medium",
              remediation: sev === "high"
                ? "High-entropy string detected. This may be an obfuscated payload, encoded data, or a hardcoded secret."
                : "Suspiciously high-entropy string. Review the content for obfuscation or secrets.",
            })
          }
        }
      }

      return findings
    })

    return { name: "entropy", isAvailable, scan }
  })
}
