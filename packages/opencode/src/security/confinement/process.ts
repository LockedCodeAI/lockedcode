/**
 * Process tree model — tracks parent-child relationships between the
 * primary agent and spawned processes/sub-agents.
 *
 * Each node records:
 * - sessionID: The session identifier for this agent
 * - parentSessionID: The parent session (null for root)
 * - projectRoot: The confinement boundary this agent operates within
 *
 * This is an in-memory map for now. Persistence comes later.
 */

export interface ProcessTreeNode {
  readonly sessionID: string
  readonly parentSessionID: string | null
  readonly projectRoot: string
}

const processes = new Map<string, ProcessTreeNode>()

/**
 * Register a process/node in the tree.
 */
export function registerNode(sessionID: string, parentSessionID: string | null, projectRoot: string): void {
  processes.set(sessionID, { sessionID, parentSessionID, projectRoot })
}

/**
 * Get a node by session ID.
 */
export function getNode(sessionID: string): ProcessTreeNode | undefined {
  return processes.get(sessionID)
}

/**
 * Check if a child session inherits the parent's confinement boundary.
 * A child cannot have a more restrictive boundary (i.e., wider scope) than its parent.
 */
export function verifyInheritance(childSessionID: string, parentSessionID: string): boolean {
  const child = processes.get(childSessionID)
  const parent = processes.get(parentSessionID)
  if (!child || !parent) return false
  return child.projectRoot === parent.projectRoot || child.projectRoot.startsWith(parent.projectRoot + "/")
}

/**
 * Remove a node (and all its descendants) from the tree.
 */
export function removeNode(sessionID: string): void {
  const toRemove: string[] = [sessionID]
  for (const [id, node] of processes) {
    if (node.parentSessionID === sessionID) {
      toRemove.push(id)
    }
  }
  for (const id of toRemove) {
    processes.delete(id)
  }
}

/**
 * Get all registered nodes (for testing/inspection).
 */
export function getAllNodes(): ProcessTreeNode[] {
  return Array.from(processes.values())
}

/**
 * Clear the tree (for testing).
 */
export function clearTree(): void {
  processes.clear()
}
