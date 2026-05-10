import os from "os"
import path from "path"

/**
 * Generate a macOS sandbox-exec profile (SBPL) for confining the agent
 * to the project directory.
 *
 * sandbox-exec is deprecated by Apple but still functional.
 * This profile uses the Seatbelt Sandbox Profile Language.
 */
export function generateProfile(projectRoot: string, preApprovedPaths: string[]): string {
  const lines: string[] = [
    "(version 1)",
    "(deny default)",
    "",
    ";; Allow process execution",
    "(allow process-exec)",
    "(allow process-fork)",
    "",
    ";; Allow network access (needed for LLM API calls)",
    "(allow network*)",
    "(allow system-socket)",
    "(allow ipc-posix*)",
    "(allow mach-lookup)",
    "(allow sysctl-read)",
    "",
    ";; Signal self and child processes",
    "(allow signal (target self))",
    "(allow signal (target same-sandbox))",
    "",
    ";; System libraries",
    "(allow file-read*",
    "  (subpath \"/usr/lib\")",
    "  (subpath \"/usr/share\")",
    "  (subpath \"/usr/local/lib\")",
    "  (subpath \"/System/Library\")",
    "  (subpath \"/Library/Frameworks\")",
    "  (subpath \"/Library/Apple\")",
    "  (subpath \"/private/var/db/dyld\")",
    ")",
    "",
    ";; Project root — read + write",
    `(allow file-read* file-write* (subpath "${projectRoot}"))`,
    "",
    ";; Temp directories",
    "(allow file-read* file-write*",
    "  (subpath \"/private/tmp\")",
    "  (subpath \"/tmp\")",
  ]

  // Add TMPDIR if set
  const tmpdir = process.env.TMPDIR
  if (tmpdir && !tmpdir.startsWith("/private/tmp") && !tmpdir.startsWith("/tmp")) {
    lines.push(`  (subpath "${tmpdir}")`)
  }

  lines.push(")")

  // Pre-approved paths
  for (const p of preApprovedPaths) {
    const expanded = p.replace(/^~/, os.homedir())
    const resolved = path.resolve(expanded)
    lines.push("", `(allow file-read* file-write* (subpath "${resolved}"))`)
  }

  // Home directory caches (read-only)
  lines.push("", "(allow file-read*")
  lines.push(`  (subpath "${os.homedir()}/Library/Caches")`)
  lines.push(`  (subpath "${os.homedir()}/.npm")`)
  lines.push(`  (subpath "${os.homedir()}/.bun")`)
  lines.push(")")

  // Required system paths
  lines.push("", "(allow file-read*")
  lines.push("  (subpath \"/usr/bin\")")
  lines.push("  (subpath \"/bin\")")
  lines.push("  (subpath \"/usr/sbin\")")
  lines.push("  (subpath \"/sbin\")")
  lines.push(")")

  return lines.join("\n")
}
