import { execFileSync } from "child_process"
import * as Log from "@opencode-ai/core/util/log"
import type { ConfinementBackend } from "./interface"

const log = Log.create({ service: "confinement.bubblewrap" })

let active = false

/**
 * Build bwrap arguments for a command.
 */
function buildBwrapArgs(projectRoot: string, preApprovedPaths: string[]): string[] {
  const args: string[] = []

  // Bind essential system directories as read-only
  const systemDirs = ["/usr", "/lib", "/lib64", "/bin", "/sbin", "/etc"]
  for (const dir of systemDirs) {
    if (dirExists(dir)) {
      args.push("--ro-bind", dir, dir)
    }
  }

  // Bind project root as read-write
  args.push("--bind", projectRoot, projectRoot)

  // Bind pre-approved paths
  for (const p of preApprovedPaths) {
    const expanded = p.replace(/^~/, require("os").homedir())
    if (dirExists(expanded)) {
      args.push("--bind", expanded, expanded)
    }
  }

  // Bind temp directory
  args.push("--bind", "/tmp", "/tmp")

  // Device nodes
  args.push("--dev", "/dev")
  args.push("--proc", "/proc")

  // Namespace isolation
  args.push("--unshare-all")
  args.push("--die-with-parent")

  return args
}

function dirExists(p: string): boolean {
  try {
    const fs = require("fs")
    return fs.existsSync(p) && fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

/**
 * Check if Bubblewrap is available on the system.
 */
function isAvailable(): boolean {
  try {
    execFileSync("which", ["bwrap"], { encoding: "utf-8" })
    return true
  } catch {
    return false
  }
}

/**
 * Create the Bubblewrap confinement backend.
 */
export const BubblewrapBackend: ConfinementBackend = {
  name: "bubblewrap",
  platform: "linux",
  isAvailable,
  activate: (projectRoot: string, preApprovedPaths: string[]): boolean => {
    if (!isAvailable()) {
      log.warn("Bubblewrap (bwrap) not found on PATH")
      return false
    }

    log.info("Bubblewrap confinement activated", {
      projectRoot,
      preApprovedPaths: preApprovedPaths.length,
    })

    active = true
    return true
  },
  deactivate: () => {
    active = false
  },
  wrapCommand: (command: string, projectRoot: string, preApprovedPaths: string[]): string => {
    const bwrapArgs = buildBwrapArgs(projectRoot, preApprovedPaths)
    return `bwrap ${bwrapArgs.join(" ")} -- ${command}`
  },
  isActive: () => active,
  getEnforcementLevel: (): "namespace" | "kernel" | "application" => {
    return active ? "namespace" : "application"
  },
}
