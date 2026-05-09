import { Context, Effect, Layer } from "effect"
import type { PolicyDecision } from "../types"

export interface Interface {
  readonly evaluate: (input: { action: string; context: Record<string, unknown> }) => Effect.Effect<PolicyDecision>
  readonly load: (paths: string[]) => Effect.Effect<PolicyDocument>
  readonly reload: () => Effect.Effect<void>
}

export interface PolicyDocument {
  readonly strictness: string
  readonly rules: Record<string, unknown>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Policy") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const evaluate = Effect.fn("Policy.evaluate")(function* (input: {
      action: string
      context: Record<string, unknown>
    }) {
      return {
        action: "allow" as const,
        matchedRule: "pass-through",
        explanation: "policy engine not yet implemented (pass-through)",
      } as PolicyDecision
    })

    const load = Effect.fn("Policy.load")(function* (paths: string[]) {
      return { strictness: "standard", rules: {} } as PolicyDocument
    })

    const reload = Effect.fn("Policy.reload")(function* () {})

    return Service.of({ evaluate, load, reload })
  }),
)

export const defaultLayer = layer
