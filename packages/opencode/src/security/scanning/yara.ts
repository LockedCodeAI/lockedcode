import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import fs from "fs"
import path from "path"
import os from "os"
import { execFileSync } from "child_process"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "./scanner"
import { resolveRulesPath } from "../rules/resolver"
import { checkPathSync } from "../confinement/whitelist"

const log = Log.create({ service: "scanning.yara" })

/** Map YARA metadata severity to LockedCode severity. */
function mapSeverity(s: string): Severity {
  switch (s.toLowerCase()) {
    case "critical":
      return "critical"
    case "high":
      return "high"
    case "warning":
      return "warning"
    case "info":
      return "info"
    default:
      return "high"
  }
}

/** Resolve the YARA rules directory. */
function resolveRulesPathLocal(): string | null {
  return resolveRulesPath("yara")
}

/**
 * Create a YARA scanner instance.
 * Invokes the `yara` CLI via child process.
 */
export function YaraScanner(config: {
  enabled: boolean
  rulesPath?: string
  timeout: number
}): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    let available: boolean | null = null
    const rulesDir = config.rulesPath ?? resolveRulesPathLocal()

    const isAvailable = Effect.fn("Yara.isAvailable")(function* () {
      if (available !== null) return available
      try {
        execFileSync("which", ["yara"], { encoding: "utf-8" })
        available = rulesDir !== null
      } catch {
        available = false
      }
      if (!available) log.warn("YARA not found on PATH — skipping YARA scans")
      else if (rulesDir === null) log.warn("YARA rules directory not found — skipping YARA scans")
      return available!
    })

    const scan = Effect.fn("Yara.scan")(function* (content: string, metadata: ScanMetadata) {
      if (!available || !rulesDir) return [] as ScanFinding[]

      const tmpFile = path.join(os.tmpdir(), `lockedcode-yara-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
      yield* Effect.promise(() => fs.promises.writeFile(tmpFile, content, "utf-8"))

      const findings: ScanFinding[] = yield* Effect.promise<ScanFinding[]>(async () => {
        try {
          const stdout = execFileSync("yara", [
            "-s",
            "-w",
            rulesDir,
            tmpFile,
          ], {
            encoding: "utf-8",
            timeout: (config.timeout ?? 15) * 1000,
            maxBuffer: 10 * 1024 * 1024,
          })

          return parseYaraOutput(stdout, rulesDir)
        } catch (err: any) {
          if (err.killed || err.code === "ETIMEDOUT") {
            log.warn("YARA scan timed out", { timeout: config.timeout })
            return [{
              severity: "warning" as Severity,
              ruleId: "yara-timeout",
              scanner: "yara",
              matchedContent: "",
              confidence: "medium" as const,
              remediation: "YARA scan timed out. The file was not scanned.",
            }]
          }
          // Non-zero exit means matches or errors — try to parse stdout
          if (err.stdout) {
            const parsed = parseYaraOutput(err.stdout.toString(), rulesDir)
            if (parsed.length > 0) return parsed
          }
          log.warn("YARA scan failed", { error: err.message ?? String(err) })
          return []
        } finally {
          try { await fs.promises.unlink(tmpFile) } catch {}
        }
      })

      return findings
    })

    return { name: "yara", isAvailable, scan }
  })
}

/**
 * Parse YARA CLI output into ScanFinding array.
 * YARA -s output format:
 *   ruleName [metadata] filePath
 *   0xoffset:$stringName: matchedString
 *   ...
 */
function parseYaraOutput(stdout: string, rulesDir: string): ScanFinding[] {
  const lines = stdout.trim().split("\n")
  const findings: ScanFinding[] = []
  let currentRule = ""
  let currentMeta: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Check if this is a rule header line (rule name + file path)
    if (!trimmed.startsWith("0x") && !trimmed.startsWith(" ")) {
      // Save previous rule's findings
      if (currentRule) {
        const severity = mapSeverity(currentMeta.severity ?? "high")
        findings.push({
          severity,
          ruleId: currentRule,
          scanner: "yara",
          matchedContent: currentMeta.description ?? currentMeta.author ?? "",
          confidence: severity === "critical" ? "high" : "medium",
          remediation: `YARA rule matched: ${currentMeta.description ?? currentRule}`,
        })
      }
      // Parse new rule header: "ruleName filePath"
      const parts = trimmed.split(/\s+/)
      currentRule = parts[0]
      currentMeta = {}

      // Try to parse rule from bundled file for metadata
      const rulesDirCheck = checkPathSync(rulesDir, "read", process.cwd())
      if (!rulesDirCheck.allowed) continue
      const rulesFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".yar") || f.endsWith(".yara"))
      for (const rf of rulesFiles) {
        const rfPath = path.join(rulesDir, rf)
        const rfCheck = checkPathSync(rfPath, "read", process.cwd())
        if (!rfCheck.allowed) continue
        const content = fs.readFileSync(rfPath, "utf-8")
        const metaMatch = content.match(new RegExp(`rule\\s+${escapeRegex(currentRule)}\\s*\\{[^}]*meta:\\s*([^}]+)`, "s"))
        if (metaMatch) {
          const metaBlock = metaMatch[1]
          for (const metaLine of metaBlock.split("\n")) {
            const kv = metaLine.match(/\s*(\w+)\s*=\s*"([^"]*)"/)
            if (kv) currentMeta[kv[1].toLowerCase()] = kv[2]
          }
          break
        }
      }
    }
  }

  // Add last rule
  if (currentRule) {
    const severity = mapSeverity(currentMeta.severity ?? "high")
    findings.push({
      severity,
      ruleId: currentRule,
      scanner: "yara",
      matchedContent: currentMeta.description ?? currentMeta.author ?? "",
      confidence: severity === "critical" ? "high" : "medium",
      remediation: `YARA rule matched: ${currentMeta.description ?? currentRule}`,
    })
  }

  return findings
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
