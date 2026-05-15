import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { DLPResult, DLPDetection, Severity, FileSensitivity } from "../types"
import { Service as SecurityConfigService } from "../config"
import { SECRET_PATTERNS } from "../secrets/patterns"
import { isPlaceholder } from "../secrets/context"
import { PII_PATTERNS, createSnippet } from "./pii-patterns"
import { classifyFile } from "./sensitivity"
import { redact } from "./redaction"

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
    const configSvc = yield* SecurityConfigService
    const cfg = configSvc.get().dlp

    const runScan = Effect.fn("DLP.runScan")(function* (content: string) {
      if (content.length === 0) return { status: "clean", detections: [] } as DLPResult

      const lines = content.split("\n")
      const detections: DLPDetection[] = []
      const seenKeys = new Set<string>()

      // Scan for secrets
      for (const pattern of SECRET_PATTERNS) {
        const flags = pattern.regex.flags.includes("g") ? pattern.regex.flags : pattern.regex.flags + "g"
        const globalRe = new RegExp(pattern.regex.source, flags)
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]
          for (const match of line.matchAll(globalRe)) {
            const value = match[0]
            if (!value) continue
            const key = `${pattern.id}:${lineIdx}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            if (isPlaceholder(value)) continue
            detections.push({
              type: "secret",
              patternId: pattern.id,
              patternName: pattern.name,
              severity: pattern.severity,
              lineNumber: lineIdx + 1,
              snippet: createSnippet(line, match.index ?? 0, (match.index ?? 0) + value.length),
            })
          }
        }
      }

      // Scan for PII
      for (const pii of PII_PATTERNS) {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]
          for (const match of line.matchAll(pii.regex)) {
            const value = match[0]
            if (!value) continue
            if (pii.validate && !pii.validate(value)) continue
            const key = `${pii.id}:${lineIdx}`
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            detections.push({
              type: "pii",
              patternId: pii.id,
              patternName: pii.name,
              severity: pii.severity,
              lineNumber: lineIdx + 1,
              snippet: createSnippet(line, match.index ?? 0, (match.index ?? 0) + value.length),
            })
          }
        }
      }

      // Aggregate status
      let status: DLPResult["status"] = "clean"
      if (detections.some((d) => d.type === "secret")) status = "secret_detected"
      else if (detections.some((d) => d.type === "pii")) status = "pii_detected"

      return { status, detections } as DLPResult
    })

    const scanOutbound = Effect.fn("DLP.scanOutbound")(function* (content: string, filePath: string) {
      if (!cfg.enabled || content.length === 0) {
        return { status: "clean", detections: [] } as DLPResult
      }

      // Check file sensitivity
      const level = classifyFile(filePath)

      if (level === "restricted" && cfg.blockRestrictedFiles) {
        log.warn("DLP: blocked restricted file from outbound context", { filePath })
        return {
          status: "file_blocked" as const,
          detections: [{
            type: "sensitive_file",
            patternId: "file-blocked",
            patternName: "Restricted File",
            severity: "high" as Severity,
            lineNumber: 0,
            snippet: `[BLOCKED: ${filePath}]`,
          }],
        } as DLPResult
      }

      // Run scan
      const scanResult = yield* runScan(content)

      // Determine action based on sensitivity and findings
      if (cfg.redactionMode && scanResult.detections.length > 0) {
        const redactionResult = redact(content, scanResult.detections)
        log.info("DLP: redacted content", { count: redactionResult.redactions.length, filePath })
        return {
          status: "redacted" as const,
          detections: scanResult.detections,
          redactedContent: redactionResult.content,
        } as DLPResult
      }

      if (scanResult.detections.length > 0) {
        log.info("DLP scan complete", { status: scanResult.status, count: scanResult.detections.length, filePath })
      }

      return scanResult
    })

    const classifyFileFn = Effect.fn("DLP.classifyFile")(function* (filePath: string) {
      return classifyFile(filePath)
    })

    const redactFn = Effect.fn("DLP.redact")(function* (content: string, findings: DLPResult["detections"]) {
      const result = redact(content, findings)
      return result.content
    })

    return Service.of({ scanOutbound: scanOutbound, classifyFile: classifyFileFn, redact: redactFn })
  }),
)

import { defaultLayer as SecurityConfigLayer } from "../config"

export const defaultLayer = layer.pipe(Layer.provide(SecurityConfigLayer))
