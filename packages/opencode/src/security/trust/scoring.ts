import type { Severity } from "../types"

/**
 * Context for scoring a single action.
 */
export interface ActionContext {
  readonly toolName: string
  readonly operation: "read" | "write" | "execute" | "shell" | "rename"
  readonly paths: string[]
  readonly hasOutsidePaths: boolean
  readonly scanSeverity?: Severity
  readonly hasPipes: boolean
  readonly hasEnvVarAccess: boolean
  readonly hasNetworkActivity: boolean
  readonly hasDlpDetections: boolean
  readonly hasInjectionDetections: boolean
  readonly writesToSystemDir: boolean
  readonly findingCount: number
}

export interface ScoredAction {
  readonly score: number
  readonly riskLevel: "low" | "medium" | "high" | "critical"
  readonly factors: string[]
}

/**
 * Determine the base score from action type and scan findings.
 */
function baseScore(ctx: ActionContext): number {
  if (ctx.scanSeverity === "critical") return 95
  if (ctx.scanSeverity === "high") {
    if (ctx.toolName === "shell") return 80
    return 75
  }

  if (ctx.toolName === "shell") {
    if (ctx.hasPipes) return 45
    if (ctx.scanSeverity === "warning") return 55
    return 30
  }

  if (ctx.operation === "rename") return 10
  if (ctx.operation === "write" || ctx.toolName === "write" || ctx.toolName === "edit") {
    if (ctx.scanSeverity === "warning") return 55
    if (ctx.findingCount > 0) return 25
    return 15
  }

  if (ctx.operation === "read") return 5

  return 20
}

/**
 * Calculate modifiers that add to the base score.
 */
function calculateModifiers(ctx: ActionContext): { modifier: number; factors: string[] } {
  let modifier = 0
  const factors: string[] = []

  if (ctx.hasOutsidePaths) {
    modifier += 10
    factors.push("paths outside project root")
  }

  if (ctx.hasEnvVarAccess) {
    modifier += 10
    factors.push("sensitive environment variable access")
  }

  if (ctx.hasNetworkActivity) {
    modifier += 10
    factors.push("network activity")
  }

  if (ctx.writesToSystemDir) {
    modifier += 15
    factors.push("writes to system directory")
  }

  if (ctx.findingCount > 1) {
    const addl = Math.min((ctx.findingCount - 1) * 5, 20)
    modifier += addl
    factors.push(`${addl} additional findings`)
  }

  if (ctx.hasDlpDetections) {
    modifier += 5
    factors.push("DLP detections on related content")
  }

  if (ctx.hasInjectionDetections) {
    modifier += 10
    factors.push("injection patterns in related files")
  }

  if (ctx.hasPipes && ctx.toolName === "shell") {
    modifier += 5
    if (!factors.some((f) => f.includes("pipes"))) {
      factors.push("shell command with pipes")
    }
  }

  return { modifier, factors }
}

/**
 * Score an action and return the trust score with contributing factors.
 */
export function scoreAction(ctx: ActionContext): ScoredAction {
  const base = baseScore(ctx)
  const { modifier, factors } = calculateModifiers(ctx)

  const score = Math.min(base + modifier, 100)

  let riskLevel: "low" | "medium" | "high" | "critical"
  if (score <= 20) riskLevel = "low"
  else if (score <= 50) riskLevel = "medium"
  else if (score <= 80) riskLevel = "high"
  else riskLevel = "critical"

  if (factors.length === 0) {
    factors.push(`base score ${base} for ${ctx.toolName} ${ctx.operation}`)
  }

  return { score, riskLevel, factors }
}
