import type { Severity } from "../types"

export interface TimelineEntry {
  readonly timestamp: number
  readonly eventType: string
  readonly severity: Severity
  readonly toolName: string | null
  readonly action: string
  readonly details: Record<string, unknown>
  readonly scanFindings: Array<{ ruleId: string; severity: string; scanner: string; remediation?: string }>
  readonly policyDecision: string | null
  readonly trustScore: number | null
  readonly filePath: string | null
  readonly duration: number | null
}

export interface SessionTimeline {
  readonly sessionId: string
  readonly startTime: number
  readonly endTime: number
  readonly modelId: string
  readonly entries: TimelineEntry[]
  readonly summary: {
    readonly totalEvents: number
    readonly warnings: number
    readonly blocked: number
    readonly findings: number
    readonly trustFinal: number
    readonly trustLevel: string
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

export function buildTimeline(sessionId: string): SessionTimeline {
  const events = query(
    `SELECT * FROM security_event WHERE session_id = '${sessionId}' ORDER BY timestamp ASC`
  )

  if (events.length === 0) {
    return {
      sessionId,
      startTime: 0, endTime: 0, modelId: "unknown",
      entries: [],
      summary: { totalEvents: 0, warnings: 0, blocked: 0, findings: 0, trustFinal: 0, trustLevel: "none" },
    }
  }

  const modelId = events.find((e: any) => e.model_id)?.model_id ?? "unknown"
  const startTime = events[0].timestamp
  const endTime = events[events.length - 1].timestamp

  const entries: TimelineEntry[] = []

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const prev = i > 0 ? events[i - 1] : null
    const findings = query(`SELECT * FROM scan_result WHERE security_event_id = '${e.id}'`)

    entries.push({
      timestamp: e.timestamp,
      eventType: e.event_type,
      severity: e.severity,
      toolName: e.tool_name ?? null,
      action: e.action_taken,
      details: {},
      scanFindings: findings.map((f: any) => ({
        ruleId: f.rule_id,
        severity: f.severity,
        scanner: f.scanner_name,
        remediation: f.remediation ?? undefined,
      })),
      policyDecision: null,
      trustScore: null,
      filePath: null,
      duration: prev ? e.timestamp - prev.timestamp : null,
    })
  }

  const warnings = entries.filter((e) => e.severity === "warning" || e.severity === "high").length
  const blocked = entries.filter((e) => e.action === "blocked").length
  const findings = entries.reduce((sum, e) => sum + e.scanFindings.length, 0)

  const trustFinal = Math.min(entries.length, 100)
  let trustLevel = "low"
  if (trustFinal > 50) trustLevel = "high"
  else if (trustFinal > 20) trustLevel = "medium"

  return {
    sessionId, startTime, endTime, modelId, entries,
    summary: { totalEvents: entries.length, warnings, blocked, findings, trustFinal, trustLevel },
  }
}
