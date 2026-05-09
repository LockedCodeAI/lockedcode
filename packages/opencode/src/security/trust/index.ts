import { Context, Effect, Layer } from "effect"
import type { TrustScore } from "../types"

export interface Interface {
  readonly score: (input: { action: string; context: Record<string, unknown> }) => Effect.Effect<TrustScore>
  readonly trustDecay: (sessionID: string) => Effect.Effect<void>
  readonly getModelHistory: (modelID: string) => Effect.Effect<{ totalActions: number; flags: number }>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Trust") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const score = Effect.fn("Trust.score")(function* (input: {
      action: string
      context: Record<string, unknown>
    }) {
      return {
        score: 10,
        riskLevel: "low" as const,
        factors: ["trust scoring not yet implemented (pass-through)"],
      } as TrustScore
    })

    const trustDecay = Effect.fn("Trust.trustDecay")(function* (sessionID: string) {})

    const getModelHistory = Effect.fn("Trust.getModelHistory")(function* (modelID: string) {
      return { totalActions: 0, flags: 0 }
    })

    return Service.of({ score, trustDecay, getModelHistory })
  }),
)

export const defaultLayer = layer
