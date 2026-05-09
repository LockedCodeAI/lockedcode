import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { SecurityEvent } from "../types"

const log = Log.create({ service: "audit" })

export interface Interface {
  readonly record: (event: SecurityEvent) => Effect.Effect<void>
  readonly query: (filters: Record<string, unknown>) => Effect.Effect<SecurityEvent[]>
  readonly prune: () => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Audit") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const record = Effect.fn("Audit.record")(function* (event: SecurityEvent) {
      log.debug("audit event (no-op stub)", { eventType: event.eventType, sessionId: event.sessionId })
    })

    const query = Effect.fn("Audit.query")(function* (filters: Record<string, unknown>) {
      return [] as SecurityEvent[]
    })

    const prune = Effect.fn("Audit.prune")(function* () {
      return 0
    })

    return Service.of({ record, query, prune })
  }),
)

export const defaultLayer = layer
