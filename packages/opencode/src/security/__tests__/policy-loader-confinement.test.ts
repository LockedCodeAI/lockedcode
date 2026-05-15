import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { loadPolicy, DEFAULT_POLICY } from "../policy/loader"
import { clearExternalPathWhitelist, registerExternalPath } from "../confinement/whitelist"
import fs from "fs"
import path from "path"
import os from "os"

const tmpDir = path.join(os.tmpdir(), "lockedcode-policy-test-" + process.pid)

beforeEach(() => {
  clearExternalPathWhitelist()
  fs.mkdirSync(path.join(tmpDir, ".lockedcode"), { recursive: true })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("policy loader confinement", () => {
  test("default load uses built-in defaults only (no XDG)", () => {
    const { policy, sources } = loadPolicy(tmpDir)
    expect(sources).toContain("built-in defaults")
    expect(sources.length).toBe(1)
    expect(policy.security.strictness).toBe("standard")
  })

  test("does not read XDG config without flag", () => {
    let homedirCalled = false
    const origHomedir = os.homedir
    os.homedir = () => {
      homedirCalled = true
      return origHomedir()
    }
    try {
      loadPolicy(tmpDir)
      expect(homedirCalled).toBe(false)
    } finally {
      os.homedir = origHomedir
    }
  })

  test("loads project-local policy file", () => {
    const policyFile = path.join(tmpDir, ".lockedcode", "policy.json")
    fs.writeFileSync(policyFile, JSON.stringify({
      security: { strictness: "strict" },
    }))
    const { policy, sources } = loadPolicy(tmpDir)
    expect(policy.security.strictness).toBe("strict")
    expect(sources).toContain(policyFile)
  })

  test("project policy overrides built-in defaults", () => {
    const policyFile = path.join(tmpDir, ".lockedcode", "policy.json")
    fs.writeFileSync(policyFile, JSON.stringify({
      security: { strictness: "permissive" },
    }))
    const { policy } = loadPolicy(tmpDir)
    expect(policy.security.strictness).toBe("permissive")
  })

  test("allowGlobalPolicy flag loads XDG policy when whitelisted", () => {
    const testXdgDir = path.join(tmpDir, "xdg-config", "lockedcode")
    fs.mkdirSync(testXdgDir, { recursive: true })
    const testXdgPolicy = path.join(testXdgDir, "policy.json")
    fs.writeFileSync(testXdgPolicy, JSON.stringify({
      security: { strictness: "permissive" },
    }))

    registerExternalPath(testXdgDir, "test: global policy")

    // Override XDG_CONFIG_HOME so the loader looks in our temp dir
    const origXdg = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = path.join(tmpDir, "xdg-config")
    try {
      const { policy, sources } = loadPolicy(tmpDir, undefined, { allowGlobalPolicy: true })
      expect(sources.some((s) => s.includes("policy.json"))).toBe(true)
      expect(policy.security.strictness).toBe("permissive")
    } finally {
      if (origXdg !== undefined) process.env.XDG_CONFIG_HOME = origXdg
      else delete process.env.XDG_CONFIG_HOME
    }
  })

  test("session overrides are applied last", () => {
    const { policy } = loadPolicy(tmpDir, {
      security: { strictness: "strict" },
    })
    expect(policy.security.strictness).toBe("strict")
  })

  test("merge precedence: project overrides global when both define a key", () => {
    const policyFile = path.join(tmpDir, ".lockedcode", "policy.json")
    fs.writeFileSync(policyFile, JSON.stringify({
      security: { strictness: "strict" },
    }))

    const testXdgDir = path.join(tmpDir, "xdg-merge", "lockedcode")
    fs.mkdirSync(testXdgDir, { recursive: true })
    const testXdgPolicy = path.join(testXdgDir, "policy.json")
    fs.writeFileSync(testXdgPolicy, JSON.stringify({
      security: { strictness: "permissive" },
    }))

    registerExternalPath(testXdgDir, "test: merge precedence")

    const origXdg = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = path.join(tmpDir, "xdg-merge")
    try {
      const { policy } = loadPolicy(tmpDir, undefined, { allowGlobalPolicy: true })
      // Project policy (strict) overrides global (permissive) because project loads after global
      expect(policy.security.strictness).toBe("strict")
    } finally {
      if (origXdg !== undefined) process.env.XDG_CONFIG_HOME = origXdg
      else delete process.env.XDG_CONFIG_HOME
    }
  })
})
