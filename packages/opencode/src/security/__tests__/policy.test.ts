import { describe, expect, test } from "bun:test"
import { PolicyDocumentSchema, SecuritySectionSchema } from "../policy/schema"
import { loadPolicy, DEFAULT_POLICY } from "../policy/loader"

// ============================================================
// Schema Validation Tests
// ============================================================

describe("policy schema validation", () => {
  test("valid complete policy passes", () => {
    const result = PolicyDocumentSchema.safeParse({
      security: {
        strictness: "standard",
        confinement: { enabled: true, preApprovedPaths: ["/custom/path"] },
      },
    })
    expect(result.success).toBe(true)
  })

  test("empty file with defaults passes", () => {
    const result = PolicyDocumentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test("empty security section passes", () => {
    const result = SecuritySectionSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test("default strictness is standard", () => {
    const result = SecuritySectionSchema.parse({})
    expect(result.strictness).toBe("standard")
  })

  test("invalid strictness fails", () => {
    const result = PolicyDocumentSchema.safeParse({ security: { strictness: "extreme" as any } })
    expect(result.success).toBe(false)
  })

  test("valid strictness values pass", () => {
    expect(PolicyDocumentSchema.safeParse({ security: { strictness: "strict" } }).success).toBe(true)
    expect(PolicyDocumentSchema.safeParse({ security: { strictness: "standard" } }).success).toBe(true)
    expect(PolicyDocumentSchema.safeParse({ security: { strictness: "permissive" } }).success).toBe(true)
  })
})

// ============================================================
// Policy Loading Tests
// ============================================================

describe("policy loading", () => {
  test("no file returns defaults", () => {
    const { policy } = loadPolicy("/nonexistent-path-for-testing")
    expect(policy.security.strictness).toBe("standard")
    expect(policy.security.enabled).toBe(true)
    expect(policy.security.confinement.enabled).toBe(true)
  })

  test("default confinement has pre-approved paths", () => {
    const { policy } = loadPolicy()
    expect(policy.security.confinement.preApprovedPaths.length).toBeGreaterThan(0)
  })

  test("default scanning has all scanners enabled", () => {
    const { policy } = loadPolicy()
    expect(policy.security.scanning.semgrep.enabled).toBe(true)
    expect(policy.security.scanning.yara.enabled).toBe(true)
    expect(policy.security.scanning.entropy.enabled).toBe(true)
    expect(policy.security.scanning.injection.sensitivity).toBe("medium")
  })

  test("sources includes built-in defaults", () => {
    const { sources } = loadPolicy()
    expect(sources).toContain("built-in defaults")
  })
})

// ============================================================
// Action Evaluation Tests
// ============================================================

function evaluateAction(severity: string, strictness: string): string {
  if (severity === "info") return "allow"
  if (severity === "warning") {
    if (strictness === "permissive") return "allow"
    return "prompt"
  }
  if (severity === "high") {
    if (strictness === "strict") return "deny"
    if (strictness === "permissive") return "prompt"
    return "prompt"
  }
  if (severity === "critical") {
    if (strictness === "permissive") return "prompt"
    return "deny"
  }
  return "allow"
}

describe("action evaluation", () => {
  test("info always passes", () => {
    expect(evaluateAction("info", "strict")).toBe("allow")
    expect(evaluateAction("info", "standard")).toBe("allow")
    expect(evaluateAction("info", "permissive")).toBe("allow")
  })

  test("warning prompts in strict and standard", () => {
    expect(evaluateAction("warning", "strict")).toBe("prompt")
    expect(evaluateAction("warning", "standard")).toBe("prompt")
    expect(evaluateAction("warning", "permissive")).toBe("allow")
  })

  test("high denies in strict, prompts in standard and permissive", () => {
    expect(evaluateAction("high", "strict")).toBe("deny")
    expect(evaluateAction("high", "standard")).toBe("prompt")
    expect(evaluateAction("high", "permissive")).toBe("prompt")
  })

  test("critical denies in strict and standard, prompts in permissive", () => {
    expect(evaluateAction("critical", "strict")).toBe("deny")
    expect(evaluateAction("critical", "standard")).toBe("deny")
    expect(evaluateAction("critical", "permissive")).toBe("prompt")
  })
})

// ============================================================
// Model Approval Tests
// ============================================================

function isModelAllowed(modelId: string, approved: string[], blocked: string[]): boolean {
  if (blocked.length > 0 && blocked.some((m) => modelId.includes(m))) return false
  if (approved.length === 0) return true
  return approved.some((m) => modelId.includes(m))
}

describe("model approval", () => {
  test("empty approved list allows all", () => {
    expect(isModelAllowed("gpt-4", [], [])).toBe(true)
    expect(isModelAllowed("claude-3", [], [])).toBe(true)
  })

  test("model on approved list is allowed", () => {
    expect(isModelAllowed("gpt-4", ["gpt-4"], [])).toBe(true)
  })

  test("model not on approved list is blocked", () => {
    expect(isModelAllowed("gpt-4", ["claude-3"], [])).toBe(false)
  })

  test("model on blocked list is denied", () => {
    expect(isModelAllowed("gpt-4", ["gpt-4"], ["gpt-4"])).toBe(false)
  })

  test("partial model ID matching works", () => {
    expect(isModelAllowed("gpt-4-turbo", ["gpt-4"], [])).toBe(true)
    expect(isModelAllowed("gpt-4-turbo", [], ["gpt-4"])).toBe(false)
  })
})

// ============================================================
// Deep Merge Tests
// ============================================================

function deepMerge(target: any, source: any): any {
  if (source === undefined || source === null) return target
  if (target === undefined || target === null) return source
  if (typeof target !== "object" || typeof source !== "object") return source
  if (Array.isArray(target) || Array.isArray(source)) return source
  const result = { ...target }
  for (const key of Object.keys(source)) {
    result[key] = deepMerge(target[key], source[key])
  }
  return result
}

describe("deep merge", () => {
  test("source overrides target", () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3 })
    expect(result).toEqual({ a: 1, b: 3 })
  })

  test("arrays are replaced, not concatenated", () => {
    const result = deepMerge({ items: [1, 2] }, { items: [3] })
    expect(result.items).toEqual([3])
  })

  test("nested objects are deep merged", () => {
    const result = deepMerge({ outer: { a: 1, b: 2 } }, { outer: { c: 3 } })
    expect(result).toEqual({ outer: { a: 1, b: 2, c: 3 } })
  })

  test("undefined source returns target", () => {
    const result = deepMerge({ a: 1 }, undefined)
    expect(result).toEqual({ a: 1 })
  })

  test("null target returns source", () => {
    const result = deepMerge(null, { a: 1 })
    expect(result).toEqual({ a: 1 })
  })
})
