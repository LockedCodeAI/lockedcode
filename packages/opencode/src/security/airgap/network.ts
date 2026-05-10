import type { Policy } from "../policy/schema"
import { resolveRulesPath } from "../rules/resolver"

export interface NetworkConfigWarning {
  readonly field: string
  readonly description: string
  readonly severity: "info" | "warning"
}

/**
 * Scan the policy for any settings that imply network access.
 */
export function detectNetworkConfig(policy: Policy): NetworkConfigWarning[] {
  const warnings: NetworkConfigWarning[] = []

  // Check custom rule paths
  for (const ruleType of ["semgrep", "yara"] as const) {
    const rulesPath = ruleType === "semgrep"
      ? policy.security.scanning.semgrep.rulesPath
      : policy.security.scanning.yara.rulesPath
    if (rulesPath && (rulesPath.startsWith("http://") || rulesPath.startsWith("https://"))) {
      warnings.push({
        field: `security.scanning.${ruleType}.rulesPath`,
        description: `Custom ${ruleType} rules path points to a network URL: ${rulesPath}`,
        severity: "warning",
      })
    }
  }

  return warnings
}

/**
 * Verify air-gap compliance for all scanners.
 */
export function verifyAirGapCompliance(policy: Policy): NetworkConfigWarning[] {
  const warnings = detectNetworkConfig(policy)

  // Check if Semgrep rules resolve locally
  if (policy.security.scanning.semgrep.enabled) {
    const semgrepPath = resolveRulesPath("semgrep", policy.security.scanning.semgrep.rulesPath)
    if (!semgrepPath) {
      warnings.push({
        field: "security.scanning.semgrep",
        description: "Semgrep rules not found locally. In air-gap mode, Semgrep scanning will be unavailable.",
        severity: "warning",
      })
    }
  }

  // Check if YARA rules resolve locally
  if (policy.security.scanning.yara.enabled) {
    const yaraPath = resolveRulesPath("yara", policy.security.scanning.yara.rulesPath)
    if (!yaraPath) {
      warnings.push({
        field: "security.scanning.yara",
        description: "YARA rules not found locally. In air-gap mode, YARA scanning will be unavailable.",
        severity: "warning",
      })
    }
  }

  return warnings
}
