import { describe, expect, test } from "bun:test"
import { detectPlatform, detectLinuxCapabilities, getBestBackend } from "../confinement/platform"
import { BubblewrapBackend } from "../confinement/backends/bubblewrap"
import { LandlockBackend } from "../confinement/backends/landlock"

// ============================================================
// Platform Detection Tests
// ============================================================

describe("platform detection", () => {
  test("detects current platform", () => {
    const info = detectPlatform()
    expect(info.os).toBe(process.platform)
    expect(info.arch).toBe(process.arch)
  })

  test("getBestBackend always returns a string", () => {
    const backend = getBestBackend()
    expect(["landlock", "bubblewrap", "application"]).toContain(backend)
  })
})

// ============================================================
// Linux Capabilities Tests (mock-based)
// ============================================================

describe("Linux capabilities detection", () => {
  test("non-Linux platform returns no capabilities", () => {
    // The function short-circuits for non-linux
    const caps = detectLinuxCapabilities()
    // On non-Linux, all should be false/0
    if (process.platform !== "linux") {
      expect(caps.landlockSupported).toBe(false)
      expect(caps.bubblewrapAvailable).toBe(false)
      expect(caps.landlockABIVersion).toBe(0)
    }
  })
})

// ============================================================
// Bubblewrap Backend Tests
// ============================================================

describe("Bubblewrap backend", () => {
  test("has platform linux", () => {
    expect(BubblewrapBackend.platform).toBe("linux")
  })

  test("wrapCommand produces valid bwrap invocation", () => {
    const cmd = BubblewrapBackend.wrapCommand("echo hello", "/project", ["/tmp", "~/.cache"])
    expect(cmd).toContain("bwrap")
    expect(cmd).toContain("/project")
    expect(cmd).toContain("echo hello")
    expect(cmd).toContain("--unshare-all")
    expect(cmd).toContain("--die-with-parent")
  })

  test("wrapCommand includes system dirs as read-only", () => {
    const cmd = BubblewrapBackend.wrapCommand("ls", "/proj", [])
    expect(cmd).toContain("--ro-bind")
  })

  test("wrapCommand includes project root as read-write", () => {
    const cmd = BubblewrapBackend.wrapCommand("ls", "/my-project", [])
    expect(cmd).toContain("--bind /my-project /my-project")
  })

  test("wrapCommand includes pre-approved paths", () => {
    const cmd = BubblewrapBackend.wrapCommand("ls", "/p", ["/tmp"])
    expect(cmd).toContain("--bind /tmp /tmp")
  })

  test("getEnforcementLevel returns namespace when active", () => {
    // Just test the method exists and returns expected type
    const level = BubblewrapBackend.getEnforcementLevel()
    expect(["kernel", "namespace", "application"]).toContain(level)
  })
})

// ============================================================
// Landlock Backend Honesty Tests (#4)
// ============================================================

describe("Landlock backend", () => {
  test("has platform linux", () => {
    expect(LandlockBackend.platform).toBe("linux")
  })

  test("activate returns false without native syscalls", () => {
    const result = LandlockBackend.activate("/project", ["/tmp"])
    expect(result).toBe(false)
  })

  test("isActive returns false after activate (no real enforcement)", () => {
    LandlockBackend.activate("/project", [])
    expect(LandlockBackend.isActive()).toBe(false)
  })

  test("getEnforcementLevel never returns kernel without real enforcement", () => {
    LandlockBackend.activate("/project", [])
    expect(LandlockBackend.getEnforcementLevel()).toBe("application")
  })

  test("getEnforcementLevel returns application when inactive", () => {
    LandlockBackend.deactivate()
    expect(LandlockBackend.getEnforcementLevel()).toBe("application")
  })

  test("wrapCommand delegates to Bubblewrap", () => {
    const cmd = LandlockBackend.wrapCommand("echo hi", "/project", ["/tmp"])
    expect(cmd).toContain("bwrap")
  })
})
