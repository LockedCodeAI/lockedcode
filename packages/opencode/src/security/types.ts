import os from "os"

/**
 * Security strictness level — drives the enforcement mode for all security checks.
 *
 * - "strict": Everything not explicitly allowed is denied. No prompts.
 * - "standard": Default rules enforced, escape hatch available for unlisted actions.
 * - "permissive": Scan and log everything, block only hard-blocked patterns, prompt on high-risk actions.
 */
export type SecurityStrictness = "strict" | "standard" | "permissive"

export type Severity = "info" | "warning" | "high" | "critical"

/**
 * Result of a content or command scan.
 */
export interface ScanResult {
  readonly severity: Severity
  readonly ruleId: string
  readonly matchedContent: string
  readonly remediation: string
  readonly scanner: string
}

/**
 * Result of a confinement check.
 */
export interface ConfinementResult {
  readonly allowed: boolean
  readonly path: string
  readonly operation: "read" | "write" | "execute"
  readonly reason: string
  readonly escapable: boolean
  readonly escapeId?: string
}

/**
 * A pending escape request that needs user approval.
 */
export interface EscapeRequest {
  readonly id: string
  readonly path: string
  readonly operation: string
  readonly reason: string
  readonly modelId: string
  readonly sessionId: string
  readonly contentHash: string
  readonly status: "pending" | "approved" | "denied"
}

/**
 * Confinement-specific configuration.
 */
export interface ConfinementConfig {
  readonly enabled: boolean
  readonly projectRoot?: string
  readonly preApprovedPaths: string[]
}

/**
 * Result of an outbound DLP scan.
 */
export interface DLPResult {
  readonly detections: DLPDetection[]
}

export interface DLPDetection {
  readonly type: "secret" | "pii" | "sensitive_file"
  readonly patternId: string
  readonly matchedContent: string
  readonly severity: Severity
}

/**
 * Decision returned by the policy engine.
 */
export interface PolicyDecision {
  readonly action: "allow" | "deny" | "prompt"
  readonly matchedRule: string
  readonly explanation: string
}

/**
 * Trust score for a single action.
 */
export interface TrustScore {
  readonly score: number
  readonly riskLevel: "low" | "medium" | "high" | "critical"
  readonly factors: string[]
}

/**
 * Security event types for bus dispatch.
 */
export type SecurityEventType =
  | "security.scan_started"
  | "security.scan_completed"
  | "security.action_blocked"
  | "security.action_approved"
  | "security.policy_violation"
  | "security.confinement_escape_requested"
  | "security.confinement_escape_approved"
  | "security.confinement_escape_denied"
  | "security.dlp_secret_detected"
  | "security.dlp_pii_detected"
  | "security.injection_detected"
  | "security.trust_threshold_crossed"

/**
 * Structured data for a security audit event.
 */
export interface SecurityEvent {
  readonly eventType: SecurityEventType
  readonly sessionId: string
  readonly timestamp: number
  readonly toolName: string
  readonly modelId: string
  readonly contentHash?: string
  readonly actionTaken: "allowed" | "blocked" | "overridden" | "redacted"
  readonly details: Record<string, unknown>
}

/**
 * Security configuration section.
 */
export interface SecurityConfig {
  readonly strictness: SecurityStrictness
  readonly enabled: boolean
  readonly confinement: ConfinementConfig
  readonly scanning: { readonly enabled: boolean }
  readonly dlp: { readonly enabled: boolean }
  readonly audit: { readonly enabled: boolean }
}

/**
 * File sensitivity classification for DLP policies.
 */
export type FileSensitivity = "public" | "internal" | "confidential" | "restricted"

/** Default pre-approved paths for confinement. */
export const defaultPreApprovedPaths: string[] = [
  os.tmpdir(),
  "~/.npm",
  "~/.bun",
  "~/.cache",
  "~/.local/share",
]

/** Default security configuration. */
export const defaultSecurityConfig: SecurityConfig = {
  strictness: "standard",
  enabled: true,
  confinement: {
    enabled: true,
    preApprovedPaths: defaultPreApprovedPaths,
  },
  scanning: { enabled: true },
  dlp: { enabled: true },
  audit: { enabled: true },
}
