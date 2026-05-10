import { describe, expect, test } from "bun:test"
import { fingerprint, similarity } from "../license/fingerprint"
import { classifyLicense } from "../license/classify"

// ============================================================
// Fingerprinting Tests
// ============================================================

describe("code fingerprinting", () => {
  test("same code produces same fingerprint", () => {
    const code = "function hello() { return 42; }"
    const fp1 = fingerprint(code)
    const fp2 = fingerprint(code)
    expect(fp1.size).toBe(fp2.size)
    expect(similarity(fp1, fp2)).toBe(1)
  })

  test("renamed variables produce similar fingerprint", () => {
    const code1 = "function add(a, b) { return a + b; }"
    const code2 = "function add(x, y) { return x + y; }"
    const fp1 = fingerprint(code1)
    const fp2 = fingerprint(code2)
    const sim = similarity(fp1, fp2)
    expect(sim).toBeGreaterThan(0.5)
  })

  test("whitespace changes don't affect fingerprint", () => {
    const code1 = "function foo(){return 1;}"
    const code2 = "function foo() {\n  return 1;\n}"
    const fp1 = fingerprint(code1)
    const fp2 = fingerprint(code2)
    expect(similarity(fp1, fp2)).toBe(1)
  })

  test("different code produces different fingerprint", () => {
    const code1 = "function add(a, b) { return a + b; }"
    const code2 = "class User { constructor(name) { this.name = name; } }"
    const fp1 = fingerprint(code1)
    const fp2 = fingerprint(code2)
    expect(similarity(fp1, fp2)).toBeLessThan(0.5)
  })

  test("empty code handled gracefully", () => {
    const fp = fingerprint("")
    expect(fp.size).toBe(0)
    expect(similarity(fp, fp)).toBe(0)
  })
})

// ============================================================
// License Classification Tests
// ============================================================

describe("license classification", () => {
  test("GPL-3.0 is copyleft", () => {
    const cls = classifyLicense("GPL-3.0")
    expect(cls.risk).toBe("copyleft")
  })

  test("AGPL-3.0 is copyleft", () => {
    const cls = classifyLicense("AGPL-3.0")
    expect(cls.risk).toBe("copyleft")
  })

  test("LGPL-2.1 is weak copyleft", () => {
    const cls = classifyLicense("LGPL-2.1")
    expect(cls.risk).toBe("weak-copyleft")
  })

  test("MPL-2.0 is weak copyleft", () => {
    const cls = classifyLicense("MPL-2.0")
    expect(cls.risk).toBe("weak-copyleft")
  })

  test("MIT is permissive", () => {
    const cls = classifyLicense("MIT")
    expect(cls.risk).toBe("permissive")
  })

  test("unknown license returns unknown risk", () => {
    const cls = classifyLicense("CUSTOM-1.0")
    expect(cls.risk).toBe("unknown")
  })
})
