import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, ScanResult, Severity, ScanningConfig, SecurityStrictness } from "../types"
import { defaultSecurityConfig } from "../types"
import type { Scanner } from "./scanner"
import { SemgrepScanner } from "./semgrep"
import { YaraScanner } from "./yara"
import { EntropyScanner } from "./entropy"

const log = Log.create({ service: "scanning" })

export interface Interface {
  readonly registerScanner: (scanner: Scanner) => Effect.Effect<void>
  readonly scan: (content: string, metadata: ScanMetadata) => Effect.Effect<ScanResult>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Scanning") {}

/** Determine the aggregate severity from a list of findings. */
function highestSeverity(findings: ScanFinding[]): Severity {
  const order: Severity[] = ["info", "warning", "high", "critical"]
  let highest: Severity = "info"
  for (const f of findings) {
    if (order.indexOf(f.severity) > order.indexOf(highest)) {
      highest = f.severity
    }
  }
  return highest
}

/** Determine the aggregate action based on severity and strictness. */
function aggregateAction(severity: Severity, strictness: SecurityStrictness): "pass" | "warn" | "block" {
  if (severity === "info") return "pass"
  if (severity === "warning") return "warn"
  if (severity === "high") {
    if (strictness === "strict") return "block"
    if (strictness === "standard") return "warn"
    return "pass"
  }
  // critical
  if (strictness === "permissive") return "warn"
  return "block"
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const cfg: ScanningConfig = defaultSecurityConfig.scanning
    const scanners: Scanner[] = []

    // Register Semgrep scanner
    if (cfg.semgrep.enabled) {
      const semgrep = yield* SemgrepScanner(cfg.semgrep)
      scanners.push(semgrep)
    }

    // Register YARA scanner
    if (cfg.yara.enabled) {
      const yara = yield* YaraScanner(cfg.yara)
      scanners.push(yara)
    }

    // Register Entropy scanner
    if (cfg.entropy.enabled) {
      const entropy = yield* EntropyScanner(cfg.entropy)
      scanners.push(entropy)
    }

    let noScannerWarning = false

    const registerScanner = Effect.fn("Scanning.registerScanner")(function* (scanner: Scanner) {
      scanners.push(scanner)
      log.info("scanner registered", { name: scanner.name })
    })

    const scan = Effect.fn("Scanning.scan")(function* (content: string, metadata: ScanMetadata) {
      if (!cfg.enabled || content.length === 0) {
        return {
          severity: "info" as Severity,
          action: "pass" as const,
          findings: [],
          ruleId: "scan-disabled",
          matchedContent: "",
          remediation: "scanning disabled",
          scanner: "none",
        } as ScanResult
      }

      // Check which scanners are available
      const available: Scanner[] = []
      for (const scanner of scanners) {
        const avail = yield* scanner.isAvailable()
        if (avail) available.push(scanner)
      }

      if (available.length === 0) {
        if (!noScannerWarning) {
          log.warn("No scanners available — install semgrep or yara for static analysis")
          noScannerWarning = true
        }
        return {
          severity: "info" as Severity,
          action: "pass" as const,
          findings: [],
          ruleId: "no-scanner",
          matchedContent: "",
          remediation: "No scanning engines available. Install semgrep or yara to enable static analysis.",
          scanner: "none",
        } as ScanResult
      }

      log.debug("scanning content", { scanners: available.map((s) => s.name), contentLength: content.length })

      // Run all available scanners in parallel
      const findingArrays = yield* Effect.forEach(
        available,
        (scanner) =>
          scanner.scan(content, metadata).pipe(
            Effect.catchCause((err) => {
              log.error("scanner failed", { scanner: scanner.name, error: String(err) })
              return Effect.succeed([] as ScanFinding[])
            }),
          ),
        { concurrency: "unbounded" },
      )

      const findings: ScanFinding[] = (findingArrays as ScanFinding[][]).flat()
      const sev = highestSeverity(findings)
      const action = aggregateAction(sev, defaultSecurityConfig.strictness)

      if (findings.length > 0) {
        log.info("scan complete", {
          findings: findings.length,
          highestSeverity: sev,
          action,
        })
      }

      const topFinding = findings[0] as ScanFinding | undefined
      return {
        severity: sev,
        action,
        findings,
        ruleId: topFinding?.ruleId ?? "clean",
        matchedContent: topFinding?.matchedContent ?? "",
        remediation: topFinding?.remediation ?? "No issues detected.",
        scanner: topFinding?.scanner ?? "none",
      } as ScanResult
    })

    return Service.of({ registerScanner, scan })
  }),
)

export const defaultLayer = layer
