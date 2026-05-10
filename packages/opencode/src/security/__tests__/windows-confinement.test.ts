import { describe, expect, test } from "bun:test"
import { resolveWindowsPath, isWindowsSubPath } from "../confinement/backends/windows-paths"
import { WindowsACLBackend } from "../confinement/backends/windows-acl"
import { detectWindowsCapabilities, getBestBackend } from "../confinement/platform"

// ============================================================
// Windows Path Hardening Tests
// ============================================================

describe("Windows path hardening", () => {
  test("drive letter normalization", () => {
    const result = resolveWindowsPath("c:\\project")
    expect(result.startsWith("C:")).toBe(true)
  })

  test("backslash normalization", () => {
    const result = resolveWindowsPath("C:/project/src")
    expect(result).toContain("\\")
    expect(result).not.toContain("/")
  })

  test("\\\\?\\ prefix stripped", () => {
    const result = resolveWindowsPath("\\\\?\\C:\\project")
    expect(result).toBe("C:\\project")
  })

  test("reserved names rejected", () => {
    expect(resolveWindowsPath("C:\\CON")).toBe("")
    expect(resolveWindowsPath("C:\\PRN")).toBe("")
    expect(resolveWindowsPath("C:\\NUL")).toBe("")
    expect(resolveWindowsPath("C:\\COM1")).toBe("")
    expect(resolveWindowsPath("C:\\LPT1")).toBe("")
  })

  test("normal path passes through", () => {
    const result = resolveWindowsPath("C:\\Users\\test\\project")
    expect(result).toBe("C:\\Users\\test\\project")
  })

  test("isWindowsSubPath case insensitive", () => {
    expect(isWindowsSubPath("C:\\Project\\src\\file.ts", "C:\\project")).toBe(true)
    expect(isWindowsSubPath("c:\\project\\src\\file.ts", "C:\\Project")).toBe(true)
  })

  test("isWindowsSubPath outside is false", () => {
    expect(isWindowsSubPath("C:\\other\\file.ts", "C:\\project")).toBe(false)
  })

  test("isWindowsSubPath same path is true", () => {
    expect(isWindowsSubPath("C:\\project", "C:\\project")).toBe(true)
  })

  test("nested path is inside parent", () => {
    expect(isWindowsSubPath("C:\\project\\deeply\\nested\\file.ts", "C:\\project")).toBe(true)
  })
})

// ============================================================
// Windows ACL Backend Tests
// ============================================================

describe("Windows ACL backend", () => {
  test("has correct platform", () => {
    expect(WindowsACLBackend.platform).toBe("windows")
  })

  test("getEnforcementLevel returns a value", () => {
    const level = WindowsACLBackend.getEnforcementLevel()
    expect(["kernel", "namespace", "application"]).toContain(level)
  })

  test("wrapCommand produces powershell invocation", () => {
    const cmd = WindowsACLBackend.wrapCommand("echo hello", "C:\\project", ["C:\\tmp"])
    expect(cmd).toContain("powershell")
    expect(cmd).toContain("Set-Location")
    expect(cmd).toContain("C:\\project")
  })
})

// ============================================================
// Windows Platform Detection Tests
// ============================================================

describe("Windows platform detection", () => {
  test("detectWindowsCapabilities returns valid object", () => {
    const caps = detectWindowsCapabilities()
    expect(typeof caps.isNTFS).toBe("boolean")
    expect(typeof caps.powershellAvailable).toBe("boolean")
    expect(typeof caps.icaclsAvailable).toBe("boolean")
  })

  test("getBestBackend returns a valid backend", () => {
    const backend = getBestBackend()
    expect(["landlock", "bubblewrap", "sandbox", "ntfs-acl", "application"]).toContain(backend)
  })
})
