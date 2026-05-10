import { describe, expect, test } from "bun:test"
import { generateProfile } from "../confinement/backends/sandbox-profile"
import { MacOSSandboxBackend } from "../confinement/backends/macos-sandbox"
import { detectMacOSCapabilities, getBestBackend } from "../confinement/platform"

// ============================================================
// Sandbox Profile Tests
// ============================================================

describe("sandbox profile generation", () => {
  test("profile includes project root as read-write", () => {
    const profile = generateProfile("/Users/test/project", ["/tmp"])
    expect(profile).toContain("subpath \"/Users/test/project\"")
    expect(profile).toContain("file-write*")
    expect(profile).toContain("file-read*")
  })

  test("profile denies default", () => {
    const profile = generateProfile("/p", [])
    expect(profile).toContain("(deny default)")
  })

  test("profile includes pre-approved paths", () => {
    const profile = generateProfile("/p", ["/custom/path"])
    expect(profile).toContain("subpath \"/custom/path\"")
  })

  test("profile includes system libraries as read-only", () => {
    const profile = generateProfile("/p", [])
    expect(profile).toContain("subpath \"/usr/lib\"")
    expect(profile).toContain("subpath \"/System/Library\"")
  })

  test("profile includes temp directories", () => {
    const profile = generateProfile("/p", [])
    expect(profile).toContain("/tmp")
    expect(profile).toContain("/private/tmp")
  })

  test("profile is valid SBPL starting with version 1", () => {
    const profile = generateProfile("/p", [])
    expect(profile).toContain("(version 1)")
  })
})

// ============================================================
// macOS Sandbox Backend Tests
// ============================================================

describe("macOS sandbox backend", () => {
  test("has correct platform", () => {
    expect(MacOSSandboxBackend.platform).toBe("macos")
  })

  test("getEnforcementLevel returns a value", () => {
    const level = MacOSSandboxBackend.getEnforcementLevel()
    expect(["kernel", "namespace", "application"]).toContain(level)
  })

  test("wrapCommand produces sandbox-exec invocation", () => {
    const cmd = MacOSSandboxBackend.wrapCommand("echo hello", "/Users/test/proj", ["/tmp"])
    expect(cmd).toContain("sandbox-exec")
    expect(cmd).toContain("echo hello")
  })
})

// ============================================================
// macOS Platform Detection Tests
// ============================================================

describe("macOS platform detection", () => {
  test("detectMacOSCapabilities returns valid object", () => {
    const caps = detectMacOSCapabilities()
    expect(typeof caps.sandboxExecAvailable).toBe("boolean")
    expect(typeof caps.fseventsAvailable).toBe("boolean")
  })

  test("getBestBackend returns a valid backend", () => {
    const backend = getBestBackend()
    expect(["landlock", "bubblewrap", "sandbox", "application"]).toContain(backend)
  })
})
