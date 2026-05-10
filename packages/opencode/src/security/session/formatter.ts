import type { SessionTimeline } from "./timeline"

function formatTime(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(11, 19)
}

function formatDuration(ms: number | null): string {
  if (!ms) return ""
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "info": return "✓"
    case "warning": return "🟡"
    case "high": return "🟠"
    case "critical": return "🔴"
    default: return "•"
  }
}

export function formatTimeline(timeline: SessionTimeline): string {
  const lines: string[] = []
  const totalSec = Math.floor((timeline.endTime - timeline.startTime) / 1000)
  const durationStr = `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`

  lines.push(`Session Replay: ${timeline.sessionId}`)
  lines.push(`Model: ${timeline.modelId} | Duration: ${durationStr} | ${new Date(timeline.startTime).toISOString().slice(0, 16).replace("T", " ")}–${new Date(timeline.endTime).toISOString().slice(11, 16)}`)
  lines.push("")

  for (const entry of timeline.entries) {
    const ts = formatTime(entry.timestamp)
    const icon = severityIcon(entry.severity)
    const tool = entry.toolName ? `[${entry.toolName}]` : `[${entry.eventType.slice(9, 20)}]`
    const file = entry.filePath ?? ""
    const score = entry.trustScore !== null ? `score: ${entry.trustScore}` : ""
    const duration = entry.duration !== null ? `+${formatDuration(entry.duration)}` : ""

    let actionIndicator = ""
    if (entry.action === "blocked") actionIndicator = " 🔒 BLOCKED"
    else if (entry.action === "redacted") actionIndicator = " ✏️ REDACTED"

    lines.push(`  ${ts} ${duration.padStart(8)} ${icon} ${tool.padEnd(18)} ${file.padEnd(35)} ${score}${actionIndicator}`)

    for (const f of entry.scanFindings) {
      const fIcon = severityIcon(f.severity)
      lines.push(`    ${fIcon} [${f.scanner}] ${f.ruleId} — ${f.remediation ?? ""}`)
    }

    if (entry.action === "blocked") {
      lines.push(`    🔒 Action blocked by policy`)
    }
  }

  lines.push("")
  lines.push("─── Summary ───────────────────────────────────────")
  lines.push(`Actions: ${timeline.summary.totalEvents} | Warnings: ${timeline.summary.warnings} | Blocked: ${timeline.summary.blocked} | Findings: ${timeline.summary.findings}`)
  lines.push(`Trust: ${timeline.summary.trustLevel} risk (score: ${timeline.summary.trustFinal})`)

  return lines.join("\n")
}

export function formatTimelineJSON(timeline: SessionTimeline): string {
  return JSON.stringify(timeline, null, 2)
}
