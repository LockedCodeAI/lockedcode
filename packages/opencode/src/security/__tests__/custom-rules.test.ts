import { describe, expect, test } from "bun:test"
import { CustomRuleFileSchema, CustomRuleSchema, type CustomRule } from "../rules/schema"
import { testRule, formatTestResults } from "../rules/tester"

// ============================================================
// Schema Validation Tests
// ============================================================

describe("custom rule schema", () => {
  test("valid rule passes", () => {
    const result = CustomRuleSchema.safeParse({
      id: "test-rule",
      name: "Test Rule",
      type: "content",
      pattern: "test.*pattern",
      severity: "high",
      description: "A test rule",
    })
    expect(result.success).toBe(true)
  })

  test("missing required id fails", () => {
    const result = CustomRuleSchema.safeParse({
      name: "Test",
      type: "content",
      pattern: "test",
      severity: "high",
      description: "Test",
    })
    expect(result.success).toBe(false)
  })

  test("invalid severity fails", () => {
    const result = CustomRuleSchema.safeParse({
      id: "test", name: "Test", type: "content", pattern: "test",
      severity: "extreme", description: "Test",
    })
    expect(result.success).toBe(false)
  })

  test("invalid type fails", () => {
    const result = CustomRuleSchema.safeParse({
      id: "test", name: "Test", type: "regex", pattern: "test",
      severity: "high", description: "Test",
    })
    expect(result.success).toBe(false)
  })

  test("unknown fields allowed for forward compat", () => {
    const result = CustomRuleSchema.safeParse({
      id: "test", name: "Test", type: "content", pattern: "test",
      severity: "high", description: "Test", futureField: "value",
    })
    expect(result.success).toBe(true)
  })

  test("valid rule file passes", () => {
    const result = CustomRuleFileSchema.safeParse({
      rules: [
        { id: "r1", name: "R1", type: "content", pattern: "p1", severity: "high", description: "D1" },
        { id: "r2", name: "R2", type: "command", pattern: "p2", severity: "warning", description: "D2" },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// Rule Testing Framework Tests
// ============================================================

describe("rule testing framework", () => {
  const makeRule = (overrides: Partial<CustomRule> = {}): CustomRule => ({
    id: "test-rule",
    name: "Test Rule",
    type: "content",
    regex: /secret/i,
    severity: "high",
    languages: undefined,
    description: "Test description",
    remediation: "Fix it",
    tags: [],
    enabled: true,
    testCases: { shouldMatch: ["my secret value"], shouldNotMatch: ["public value"] },
    source: "test",
    ...overrides,
  })

  test("shouldMatch case passes", () => {
    const result = testRule(makeRule())
    expect(result.passed).toBe(2)
    expect(result.failed).toBe(0)
  })

  test("shouldMatch case fails when no match", () => {
    const rule = makeRule({
      regex: /notfound/i,
      testCases: { shouldMatch: ["this won't match"], shouldNotMatch: [] },
    })
    const result = testRule(rule)
    expect(result.failed).toBe(1)
    expect(result.failures[0].type).toBe("shouldMatch")
  })

  test("shouldNotMatch case passes when no match", () => {
    const rule = makeRule({
      regex: /secret/i,
      testCases: { shouldMatch: [], shouldNotMatch: ["public value"] },
    })
    const result = testRule(rule)
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(0)
  })

  test("shouldNotMatch case fails when it matches", () => {
    const rule = makeRule({
      regex: /secret/i,
      testCases: { shouldMatch: [], shouldNotMatch: ["my secret value"] },
    })
    const result = testRule(rule)
    expect(result.failed).toBe(1)
    expect(result.failures[0].type).toBe("shouldNotMatch")
  })

  test("rule with no test cases is skipped", () => {
    const rule = makeRule({ testCases: undefined })
    const result = testRule(rule)
    expect(result.skipped).toBe(true)
    expect(result.passed).toBe(0)
    expect(result.failed).toBe(0)
  })

  test("formatTestResults includes rule IDs", () => {
    const rule = makeRule()
    const result = testRule(rule)
    const formatted = formatTestResults({
      filepath: "/test/path.json",
      valid: true,
      rules: [result],
      totalPassed: result.passed,
      totalFailed: result.failed,
    })
    expect(formatted).toContain("test-rule")
    expect(formatted).toContain("✓")
  })
})
