import { describe, expect, test, afterEach } from "bun:test"
import { scoreAction, type ActionContext } from "../trust/scoring"
import { determineAction, DEFAULT_THRESHOLDS } from "../trust/thresholds"
import { getSessionDecay, applySessionDecay, recordHighRiskAction, resetSessionDecay, getSessionSummary } from "../trust/session"

// ============================================================
// Scoring Tests
// ============================================================

describe("trust scoring", () => {
  const baseReadCtx: ActionContext = {
    toolName: "read", operation: "read", paths: ["/project/file.ts"],
    hasOutsidePaths: false, scanSeverity: undefined, hasPipes: false,
    hasEnvVarAccess: false, hasNetworkActivity: false,
    hasDlpDetections: false, hasInjectionDetections: false,
    writesToSystemDir: false, findingCount: 0,
  }

  test("file read within project → low score", () => {
    const result = scoreAction(baseReadCtx)
    expect(result.score).toBeLessThanOrEqual(20)
    expect(result.riskLevel).toBe("low")
  })

  test("file write with no findings → low score", () => {
    const result = scoreAction({ ...baseReadCtx, toolName: "write", operation: "write" })
    expect(result.score).toBe(15)
    expect(result.riskLevel).toBe("low")
  })

  test("shell command within project → medium score", () => {
    const result = scoreAction({ ...baseReadCtx, toolName: "shell", operation: "execute" })
    expect(result.score).toBe(30)
    expect(result.riskLevel).toBe("medium")
  })

  test("shell command with pipes → higher score", () => {
    const result = scoreAction({ ...baseReadCtx, toolName: "shell", operation: "execute", hasPipes: true })
    expect(result.score).toBeGreaterThanOrEqual(40)
  })

  test("write with high findings → high score", () => {
    const result = scoreAction({ ...baseReadCtx, toolName: "write", operation: "write", scanSeverity: "high" })
    expect(result.score).toBe(75)
    expect(result.riskLevel).toBe("high")
  })

  test("shell with hard-blocked pattern → critical score", () => {
    const result = scoreAction({ ...baseReadCtx, toolName: "shell", operation: "execute", scanSeverity: "critical" })
    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.riskLevel).toBe("critical")
  })

  test("score modifiers apply correctly", () => {
    const result = scoreAction({ ...baseReadCtx, hasOutsidePaths: true, hasEnvVarAccess: true, hasNetworkActivity: true })
    expect(result.score).toBeGreaterThan(30)
    expect(result.factors.length).toBeGreaterThanOrEqual(3)
  })

  test("score capped at 100", () => {
    const result = scoreAction({
      ...baseReadCtx, toolName: "shell", operation: "execute",
      scanSeverity: "critical", hasNetworkActivity: true, hasEnvVarAccess: true,
      hasOutsidePaths: true, writesToSystemDir: true, findingCount: 10,
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

// ============================================================
// Risk Level Mapping Tests
// ============================================================

describe("risk level mapping", () => {
  test("score 10 → low", () => {
    const result = scoreAction({
      toolName: "read", operation: "read", paths: [], hasOutsidePaths: false,
      scanSeverity: undefined, hasPipes: false, hasEnvVarAccess: false,
      hasNetworkActivity: false, hasDlpDetections: false,
      hasInjectionDetections: false, writesToSystemDir: false, findingCount: 0,
    })
    expect(result.riskLevel).toBe("low")
  })

  test("score 35 → medium", () => {
    const result = scoreAction({
      toolName: "shell", operation: "execute", paths: [], hasOutsidePaths: false,
      scanSeverity: undefined, hasPipes: false, hasEnvVarAccess: false,
      hasNetworkActivity: false, hasDlpDetections: false,
      hasInjectionDetections: false, writesToSystemDir: false, findingCount: 0,
    })
    expect(result.riskLevel).toBe("medium")
  })
})

// ============================================================
// Threshold Action Tests
// ============================================================

describe("threshold actions", () => {
  test("score 15 with default thresholds → auto_approve", () => {
    const action = determineAction({ score: 15, riskLevel: "low", factors: [] })
    expect(action).toBe("auto_approve")
  })

  test("score 35 → notify", () => {
    const action = determineAction({ score: 35, riskLevel: "medium", factors: [] })
    expect(action).toBe("notify")
  })

  test("score 60 → prompt", () => {
    const action = determineAction({ score: 60, riskLevel: "high", factors: [] })
    expect(action).toBe("prompt")
  })

  test("score 95 → block", () => {
    const action = determineAction({ score: 95, riskLevel: "critical", factors: [] })
    expect(action).toBe("block")
  })
})

// ============================================================
// Session Decay Tests
// ============================================================

describe("session decay", () => {
  const sessionId = "decay-test-session"

  afterEach(() => {
    resetSessionDecay(sessionId)
  })

  test("fresh session has 0 decay", () => {
    expect(getSessionDecay(sessionId)).toBe(0)
  })

  test("high-risk action adds decay", () => {
    recordHighRiskAction(sessionId, 60)
    expect(getSessionDecay(sessionId)).toBeGreaterThan(0)
  })

  test("critical-risk action adds more decay", () => {
    recordHighRiskAction(sessionId, 90)
    expect(getSessionDecay(sessionId)).toBe(10)
  })

  test("decay modifier applied to subsequent scores", () => {
    recordHighRiskAction(sessionId, 90) // +10 decay
    const decayed = applySessionDecay(30, sessionId)
    expect(decayed).toBe(40)
  })

  test("session reset clears decay", () => {
    recordHighRiskAction(sessionId, 90) // +10 decay
    resetSessionDecay(sessionId)
    expect(getSessionDecay(sessionId)).toBe(0)
  })

  test("decay caps at 30", () => {
    for (let i = 0; i < 10; i++) {
      recordHighRiskAction(sessionId + "-cap", 90)
    }
    expect(getSessionDecay(sessionId + "-cap")).toBeLessThanOrEqual(30)
  })

  test("getSessionSummary returns state", () => {
    recordHighRiskAction(sessionId, 60)
    const summary = getSessionSummary(sessionId)
    expect(summary.decay).toBeGreaterThanOrEqual(0)
    expect(summary.highRiskCount).toBeGreaterThanOrEqual(1)
  })
})
