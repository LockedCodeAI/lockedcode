import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { Bus } from "../bus"
import * as SecurityEvent from "./event"
import type {
  SecurityConfig,
  ScanResult,
  ConfinementResult,
  DLPResult,
  PolicyDecision,
  TrustScore,
  SecurityEvent as SecurityEventData,
} from "./types"
import { Service as ConfinementService } from "./confinement"
import { Service as ScanningService } from "./scanning"
import { Service as DLPService } from "./dlp"
import { Service as InjectionService } from "./injection"
import { Service as SecretService } from "./secrets"
import { Service as AuditService } from "./audit"
import { Service as PolicyService } from "./policy"
import { Service as TrustService } from "./trust"
import { Service as CascadeService } from "./cascade"
import { Service as SecurityConfigService, defaultLayer as configLayer } from "./config"
import { defaultLayer as confinementLayer } from "./confinement"
import { defaultLayer as scanningLayer } from "./scanning"
import { defaultLayer as dlpLayer } from "./dlp"
import { defaultLayer as injectionLayer } from "./injection"
import { defaultLayer as secretsLayer } from "./secrets"
import { defaultLayer as auditLayer } from "./audit"
import { defaultLayer as policyLayer } from "./policy"
import { defaultLayer as trustLayer } from "./trust"
import { defaultLayer as cascadeLayer } from "./cascade"

const log = Log.create({ service: "security" })

export interface Interface {
  readonly getStrictness: () => SecurityConfig["strictness"]
  readonly scanContent: (content: string, metadata: Record<string, unknown>) => Effect.Effect<ScanResult>
  readonly scanCommand: (command: string, metadata: Record<string, unknown>) => Effect.Effect<ScanResult>
  readonly checkConfinement: (path: string, operation: "read" | "write" | "execute") => Effect.Effect<ConfinementResult>
  readonly scanOutbound: (content: string, metadata: Record<string, unknown>) => Effect.Effect<DLPResult>
  readonly evaluatePolicy: (action: string, context: Record<string, unknown>) => Effect.Effect<PolicyDecision>
  readonly scoreTrust: (action: string, context: Record<string, unknown>) => Effect.Effect<TrustScore>
  readonly recordAuditEvent: (event: SecurityEventData) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Security") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* SecurityConfigService
    const confinement = yield* ConfinementService
    const scanning = yield* ScanningService
    const dlp = yield* DLPService
    const injection = yield* InjectionService
    const secrets = yield* SecretService
    const audit = yield* AuditService
    const policy = yield* PolicyService
    const trust = yield* TrustService
    const cascade = yield* CascadeService
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
      const result = yield* scanning.scan(content, metadata)
      yield* bus.publish(SecurityEvent.ScanCompleted, {
        sessionID: String(metadata.sessionID ?? ""),
        findings: [],
        highestSeverity: "info",
        duration: 0,
      })
      return result
    })

    const scanCommand = Effect.fn("Security.scanCommand")(function* (
      command: string,
      metadata: Record<string, unknown>,
    ) {
      log.debug("scanCommand called", { commandLength: command.length })
      return yield* scanning.scan(command, metadata)
    })

    const checkConfinement = Effect.fn("Security.checkConfinement")(function* (
      path: string,
      operation: "read" | "write" | "execute",
    ) {
      log.debug("checkConfinement called", { path, operation })
      return yield* confinement.checkPath(path, operation)
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
      yield* audit.record(event)
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
)

/**
 * Default layer providing the Security service with all subsystem stubs.
 */
export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(confinementLayer),
    Layer.provide(scanningLayer),
    Layer.provide(dlpLayer),
    Layer.provide(injectionLayer),
    Layer.provide(secretsLayer),
    Layer.provide(auditLayer),
    Layer.provide(policyLayer),
    Layer.provide(trustLayer),
    Layer.provide(cascadeLayer),
    Layer.provide(configLayer),
    Layer.provide(Bus.layer),
  ),
)

export * as Security from "."
