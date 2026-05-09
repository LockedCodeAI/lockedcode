import { Schema } from "effect"
import { BusEvent } from "../bus/bus-event"

export const ScanStarted = BusEvent.define(
  "security.scan_started",
  Schema.Struct({
    sessionID: Schema.String,
    toolCallID: Schema.String,
    scanners: Schema.Array(Schema.String),
  }),
)

export const ScanCompleted = BusEvent.define(
  "security.scan_completed",
  Schema.Struct({
    sessionID: Schema.String,
    findings: Schema.Array(
      Schema.Struct({
        ruleID: Schema.String,
        severity: Schema.String,
        matchedContent: Schema.String,
      }),
    ),
    highestSeverity: Schema.String,
    duration: Schema.Number,
  }),
)

export const ActionBlocked = BusEvent.define(
  "security.action_blocked",
  Schema.Struct({
    sessionID: Schema.String,
    toolName: Schema.String,
    reason: Schema.String,
    ruleID: Schema.String,
    contentHash: Schema.String,
  }),
)

export const ActionApproved = BusEvent.define(
  "security.action_approved",
  Schema.Struct({
    sessionID: Schema.String,
    toolName: Schema.String,
    approver: Schema.String,
    justification: Schema.String,
  }),
)

export const PolicyViolation = BusEvent.define(
  "security.policy_violation",
  Schema.Struct({
    sessionID: Schema.String,
    policyRuleID: Schema.String,
    severity: Schema.String,
    explanation: Schema.String,
  }),
)

export const ConfinementEscapeRequested = BusEvent.define(
  "security.confinement_escape_requested",
  Schema.Struct({
    sessionID: Schema.String,
    path: Schema.String,
    operation: Schema.String,
    modelID: Schema.String,
    contentHash: Schema.String,
  }),
)

export const ConfinementEscapeApproved = BusEvent.define(
  "security.confinement_escape_approved",
  Schema.Struct({
    sessionID: Schema.String,
    path: Schema.String,
    operation: Schema.String,
    approver: Schema.String,
  }),
)

export const ConfinementEscapeDenied = BusEvent.define(
  "security.confinement_escape_denied",
  Schema.Struct({
    sessionID: Schema.String,
    path: Schema.String,
    operation: Schema.String,
    reason: Schema.String,
  }),
)

export const DLPSecretDetected = BusEvent.define(
  "security.dlp_secret_detected",
  Schema.Struct({
    sessionID: Schema.String,
    filePath: Schema.String,
    secretType: Schema.String,
    action: Schema.String,
  }),
)

export const DLPPIIDetected = BusEvent.define(
  "security.dlp_pii_detected",
  Schema.Struct({
    sessionID: Schema.String,
    filePath: Schema.String,
    piiType: Schema.String,
    action: Schema.String,
  }),
)

export const InjectionDetected = BusEvent.define(
  "security.injection_detected",
  Schema.Struct({
    sessionID: Schema.String,
    filePath: Schema.String,
    patternID: Schema.String,
    severity: Schema.String,
  }),
)

export const TrustThresholdCrossed = BusEvent.define(
  "security.trust_threshold_crossed",
  Schema.Struct({
    sessionID: Schema.String,
    score: Schema.Number,
    threshold: Schema.Number,
    action: Schema.String,
  }),
)
