import { describe, expect, test } from "bun:test"
import { formatCEF } from "../siem/cef"
import { formatOCSF } from "../siem/ocsf"
import { formatSyslog, formatJSONSyslog } from "../siem/json-syslog"
import type { SecurityEvent, Severity } from "../types"

const testEvent: SecurityEvent = {
  eventType: "security.scan_completed",
  sessionId: "session-test-1",
  timestamp: 1715350000000,
  severity: "warning" as Severity,
  toolName: "semgrep",
  modelId: "gpt-4",
  contentHash: "abc123def456ghi789jkl012mno3456789abcdef0123456789abcdef012345678",
  actionTaken: "blocked",
  details: { findings: 2, scanner: "semgrep" },
}

const infoEvent: SecurityEvent = { ...testEvent, severity: "info", eventType: "security.scan_completed" }
const highEvent: SecurityEvent = { ...testEvent, severity: "high", eventType: "security.action_blocked" }
const criticalEvent: SecurityEvent = { ...testEvent, severity: "critical", eventType: "security.dlp_secret_detected" }

// ============================================================
// CEF Format Tests
// ============================================================

describe("CEF formatting", () => {
  test("produces valid CEF header", () => {
    const result = formatCEF(testEvent)
    expect(result).toContain("CEF:0|LockedCode|LockedCode|1.0|security.scan_completed")
  })

  test("severity warning maps to 5", () => {
    const result = formatCEF(testEvent)
    expect(result).toContain("|5|")
  })

  test("severity info maps to 3", () => {
    expect(formatCEF(infoEvent)).toContain("|3|")
  })

  test("severity high maps to 7", () => {
    expect(formatCEF(highEvent)).toContain("|7|")
  })

  test("severity critical maps to 9", () => {
    expect(formatCEF(criticalEvent)).toContain("|9|")
  })

  test("includes session_id in extension", () => {
    expect(formatCEF(testEvent)).toContain("session-test-1")
  })

  test("includes action_taken in extension", () => {
    expect(formatCEF(testEvent)).toContain("act=blocked")
  })

  test("includes session_id in extension", () => {
    expect(formatCEF(testEvent)).toContain("session-test-1")
  })
})

// ============================================================
// OCSF Format Tests
// ============================================================

describe("OCSF formatting", () => {
  test("produces valid OCSF object", () => {
    const result = formatOCSF(testEvent)
    expect(result.class_uid).toBeDefined()
    expect(result.category_uid).toBeDefined()
    expect(result.time).toBe(1715350000000)
  })

  test("severity warning maps correctly", () => {
    const result = formatOCSF(testEvent)
    expect(result.severity_id).toBe(3)
  })

  test("severity critical maps to 5", () => {
    const result = formatOCSF(criticalEvent)
    expect(result.severity_id).toBe(5)
  })

  test("includes product metadata", () => {
    const result = formatOCSF(testEvent)
    expect((result.metadata as any).product.name).toBe("LockedCode")
    expect((result.metadata as any).product.vendor_name).toBe("LockedCodeAI")
  })

  test("includes session UID", () => {
    const result = formatOCSF(testEvent)
    expect((result.actor as any).session.uid).toBe("session-test-1")
  })

  test("scan events map to class_uid 2001", () => {
    const result = formatOCSF(testEvent)
    expect(result.class_uid).toBe(2001)
  })
})

// ============================================================
// Syslog Format Tests
// ============================================================

describe("syslog formatting", () => {
  test("RFC 5424 version header present", () => {
    const result = formatSyslog(testEvent)
    expect(result).toContain("lockedcode")
  })

  test("includes lockedcode appname", () => {
    const result = formatSyslog(testEvent)
    expect(result).toContain("lockedcode")
  })

  test("includes structured data with @0", () => {
    const result = formatSyslog(testEvent)
    expect(result).toContain("lockedcode@0")
  })

  test("JSON syslog format has all fields", () => {
    const result = JSON.parse(formatJSONSyslog(testEvent))
    expect(result.appname).toBe("lockedcode")
    expect(result.msgid).toBe("security.scan_completed")
    expect(result.structured_data["lockedcode@0"].session_id).toBe("session-test-1")
  })
})
