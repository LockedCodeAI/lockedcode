import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { inheritPolicy, verifyCascade } from "./policy-cascade"
import { registerAgent, getAgentContext, deregisterAgent, getParentChain, clearRegistry } from "./registry"
import type { Policy } from "../policy/schema"
import type { AgentSecurityContext } from "./registry"

const log = Log.create({ service: "cascade" })

export interface Interface {
  readonly onAgentSpawn: (
    parentAgentId: string | null,
    childAgentId: string,
    childSessionId: string,
    childPolicyOverrides?: Partial<Policy>,
  ) => Effect.Effect<{ agentId: string; effectivePolicy: Policy }>
  readonly verifyInheritance: (childAgentId: string) => Effect.Effect<{ valid: boolean; issues: string[] }>
  readonly getEffectivePolicy: (agentId: string) => Effect.Effect<Policy | null>
  readonly getAgentSecurityContext: (agentId: string) => Effect.Effect<AgentSecurityContext | null>
  readonly onAgentComplete: (agentId: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Cascade") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const onAgentSpawn = Effect.fn("Cascade.onAgentSpawn")(function* (
      parentAgentId: string | null,
      childAgentId: string,
      childSessionId: string,
      childPolicyOverrides?: Partial<Policy>,
    ) {
      let effectivePolicy: Policy

      if (parentAgentId) {
        const parent = getAgentContext(parentAgentId)
        if (!parent) {
          log.error("parent agent not found", { parentAgentId })
          throw new Error(`Parent agent "${parentAgentId}" not found in cascade registry`)
        }
        effectivePolicy = inheritPolicy(parent.effectivePolicy, childPolicyOverrides)
        registerAgent(childAgentId, parentAgentId, childSessionId, effectivePolicy, parent.confinementRoot)
        log.info("security policy cascaded", { from: parentAgentId, to: childAgentId })
      } else {
        // Root agent — create baseline context
        const blankPolicy = childPolicyOverrides as Policy
        if (!blankPolicy) {
          throw new Error("Root agent requires an effective policy")
        }
        effectivePolicy = blankPolicy
        registerAgent(childAgentId, null, childSessionId, effectivePolicy, process.cwd())
        log.info("root agent registered", { agentId: childAgentId })
      }

      return { agentId: childAgentId, effectivePolicy }
    })

    const verifyInheritance = Effect.fn("Cascade.verifyInheritance")(function* (childAgentId: string) {
      const child = getAgentContext(childAgentId)
      if (!child || !child.parentAgentId) {
        return { valid: true, issues: [] }
      }

      const parent = getAgentContext(child.parentAgentId)
      if (!parent) {
        return { valid: false, issues: ["Parent agent not found"] }
      }

      return verifyCascade(parent.effectivePolicy, child.effectivePolicy)
    })

    const getEffectivePolicy = Effect.fn("Cascade.getEffectivePolicy")(function* (agentId: string) {
      const ctx = getAgentContext(agentId)
      return ctx?.effectivePolicy ?? null
    })

    const getAgentSecurityContext = Effect.fn("Cascade.getAgentSecurityContext")(function* (agentId: string) {
      return getAgentContext(agentId)
    })

    const onAgentComplete = Effect.fn("Cascade.onAgentComplete")(function* (agentId: string) {
      deregisterAgent(agentId)
      log.info("agent deregistered from cascade", { agentId })
    })

    return Service.of({ onAgentSpawn, verifyInheritance, getEffectivePolicy, getAgentSecurityContext, onAgentComplete })
  }),
)

export const defaultLayer = layer
