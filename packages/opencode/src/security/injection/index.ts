import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, Severity, InjectionSensitivity } from "../types"
import type { Scanner } from "../scanning/scanner"
import { INJECTION_PATTERNS } from "./patterns"
import type { InjectionMatch } from "./patterns"
import { detectAll } from "./unicode"

const log = Log.create({ service: "injection" })

const SENSITIVITY_ORDER: InjectionSensitivity[] = ["low", "medium", "high"]

function meetsSensitivity(patternSensitivity: InjectionSensitivity, configSensitivity: InjectionSensitivity): boolean {
  const patternIdx = SENSITIVITY_ORDER.indexOf(patternSensitivity)
  const configIdx = SENSITIVITY_ORDER.indexOf(configSensitivity)
  return patternIdx <= configIdx
}

function adjustSeverityForContext(baseSeverity: Severity, filename: string, category: string): Severity {
  const isDoc = /\.(md|rst|txt|adoc|asciidoc)$/i.test(filename)
  const isTest = /(test|spec|__tests__|fixture)/i.test(filename)
  const isSource = /\.(ts|js|tsx|jsx|py|go|rs|java|c|cpp|rb|php)$/i.test(filename)
  const isMeta = /package\.json|pyproject\.toml|setup\.cfg|\.gemspec/i.test(filename)

  const order: Severity[] = ["info", "warning", "high", "critical"]

  if ((isDoc || isTest) && category === "role-override") {
    const idx = order.indexOf(baseSeverity)
    return order[Math.max(0, idx - 1)] as Severity
  }

  if (isDoc && category === "comment-injection") {
    const idx = order.indexOf(baseSeverity)
    return order[Math.max(0, idx - 1)] as Severity
  }

  if (isMeta && category === "metadata") {
    return order[Math.min(order.length - 1, order.indexOf(baseSeverity) + 1)] as Severity
  }

  if (isSource && category === "comment-injection") {
    return baseSeverity
  }

  if (isTest) {
    const idx = order.indexOf(baseSeverity)
    return order[Math.max(0, idx - 1)] as Severity
  }

  return baseSeverity
}

/**
 * Create an InjectionScanner instance.
 * Scans file content for prompt injection patterns.
 */
export function InjectionScanner(config: {
  enabled: boolean
  sensitivity: InjectionSensitivity
}): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    const sensitivity = config.sensitivity

    const isAvailable = Effect.fn("Injection.isAvailable")(function* () {
      return true
    })

    const scan = Effect.fn("Injection.scan")(function* (content: string, metadata: ScanMetadata) {
      if (!config.enabled || content.length === 0) return [] as ScanFinding[]

      const filename = metadata.filename ?? ""
      const findings: ScanFinding[] = []
      const seenKeys = new Set<string>()

      // Run pattern-based injection detection
      for (const pattern of INJECTION_PATTERNS) {
        if (!meetsSensitivity(pattern.minSensitivity, sensitivity)) continue

        const matches: InjectionMatch[] = pattern.test(content, filename)
        for (const m of matches) {
          const key = `${pattern.id}:${m.lineNumber}`
          if (seenKeys.has(key)) continue
          seenKeys.add(key)

          const adjusted = adjustSeverityForContext(pattern.severity, metadata.filename ?? "", pattern.category)
          findings.push({
            severity: adjusted,
            ruleId: pattern.id,
            scanner: "injection",
            matchedContent: m.matched.slice(0, 60),
            lineNumber: m.lineNumber,
            confidence: adjusted === "critical" || adjusted === "high" ? "high" : "medium",
            remediation: `Prompt injection pattern detected: ${pattern.description}. Review the file content before sending it to the LLM.`,
          })
        }
      }

      // Run Unicode analysis
      const unicodeDetections = detectAll(content)
      for (const u of unicodeDetections) {
        const key = `unicode:${u.lineNumber}:${u.codePoint}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)

        findings.push({
          severity: u.severity,
          ruleId: `injection.unicode.${u.category}`,
          scanner: "injection",
          matchedContent: `U+${u.codePoint.toString(16).padStart(4, "0")} ${u.name}`,
          lineNumber: u.lineNumber,
          confidence: u.severity === "critical" ? "high" : "medium",
          remediation: `Unicode ${u.category} character detected (${u.name}). This may be used for prompt injection or text manipulation.`,
        })
      }

      if (findings.length > 0) {
        log.info("injection patterns detected", { count: findings.length })
      }

      return findings
    })

    return { name: "injection", isAvailable, scan }
  })
}
