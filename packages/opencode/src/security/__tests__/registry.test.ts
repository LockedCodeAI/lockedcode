import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../../../test/lib/effect"
import { Service as RegistryService, defaultLayer as registryLayer } from "../registry"

const it = testEffect(registryLayer)

describe("ModelRegistry", () => {
  it.effect("register a model", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.registerModel("test-model-1", "approved", "test")
      const m = yield* svc.getModel("test-model-1")
      expect(m).not.toBeNull()
      expect(m!.status).toBe("approved")
    }),
  )

  it.effect("approve a model", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.approveModel("model-to-approve", "Great model")
      const m = yield* svc.getModel("model-to-approve")
      expect(m).not.toBeNull()
      expect(m!.status).toBe("approved")
      expect(m!.addedBy).toBe("cli")
      expect(m!.reason).toBe("Great model")
    }),
  )

  it.effect("block a model", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.blockModel("bad-model", "Security concern")
      const m = yield* svc.getModel("bad-model")
      expect(m).not.toBeNull()
      expect(m!.status).toBe("blocked")
    }),
  )

  it.effect("record usage creates entry for unknown model", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.recordModelUsage("new-model")
      const m = yield* svc.getModel("new-model")
      expect(m).not.toBeNull()
      expect(m!.status).toBe("unknown")
      expect(m!.addedBy).toBe("auto")
      expect(m!.sessionCount).toBe(1)
    }),
  )

  it.effect("record usage increments session count", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.approveModel("usage-model")
      yield* svc.recordModelUsage("usage-model")
      yield* svc.recordModelUsage("usage-model")
      const m = yield* svc.getModel("usage-model")
      expect(m!.sessionCount).toBe(3) // 1 from approve insert default, +2 from usage
    }),
  )

  it.effect("isModelAllowed — approved is allowed", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.approveModel("good-model")
      const allowed = yield* svc.isModelAllowed("good-model")
      expect(allowed).toBe(true)
    }),
  )

  it.effect("isModelAllowed — blocked is not allowed", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.blockModel("evil-model")
      const allowed = yield* svc.isModelAllowed("evil-model")
      expect(allowed).toBe(false)
    }),
  )

  it.effect("isModelAllowed — unknown model is allowed (not explicitly blocked)", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      const allowed = yield* svc.isModelAllowed("never-registered-model")
      expect(allowed).toBe(true)
    }),
  )

  it.effect("getAllModels lists all models", () =>
    Effect.gen(function* () {
      const svc = yield* RegistryService
      yield* svc.approveModel("list-model-a")
      yield* svc.approveModel("list-model-b")
      const all = yield* svc.getAllModels()
      expect(all.length).toBeGreaterThanOrEqual(2)
    }),
  )
})
