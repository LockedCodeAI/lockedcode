import type { Policy } from "../policy/schema"

/**
 * Inherit policy from parent to child, enforcing escalation rules.
 *
 * The child's effective policy can only be MORE restrictive than the parent's.
 * Violations are silently corrected to the parent's level (with a logged warning).
 */
export function inheritPolicy(parent: Policy, child?: Partial<Policy>): Policy {
  if (!child) return { ...parent }

  const result: Policy = JSON.parse(JSON.stringify(parent))

  // Strictness: child cannot be less restrictive
  const order = ["permissive", "standard", "strict"]
  const parentIdx = order.indexOf(parent.security.strictness)
  const childIdx = child.security?.strictness ? order.indexOf(child.security.strictness) : -1

  if (child.security?.strictness && childIdx !== -1 && childIdx < parentIdx) {
    // Child requested less restrictive — override to parent's level
    result.security.strictness = parent.security.strictness
  } else if (child.security?.strictness && childIdx !== -1) {
    result.security.strictness = child.security.strictness
  }

  // Confinement: child inherits parent boundary, cannot widen
  if (child.security?.confinement) {
    if (child.security.confinement.preApprovedPaths) {
      // Child can remove paths but cannot add new ones
      const parentPaths = new Set(parent.security.confinement.preApprovedPaths ?? [])
      const childPaths = child.security.confinement.preApprovedPaths
      result.security.confinement.preApprovedPaths = childPaths.filter((p) => parentPaths.has(p))
    }
  }

  // Trust thresholds: child can lower autoApprove (more restrictive) but cannot raise it
  if (child.security?.trust) {
    const parentTrust = parent.security.trust
    const childTrust = child.security.trust
    if (childTrust.autoApproveBelow !== undefined) {
      result.security.trust.autoApproveBelow = Math.min(childTrust.autoApproveBelow, parentTrust.autoApproveBelow)
    }
    if (childTrust.promptAbove !== undefined) {
      result.security.trust.promptAbove = Math.max(childTrust.promptAbove, parentTrust.promptAbove)
    }
    if (childTrust.blockAbove !== undefined) {
      result.security.trust.blockAbove = Math.min(childTrust.blockAbove, parentTrust.blockAbove)
    }
  }

  // Scanning: child cannot disable scanners the parent has enabled
  if (child.security?.scanning) {
    result.security.scanning.enabled = parent.security.scanning.enabled
    if (result.security.scanning.semgrep) {
      result.security.scanning.semgrep.enabled = parent.security.scanning.semgrep.enabled
    }
    if (result.security.scanning.yara) {
      result.security.scanning.yara.enabled = parent.security.scanning.yara.enabled
    }
  }

  // DLP: child cannot disable DLP if parent has it enabled
  if (child.security?.dlp) {
    result.security.dlp.enabled = parent.security.dlp.enabled
  }

  return result
}

/**
 * Verify that a child's effective policy is not less restrictive than the parent's.
 */
export function verifyCascade(parent: Policy, child: Policy): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  const order = ["permissive", "standard", "strict"]

  const parentLevel = order.indexOf(parent.security.strictness)
  const childLevel = order.indexOf(child.security.strictness)
  if (childLevel < parentLevel) {
    issues.push(`Child strictness "${child.security.strictness}" is less restrictive than parent "${parent.security.strictness}"`)
  }

  return { valid: issues.length === 0, issues }
}
