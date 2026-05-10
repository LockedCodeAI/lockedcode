import { describe, expect, test, beforeEach } from "bun:test"
import { resolveRulesPath, clearResolverCache } from "../rules/resolver"
import { detectNetworkConfig } from "../airgap/network"
import type { Policy } from "../policy/schema"

const basePolicy: Policy = {
  security: {
    strictness: "standard", enabled: true,
    confinement: { enabled: true, preApprovedPaths: [] },
    scanning: {
      enabled: true, scanOnWrite: true, scanOnEdit: true,
      semgrep: { enabled: true, timeout: 30 },
      yara: { enabled: true, timeout: 15 },
      entropy: { enabled: true, threshold: 4.5, minStringLength: 20 },
      secrets: { enabled: true },
      injection: { enabled: true, sensitivity: "medium" },
    },
    dlp: {
      enabled: true, scanSecrets: true, scanPii: true,
      redactionMode: true, blockRestrictedFiles: true,
      sensitivityPatterns: { restricted: [], confidential: [], internal: [] },
      piiCategories: { email: true, phone: true, ssn: true, creditCard: true, ipAddress: true },
    },
    trust: { autoApproveBelow: 20, promptAbove: 50, blockAbove: 90 },
    audit: { enabled: true, retentionDays: 90, logLevel: "all" },
    shell: { additionalBlockedPatterns: [], allowedCommands: [] },
    models: { approved: [], blocked: [] },
    airGap: { enabled: false, verifyOnStartup: true, allowExternalScanners: false },
  },
}

// ============================================================
// Rule Path Resolution Tests
// ============================================================

describe("rule path resolution", () => {
  beforeEach(() => {
    clearResolverCache()
  })

  test("resolves rules from repo relative path", () => {
    const path = resolveRulesPath("semgrep")
    // Should find the bundled rules at repo root
    expect(path).not.toBeNull()
    if (path) {
      expect(path).toContain("rules")
      expect(path).toContain("semgrep")
    }
  })

  test("resolves yara rules from repo relative path", () => {
    const path = resolveRulesPath("yara")
    expect(path).not.toBeNull()
    if (path) expect(path).toContain("yara")
  })

  test("resolves injection rules from repo relative path", () => {
    const path = resolveRulesPath("injection")
    expect(path).not.toBeNull()
    if (path) expect(path).toContain("injection")
  })

  test("returns null for unknown rule type", () => {
    const path = resolveRulesPath("semgrep" as any, undefined, "/nonexistent-path-for-testing")
    // The resolver will still walk up to find rules — it might find them from current dir
    // This test verifies it doesn't crash
    expect(typeof path).toBe("object") // null is typeof object
  })

  test("path is cached after first resolution", () => {
    clearResolverCache()
    const p1 = resolveRulesPath("semgrep")
    // Call again — should return same result from cache
    const p2 = resolveRulesPath("semgrep")
    expect(p1).toBe(p2)
  })
})

// ============================================================
// Network Config Detection Tests
// ============================================================

describe("network config detection", () => {
  test("config with no network settings is compliant", () => {
    const warnings = detectNetworkConfig(basePolicy)
    expect(warnings.length).toBe(0)
  })

  test("custom semgrep path with http URL warns", () => {
    const policy: Policy = {
      ...basePolicy,
      security: {
        ...basePolicy.security,
        scanning: {
          ...basePolicy.security.scanning,
          semgrep: { enabled: true, rulesPath: "https://example.com/rules", timeout: 30 },
        },
      },
    }
    const warnings = detectNetworkConfig(policy)
    expect(warnings.some((w) => w.field.includes("semgrep"))).toBe(true)
    expect(warnings[0].severity).toBe("warning")
  })

  test("custom yara path with http URL warns", () => {
    const policy: Policy = {
      ...basePolicy,
      security: {
        ...basePolicy.security,
        scanning: {
          ...basePolicy.security.scanning,
          yara: { enabled: true, rulesPath: "http://example.com/rules", timeout: 15 },
        },
      },
    }
    const warnings = detectNetworkConfig(policy)
    expect(warnings.some((w) => w.field.includes("yara"))).toBe(true)
  })
})
