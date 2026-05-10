import { execFileSync } from "child_process"
import path from "path"

export interface FileAccessViolation {
  readonly pid: number
  readonly filePath: string
  readonly accessType: "read" | "write"
  readonly isOutsideProject: boolean
}

/** System paths that are expected to be accessed. */
const SYSTEM_PATHS = ["/usr", "/lib", "/etc", "/opt", "/System", "/Library", "/Applications"]

/**
 * Check if a path is a system path (not suspicious).
 */
function isSystemPath(filePath: string): boolean {
  return SYSTEM_PATHS.some((p) => filePath.startsWith(p))
}

/**
 * Parse lsof output for file access.
 */
export function checkFileAccess(pid: number, projectRoot: string): FileAccessViolation[] {
  const violations: FileAccessViolation[] = []

  try {
    const output = execFileSync("lsof", ["-p", String(pid)], { encoding: "utf-8", timeout: 2000, maxBuffer: 1024 * 1024 })
    const lines = output.trim().split("\n").slice(1) // skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue

      const fd = parts[3] ?? ""
      const filePath = parts[parts.length - 1] ?? ""

      // Skip non-file descriptors (DIR, CHR, etc.) and non-file paths
      if (!filePath.startsWith("/") && !filePath.startsWith(".")) continue
      if (filePath === "/") continue
      if (isSystemPath(filePath)) continue
      if (filePath.startsWith("/dev") || filePath.startsWith("/proc")) continue

      // Determine access type
      const accessType: "read" | "write" = fd.includes("w") || fd.includes("u") ? "write" : "read"
      const isOutside = !filePath.startsWith(projectRoot)

      if (isOutside) {
        violations.push({ pid: parseInt(parts[1]), filePath, accessType, isOutsideProject: true })
      }
    }
  } catch {}

  return violations
}
