import { Context, Effect, Layer } from "effect"
import type { ConfinementResult } from "../types"

export interface Interface {
  readonly checkPath: (path: string, operation: "read" | "write" | "execute") => Effect.Effect<ConfinementResult>
  readonly requestEscape: (path: string, operation: string, reason: string) => Effect.Effect<{ approved: boolean }>
  readonly detectBackend: () => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Confinement") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const checkPath = Effect.fn("Confinement.checkPath")(function* (
      path: string,
      operation: "read" | "write" | "execute",
    ) {
      return { allowed: true, path, operation, reason: "confinement not yet implemented (pass-through)" } as ConfinementResult
    })

    const requestEscape = Effect.fn("Confinement.requestEscape")(function* (
      path: string,
      operation: string,
      reason: string,
    ) {
      return { approved: true }
    })

    const detectBackend = Effect.fn("Confinement.detectBackend")(function* () {
      return "none (pass-through)"
    })

    return Service.of({ checkPath, requestEscape, detectBackend })
  }),
)

export const defaultLayer = layer
