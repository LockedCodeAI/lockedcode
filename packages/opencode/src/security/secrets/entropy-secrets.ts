import type { ScanFinding, Severity } from "../types"

/**
 * Shannon entropy calculation for entropy-based secret detection.
 * Reused from the entropy scanner.
 */
function shannonEntropy(s: string): number {
  const len = s.length
  if (len === 0) return 0
  const freq = new Map<number, number>()
  for (let i = 0; i < len; i++) {
    const code = s.charCodeAt(i)
    freq.set(code, (freq.get(code) ?? 0) + 1)
  }
  let entropy = 0
  for (const count of freq.values()) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

/** Variable name patterns that suggest a credential context. */
const CREDENTIAL_VAR_PATTERNS = [
  /key$/i, /secret/i, /token/i, /password/i, /credential/i,
  /auth/i, /api_key/i, /apikey/i, /private_key/i, /access_key/i,
]

/** Variable names that do NOT suggest credentials despite matching patterns. */
const NON_CREDENTIAL_VARS = new Set([
  "sessionToken", "session_token", "csrfToken", "csrf_token",
  "nonce", "keyName", "key_id", "replyToken",
])

/**
 * Scan content for potential secrets using entropy analysis.
 * Detects high-entropy strings assigned to credential-suggesting variable names.
 *
 * @param content - The content to scan
 * @param lines - Line-by-line split of the content
 * @returns Array of entropy-based findings
 */
export function detectEntropySecrets(content: string, lines: string[]): ScanFinding[] {
  const findings: ScanFinding[] = []
  const ENTROPY_THRESHOLD = 4.0
  const MIN_LENGTH = 16

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]

    // Find variable assignments
    const assignMatch = line.match(/(?:const|let|var|export\s+(?:const|let|var))?\s*([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*['"]([^'"]{16,})['"]/)
    if (!assignMatch) continue

    const varName = assignMatch[1]
    const value = assignMatch[2]

    // Skip known non-credential variables
    if (NON_CREDENTIAL_VARS.has(varName)) continue

    // Check if variable name suggests credential
    const isCredentialVar = CREDENTIAL_VAR_PATTERNS.some((p) => p.test(varName))
    if (!isCredentialVar) continue

    // Calculate entropy
    const entropy = shannonEntropy(value)
    if (entropy > ENTROPY_THRESHOLD) {
      findings.push({
        severity: "warning" as Severity,
        ruleId: "entropy-secret",
        scanner: "secrets",
        matchedContent: `${varName} = ${value.slice(0, 20)}...`,
        lineNumber: lineIdx + 1,
        confidence: "medium",
        remediation: `High-entropy string assigned to '${varName}'. If this is a credential, move it to an environment variable or secrets manager.`,
      })
    }
  }

  return findings
}
