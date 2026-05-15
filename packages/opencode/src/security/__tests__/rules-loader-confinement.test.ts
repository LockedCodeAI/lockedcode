import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { loadCustomRules } from "../rules/loader"
import { clearExternalPathWhitelist } from "../confinement/whitelist"
import fs from "fs"
import path from "path"
import os from "os"

const tmpDir = path.join(os.tmpdir(), "lockedcode-rules-test-" + process.pid)

beforeEach(() => {
  clearExternalPathWhitelist()
  fs.mkdirSync(path.join(tmpDir, ".lockedcode", "rules"), { recursive: true })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("rules loader confinement", () => {
  test("loads project-local rules successfully", () => {
    const ruleFile = path.join(tmpDir, ".lockedcode", "rules", "test.json")
    fs.writeFileSync(ruleFile, JSON.stringify({
      rules: [{
        id: "test-rule-1",
        name: "Test Rule",
        type: "content",
        pattern: "test_pattern",
        severity: "warning",
        description: "A test rule",
      }],
    }))
    const rules = loadCustomRules(tmpDir)
    expect(rules.length).toBe(1)
    expect(rules[0].id).toBe("test-rule-1")
  })

  test("does not access home directory without flag", () => {
    let homedirCalled = false
    const origHomedir = os.homedir
    os.homedir = () => {
      homedirCalled = true
      return origHomedir()
    }
    try {
      loadCustomRules(tmpDir)
      expect(homedirCalled).toBe(false)
    } finally {
      os.homedir = origHomedir
    }
  })

  test("allowGlobalRules flag throws not-implemented error", () => {
    expect(() => {
      loadCustomRules(tmpDir, undefined, { allowGlobalRules: true })
    }).toThrow("not implemented")
  })

  test("rejects malformed regex and continues loading", () => {
    const ruleFile = path.join(tmpDir, ".lockedcode", "rules", "bad-regex.json")
    fs.writeFileSync(ruleFile, JSON.stringify({
      rules: [
        {
          id: "bad-regex-rule",
          name: "Bad Regex",
          type: "content",
          pattern: "(unclosed-group",
          severity: "warning",
          description: "Should fail compilation",
        },
        {
          id: "good-rule",
          name: "Good Rule",
          type: "content",
          pattern: "valid_pattern",
          severity: "warning",
          description: "Should load fine",
        },
      ],
    }))
    const rules = loadCustomRules(tmpDir)
    expect(rules.length).toBe(1)
    expect(rules[0].id).toBe("good-rule")
  })

  test("rejects regex pattern exceeding max length", () => {
    const ruleFile = path.join(tmpDir, ".lockedcode", "rules", "long-regex.json")
    const longPattern = "a".repeat(1025)
    fs.writeFileSync(ruleFile, JSON.stringify({
      rules: [{
        id: "long-regex-rule",
        name: "Long Regex",
        type: "content",
        pattern: longPattern,
        severity: "warning",
        description: "Should be rejected",
      }],
    }))
    const rules = loadCustomRules(tmpDir)
    expect(rules.length).toBe(0)
  })

  test("produces clean load with no rules files on disk", () => {
    fs.rmSync(path.join(tmpDir, ".lockedcode", "rules"), { recursive: true, force: true })
    const rules = loadCustomRules(tmpDir)
    expect(rules.length).toBe(0)
  })
})
