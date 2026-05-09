import { Context, Effect, Layer } from "effect"
import type { ScanResult, Severity } from "../types"

export interface Interface {
  readonly scan: (content: string, metadata: Record<string, unknown>) => Effect.Effect<ScanResult>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Scanning") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scan = Effect.fn("Scanning.scan")(function* (content: string, metadata: Record<string, unknown>) {
      return {
        severity: "info" as Severity,
        ruleId: "pass-through",
        matchedContent: "",
        remediation: "scanning not yet implemented (pass-through)",
        scanner: "stub",
      } as ScanResult
    })

    return Service.of({ scan })
  }),
)

export const defaultLayer = layer
