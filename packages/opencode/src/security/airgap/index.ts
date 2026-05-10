import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { verifyAirGapCompliance } from "./network"
import type { NetworkConfigWarning } from "./network"
import { DEFAULT_POLICY } from "../policy/loader"

const log = Log.create({ service: "airgap" })

export interface Interface {
  readonly isAirGapEnabled: () => Effect.Effect<boolean>
  readonly verifyStartup: () => Effect.Effect<NetworkConfigWarning[]>
  readonly getRulesManifest: () => Effect.Effect<RulesManifest | null>
}

export interface RulesManifest {
  readonly version: string
  readonly generated: string
  readonly rulesets: Record<string, { count: number; files: string[] }>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/AirGap") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let airGapEnabled = false

    const isAirGapEnabled = Effect.fn("AirGap.isAirGapEnabled")(function* () {
      return airGapEnabled
    })

    const verifyStartup = Effect.fn("AirGap.verifyStartup")(function* () {
      if (!airGapEnabled) return []

      const warnings = verifyAirGapCompliance(DEFAULT_POLICY)

      for (const w of warnings) {
        log.warn("air-gap compliance", { field: w.field, description: w.description, severity: w.severity })
      }

      if (warnings.length === 0) {
        log.info("LockedCode: Air-gap mode enabled. All rules resolved locally.")
      }

      return warnings
    })

    const getRulesManifest = Effect.fn("AirGap.getRulesManifest")(function* () {
      try {
        const fs = yield* Effect.promise(() => import("fs"))
        const path = yield* Effect.promise(() => import("path"))
        const cwd = process.cwd()
        let current = cwd
        for (let i = 0; i < 10; i++) {
          const manifestPath = path.join(current, "rules", "manifest.json")
          try {
            const content = fs.readFileSync(manifestPath, "utf-8")
            return JSON.parse(content) as RulesManifest
          } catch {
            const parent = path.dirname(current)
            if (parent === current) break
            current = parent
          }
        }
      } catch {}
      return null
    })

    return Service.of({ isAirGapEnabled, verifyStartup, getRulesManifest })
  }),
)

export const defaultLayer = layer
