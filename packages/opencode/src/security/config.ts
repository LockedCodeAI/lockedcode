import { Context, Effect, Layer } from "effect"
import { defaultSecurityConfig, type SecurityConfig } from "./types"

/**
 * Security configuration service — provides the security config from the config system.
 * In the skeleton phase, this uses hardcoded defaults.
 */
export interface Interface {
  readonly get: () => SecurityConfig
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/SecurityConfig") {}

export const layer = Layer.succeed(
  Service,
  Service.of({ get: () => defaultSecurityConfig }),
)

export const defaultLayer = layer

export * as SecurityConfig from "."
