import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "../scanning/scanner"
import { SECRET_PATTERNS } from "./patterns"
import { adjustSeverity, extractVarName, isPlaceholder } from "./context"
import { detectEntropySecrets } from "./entropy-secrets"

const log = Log.create({ service: "secrets" })

/**
 * Create a SecretScanner instance.
 * Detects credentials, API keys, tokens, and private keys in generated code.
 */
export function SecretScanner(): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    const isAvailable = Effect.fn("Secrets.isAvailable")(function* () {
      return true
    })

    const scan = Effect.fn("Secrets.scan")(function* (content: string, metadata: ScanMetadata) {
      if (content.length === 0) return [] as ScanFinding[]

      const lines = content.split("\n")
      const findings: ScanFinding[] = []
      const seenKeys = new Set<string>()

      // Run pattern-based detection
      for (const pattern of SECRET_PATTERNS) {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]
          const matches = line.matchAll(pattern.regex)

          for (const match of matches) {
            const value = match[0]
            if (!value) continue

            // Deduplicate: same pattern + same line + same value
            const key = `${pattern.id}:${lineIdx}:${value.slice(0, 20)}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)

            // Check placeholders
            if (isPlaceholder(value)) continue

            // Get variable name context
            const varName = extractVarName(line, match.index ?? 0)

            // Apply context-aware severity adjustment
            const adj = adjustSeverity(pattern, value, metadata, line, varName)
            if (adj === "suppress") continue

            findings.push({
              severity: adj,
              ruleId: pattern.id,
              scanner: "secrets",
              matchedContent: value.slice(0, 40),
              lineNumber: lineIdx + 1,
              confidence: adj === "critical" ? "high" : "medium",
              remediation: pattern.remediation,
            })
          }
        }
      }

      // Run entropy-based detection as fallback
      const entropyFindings = detectEntropySecrets(content, lines)
      for (const f of entropyFindings) {
        const key = `${f.ruleId}:${f.lineNumber}:${f.matchedContent.slice(0, 20)}`
        if (!seenKeys.has(key)) {
          findings.push(f)
        }
      }

      if (findings.length > 0) {
        log.info("secrets detected", { count: findings.length })
      }

      return findings
    })

    return { name: "secrets", isAvailable, scan }
  })
}
