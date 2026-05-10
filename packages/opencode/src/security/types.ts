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
 * A single finding from a scanner.
 */
export interface ScanFinding {
  readonly severity: Severity
  readonly ruleId: string
  readonly scanner: string
  readonly matchedContent: string
  readonly lineNumber?: number
  readonly remediation?: string
  readonly confidence: "low" | "medium" | "high"
}

/**
 * Improved ScanResult with array of findings.
 */
export interface ScanResult {
  readonly severity: Severity
  readonly action: "pass" | "warn" | "block"
  readonly findings: ScanFinding[]
  readonly ruleId: string
  readonly matchedContent: string
  readonly remediation: string
  readonly scanner: string
}

/**
 * Metadata passed to scanners alongside content.
 */
export interface ScanMetadata {
  readonly filename?: string
  readonly extension?: string
  readonly toolName?: string
  readonly operation: "write" | "edit" | "patch" | "command" | "context"
}

/**
 * Scanning-specific configuration.
 */
export interface ScanningConfig {
  readonly enabled: boolean
  readonly semgrep: {
    readonly enabled: boolean
    readonly rulesPath?: string
    readonly timeout: number
  }
  readonly yara: {
    readonly enabled: boolean
    readonly rulesPath?: string
    readonly timeout: number
  }
  readonly entropy: {
    readonly enabled: boolean
    readonly threshold: number
    readonly minStringLength: number
  }
  readonly scanOnWrite: boolean
  readonly scanOnEdit: boolean
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
  readonly status: "clean" | "secret_detected" | "pii_detected"
  readonly detections: DLPDetection[]
}

export interface DLPDetection {
  readonly type: "secret" | "pii" | "sensitive_file"
  readonly patternId: string
  readonly patternName: string
  readonly severity: Severity
  readonly lineNumber: number
  readonly snippet: string
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
  readonly scanning: ScanningConfig
  readonly dlp: DLPConfig
  readonly audit: { readonly enabled: boolean }
}

/**
 * DLP-specific configuration.
 */
export interface DLPConfig {
  readonly enabled: boolean
  readonly scanSecrets: boolean
  readonly scanPii: boolean
  readonly piiCategories: {
    readonly email: boolean
    readonly phone: boolean
    readonly ssn: boolean
    readonly creditCard: boolean
    readonly ipAddress: boolean
  }
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
  scanning: {
    enabled: true,
    semgrep: { enabled: true, timeout: 30 },
    yara: { enabled: true, timeout: 15 },
    entropy: { enabled: true, threshold: 4.5, minStringLength: 20 },
    scanOnWrite: true,
    scanOnEdit: true,
  },
  dlp: {
    enabled: true,
    scanSecrets: true,
    scanPii: true,
    piiCategories: { email: true, phone: true, ssn: true, creditCard: true, ipAddress: true },
  },
  audit: { enabled: true },
}
