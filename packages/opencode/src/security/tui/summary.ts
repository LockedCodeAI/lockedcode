import type { Severity } from "../types"

export interface SessionSummaryData {
  readonly projectRoot: string
  readonly strictness: string
  readonly modelId: string
  readonly actionsScanned: number
  readonly findings: Record<Severity, number>
  readonly blocked: number
  readonly overrides: number
  readonly sessionTrust: number
  readonly sessionTrustLevel: string
  readonly modelTrustFlagRate: number
  readonly modelTrustLevel: string
}

/**
 * Build a session summary from raw data points.
 * This is the aggregation function that would be called with data from
 * AuditService, TrustService, and ConfinementService.
 */
export function buildSessionSummary(input: {
  projectRoot: string
  strictness: string
  modelId: string
  eventCounts: Array<{ severity: string; event_type: string; action_taken: string }>
  sessionDecay: number
  sessionHighRiskCount: number
  modelTotalActions: number
  modelFlaggedActions: number
  modelTrustLevel: string
}): SessionSummaryData {
  const findings: Record<Severity, number> = { info: 0, warning: 0, high: 0, critical: 0 }
  let blocked = 0
  let overrides = 0
  let actionsScanned = 0

  for (const evt of input.eventCounts) {
    const sev = evt.severity as Severity
    if (findings[sev] !== undefined) {
      findings[sev]++
    }
    if (evt.action_taken === "blocked") blocked++
    if (evt.action_taken === "overridden") overrides++
    actionsScanned++
  }

  const flagRate = input.modelTotalActions > 0
    ? input.modelFlaggedActions / input.modelTotalActions
    : 0

  let sessionTrustLevel: string
  if (input.sessionDecay <= 0) sessionTrustLevel = "low"
  else if (input.sessionDecay <= 15) sessionTrustLevel = "medium"
  else if (input.sessionDecay <= 25) sessionTrustLevel = "high"
  else sessionTrustLevel = "critical"

  return {
    projectRoot: input.projectRoot,
    strictness: input.strictness,
    modelId: input.modelId,
    actionsScanned,
    findings,
    blocked,
    overrides,
    sessionTrust: input.sessionDecay,
    sessionTrustLevel,
    modelTrustFlagRate: flagRate,
    modelTrustLevel: input.modelTrustLevel,
  }
}
