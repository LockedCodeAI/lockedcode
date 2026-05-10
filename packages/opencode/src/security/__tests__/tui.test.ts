import { describe, expect, test } from "bun:test"
import { formatFinding, formatFindings, formatSecurityStatus, formatSessionSummary } from "../tui/formatter"
import { buildSessionSummary } from "../tui/summary"
import type { ScanFinding, Severity } from "../types"

// ============================================================
// Finding Formatter Tests
// ============================================================

describe("finding formatter", () => {
  test("formats a warning finding", () => {
    const finding: ScanFinding = {
      severity: "warning", ruleId: "test.rule", scanner: "semgrep",
      matchedContent: "test", confidence: "high",
    }
    const result = formatFinding(finding)
    expect(result).toContain("test.rule")
    expect(result).toContain("semgrep")
    expect(result).toContain("🟡")
  })

  test("formats a finding with line number", () => {
    const finding: ScanFinding = {
      severity: "high", ruleId: "test.rule", scanner: "yara",
      matchedContent: "test", confidence: "high", lineNumber: 42,
    }
    const result = formatFinding(finding)
    expect(result).toContain(":42")
  })

  test("groups and formats multiple findings", () => {
    const findings: ScanFinding[] = [
      { severity: "warning", ruleId: "rule1", scanner: "s1", matchedContent: "", confidence: "medium" },
      { severity: "high", ruleId: "rule2", scanner: "s2", matchedContent: "", confidence: "high" },
    ]
    const result = formatFindings(findings)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0]).toContain("findings")
  })

  test("empty findings returns empty array", () => {
    expect(formatFindings([])).toEqual([])
  })

  test("formats security status line", () => {
    const result = formatSecurityStatus({
      confinementActive: true,
      projectRoot: "/project",
      strictness: "standard",
      airGap: false,
      scansDone: 42,
      warnings: 3,
      blocks: 0,
    })
    expect(result).toContain("/project")
    expect(result).toContain("standard")
    expect(result).toContain("42")
    expect(result).toContain("3")
  })

  test("security status with confinement inactive", () => {
    const result = formatSecurityStatus({
      confinementActive: false,
      strictness: "strict",
      airGap: true,
      scansDone: 0, warnings: 0, blocks: 0,
    })
    expect(result).toContain("Confinement inactive")
    expect(result).toContain("Air-gap")
  })
})

// ============================================================
// Session Summary Builder Tests
// ============================================================

describe("session summary builder", () => {
  test("builds summary from event data", () => {
    const summary = buildSessionSummary({
      projectRoot: "/project",
      strictness: "standard",
      modelId: "gpt-4",
      eventCounts: [
        { severity: "warning", event_type: "scan_completed", action_taken: "allowed" },
        { severity: "high", event_type: "scan_completed", action_taken: "allowed" },
        { severity: "critical", event_type: "action_blocked", action_taken: "blocked" },
      ],
      sessionDecay: 5,
      sessionHighRiskCount: 1,
      modelTotalActions: 100,
      modelFlaggedActions: 3,
      modelTrustLevel: "trusted",
    })
    expect(summary.actionsScanned).toBe(3)
    expect(summary.findings.warning).toBe(1)
    expect(summary.findings.high).toBe(1)
    expect(summary.findings.critical).toBe(1)
    expect(summary.blocked).toBe(1)
    expect(summary.overrides).toBe(0)
    expect(summary.projectRoot).toBe("/project")
    expect(summary.modelTrustFlagRate).toBe(0.03)
    expect(summary.modelTrustLevel).toBe("trusted")
  })

  test("session summary formatter output", () => {
    const output = formatSessionSummary({
      projectRoot: "/project",
      strictness: "standard",
      modelId: "gpt-4",
      actionsScanned: 47,
      findings: { critical: 0, high: 1, warning: 5, info: 0 },
      blocked: 0,
      overrides: 0,
      sessionTrust: 12,
      sessionTrustLevel: "low risk",
      modelTrustFlagRate: 0.02,
      modelTrustLevel: "trusted",
    })
    expect(output).toContain("Security Summary")
    expect(output).toContain("/project")
    expect(output).toContain("standard")
    expect(output).toContain("47")
    expect(output).toContain("trusted")
  })

  test("empty event counts produce zero findings", () => {
    const summary = buildSessionSummary({
      projectRoot: "/p",
      strictness: "strict",
      modelId: "m",
      eventCounts: [],
      sessionDecay: 0,
      sessionHighRiskCount: 0,
      modelTotalActions: 0,
      modelFlaggedActions: 0,
      modelTrustLevel: "trusted",
    })
    expect(summary.actionsScanned).toBe(0)
    expect(summary.findings.warning).toBe(0)
    expect(summary.blocked).toBe(0)
  })
})
