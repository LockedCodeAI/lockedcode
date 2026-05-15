import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import * as SecurityEvent from "./event"
import { analyzeCommand } from "./scanning/command-analyzer"
import type {
  SecurityConfig,
  ScanResult,
  ConfinementResult,
  DLPResult,
  PolicyDecision,
  TrustScore,
  SecurityEvent as SecurityEventData,
  ScanMetadata,
} from "./types"
import { Service as ConfinementService, defaultLayer as confinementLayer } from "./confinement"
import { Service as ScanningService, defaultLayer as scanningLayer } from "./scanning"
import { Service as DLPService, defaultLayer as dlpLayer } from "./dlp"
import { Service as AuditService, defaultLayer as auditLayer } from "./audit"
import { Service as PolicyService, defaultLayer as policyLayer } from "./policy"
import { Service as TrustService, defaultLayer as trustLayer } from "./trust"
import { Service as SecurityConfigService, defaultLayer as configLayer } from "./config"
import { Bus } from "../bus"

const log = Log.create({ service: "security" })

export interface Interface {
  readonly getStrictness: () => SecurityConfig["strictness"]
  readonly scanContent: (content: string, metadata: Record<string, unknown>) => Effect.Effect<ScanResult>
  readonly scanCommand: (command: string, metadata: Record<string, unknown>) => Effect.Effect<ScanResult>
  readonly checkConfinement: (path: string, operation: "read" | "write" | "execute", sessionId?: string) => Effect.Effect<ConfinementResult>
  readonly scanOutbound: (content: string, metadata: Record<string, unknown>) => Effect.Effect<DLPResult>
  readonly evaluatePolicy: (action: string, context: Record<string, unknown>) => Effect.Effect<PolicyDecision>
  readonly scoreTrust: (action: string, context: Record<string, unknown>) => Effect.Effect<TrustScore>
  readonly recordAuditEvent: (event: SecurityEventData) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Security") {}

/**
 * Layer providing all subsystem stubs without Bus dependency.
 * This is the default — pass-through with no required infrastructure.
 */
const subsystemLayer = Layer.mergeAll(
  configLayer,
  confinementLayer,
  scanningLayer,
  dlpLayer,
  auditLayer,
  policyLayer,
  trustLayer,
)

/**
 * Layer providing SecurityService with all subsystem stubs.
 * Bus events are skipped in this layer (no Bus dependency required).
 */
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* SecurityConfigService
    const confinement = yield* ConfinementService
    const scanning = yield* ScanningService
    const dlp = yield* DLPService
    const audit = yield* AuditService
    const policy = yield* PolicyService
    const trust = yield* TrustService

    const getStrictness = () => config.get().strictness

    const scanContent = Effect.fn("Security.scanContent")(function* (
      content: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanContent called", { contentLength: content.length })
      const scanMeta: ScanMetadata = {
        filename: metadata.filename as string | undefined,
        extension: metadata.extension as string | undefined,
        toolName: metadata.toolName as string ?? metadata.toolCallID as string,
        operation: "write",
      }
      const result = yield* scanning.scan(content, scanMeta)
      const secEventId = (metadata.securityEventId as string) ?? null
      for (const finding of result.findings) {
        yield* audit.recordScanResult({
          securityEventId: secEventId,
          scannerName: finding.scanner ?? result.scanner,
          ruleId: finding.ruleId,
          severity: finding.severity,
          matchedContent: finding.matchedContent,
          lineNumber: finding.lineNumber,
          remediation: finding.remediation,
        })
      }
      return result
    })

    // scanCommand in layer — uses analyzeCommand + scanning
    const scanCommand = Effect.fn("Security.scanCommand")(function* (
      command: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanCommand called", { commandLength: command.length })
      const analysis = analyzeCommand(command)
      const scanMeta: ScanMetadata = {
        toolName: metadata.toolName as string ?? metadata.toolCallID as string,
        operation: "command",
      }
      const fileScan = yield* scanning.scan(command, scanMeta)
      const mergedFindings = [
        ...analysis.findings,
        ...fileScan.findings.filter(
          (f) => !analysis.findings.some((af) => af.ruleId === f.ruleId),
        ),
      ]
      const secEventId = (metadata.securityEventId as string) ?? null
      for (const finding of mergedFindings) {
        yield* audit.recordScanResult({
          securityEventId: secEventId,
          scannerName: finding.scanner ?? "command-analyzer",
          ruleId: finding.ruleId,
          severity: finding.severity,
          matchedContent: finding.matchedContent,
          lineNumber: finding.lineNumber,
          remediation: finding.remediation,
        })
      }
      const severityOrder: Array<"info" | "warning" | "high" | "critical"> = ["info", "warning", "high", "critical"]
      const highestSeverity = severityOrder.reduce((highest, sev) =>
        mergedFindings.some((f) => f.severity === sev) ? sev : highest, "info" as const)
      return {
        severity: highestSeverity,
        action: highestSeverity === "critical" ? "warn" as const : "pass" as const,
        findings: mergedFindings,
        ruleId: analysis.findings[0]?.ruleId ?? "clean",
        matchedContent: analysis.findings[0]?.matchedContent ?? "",
        remediation: analysis.findings[0]?.remediation ?? "Command analysis passed.",
        scanner: "command-analyzer",
      } as ScanResult
    })

    const checkConfinement = Effect.fn("Security.checkConfinement")(function* (
      path: string,
      operation: "read" | "write" | "execute",
      sessionId?: string,
    ) {
      log.debug("checkConfinement called", { path, operation, sessionId })
      return yield* confinement.checkPath(path, operation, sessionId)
    })

    const scanOutbound = Effect.fn("Security.scanOutbound")(function* (
      content: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanOutbound called", { contentLength: content.length })
      return yield* dlp.scanOutbound(content, metadata.filePath as string ?? "")
    })

    const evaluatePolicy = Effect.fn("Security.evaluatePolicy")(function* (
      action: string,
      context: Record<string, unknown>,
    ) {
      log.debug("evaluatePolicy called", { action })
      return yield* policy.evaluate({ action, context })
    })

    const scoreTrust = Effect.fn("Security.scoreTrust")(function* (
      action: string,
      context: Record<string, unknown>,
    ) {
      log.debug("scoreTrust called", { action })
      return yield* trust.score({ action, context })
    })

    const recordAuditEvent = Effect.fn("Security.recordAuditEvent")(function* (event: SecurityEventData) {
      log.debug("recordAuditEvent called", { eventType: event.eventType })
      return yield* audit.record(event)
    })

    return Service.of({
      getStrictness,
      scanContent,
      scanCommand,
      checkConfinement,
      scanOutbound,
      evaluatePolicy,
      scoreTrust,
      recordAuditEvent,
    })
  }),
).pipe(Layer.provideMerge(subsystemLayer))

/**
 * SecurityService with Bus-based event publishing.
 * Only needed when bus events are required (production).
 */
export const busLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* SecurityConfigService
    const confinement = yield* ConfinementService
    const scanning = yield* ScanningService
    const dlp = yield* DLPService
    const audit = yield* AuditService
    const policy = yield* PolicyService
    const trust = yield* TrustService
    const bus = yield* Bus.Service

    const getStrictness = () => config.get().strictness

    const scanContent = Effect.fn("Security.scanContent")(function* (
      content: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanContent called", { contentLength: content.length })
      yield* bus.publish(SecurityEvent.ScanStarted, {
        sessionID: String(metadata.sessionID ?? ""),
        toolCallID: String(metadata.toolCallID ?? ""),
        scanners: ["scanning", "secrets", "injection"],
      })
      const scanMeta: ScanMetadata = {
        filename: metadata.filename as string | undefined,
        extension: metadata.extension as string | undefined,
        toolName: metadata.toolName as string ?? metadata.toolCallID as string,
        operation: "write",
      }
      const result = yield* scanning.scan(content, scanMeta)
      const secEventId = (metadata.securityEventId as string) ?? null
      for (const finding of result.findings) {
        yield* audit.recordScanResult({
          securityEventId: secEventId,
          scannerName: finding.scanner ?? result.scanner,
          ruleId: finding.ruleId,
          severity: finding.severity,
          matchedContent: finding.matchedContent,
          lineNumber: finding.lineNumber,
          remediation: finding.remediation,
        })
      }
      yield* bus.publish(SecurityEvent.ScanCompleted, {
        sessionID: String(metadata.sessionID ?? ""),
        findings: [],
        highestSeverity: "info",
        duration: 0,
      })
      return result

    // scanCommand in busLayer — uses analyzeCommand + scanning + bus events
    })

    // scanCommand in busLayer — uses analyzeCommand + scanning + bus events
    const scanCommand = Effect.fn("Security.scanCommand")(function* (
      command: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanCommand called", { commandLength: command.length })
      const analysis = analyzeCommand(command)
      const scanMeta: ScanMetadata = {
        toolName: metadata.toolName as string ?? metadata.toolCallID as string,
        operation: "command",
      }
      const fileScan = yield* scanning.scan(command, scanMeta)
      const mergedFindings = [
        ...analysis.findings,
        ...fileScan.findings.filter(
          (f) => !analysis.findings.some((af) => af.ruleId === f.ruleId),
        ),
      ]
      const secEventId = (metadata.securityEventId as string) ?? null
      for (const finding of mergedFindings) {
        yield* audit.recordScanResult({
          securityEventId: secEventId,
          scannerName: finding.scanner ?? "command-analyzer",
          ruleId: finding.ruleId,
          severity: finding.severity,
          matchedContent: finding.matchedContent,
          lineNumber: finding.lineNumber,
          remediation: finding.remediation,
        })
      }
      const severityOrder: Array<"info" | "warning" | "high" | "critical"> = ["info", "warning", "high", "critical"]
      const highestSeverity = severityOrder.reduce((highest, sev) =>
        mergedFindings.some((f) => f.severity === sev) ? sev : highest, "info" as const)
      return {
        severity: highestSeverity,
        action: highestSeverity === "critical" ? "warn" as const : "pass" as const,
        findings: mergedFindings,
        ruleId: analysis.findings[0]?.ruleId ?? "clean",
        matchedContent: analysis.findings[0]?.matchedContent ?? "",
        remediation: analysis.findings[0]?.remediation ?? "Command analysis passed.",
        scanner: "command-analyzer",
      } as ScanResult
    })

    const checkConfinement = Effect.fn("Security.checkConfinement")(function* (
      path: string,
      operation: "read" | "write" | "execute",
      sessionId?: string,
    ) {
      log.debug("checkConfinement called", { path, operation, sessionId })
      return yield* confinement.checkPath(path, operation, sessionId)
    })

    // scanOutbound in busLayer
    const scanOutbound = Effect.fn("Security.scanOutbound")(function* (
      content: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanOutbound called", { contentLength: content.length })
      const result = yield* dlp.scanOutbound(content, metadata.filePath as string ?? "")
      if (result.status === "secret_detected") {
        log.warn("DLP: secrets detected in outbound context", { count: result.detections.length })
      } else if (result.status === "pii_detected") {
        log.info("DLP: PII detected in outbound context", { count: result.detections.length })
      }
      return result
    })

    const evaluatePolicy = Effect.fn("Security.evaluatePolicy")(function* (
      action: string,
      context: Record<string, unknown>,
    ) {
      log.debug("evaluatePolicy called", { action })
      return yield* policy.evaluate({ action, context })
    })

    const scoreTrust = Effect.fn("Security.scoreTrust")(function* (
      action: string,
      context: Record<string, unknown>,
    ) {
      log.debug("scoreTrust called", { action })
      return yield* trust.score({ action, context })
    })

    const recordAuditEvent = Effect.fn("Security.recordAuditEvent")(function* (event: SecurityEventData) {
      log.debug("recordAuditEvent called", { eventType: event.eventType })
      return yield* audit.record(event)
    })

    return Service.of({
      getStrictness,
      scanContent,
      scanCommand,
      checkConfinement,
      scanOutbound,
      evaluatePolicy,
      scoreTrust,
      recordAuditEvent,
    })
  }),
).pipe(Layer.provideMerge(subsystemLayer), Layer.provide(Bus.layer))

export const defaultLayer = layer

export * as Security from "."
