import { describe, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { testEffect } from "../../../test/lib/effect"
import { Security } from "../index"
import { Service as ScanningService, defaultLayer as scanningLayer } from "../scanning"
import { Service as DLPService, defaultLayer as dlpLayer } from "../dlp"
import { Service as AuditService, defaultLayer as auditLayer } from "../audit"
import { Service as PolicyService, defaultLayer as policyLayer } from "../policy"
import { Service as TrustService, defaultLayer as trustLayer } from "../trust"
import { Service as SecurityConfigService, defaultLayer as configLayer } from "../config"
import { defaultSecurityConfig } from "../types"

// Test layers for subsystem-only tests (no Bus dependency)
// Test layers for subsystem-only tests (no Bus dependency)
const subsystemLayer = Layer.mergeAll(
  Security.defaultLayer,
  configLayer,
  dlpLayer,
  auditLayer,
  policyLayer,
  trustLayer,
)

const subsystem = testEffect(subsystemLayer)

describe("SecurityService", () => {
  // SecurityService needs Bus which needs InstanceState — use instance test
  // For skeleton tests, verify the service interface works with a minimal layer
  const it = testEffect(Layer.mergeAll(Security.defaultLayer))
  const minLayer = Layer.mergeAll(Security.defaultLayer, configLayer, dlpLayer, auditLayer, policyLayer, trustLayer)
  const itMin = testEffect(minLayer)

  itMin.effect("can be instantiated via its Effect Layer", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      expect(security).toBeDefined()
    }),
  )

  itMin.effect("getStrictness returns default value", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      expect(security.getStrictness()).toBe(defaultSecurityConfig.strictness)
    }),
  )

  itMin.effect("evaluatePolicy returns allow", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      const result = yield* security.evaluatePolicy("read", {})
      expect(result.action).toBe("allow")
    }),
  )

  itMin.effect("scoreTrust returns low risk", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      const result = yield* security.scoreTrust("read", {})
      expect(result.riskLevel).toBe("low")
      expect(result.score).toBeLessThanOrEqual(100)
    }),
  )

  itMin.effect("checkConfinement denies paths outside project root", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      const result = yield* security.checkConfinement("/nonexistent-outside-path", "read")
      expect(result.allowed).toBe(false)
      expect(result.escapable).toBe(true)
    }),
  )

  itMin.effect("recordAuditEvent does not throw", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      yield* security.recordAuditEvent({
        eventType: "security.action_approved",
        sessionId: "test-session",
        timestamp: Date.now(),
        toolName: "test-tool",
        modelId: "test-model",
        actionTaken: "allowed",
        details: {},
      })
    }),
  )

  itMin.effect("scanOutbound returns clean result", () =>
    Effect.gen(function* () {
      const security = yield* Security.Service
      const result = yield* security.scanOutbound("sensitive content", { filePath: "test.txt" })
      expect(result.detections).toEqual([])
    }),
  )
})

describe("Subsystem Stubs", () => {
  subsystem.effect("ScanningService can be instantiated", () =>
    Effect.gen(function* () {
      const svc = yield* ScanningService
      const result = yield* svc.scan("test content", { operation: "write" })
      expect(result.scanner).toBeDefined()
      expect(result.severity).toBe("info")
    }),
  )

  subsystem.effect("DLPService can be instantiated", () =>
    Effect.gen(function* () {
      const svc = yield* DLPService
      const result = yield* svc.scanOutbound("content", "file.txt")
      expect(result.detections).toEqual([])
    }),
  )

  subsystem.effect("AuditService can be instantiated", () =>
    Effect.gen(function* () {
      const svc = yield* AuditService
      yield* svc.record({
        eventType: "security.scan_completed",
        sessionId: "s",
        timestamp: 0,
        toolName: "t",
        modelId: "m",
        actionTaken: "allowed",
        details: {},
      })
    }),
  )

  subsystem.effect("PolicyService can be instantiated", () =>
    Effect.gen(function* () {
      const svc = yield* PolicyService
      const result = yield* svc.evaluate({ action: "write", context: {} })
      expect(result.action).toBe("allow")
    }),
  )

  subsystem.effect("TrustService can be instantiated", () =>
    Effect.gen(function* () {
      const svc = yield* TrustService
      const result = yield* svc.score({ action: "shell", context: {} })
      expect(result.riskLevel).toBe("low")
    }),
  )
})

describe("SecurityConfig", () => {
  subsystem.effect("config has default values", () =>
    Effect.gen(function* () {
      const svc = yield* SecurityConfigService
      const config = svc.get()
      expect(config.strictness).toBe("standard")
      expect(config.enabled).toBe(true)
      expect(config.confinement.enabled).toBe(true)
      expect(config.scanning.enabled).toBe(true)
      expect(config.dlp.enabled).toBe(true)
      expect(config.audit.enabled).toBe(true)
    }),
  )
})

describe("Interception Hooks", () => {
  // Verify that Effect.serviceOption resolves Security when layer is present
  subsystem.effect("Security is resolvable via serviceOption when layer is present", () =>
    Effect.gen(function* () {
      const opt = yield* Effect.serviceOption(Security.Service)
      expect(Option.isSome(opt)).toBe(true)
      if (Option.isSome(opt)) {
        const security = opt.value
        expect(security.getStrictness()).toBe("standard")
      }
    }),
  )
})
