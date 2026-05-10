import type { ScoredAction } from "./scoring"

export type TrustAction = "auto_approve" | "notify" | "prompt" | "block"

export interface TrustThresholds {
  readonly autoApproveBelow: number
  readonly promptAbove: number
  readonly blockAbove: number
}

/**
 * Default trust thresholds.
 */
export const DEFAULT_THRESHOLDS: TrustThresholds = {
  autoApproveBelow: 20,
  promptAbove: 50,
  blockAbove: 90,
}

/**
 * Determine the action to take based on the trust score and configured thresholds.
 */
export function determineAction(scored: ScoredAction, thresholds: TrustThresholds = DEFAULT_THRESHOLDS): TrustAction {
  if (scored.score >= thresholds.blockAbove) return "block"
  if (scored.score >= thresholds.promptAbove) return "prompt"
  if (scored.score >= thresholds.autoApproveBelow) return "notify"
  return "auto_approve"
}
