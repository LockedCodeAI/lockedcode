import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { PolicyDecision, Severity } from "../types"
import { loadPolicy, DEFAULT_POLICY, type Policy } from "./loader"

const log = Log.create({ service: "policy" })

export interface Interface {
  readonly evaluate: (input: { action: string; context: Record<string, unknown> }) => Effect.Effect<PolicyDecision>
  readonly getPolicy: () => Effect.Effect<Policy>
  readonly getStrictness: () => Effect.Effect<string>
  readonly isModelAllowed: (modelId: string) => Effect.Effect<boolean>
  readonly reload: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Policy") {}

/**
 * Determine the action based on severity and strictness level.
 */
function evaluateAction(severity: Severity, strictness: string): "allow" | "deny" | "prompt" {
  if (severity === "info") return "allow"
  if (severity === "warning") {
    if (strictness === "permissive") return "allow"
    return "prompt"
  }
  if (severity === "high") {
    if (strictness === "strict") return "deny"
    if (strictness === "permissive") return "prompt"
    return "prompt"
  }
  // critical
  if (strictness === "permissive") return "prompt"
  return "deny"
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const cwd = process.cwd()
    let cached = loadPolicy(cwd)

    const evaluate = Effect.fn("Policy.evaluate")(function* (input: {
      action: string
      context: Record<string, unknown>
    }) {
      const strictness = cached.policy.security.strictness
      const sev = (input.context.severity as Severity) ?? "info"
      const action = evaluateAction(sev, strictness)

      return {
        action,
        matchedRule: `strictness:${strictness}:severity:${sev}`,
        explanation: `Policy (${strictness}): action '${input.action}' with severity '${sev}' → ${action}`,
      } as PolicyDecision
    })

    const getPolicy = Effect.fn("Policy.getPolicy")(function* () {
      return cached.policy
    })

    const getStrictness = Effect.fn("Policy.getStrictness")(function* () {
      return cached.policy.security.strictness
    })

    const isModelAllowed = Effect.fn("Policy.isModelAllowed")(function* (modelId: string) {
      const models = cached.policy.security.models
      // If model is on the blocked list, deny
      if (models.blocked.length > 0 && models.blocked.some((m) => modelId.includes(m))) return false
      // If approved list is empty, all models are allowed
      if (models.approved.length === 0) return true
      // Otherwise, check if model is on the approved list
      return models.approved.some((m) => modelId.includes(m))
    })

    const reload = Effect.fn("Policy.reload")(function* () {
      cached = loadPolicy(cwd)
      log.info("policy reloaded", { strictness: cached.policy.security.strictness, sources: cached.sources })
    })

    log.info("policy loaded", { strictness: cached.policy.security.strictness, sources: cached.sources })

    return Service.of({ evaluate, getPolicy, getStrictness, isModelAllowed, reload })
  }),
)

export const defaultLayer = layer
