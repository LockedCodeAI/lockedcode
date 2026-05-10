import { describe, expect, test } from "bun:test"
import { formatTimeline, formatTimelineJSON } from "../session/formatter"
import type { SessionTimeline } from "../session/timeline"

const sampleTimeline: SessionTimeline = {
  sessionId: "test-session",
  startTime: 1715350000000,
  endTime: 1715350100000,
  modelId: "deepseek-v4-pro",
  entries: [
    {
      timestamp: 1715350000000,
      eventType: "security.scan_completed",
      severity: "info",
      toolName: "read",
      action: "allowed",
      details: {},
      scanFindings: [],
      policyDecision: null,
      trustScore: 5,
      filePath: "src/index.ts",
      duration: null,
    },
    {
      timestamp: 1715350050000,
      eventType: "security.scan_completed",
      severity: "warning",
      toolName: "write",
      action: "warned",
      details: {},
      scanFindings: [
        { ruleId: "generic-api-key", severity: "warning", scanner: "secrets", remediation: "Move to env var" },
      ],
      policyDecision: null,
      trustScore: 55,
      filePath: "src/config/database.ts",
      duration: 50000,
    },
    {
      timestamp: 1715350100000,
      eventType: "security.action_blocked",
      severity: "critical",
      toolName: "shell",
      action: "blocked",
      details: {},
      scanFindings: [],
      policyDecision: "deny",
      trustScore: 95,
      filePath: null,
      duration: 50000,
    },
  ],
  summary: { totalEvents: 3, warnings: 1, blocked: 1, findings: 1, trustFinal: 50, trustLevel: "medium" },
}

describe("timeline formatter", () => {
  test("produces readable output", () => {
    const output = formatTimeline(sampleTimeline)
    expect(output).toContain("Session Replay")
    expect(output).toContain("deepseek-v4-pro")
    expect(output).toContain("test-session")
  })

  test("includes severity icons", () => {
    const output = formatTimeline(sampleTimeline)
    expect(output).toContain("✓")
    expect(output).toContain("🟡")
    expect(output).toContain("🔴")
  })

  test("includes scan findings", () => {
    const output = formatTimeline(sampleTimeline)
    expect(output).toContain("generic-api-key")
    expect(output).toContain("secrets")
  })

  test("includes blocked indicator", () => {
    const output = formatTimeline(sampleTimeline)
    expect(output).toContain("BLOCKED")
  })

  test("includes summary", () => {
    const output = formatTimeline(sampleTimeline)
    expect(output).toContain("Summary")
    expect(output).toContain("Actions: 3")
    expect(output).toContain("Warnings: 1")
  })

  test("JSON export produces valid JSON", () => {
    const json = formatTimelineJSON(sampleTimeline)
    const parsed = JSON.parse(json)
    expect(parsed.sessionId).toBe("test-session")
    expect(parsed.entries.length).toBe(3)
    expect(parsed.entries[1].scanFindings.length).toBe(1)
  })

  test("duration between entries calculated", () => {
    expect(sampleTimeline.entries[1].duration).toBe(50000)
    expect(sampleTimeline.entries[0].duration).toBeNull()
  })
})
