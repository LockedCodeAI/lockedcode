import { execFileSync } from "child_process"
import { existsSync, readFileSync } from "fs"

export interface PlatformInfo {
  readonly os: string
  readonly kernel: string
  readonly arch: string
}

export interface LinuxCapabilities {
  readonly landlockSupported: boolean
  readonly landlockABIVersion: number
  readonly bubblewrapAvailable: boolean
  readonly seccompAvailable: boolean
}

/**
 * Detect basic platform information.
 */
export function detectPlatform(): PlatformInfo {
  return {
    os: process.platform,
    kernel: process.platform === "linux" ? getKernelVersion() : "",
    arch: process.arch,
  }
}

/**
 * Detect Linux confinement capabilities.
 */
export function detectLinuxCapabilities(): LinuxCapabilities {
  const caps: Record<string, any> = {
    landlockSupported: false,
    landlockABIVersion: 0,
    bubblewrapAvailable: false,
    seccompAvailable: false,
  }

  if (process.platform !== "linux") return caps as LinuxCapabilities

  // Check Landlock
  try {
    const kernel = getKernelVersion()
    const parts = kernel.split(".").map(Number)
    const major = parts[0] ?? 0
    const minor = parts[1] ?? 0

    if (major > 5 || (major === 5 && minor >= 13)) {
      const landlockPath = "/sys/kernel/security/landlock"
      if (existsSync(landlockPath)) {
        caps.landlockSupported = true
        try {
          const abiStr = readFileSync(`${landlockPath}/abi_version`, "utf-8").trim()
          caps.landlockABIVersion = parseInt(abiStr) || 1
        } catch {
          caps.landlockABIVersion = 1
        }
      }
    }
  } catch {}

  // Check Bubblewrap
  try {
    execFileSync("which", ["bwrap"], { encoding: "utf-8" })
    caps.bubblewrapAvailable = true
  } catch {}

  // Check Seccomp
  try {
    caps.seccompAvailable = existsSync("/proc/sys/kernel/seccomp")
  } catch {}

  return caps as LinuxCapabilities
}

export interface MacOSCapabilities {
  readonly sandboxExecAvailable: boolean
  readonly macOSVersion: string
  readonly fseventsAvailable: boolean
}

/**
 * Detect macOS confinement capabilities.
 */
export function detectMacOSCapabilities(): MacOSCapabilities {
  const caps: Record<string, any> = {
    sandboxExecAvailable: false,
    macOSVersion: "",
    fseventsAvailable: false,
  }

  if (process.platform !== "darwin") return caps as MacOSCapabilities

  try {
    caps.sandboxExecAvailable = existsSync("/usr/bin/sandbox-exec")
  } catch {}

  try {
    const output = execFileSync("sw_vers", ["-productVersion"], { encoding: "utf-8" })
    caps.macOSVersion = output.trim()
  } catch {}

  caps.fseventsAvailable = true // always available on macOS

  return caps as MacOSCapabilities
}

/**
 * Select the best available confinement backend.
 */
export function getBestBackend(): "landlock" | "bubblewrap" | "sandbox" | "application" {
  if (process.platform === "linux") {
    try {
      const caps = detectLinuxCapabilities()
      if (caps.landlockSupported) return "landlock"
      if (caps.bubblewrapAvailable) return "bubblewrap"
    } catch {}
  }

  if (process.platform === "darwin") {
    try {
      const caps = detectMacOSCapabilities()
      if (caps.sandboxExecAvailable) return "sandbox"
    } catch {}
  }

  return "application"
}

function getKernelVersion(): string {
  try {
    const output = execFileSync("uname", ["-r"], { encoding: "utf-8" })
    return output.trim()
  } catch {
    return ""
  }
}
