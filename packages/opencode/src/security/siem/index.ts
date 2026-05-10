import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { SecurityEvent, Severity } from "../types"
import type { AuditFilter } from "../audit"
import { formatCEF } from "./cef"
import { formatOCSF } from "./ocsf"
import { formatSyslog, formatJSONSyslog } from "./json-syslog"
import { Service as AuditService } from "../audit"

const log = Log.create({ service: "siem" })

export interface SyslogEndpoint {
  readonly host: string
  readonly port: number
  readonly protocol: "udp" | "tcp"
  readonly format: "cef" | "ocsf" | "json"
}

export interface EventFilter {
  readonly minSeverity?: Severity
  readonly eventTypes?: string[]
  readonly excludeTypes?: string[]
}

export interface Interface {
  readonly exportEvents: (filter: AuditFilter, format: "cef" | "ocsf" | "json") => Effect.Effect<string[]>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/SIEM") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const audit = yield* AuditService

    const formatEvent = (event: SecurityEvent, format: string): string => {
      switch (format) {
        case "cef": return formatCEF(event)
        case "ocsf": return JSON.stringify(formatOCSF(event))
        case "json": return formatJSONSyslog(event)
        default: return JSON.stringify(event)
      }
    }

    const exportEvents = Effect.fn("SIEM.exportEvents")(function* (filter: AuditFilter, format: "cef" | "ocsf" | "json") {
      const events = yield* audit.query(filter)
      return events.map((e) => formatEvent(e, format))
    })

    return Service.of({ exportEvents })
  }),
)

export const defaultLayer = layer
