import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import fs from "fs"
import path from "path"
import os from "os"
import { execFileSync } from "child_process"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "./scanner"
import { resolveRulesPath } from "../rules/resolver"

const log = Log.create({ service: "scanning.semgrep" })

/** Map Semgrep severity to LockedCode severity. */
function mapSeverity(s: string): Severity {
  switch (s.toLowerCase()) {
    case "error":
      return "critical"
    case "warning":
      return "warning"
    case "info":
      return "info"
    default:
      return "warning"
  }
}

/** Map Semgrep confidence to LockedCode confidence. */
function mapConfidence(c: string): "low" | "medium" | "high" {
  switch (c.toLowerCase()) {
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    default:
      return "medium"
  }
}

/** Resolve the rules directory path. */
function resolveRulesPathLocal(): string | null {
  return resolveRulesPath("semgrep")
}

/**
 * Create a Semgrep scanner instance.
 * The scanner invokes the `semgrep` CLI via child process.
 */
export function SemgrepScanner(config: {
  enabled: boolean
  rulesPath?: string
  timeout: number
}): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    let available: boolean | null = null
    const rulesDir = config.rulesPath ?? resolveRulesPathLocal()

    const isAvailable = Effect.fn("Semgrep.isAvailable")(function* () {
      if (available !== null) return available
      try {
        execFileSync("which", ["semgrep"], { encoding: "utf-8" })
        available = rulesDir !== null
      } catch {
        available = false
      }
      if (!available) log.warn("Semgrep not found on PATH — skipping Semgrep scans")
      else if (rulesDir === null) log.warn("Semgrep rules directory not found — skipping Semgrep scans")
      return available!
    })

    const scan = Effect.fn("Semgrep.scan")(function* (content: string, metadata: ScanMetadata) {
      if (!available || !rulesDir) return [] as ScanFinding[]

      // Write content to temp file with original extension for language detection
      const ext = metadata.extension ?? ".tmp"
      const tmpFile = path.join(os.tmpdir(), `lockedcode-scan-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)

      yield* Effect.promise(() => fs.promises.writeFile(tmpFile, content, "utf-8"))

      const findings: ScanFinding[] = yield* Effect.promise<ScanFinding[]>(async () => {
        try {
          const stdout = execFileSync("semgrep", [
            "scan",
            "--config", rulesDir,
            "--json",
            "--no-git-ignore",
            "--quiet",
            tmpFile,
          ], {
            encoding: "utf-8",
            timeout: (config.timeout ?? 30) * 1000,
            maxBuffer: 10 * 1024 * 1024,
          })

          const parsed = JSON.parse(stdout)
          const results = parsed.results ?? []

          const findings: ScanFinding[] = results.map((r: any) => ({
            severity: mapSeverity(r.extra?.severity ?? "warning"),
            ruleId: r.check_id ?? "semgrep-unknown",
            scanner: "semgrep",
            matchedContent: (r.lines ?? "").slice(0, 200),
            lineNumber: r.start?.line,
            remediation: r.extra?.fix ?? r.extra?.message ?? "",
            confidence: mapConfidence(r.extra?.confidence ?? "medium"),
          }))

          return findings
        } catch (err: any) {
          if (err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            log.warn("Semgrep output exceeded max buffer — skipping")
            return []
          }
          if (err.killed || err.code === "ETIMEDOUT") {
            log.warn("Semgrep scan timed out", { timeout: config.timeout })
            return [{
              severity: "warning" as Severity,
              ruleId: "semgrep-timeout",
              scanner: "semgrep",
              matchedContent: "",
              confidence: "medium" as const,
              remediation: "Semgrep scan timed out. The file was not scanned.",
            }]
          }
          // Non-zero exit code — semgrep found issues or had an error
          // Try to parse stdout anyway (semgrep outputs JSON even on findings)
          try {
            const parsed = JSON.parse(err.stdout ?? "{}")
            const results = parsed.results ?? []
            if (results.length > 0) {
              return results.map((r: any) => ({
                severity: mapSeverity(r.extra?.severity ?? "warning"),
                ruleId: r.check_id ?? "semgrep-unknown",
                scanner: "semgrep",
                matchedContent: (r.lines ?? "").slice(0, 200),
                lineNumber: r.start?.line,
                remediation: r.extra?.message ?? "",
                confidence: mapConfidence(r.extra?.confidence ?? "medium"),
              }))
            }
          } catch {
            // Can't parse output either
          }
          log.warn("Semgrep scan failed", { error: err.message ?? String(err) })
          return []
        } finally {
          // Clean up temp file
          try {
            await fs.promises.unlink(tmpFile)
          } catch {
            // Best effort cleanup
          }
        }
      })

      return findings
    })

    return { name: "semgrep", isAvailable, scan }
  })
}
