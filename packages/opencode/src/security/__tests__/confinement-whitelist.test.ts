import { describe, expect, test, beforeEach } from "bun:test"
import {
  registerExternalPath,
  isExternalPathWhitelisted,
  clearExternalPathWhitelist,
  getExternalPaths,
  checkPathSync,
} from "../confinement/whitelist"
import os from "os"
import path from "path"

describe("Confinement.registerExternalPath", () => {
  beforeEach(() => {
    clearExternalPathWhitelist()
  })

  test("registers a valid absolute path", () => {
    const p = path.join(os.homedir(), ".local", "share", "lockedcode")
    registerExternalPath(p, "test reason")
    const entries = getExternalPaths()
    expect(entries.size).toBe(1)
  })

  test("idempotent — registering same path twice is a no-op", () => {
    const p = path.join(os.homedir(), ".local", "share", "lockedcode")
    registerExternalPath(p, "first")
    registerExternalPath(p, "second")
    const entries = getExternalPaths()
    expect(entries.size).toBe(1)
    expect(entries.values().next().value).toBe("first")
  })

  test("supports tilde expansion", () => {
    registerExternalPath("~/.local/share/lockedcode", "tilde test")
    const entries = getExternalPaths()
    expect(entries.size).toBe(1)
    const registeredPath = entries.keys().next().value!
    expect(registeredPath.startsWith(os.homedir())).toBe(true)
  })

  test("ignores paths with null bytes", () => {
    registerExternalPath("/some/path\0/evil", "null byte test")
    const entries = getExternalPaths()
    expect(entries.size).toBe(0)
  })

  test("first registration logged at info level", () => {
    registerExternalPath("/tmp/test-path-for-whitelist", "info log test")
    expect(getExternalPaths().has("/tmp/test-path-for-whitelist")).toBe(true)
  })
})

describe("isExternalPathWhitelisted", () => {
  beforeEach(() => {
    clearExternalPathWhitelist()
  })

  test("returns reason for directly registered path", () => {
    registerExternalPath("/tmp/test-whitelist", "direct test")
    const reason = isExternalPathWhitelisted("/tmp/test-whitelist")
    expect(reason).toBe("direct test")
  })

  test("returns reason for subpath of registered directory", () => {
    registerExternalPath("/tmp/test-whitelist-dir", "subpath test")
    const reason = isExternalPathWhitelisted("/tmp/test-whitelist-dir/child.db")
    expect(reason).toBe("subpath test")
  })

  test("returns undefined for unregistered path", () => {
    const reason = isExternalPathWhitelisted("/some/random/path")
    expect(reason).toBeUndefined()
  })

  test("does not match path prefix without separator", () => {
    registerExternalPath("/tmp/project", "prefix test")
    const reason = isExternalPathWhitelisted("/tmp/project-foo/bar")
    expect(reason).toBeUndefined()
  })
})

describe("checkPathSync with whitelist", () => {
  beforeEach(() => {
    clearExternalPathWhitelist()
  })

  test("allows whitelisted path outside project root", () => {
    const dbPath = path.join(os.homedir(), ".local", "share", "lockedcode", "lockedcode-local.db")
    registerExternalPath(path.join(os.homedir(), ".local", "share", "lockedcode"), "CLI state")
    const result = checkPathSync(dbPath, "read", process.cwd())
    expect(result.allowed).toBe(true)
    expect(result.reason).toContain("whitelisted external path")
  })

  test("denies non-whitelisted path outside project root", () => {
    const result = checkPathSync("/etc/passwd", "read", process.cwd())
    expect(result.allowed).toBe(false)
  })

  test("allows path inside project root without whitelist", () => {
    const cwd = process.cwd()
    const result = checkPathSync(path.join(cwd, "package.json"), "read", cwd)
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe("inside project root")
  })

  test("rejects null-byte path", () => {
    const result = checkPathSync("/some/path\0/evil", "read", process.cwd())
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("null bytes")
  })

  test("unregistered path fails confinement", () => {
    const result = checkPathSync(path.join(os.homedir(), ".config", "other-app", "config.json"), "read", process.cwd())
    expect(result.allowed).toBe(false)
  })
})

describe("clearExternalPathWhitelist", () => {
  test("removes all registered paths", () => {
    registerExternalPath("/tmp/a", "a")
    registerExternalPath("/tmp/b", "b")
    expect(getExternalPaths().size).toBe(2)
    clearExternalPathWhitelist()
    expect(getExternalPaths().size).toBe(0)
  })
})
