import { Context, Effect, Layer } from "effect"

export interface Interface {
  readonly scan: (content: string, filePath: string) => Effect.Effect<{ detected: boolean; patterns: string[] }>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Injection") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scan = Effect.fn("Injection.scan")(function* (content: string, filePath: string) {
      return { detected: false, patterns: [] }
    })

    return Service.of({ scan })
  }),
)

export const defaultLayer = layer
