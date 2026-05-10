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

export interface WindowsCapabilities {
  readonly isNTFS: boolean
  readonly powershellAvailable: boolean
  readonly icaclsAvailable: boolean
  readonly windowsVersion: string
}

/**
 * Detect Windows confinement capabilities.
 */
export function detectWindowsCapabilities(): WindowsCapabilities {
  const caps: Record<string, any> = {
    isNTFS: false,
    powershellAvailable: false,
    icaclsAvailable: false,
    windowsVersion: "",
  }

  if (process.platform !== "win32") return caps as WindowsCapabilities

  try {
    caps.powershellAvailable = existsSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
  } catch {}

  try {
    caps.icaclsAvailable = existsSync("C:\\Windows\\System32\\icacls.exe")
  } catch {}

  try {
    const { execFileSync } = require("child_process")
    const ver = execFileSync("cmd.exe", ["/c", "ver"], { encoding: "utf-8" })
    caps.windowsVersion = ver.trim()
  } catch {}

  caps.isNTFS = true // most modern Windows installations use NTFS

  return caps as WindowsCapabilities
}

/**
 * Select the best available confinement backend.
 */
export function getBestBackend(): "landlock" | "bubblewrap" | "sandbox" | "ntfs-acl" | "application" {
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

  if (process.platform === "win32") {
    const caps = detectWindowsCapabilities()
    if (caps.powershellAvailable) return "ntfs-acl"
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
