import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "../scanning/scanner"
import { fingerprint, similarity } from "./fingerprint"
import { loadSignatures } from "./signatures"
import { classifyLicense } from "./classify"

const log = Log.create({ service: "license" })

/**
 * Create a LicenseScanner instance.
 * Detects copyleft-licensed code patterns in LLM-generated code.
 */
export function LicenseScanner(threshold?: number): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    const signatures = loadSignatures()
    const simThreshold = threshold ?? 0.6

    const isAvailable = Effect.fn("License.isAvailable")(function* () {
      return signatures.length > 0
    })

    const scan = Effect.fn("License.scan")(function* (content: string, metadata: ScanMetadata) {
      if (content.length === 0) return [] as ScanFinding[]

      const fp = fingerprint(content)
      if (fp.size === 0) return []

      const findings: ScanFinding[] = []

      for (const sig of signatures) {
        const sim = similarity(fp, sig.fp)
        if (sim >= simThreshold) {
          const cls = classifyLicense(sig.licenseSPDX)
          const sev: Severity = sim >= 0.8 ? "high" : "warning"
          findings.push({
            severity: sev,
            ruleId: `license.${sig.licenseSPDX.toLowerCase().replace(/[.-]/g, "-")}`,
            scanner: "license",
            matchedContent: `${sig.sourceProject}/${sig.moduleName}`,
            confidence: sim >= 0.8 ? "high" : "medium",
            remediation: `Similar to ${sig.sourceProject} (${sig.licenseSPDX}). ${cls.description}`,
          })
        }
      }

      if (findings.length > 0) {
        log.info("license match found", { count: findings.length, threshold: simThreshold })
      }

      return findings
    })

    return { name: "license", isAvailable, scan }
  })
}
