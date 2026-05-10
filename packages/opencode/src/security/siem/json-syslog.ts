import os from "os"
import type { SecurityEvent, Severity } from "../types"

/**
 * RFC 5424 severity mapping.
 */
function syslogSeverity(severity: Severity): number {
  switch (severity) {
    case "info": return 6
    case "warning": return 4
    case "high": return 3
    case "critical": return 2
  }
}

function isoFormat(ts: number): string {
  return new Date(ts).toISOString()
}

/**
 * Format a security event as RFC 5424 syslog message with structured JSON.
 *
 * <PRI>VERSION TIMESTAMP HOSTNAME APPNAME PROCID MSGID [STRUCTURED_DATA] MSG
 */
export function formatSyslog(event: SecurityEvent): string {
  const pri = 128 + syslogSeverity(event.severity ?? "info")
  const ts = isoFormat(event.timestamp)
  const hostname = os.hostname()
  const appname = "lockedcode"
  const procid = String(process.pid)
  const msgid = event.eventType

  const sd = {
    "lockedcode@0": {
      session_id: event.sessionId,
      event_type: event.eventType,
      tool_name: event.toolName ?? "",
      model_id: event.modelId ?? "",
      action_taken: event.actionTaken,
      content_hash: event.contentHash?.slice(0, 16) ?? "",
    },
  }

  const sdStr = Object.entries(sd).map(([id, fields]) => {
    const pairs = Object.entries(fields).map(([k, v]) => `${k}="${String(v).replace(/[\\"]/g, "\\$&")}"`)
    return `[${id} ${pairs.join(" ")}]`
  }).join("")

  const message = `Security event: ${event.eventType} (${event.actionTaken})`

  return `<${pri}>1 ${ts} ${hostname} ${appname} ${procid} ${msgid} ${sdStr} ${message}`
}

/**
 * Format as plain JSON for syslog ingestion.
 */
export function formatJSONSyslog(event: SecurityEvent): string {
  return JSON.stringify({
    timestamp: isoFormat(event.timestamp),
    facility: "local0",
    severity: event.severity ?? "info",
    hostname: os.hostname(),
    appname: "lockedcode",
    procid: String(process.pid),
    msgid: event.eventType,
    structured_data: {
      "lockedcode@0": {
        session_id: event.sessionId,
        event_type: event.eventType,
        tool_name: event.toolName ?? "",
        model_id: event.modelId ?? "",
        action_taken: event.actionTaken,
        content_hash: event.contentHash?.slice(0, 16) ?? "",
      },
    },
    message: `Security event: ${event.eventType} (${event.actionTaken})`,
  })
}
