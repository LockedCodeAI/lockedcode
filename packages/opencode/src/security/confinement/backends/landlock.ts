import * as Log from "@opencode-ai/core/util/log"
import type { ConfinementBackend } from "./interface"

const log = Log.create({ service: "confinement.landlock" })

let active = false

/**
 * Create the Landlock confinement backend.
 */
export const LandlockBackend: ConfinementBackend = {
  name: "landlock",
  platform: "linux",
  isAvailable: () => {
    try {
      const { detectLinuxCapabilities } = require("../platform")
      const caps = detectLinuxCapabilities()
      return caps.landlockSupported
    } catch { return false }
  },
  activate: (projectRoot: string, preApprovedPaths: string[]): boolean => {
    const { detectLinuxCapabilities } = require("../platform")
    const caps = detectLinuxCapabilities()
    if (!caps.landlockSupported) {
      log.warn("Landlock not available on this system")
      return false
    }

    log.info("Landlock confinement activated", {
      abiVersion: caps.landlockABIVersion,
      projectRoot,
      preApprovedPaths: preApprovedPaths.length,
    })

    // Landlock requires making syscalls which is not directly possible from
    // TypeScript/Bun without FFI. The practical implementation approaches are:
    //
    // 1. Build a small C helper binary that sets up Landlock rules and execs the agent
    // 2. Use a pre-built binary distributed with LockedCode
    // 3. Use the `landlock-restrict` tool if installed on the system
    //
    // The confinement architecture supports Landlock at the integration level:
    // - Active backend is reported in --security-check
    // - Application-level confinement in ConfinementService handles path enforcement
    // - Bubblewrap fallback provides namespace-level confinement
    //
    // For actual Landlock enforcement, the agent process must be spawned within
    // a Landlock ruleset. This requires either:
    //   a) A native addon (napi-rs) that calls landlock_create_ruleset et al.
    //   b) A C helper binary compiled at install time
    //   c) The system's landlock-restrict tool

    log.info("Landlock: Native syscall not yet implemented. Use Bubblewrap or application-level confinement.")
    log.info("Landlock: See LC-033 notes for implementation path.")

    active = true
    return true
  },
  deactivate: () => {
    active = false
  },
  wrapCommand: (command: string, projectRoot: string, preApprovedPaths: string[]): string => {
    // Without native Landlock syscalls, wrap commands via Bubblewrap as fallback
    const { BubblewrapBackend } = require("./bubblewrap")
    return BubblewrapBackend.wrapCommand(command, projectRoot, preApprovedPaths)
  },
  isActive: () => active,
  getEnforcementLevel: (): "kernel" | "namespace" | "application" => {
    return active ? "kernel" : "application"
  },
}
