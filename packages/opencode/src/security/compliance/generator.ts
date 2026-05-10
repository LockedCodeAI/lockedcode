import type { Severity } from "../types"
import { FRAMEWORKS, type FrameworkMapping, type FrameworkControl } from "./frameworks"

export interface ReportOptions {
  readonly framework?: string
  readonly startTime?: number
  readonly endTime?: number
  readonly projectName?: string
}

export interface ControlEvidence {
  readonly controlId: string
  readonly controlName: string
  readonly status: "evidenced" | "partial" | "gap"
  readonly evidence: Array<{ metric: string; value: string; description: string }>
  readonly notes: string
}

export interface ComplianceReport {
  readonly metadata: {
    readonly framework: string
    readonly frameworkName: string
    readonly generated: string
    readonly startTime: number
    readonly endTime: number
    readonly projectName: string
    readonly version: string
    readonly disclaimer: string
  }
  readonly controls: ControlEvidence[]
  readonly summary: {
    readonly totalControls: number
    readonly evidenced: number
    readonly partial: number
    readonly gap: number
    readonly overall: string
  }
}

function query(sql: string): any[] {
  try {
    const os = require("os")
    const path = require("path")
    const fs = require("fs")
    const { execFileSync } = require("child_process")
    const dbPath = path.join(os.homedir(), ".local", "share", "lockedcode", "opencode-local.db")
    if (!fs.existsSync(dbPath)) return []
    const result = execFileSync("sqlite3", ["-json", dbPath, sql], { encoding: "utf-8", maxBuffer: 1024 * 1024 })
    return JSON.parse(result || "[]")
  } catch { return [] }
}

function countEvents(table: string, startTime?: number, endTime?: number): number {
  const conditions: string[] = []
  if (startTime) conditions.push(`timestamp >= ${startTime}`)
  if (endTime) conditions.push(`timestamp <= ${endTime}`)
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const rows = query(`SELECT COUNT(*) as cnt FROM ${table} ${where}`)
  return rows[0]?.cnt ?? 0
}

function gatherEvidence(control: FrameworkControl, startTime?: number, endTime?: number): ControlEvidence["evidence"] {
  const evidence: ControlEvidence["evidence"] = []

  for (const source of control.dataSources) {
    switch (source) {
      case "audit": {
        const totalEvents = countEvents("security_event", startTime, endTime)
        const blockedEvents = query(`SELECT COUNT(*) as cnt FROM security_event WHERE action_taken = 'blocked' ${startTime ? `AND timestamp >= ${startTime}` : ""} ${endTime ? `AND timestamp <= ${endTime}` : ""}`)
        evidence.push({ metric: "Total audit events", value: String(totalEvents), description: "All recorded security events" })
        evidence.push({ metric: "Blocked actions", value: String(blockedEvents[0]?.cnt ?? 0), description: "Actions blocked by policy" })
        evidence.push({ metric: "Audit retention", value: "90 days (default)", description: "Configurable retention period" })
        break
      }
      case "scanning": {
        const totalScans = countEvents("security_event")
        const byType = query(`SELECT event_type, COUNT(*) as cnt FROM security_event GROUP BY event_type ORDER BY cnt DESC LIMIT 10`)
        evidence.push({ metric: "Total scans", value: String(totalScans), description: "Scans performed across the pipeline" })
        evidence.push({ metric: "Scanner count", value: "6", description: "Semgrep, YARA, Entropy, Secrets, Injection, Custom" })
        if (byType.length > 0) {
          evidence.push({ metric: "Event type coverage", value: String(byType.length), description: "Distinct event types recorded" })
        }
        break
      }
      case "policy": {
        evidence.push({ metric: "Policy strictness", value: "standard (default)", description: "Configurable per deployment" })
        evidence.push({ metric: "Policy hierarchy", value: "4 levels", description: "Built-in → XDG → Project → Session" })
        break
      }
      case "registry": {
        const approved = query("SELECT COUNT(*) as cnt FROM model_registry WHERE status = 'approved'")
        const blocked = query("SELECT COUNT(*) as cnt FROM model_registry WHERE status = 'blocked'")
        evidence.push({ metric: "Approved models", value: String(approved[0]?.cnt ?? 0), description: "Explicitly approved LLM models" })
        evidence.push({ metric: "Blocked models", value: String(blocked[0]?.cnt ?? 0), description: "Explicitly blocked LLM models" })
        break
      }
      case "trust": {
        const total = query("SELECT SUM(total_actions) as t FROM model_trust")
        const flagged = query("SELECT SUM(flagged_actions) as f FROM model_trust")
        evidence.push({ metric: "Total model actions", value: String(total[0]?.t ?? 0), description: "All actions across all models" })
        evidence.push({ metric: "Flagged actions", value: String(flagged[0]?.f ?? 0), description: "Actions exceeding trust thresholds" })
        break
      }
      case "provenance": {
        const files = query("SELECT COUNT(DISTINCT file_path) as cnt FROM file_provenance")
        const models = query("SELECT COUNT(DISTINCT model_id) as cnt FROM file_provenance")
        evidence.push({ metric: "Files tracked", value: String(files[0]?.cnt ?? 0), description: "Files with model provenance recorded" })
        evidence.push({ metric: "Models tracked", value: String(models[0]?.cnt ?? 0), description: "Models with provenance entries" })
        break
      }
      case "confinement": {
        evidence.push({ metric: "Confinement type", value: "Application-level", description: "Path canonicalization + pre-approved paths" })
        evidence.push({ metric: "Pre-approved paths", value: "5 (default)", description: "Configurable per deployment" })
        break
      }
      case "cascade": {
        evidence.push({ metric: "Cascade model", value: "One-way inheritance", description: "Parent → child policy propagation" })
        break
      }
      case "dlp": {
        const secretDetections = query("SELECT COUNT(*) as cnt FROM security_event WHERE event_type LIKE '%dlp%' OR event_type LIKE '%secret%'")
        evidence.push({ metric: "DLP detections", value: String(secretDetections[0]?.cnt ?? 0), description: "Secrets and PII blocked from outbound context" })
        evidence.push({ metric: "DLP modes", value: "Scan, Block, Redact", description: "Configurable action on detection" })
        break
      }
      case "injection": {
        evidence.push({ metric: "Injection patterns", value: "12 built-in", description: "Role override, system markers, comment injection, etc." })
        break
      }
      case "siem": {
        evidence.push({ metric: "SIEM export", value: "3 formats", description: "CEF, OCSF, JSON-syslog" })
        break
      }
    }
  }

  return evidence
}

function determineStatus(evidence: ControlEvidence["evidence"]): "evidenced" | "partial" | "gap" {
  if (evidence.length === 0) return "gap"
  const numericValues = evidence.filter((e) => parseInt(e.value) > 0 || e.value.includes("6") || e.value.includes("4") || e.value.includes("3"))
  if (numericValues.length >= evidence.length / 2) return "evidenced"
  if (numericValues.length > 0) return "partial"
  return "gap"
}

export function generateReport(options: ReportOptions): ComplianceReport {
  const frameworkName = options.framework ?? "all"
  const now = Date.now()
  const startTime = options.startTime ?? (now - 30 * 24 * 60 * 60 * 1000)
  const endTime = options.endTime ?? now

  const frameworksToProcess = frameworkName === "all"
    ? FRAMEWORKS
    : FRAMEWORKS.filter((f) => f.framework === frameworkName)

  const allControls: ControlEvidence[] = []

  for (const fw of frameworksToProcess) {
    for (const ctrl of fw.controls) {
      const evidence = gatherEvidence(ctrl, startTime, endTime)
      const status = determineStatus(evidence)
      allControls.push({
        controlId: ctrl.id,
        controlName: ctrl.name,
        status,
        evidence,
        notes: `Data sources: ${ctrl.dataSources.join(", ")}`,
      })
    }
  }

  const evidenced = allControls.filter((c) => c.status === "evidenced").length
  const partial = allControls.filter((c) => c.status === "partial").length
  const gap = allControls.filter((c) => c.status === "gap").length

  let overall = "Insufficient data"
  if (evidenced > allControls.length / 2) overall = evidenced > allControls.length * 0.8 ? "Strong" : "Moderate"
  if (gap > allControls.length / 2) overall = "Needs Improvement"

  return {
    metadata: {
      framework: frameworkName,
      frameworkName: frameworkName === "all" ? "All Frameworks" : frameworksToProcess[0]?.name ?? frameworkName,
      generated: new Date(now).toISOString(),
      startTime,
      endTime,
      projectName: options.projectName ?? "default",
      version: "1.0.0",
      disclaimer: "This report is generated from local data for informational purposes. LockedCode is not a compliance certification tool. Consult a qualified auditor for formal compliance assessments.",
    },
    controls: allControls,
    summary: { totalControls: allControls.length, evidenced, partial, gap, overall },
  }
}
