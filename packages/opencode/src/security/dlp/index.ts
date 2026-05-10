import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { DLPResult, DLPDetection, Severity, FileSensitivity } from "../types"
import { SECRET_PATTERNS } from "../secrets/patterns"
import { isPlaceholder } from "../secrets/context"
import { PII_PATTERNS, createSnippet } from "./pii-patterns"

const log = Log.create({ service: "dlp" })

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
      if (content.length === 0) {
        return { status: "clean", detections: [] } as DLPResult
      }

      const lines = content.split("\n")
      const detections: DLPDetection[] = []
      const seenKeys = new Set<string>()

      // Scan for secrets (reuse LC-011 patterns)
      for (const pattern of SECRET_PATTERNS) {
        const globalRe = new RegExp(pattern.regex.source, pattern.regex.flags.includes("g") ? pattern.regex.flags : pattern.regex.flags + "g")
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]
          const matches = line.matchAll(globalRe)
          for (const match of matches) {
            const value = match[0]
            if (!value) continue
            const key = `${pattern.id}:${lineIdx}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            if (isPlaceholder(value)) continue
            const snippet = createSnippet(line, match.index ?? 0, (match.index ?? 0) + value.length)
            detections.push({
              type: "secret",
              patternId: pattern.id,
              patternName: pattern.name,
              severity: pattern.severity,
              lineNumber: lineIdx + 1,
              snippet,
            })
          }
        }
      }

      // Scan for PII
      for (const pii of PII_PATTERNS) {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]
          const matches = line.matchAll(pii.regex)
          for (const match of matches) {
            const value = match[0]
            if (!value) continue
            // Run validation if present
            if (pii.validate && !pii.validate(value)) continue
            const key = `${pii.id}:${lineIdx}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            const snippet = createSnippet(line, match.index ?? 0, (match.index ?? 0) + value.length)
            detections.push({
              type: "pii",
              patternId: pii.id,
              patternName: pii.name,
              severity: pii.severity,
              lineNumber: lineIdx + 1,
              snippet,
            })
          }
        }
      }

      // Determine aggregate status
      let status: DLPResult["status"] = "clean"
      if (detections.some((d) => d.type === "secret")) status = "secret_detected"
      else if (detections.some((d) => d.type === "pii")) status = "pii_detected"

      if (detections.length > 0) {
        log.info("DLP scan complete", { status, count: detections.length })
      }

      return { status, detections } as DLPResult
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
