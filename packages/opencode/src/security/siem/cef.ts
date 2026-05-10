import type { SecurityEvent, Severity } from "../types"

/**
 * CEF severity mapping: LockedCode → ArcSight (0-10).
 */
function cefSeverity(severity: Severity): number {
  switch (severity) {
    case "info": return 3
    case "warning": return 5
    case "high": return 7
    case "critical": return 9
  }
}

/**
 * Escape CEF extension values.
 * Backslash, equals, and pipe must be escaped.
 */
function cefEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\|/g, "\\|")
}

/**
 * Format a security event as CEF (Common Event Format).
 *
 * CEF:0|Vendor|Product|Version|EventType|Name|Severity|Extension
 */
export function formatCEF(event: SecurityEvent): string {
  const sev = cefSeverity(event.severity ?? "info")
  const ext = [
    `src=${cefEscape(event.sessionId)}`,
    `act=${cefEscape(event.actionTaken)}`,
    event.toolName ? `cs1=${cefEscape(event.toolName)} cs1Label=toolName` : "",
    event.modelId ? `cs2=${cefEscape(event.modelId)} cs2Label=modelId` : "",
    event.contentHash ? `cs3=${cefEscape(event.contentHash.slice(0, 16))} cs3Label=contentHash` : "",
  ].filter(Boolean).join(" ")

  return `CEF:0|LockedCode|LockedCode|1.0|${cefEscape(event.eventType)}|Security event|${sev}|${ext}`
}
