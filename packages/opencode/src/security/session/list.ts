export interface SessionListEntry {
  readonly sessionId: string
  readonly modelId: string
  readonly startTime: number
  readonly endTime: number
  readonly eventCount: number
  readonly findingCount: number
  readonly blockedCount: number
  readonly trustScore: number
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

export function listSessions(options: { limit?: number; since?: number } = {}): SessionListEntry[] {
  const limit = options.limit ?? 20
  const since = options.since ?? (Date.now() - 7 * 24 * 3600 * 1000)

  const rows = query(`
    SELECT session_id,
           COUNT(*) as event_count,
           MAX(timestamp) as last_time,
           MIN(timestamp) as first_time,
           SUM(CASE WHEN severity IN ('warning', 'high', 'critical') THEN 1 ELSE 0 END) as finding_count,
           SUM(CASE WHEN action_taken = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
           MAX(CASE WHEN model_id IS NOT NULL THEN model_id ELSE '' END) as model_id
    FROM security_event
    WHERE timestamp >= ${since}
    GROUP BY session_id
    ORDER BY last_time DESC
    LIMIT ${limit}
  `)

  return rows.map((r: any) => ({
    sessionId: r.session_id,
    modelId: r.model_id || "unknown",
    startTime: r.first_time,
    endTime: r.last_time,
    eventCount: r.event_count,
    findingCount: r.finding_count,
    blockedCount: r.blocked_count,
    trustScore: Math.min(r.event_count, 100),
  }))
}
