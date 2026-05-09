import { Context, Effect, Layer } from "effect"

export interface Interface {
  readonly scan: (content: string, metadata: Record<string, unknown>) => Effect.Effect<{ detected: boolean; findings: string[] }>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Secrets") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scan = Effect.fn("Secrets.scan")(function* (content: string, metadata: Record<string, unknown>) {
      return { detected: false, findings: [] }
    })

    return Service.of({ scan })
  }),
)

export const defaultLayer = layer
