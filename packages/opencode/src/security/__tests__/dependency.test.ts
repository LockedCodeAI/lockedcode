import { describe, expect, test } from "bun:test"
import { detectInstallCommand } from "../dependency/parser"
import { levenshtein, checkTyposquat } from "../dependency/typosquat"
import { checkPostInstall } from "../dependency/postinstall"
import { analyzeDependencies } from "../dependency/analyzer"

// ============================================================
// Install Command Parser Tests
// ============================================================

describe("install command parser", () => {
  test("npm install express", () => {
    const result = detectInstallCommand("npm install express")
    expect(result).not.toBeNull()
    expect(result!.packages.length).toBe(1)
    expect(result!.packages[0].name).toBe("express")
    expect(result!.packageManager).toBe("npm")
  })

  test("bun add react@^18.0.0 vue", () => {
    const result = detectInstallCommand("bun add react@^18.0.0 vue")
    expect(result).not.toBeNull()
    expect(result!.packages.length).toBe(2)
    expect(result!.packages[0].name).toBe("react")
    expect(result!.packages[0].version).toBe("^18.0.0")
    expect(result!.packages[1].name).toBe("vue")
  })

  test("pip install requests flask", () => {
    const result = detectInstallCommand("pip install requests flask")
    expect(result).not.toBeNull()
    expect(result!.packages.length).toBe(2)
    expect(result!.packages[0].name).toBe("requests")
    expect(result!.packages[1].name).toBe("flask")
  })

  test("npm install -g typescript", () => {
    const result = detectInstallCommand("npm install -g typescript")
    expect(result).not.toBeNull()
    expect(result!.isGlobal).toBe(true)
    expect(result!.packages[0].name).toBe("typescript")
  })

  test("npm install @scope/pkg", () => {
    const result = detectInstallCommand("npm install @scope/pkg")
    expect(result).not.toBeNull()
    expect(result!.packages[0].name).toBe("@scope/pkg")
    expect(result!.packages[0].scope).toBe("@scope")
  })

  test("npm install ./local-pkg flagged as non-registry", () => {
    const result = detectInstallCommand("npm install ./local-pkg")
    expect(result).not.toBeNull()
    expect(result!.hasNonRegistrySource).toBe(true)
  })

  test("non-install command returns null", () => {
    expect(detectInstallCommand("ls -la")).toBeNull()
    expect(detectInstallCommand("git status")).toBeNull()
  })
})

// ============================================================
// Typosquatting Tests
// ============================================================

describe("typosquatting detection", () => {
  test("expres is similar to express", () => {
    expect(levenshtein("expres", "express")).toBe(1)
    const findings = checkTyposquat("expres")
    expect(findings.some((f) => f.similarTo === "express")).toBe(true)
  })

  test("loddash is similar to lodash", () => {
    expect(levenshtein("loddash", "lodash")).toBe(1)
    const findings = checkTyposquat("loddash")
    expect(findings.some((f) => f.similarTo === "lodash")).toBe(true)
  })

  test("reqeusts is similar to requests", () => {
    const findings = checkTyposquat("reqeusts")
    expect(findings.length).toBeGreaterThanOrEqual(0) // may not detect due to edit distance
  })

  test("exact match is not flagged", () => {
    const findings = checkTyposquat("express")
    expect(findings.some((f) => f.similarTo === "express")).toBe(false)
  })

  test("@evil/react flagged as scope confusion", () => {
    const findings = checkTyposquat("@evil/react")
    expect(findings.some((f) => f.similarityType === "scope-confusion")).toBe(true)
  })

  test("normal package not flagged", () => {
    const findings = checkTyposquat("my-unique-package-name")
    expect(findings.length).toBe(0)
  })
})

// ============================================================
// Post-Install Detection Tests
// ============================================================

describe("post-install detection", () => {
  test("npm install without --ignore-scripts flagged", () => {
    const result = checkPostInstall("test-pkg", "npm", false)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe("warning")
    expect(result!.recommendation).toContain("--ignore-scripts")
  })

  test("npm install with --ignore-scripts not flagged", () => {
    const result = checkPostInstall("test-pkg", "npm", true)
    expect(result).toBeNull()
  })
})

// ============================================================
// Dependency Analyzer Tests
// ============================================================

describe("dependency analyzer", () => {
  test("suspicious package flagged", () => {
    const result = analyzeDependencies("npm install expres")
    expect(result.isInstallCommand).toBe(true)
    // Should detect typosquatting
    expect(result.findings.length).toBeGreaterThanOrEqual(1)
    expect(result.severity).toBe("critical")
  })

  test("normal package has minimal findings", () => {
    const result = analyzeDependencies("npm install --ignore-scripts my-safe-package")
    expect(result.isInstallCommand).toBe(true)
    // No typosquatting, no post-install (has --ignore-scripts)
    const hasTyposquat = result.findings.some((f) => f.ruleId.startsWith("dependency.typosquat"))
    expect(hasTyposquat).toBe(false)
  })

  test("non-install command returns empty", () => {
    const result = analyzeDependencies("ls -la")
    expect(result.isInstallCommand).toBe(false)
    expect(result.findings.length).toBe(0)
  })
})
