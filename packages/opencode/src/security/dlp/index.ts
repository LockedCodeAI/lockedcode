import { Context, Effect, Layer } from "effect"
import type { DLPResult, FileSensitivity } from "../types"

export interface Interface {
  readonly scanOutbound: (content: string, filePath: string) => Effect.Effect<DLPResult>
  readonly classifyFile: (filePath: string) => Effect.Effect<FileSensitivity>
  readonly redact: (content: string, findings: DLPResult["detections"]) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/DLP") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scanOutbound = Effect.fn("DLP.scanOutbound")(function* (content: string, filePath: string) {
      return { detections: [] } as DLPResult
    })

    const classifyFile = Effect.fn("DLP.classifyFile")(function* (filePath: string) {
      return "public" as FileSensitivity
    })

    const redact = Effect.fn("DLP.redact")(function* (content: string, findings: DLPResult["detections"]) {
      return content
    })

    return Service.of({ scanOutbound, classifyFile, redact })
  }),
)

export const defaultLayer = layer
