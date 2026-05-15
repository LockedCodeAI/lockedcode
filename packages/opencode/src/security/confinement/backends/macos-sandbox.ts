import { execFileSync } from "child_process"
import * as Log from "@opencode-ai/core/util/log"
import type { ConfinementBackend } from "./interface"
import { generateProfile } from "./sandbox-profile"
import fs from "fs"
import path from "path"
import os from "os"

const log = Log.create({ service: "confinement.macos" })

let active = false
let currentProfilePath: string | null = null
let currentPreApprovedPaths: string[] = []

/**
 * Create the macOS sandbox-exec confinement backend.
 */
export const MacOSSandboxBackend: ConfinementBackend = {
  name: "macos-sandbox",
  platform: "macos",
  isAvailable: () => {
    try {
      return fs.existsSync("/usr/bin/sandbox-exec")
    } catch {
      return false
    }
  },
  activate: (projectRoot: string, preApprovedPaths: string[]): boolean => {
    if (!fs.existsSync("/usr/bin/sandbox-exec")) {
      log.warn("sandbox-exec not found at /usr/bin/sandbox-exec")
      return false
    }

    currentPreApprovedPaths = preApprovedPaths

    // Generate and write the sandbox profile for use by wrapCommand().
    // sandbox-exec cannot be applied to the current running process —
    // it only confines child processes spawned through wrapCommand().
    const profile = generateProfile(projectRoot, preApprovedPaths)
    const profilePath = path.join(os.tmpdir(), `lockedcode-sandbox-${Date.now()}.sbpl`)
    fs.writeFileSync(profilePath, profile, "utf-8")
    currentProfilePath = profilePath

    log.warn("macOS sandbox: profile written but cannot confine current process — activate() returning false", { projectRoot, profilePath })
    return false
  },
  deactivate: () => {
    active = false
    // Clean up the temp profile file
    if (currentProfilePath) {
      try { fs.unlinkSync(currentProfilePath) } catch {}
      currentProfilePath = null
    }
  },
  wrapCommand: (command: string, projectRoot: string, preApprovedPaths: string[]): string => {
    // Generate profile if not already active
    if (!currentProfilePath) {
      const profile = generateProfile(projectRoot, preApprovedPaths)
      const profilePath = path.join(os.tmpdir(), `lockedcode-sandbox-${Date.now()}.sbpl`)
      fs.writeFileSync(profilePath, profile, "utf-8")
      currentProfilePath = profilePath
    }

    return `sandbox-exec -f ${currentProfilePath} /bin/bash -c ${JSON.stringify(command)}`
  },
  isActive: () => active,
  getEnforcementLevel: (): "kernel" | "namespace" | "application" => {
    return "application"
  },
}
