/**
 * Per-process, append-only whitelist of external paths permitted outside
 * the project root.
 *
 * @remarks
 * This module is the single mechanism for intentional, audited exceptions to
 * project-root confinement. Internal subsystems (CLI database, flag-gated
 * global config) register paths here at startup. The confinement check
 * (`checkPath`) consults this set before denying access. There is no
 * remove method — the whitelist is append-only for the process lifetime.
 *
 * This module is deliberately free of Effect-ts dependencies so it can be
 * imported from non-Effect code (CLI commands, loaders, etc.) without
 * triggering the full security module initialization chain.
 */
import os from "os"
import * as Log from "@opencode-ai/core/util/log"
import { canonicalize, isSubPath } from "./paths"
import type { ConfinementResult } from "../types"

const log = Log.create({ service: "confinement.whitelist" })

const externalPathWhitelist = new Map<string, string>()

/**
 * Register an absolute path as a permitted external access outside the
 * project root. The path is canonicalized before storage. Registration
 * is idempotent — registering the same path twice is a no-op.
 *
 * @param absolutePath - The absolute path to whitelist (tilde expansion supported)
 * @param reason - Human-readable audit reason explaining why this path is needed
 */
export function registerExternalPath(absolutePath: string, reason: string): void {
  let resolved = absolutePath
  if (resolved.startsWith("~")) {
    resolved = os.homedir() + resolved.slice(1)
  }
  const canon = canonicalize(resolved)
  if (canon === "") {
    log.warn("registerExternalPath: invalid path ignored", { absolutePath, reason })
    return
  }
  if (externalPathWhitelist.has(canon)) {
    return
  }
  externalPathWhitelist.set(canon, reason)
  log.info("external path registered", { path: canon, reason })
}

/**
 * Check whether a canonicalized path is in the external whitelist.
 *
 * @param canonicalPath - Already-canonicalized absolute path to check
 * @returns The registration reason if whitelisted, undefined otherwise
 */
export function isExternalPathWhitelisted(canonicalPath: string): string | undefined {
  const direct = externalPathWhitelist.get(canonicalPath)
  if (direct) return direct
  for (const [registered, reason] of externalPathWhitelist) {
    if (isSubPath(canonicalPath, registered)) return reason
  }
  return undefined
}

/**
 * Clear the external path whitelist. For testing only.
 */
export function clearExternalPathWhitelist(): void {
  externalPathWhitelist.clear()
}

/**
 * Get all registered external paths. For testing/inspection.
 *
 * @returns Read-only snapshot of the current whitelist entries
 */
export function getExternalPaths(): ReadonlyMap<string, string> {
  return new Map(externalPathWhitelist)
}

/**
 * Synchronous confinement check for use outside Effect context.
 * Checks whether a path is inside the project root or in the external whitelist.
 * Does not support escape requests — returns allowed/denied only.
 *
 * @param targetPath - Path to check
 * @param operation - The operation type (read/write/execute)
 * @param projectRoot - The project root to confine within
 * @returns ConfinementResult indicating whether access is permitted
 */
export function checkPathSync(
  targetPath: string,
  operation: "read" | "write" | "execute",
  projectRoot: string,
): ConfinementResult {
  const cwd = process.cwd()
  const canon = canonicalize(targetPath, cwd)
  if (canon === "") {
    return { allowed: false, path: targetPath, operation, reason: "path contains null bytes or is invalid", escapable: false }
  }

  const canonRoot = canonicalize(projectRoot, cwd)
  if (isSubPath(canon, canonRoot)) {
    return { allowed: true, path: canon, operation, reason: "inside project root", escapable: false }
  }

  const whitelistReason = isExternalPathWhitelisted(canon)
  if (whitelistReason) {
    log.debug("whitelisted external path access (sync)", { path: canon, operation, reason: whitelistReason })
    return { allowed: true, path: canon, operation, reason: `whitelisted external path: ${whitelistReason}`, escapable: false }
  }

  log.warn("confinement denied (sync)", { path: canon, operation, projectRoot })
  return { allowed: false, path: canon, operation, reason: "outside project root", escapable: false }
}
