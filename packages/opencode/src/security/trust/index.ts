import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { scoreAction, type ActionContext } from "./scoring"
import { determineAction, DEFAULT_THRESHOLDS, type TrustAction, type TrustThresholds } from "./thresholds"
import { applySessionDecay, getSessionSummary, recordHighRiskAction, resetSessionDecay } from "./session"
import { updateModelHistory, getModelHistory, type ModelTrustProfile } from "./model-history"
import type { TrustScore } from "../types"

const log = Log.create({ service: "trust" })

export interface Interface {
  readonly score: (input: { action: string; context: Record<string, unknown> }) => Effect.Effect<TrustScore>
  readonly getSessionTrust: (sessionId: string) => Effect.Effect<{ decay: number; highRiskCount: number }>
  readonly getModelTrust: (modelId: string) => Effect.Effect<ModelTrustProfile | null>
  readonly resetSessionTrust: (sessionId: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Trust") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const thresholds: TrustThresholds = DEFAULT_THRESHOLDS

    const score = Effect.fn("Trust.score")(function* (input: {
      action: string
      context: Record<string, unknown>
    }) {
      const sessionId = (input.context.sessionID as string) ?? "unknown"
      const modelId = (input.context.modelID as string) ?? "unknown"

      // Build action context from the raw input
      const ctx: ActionContext = {
        toolName: input.action,
        operation: (input.context.operation as any) ?? "write",
        paths: (input.context.paths as string[]) ?? [],
        hasOutsidePaths: !!(input.context.hasOutsidePaths as boolean),
        scanSeverity: input.context.scanSeverity as any,
        hasPipes: !!(input.context.hasPipes as boolean),
        hasEnvVarAccess: !!(input.context.hasEnvVarAccess as boolean),
        hasNetworkActivity: !!(input.context.hasNetworkActivity as boolean),
        hasDlpDetections: !!(input.context.hasDlpDetections as boolean),
        hasInjectionDetections: !!(input.context.hasInjectionDetections as boolean),
        writesToSystemDir: !!(input.context.writesToSystemDir as boolean),
        findingCount: (input.context.findingCount as number) ?? 0,
      }

      const scored = scoreAction(ctx)
      const withDecay = applySessionDecay(scored.score, sessionId)

      const action: TrustAction = determineAction(
        { ...scored, score: withDecay },
        thresholds,
      )

      // Record high-risk actions for session decay
      if (withDecay > 50) {
        recordHighRiskAction(sessionId, withDecay)
      }

      // Update model history
      yield* updateModelHistory(
        modelId,
        withDecay,
        withDecay >= thresholds.promptAbove,
        withDecay >= thresholds.blockAbove,
      )

      // Determine risk level from the decayed score
      let riskLevel: "low" | "medium" | "high" | "critical"
      if (withDecay <= 20) riskLevel = "low"
      else if (withDecay <= 50) riskLevel = "medium"
      else if (withDecay <= 80) riskLevel = "high"
      else riskLevel = "critical"

      const allFactors = [...scored.factors]
      const decay = getSessionSummary(sessionId).decay
      if (decay > 0) allFactors.push(`session decay: +${decay}`)

      log.debug("trust score", { action: input.action, score: withDecay, riskLevel, trustAction: action })

      return {
        score: withDecay,
        riskLevel,
        action,
        factors: allFactors,
      } as TrustScore
    })

    const getSessionTrust = Effect.fn("Trust.getSessionTrust")(function* (sessionId: string) {
      return getSessionSummary(sessionId)
    })

    const getModelTrust = Effect.fn("Trust.getModelTrust")(function* (modelId: string) {
      return yield* getModelHistory(modelId)
    })

    const resetSessionTrust = Effect.fn("Trust.resetSessionTrust")(function* (sessionId: string) {
      resetSessionDecay(sessionId)
    })

    return Service.of({ score, getSessionTrust, getModelTrust, resetSessionTrust })
  }),
)

export const defaultLayer = layer
