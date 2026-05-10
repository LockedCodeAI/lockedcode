import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import os from "os"
import type { ConfinementResult, EscapeRequest } from "../types"
import { defaultSecurityConfig } from "../types"
import { detectProjectRoot } from "./root"
import { canonicalize, isSubPath } from "./paths"
import { Identifier } from "@/id/id"
import { Service as SecurityConfigService, defaultLayer as SecurityConfigLayer } from "../config"

const log = Log.create({ service: "confinement" })

/** Mutable escape record for internal use. */
interface MutableEscape extends EscapeRequest {
  resolve: (approved: boolean) => void
}

const pendingEscapes = new Map<string, MutableEscape>()
const sessionApprovals = new Map<string, Set<string>>()

export interface Interface {
  readonly checkPath: (path: string, operation: "read" | "write" | "execute") => Effect.Effect<ConfinementResult>
  readonly requestEscape: (path: string, operation: string, reason: string) => Effect.Effect<EscapeRequest>
  readonly approveEscape: (escapeId: string) => Effect.Effect<ConfinementResult>
  readonly denyEscape: (escapeId: string, reason?: string) => Effect.Effect<ConfinementResult>
  readonly approvePathForSession: (path: string) => Effect.Effect<void>
  readonly detectBackend: () => Effect.Effect<string>
  readonly getProjectRoot: () => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Confinement") {}

/**
 * Create the confinement service layer.
 * Requires SecurityConfigService to be provided.
 */
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const svc = yield* SecurityConfigService
    const cfg = svc.get()
    const enabled = cfg.confinement.enabled
    const cwd = process.cwd()

    // Only detect project root if confinement is enabled
    const projectRoot: string = enabled
      ? detectProjectRoot(cwd, cfg.confinement.projectRoot)
      : cwd

    log.info("Confinement active", { projectRoot, enabled })

    const checkPath = Effect.fn("Confinement.checkPath")(function* (
      path: string,
      operation: "read" | "write" | "execute",
    ) {
      if (!enabled) {
        return { allowed: true, path, operation, reason: "confinement disabled", escapable: false } as ConfinementResult
      }

      const canon = canonicalize(path, cwd)
      if (canon === "") {
        return { allowed: false, path, operation, reason: "path contains null bytes or is invalid", escapable: false } as ConfinementResult
      }

      // Check session-level approved paths first
      const sessionKey = `${operation}:${canon}`
      for (const [, approved] of sessionApprovals) {
        if (approved.has(sessionKey) || approved.has(canon)) {
          return { allowed: true, path: canon, operation, reason: "session-approved escape path", escapable: false } as ConfinementResult
        }
      }

      // Check if inside project root
      if (isSubPath(canon, projectRoot)) {
        return { allowed: true, path: canon, operation, reason: "inside project root", escapable: false } as ConfinementResult
      }

      // Check pre-approved paths
      const preApproved = cfg.confinement.preApprovedPaths
      for (const approved of preApproved) {
        const expanded = approved.replace(/^~/, os.homedir())
        const approvedCanon = canonicalize(expanded, cwd)
        if (isSubPath(canon, approvedCanon)) {
          log.info("pre-approved path access", { path: canon, approved })
          return { allowed: true, path: canon, operation, reason: `pre-approved path: ${approved}`, escapable: false } as ConfinementResult
        }
      }

      // Denied — but escapable
      const escapeId = Identifier.create("esc", "ascending")
      return {
        allowed: false,
        path: canon,
        operation,
        reason: "outside project root",
        escapable: true,
        escapeId,
      } as ConfinementResult
    })

    const requestEscape = Effect.fn("Confinement.requestEscape")(function* (
      path: string,
      operation: string,
      reason: string,
    ) {
      const canon = canonicalize(path, cwd)
      const escapeId = Identifier.create("esc", "ascending")

      const escape: MutableEscape = {
        id: escapeId,
        path: canon,
        operation,
        reason,
        modelId: "unknown",
        sessionId: "unknown",
        contentHash: "",
        status: "pending" as const,
        resolve: () => {},
      }

      pendingEscapes.set(escapeId, escape)

      // Auto-approve for now (full UX integration deferred — see report notes)
      log.warn("escape hatch triggered (auto-approved — UX integration pending)", {
        path: canon,
        operation,
        reason,
      })

      const entry = pendingEscapes.get(escapeId)
      if (entry) {
        ;(entry as any).status = "approved"
        entry.resolve(true)
      }
      return { id: escapeId, path: canon, operation, reason, modelId: "unknown", sessionId: "unknown", contentHash: "", status: "approved" as const } as EscapeRequest
    })

    const approveEscape = Effect.fn("Confinement.approveEscape")(function* (escapeId: string) {
      const escape = pendingEscapes.get(escapeId)
      if (!escape) {
        return { allowed: false, path: "", operation: "read", reason: "escape request not found", escapable: false } as ConfinementResult
      }
      ;(escape as any).status = "approved"
      escape.resolve(true)
      log.info("escape approved", { path: escape.path, operation: escape.operation })
      return {
        allowed: true,
        path: escape.path,
        operation: escape.operation as "read" | "write" | "execute",
        reason: "escape approved",
        escapable: false,
      } as ConfinementResult
    })

    const denyEscape = Effect.fn("Confinement.denyEscape")(function* (escapeId: string, reason?: string) {
      const escape = pendingEscapes.get(escapeId)
      if (!escape) {
        return { allowed: false, path: "", operation: "read", reason: "escape request not found", escapable: false } as ConfinementResult
      }
      ;(escape as any).status = "denied"
      escape.resolve(false)
      log.info("escape denied", { path: escape.path, operation: escape.operation, reason })
      return {
        allowed: false,
        path: escape.path,
        operation: escape.operation as "read" | "write" | "execute",
        reason: reason ?? "escape denied by user",
        escapable: false,
      } as ConfinementResult
    })

    const approvePathForSession = Effect.fn("Confinement.approvePathForSession")(function* (path: string) {
      if (!sessionApprovals.has(path)) {
        sessionApprovals.set(path, new Set())
      }
      sessionApprovals.get(path)!.add(path)
    })

    const detectBackend = Effect.fn("Confinement.detectBackend")(function* () {
      return "application-level (no kernel backend)"
    })

    const getProjectRoot = Effect.fn("Confinement.getProjectRoot")(function* () {
      return projectRoot
    })

    return Service.of({
      checkPath,
      requestEscape,
      approveEscape,
      denyEscape,
      approvePathForSession,
      detectBackend,
      getProjectRoot,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(SecurityConfigLayer))
