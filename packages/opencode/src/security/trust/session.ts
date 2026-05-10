const DECAY_INCREMENT_HIGH = 5
const DECAY_INCREMENT_CRITICAL = 10
const DECAY_CAP = 30

interface SessionState {
  decay: number
  highRiskCount: number
}

const sessions = new Map<string, SessionState>()

/**
 * Get the current session decay modifier.
 */
export function getSessionDecay(sessionId: string): number {
  return sessions.get(sessionId)?.decay ?? 0
}

/**
 * Apply session decay modifier to a score.
 */
export function applySessionDecay(score: number, sessionId: string): number {
  const decay = getSessionDecay(sessionId)
  return Math.min(score + decay, 100)
}

/**
 * Record a high-risk action that may increase session decay.
 */
export function recordHighRiskAction(sessionId: string, score: number): void {
  const state = sessions.get(sessionId) ?? { decay: 0, highRiskCount: 0 }
  state.highRiskCount++

  if (score > 80) {
    state.decay = Math.min(state.decay + DECAY_INCREMENT_CRITICAL, DECAY_CAP)
  } else if (score > 50) {
    state.decay = Math.min(state.decay + DECAY_INCREMENT_HIGH, DECAY_CAP)
  }

  sessions.set(sessionId, state)
}

/**
 * Reset session trust state.
 */
export function resetSessionDecay(sessionId: string): void {
  sessions.delete(sessionId)
}

/**
 * Get session trust summary.
 */
export function getSessionSummary(sessionId: string): { decay: number; highRiskCount: number } {
  const state = sessions.get(sessionId)
  return { decay: state?.decay ?? 0, highRiskCount: state?.highRiskCount ?? 0 }
}
