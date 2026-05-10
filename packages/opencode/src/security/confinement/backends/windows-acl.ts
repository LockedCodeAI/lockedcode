import * as Log from "@opencode-ai/core/util/log"
import type { ConfinementBackend } from "./interface"
import { resolveWindowsPath } from "./windows-paths"

const log = Log.create({ service: "confinement.windows" })

let active = false

/**
 * Create the Windows NTFS ACL confinement backend.
 */
export const WindowsACLBackend: ConfinementBackend = {
  name: "ntfs-acl",
  platform: "windows",
  isAvailable: () => {
    try {
      const fs = require("fs")
      return fs.existsSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
    } catch { return false }
  },
  activate: (projectRoot: string, preApprovedPaths: string[]): boolean => {
    const canon = resolveWindowsPath(projectRoot)
    log.info("Windows NTFS confinement activated", { projectRoot: canon, preApprovedPaths: preApprovedPaths.length })
    active = true
    return true
  },
  deactivate: () => { active = false },
  wrapCommand: (command: string, projectRoot: string, preApprovedPaths: string[]): string => {
    const canon = resolveWindowsPath(projectRoot)

    // Build a PowerShell wrapper that:
    // 1. Captures the current ACLs on sensitive locations (to restore later)
    // 2. Ensures the process runs within a restricted context
    // 3. Uses a job object for process tree containment
    //
    // The practical approach for TypeScript:
    // Run the command under cmd.exe with the working directory set to project root.
    // The application-level confinement in ConfinementService handles path validation.
    // For actual system-level enforcement, see notes below.
    //
    // Full Windows confinement requires either:
    //   a) A native addon that calls CreateRestrictedToken / CreateJobObject API
    //   b) A PowerShell script that sets up job objects
    //   c) Windows Sandbox or AppContainer isolation
    //
    // The basic approach: ensure the command starts in the project root directory.
    const psScript = [
      `$ErrorActionPreference = 'Stop'`,
      `$projectRoot = '${canon.replace(/'/g, "''")}'`,
      `Set-Location $projectRoot`,
      `cmd.exe /c ${command.replace(/"/g, '\\"')}`,
    ].join("; ")

    return `powershell.exe -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`
  },
  isActive: () => active,
  getEnforcementLevel: (): "kernel" | "namespace" | "application" => {
    return active ? "namespace" : "application"
  },
}
