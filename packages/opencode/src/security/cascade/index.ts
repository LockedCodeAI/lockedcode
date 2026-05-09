import { Context, Effect, Layer } from "effect"

export interface Interface {
  readonly inherit: (childSessionID: string, parentSessionID: string) => Effect.Effect<void>
  readonly verifyEscalation: (child: string, parent: string) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Cascade") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const inherit = Effect.fn("Cascade.inherit")(function* (childSessionID: string, parentSessionID: string) {})

    const verifyEscalation = Effect.fn("Cascade.verifyEscalation")(function* (child: string, parent: string) {
      return true
    })

    return Service.of({ inherit, verifyEscalation })
  }),
)

export const defaultLayer = layer
