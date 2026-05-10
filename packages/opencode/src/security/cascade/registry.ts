import type { Policy } from "../policy/schema"

/**
 * Security context for an agent in the cascade hierarchy.
 */
export interface AgentSecurityContext {
  readonly agentId: string
  readonly parentAgentId: string | null
  readonly sessionId: string
  readonly effectivePolicy: Policy
  readonly confinementRoot: string
  readonly registeredAt: number
}

const registry = new Map<string, AgentSecurityContext>()

/**
 * Register a new agent with its security context.
 */
export function registerAgent(
  agentId: string,
  parentAgentId: string | null,
  sessionId: string,
  effectivePolicy: Policy,
  confinementRoot: string,
): void {
  if (parentAgentId && !registry.has(parentAgentId)) {
    throw new Error(`Parent agent "${parentAgentId}" not found in cascade registry`)
  }
  registry.set(agentId, {
    agentId,
    parentAgentId,
    sessionId,
    effectivePolicy,
    confinementRoot,
    registeredAt: Date.now(),
  })
}

/**
 * Get the security context for an agent.
 */
export function getAgentContext(agentId: string): AgentSecurityContext | null {
  return registry.get(agentId) ?? null
}

/**
 * Get the parent chain from an agent up to the root.
 */
export function getParentChain(agentId: string): string[] {
  const chain: string[] = []
  let current = registry.get(agentId)
  while (current) {
    chain.push(current.agentId)
    current = current.parentAgentId ? registry.get(current.parentAgentId) ?? null : null
  }
  return chain
}

/**
 * Remove an agent from the registry.
 */
export function deregisterAgent(agentId: string): void {
  registry.delete(agentId)
}

/**
 * Get all active agent contexts.
 */
export function getActiveAgents(): AgentSecurityContext[] {
  return Array.from(registry.values())
}

/**
 * Clear the registry (for testing).
 */
export function clearRegistry(): void {
  registry.clear()
}
