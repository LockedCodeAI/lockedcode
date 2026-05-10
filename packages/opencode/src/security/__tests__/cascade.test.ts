import { describe, expect, test, afterEach } from "bun:test"
import { inheritPolicy, verifyCascade } from "../cascade/policy-cascade"
import { registerAgent, getAgentContext, deregisterAgent, getParentChain, clearRegistry } from "../cascade/registry"
import type { Policy } from "../policy/schema"

const defaultPolicy: Policy = {
  security: {
    strictness: "standard",
    enabled: true,
    confinement: { enabled: true, preApprovedPaths: ["/tmp", "~/.npm", "~/.bun", "~/.cache"] },
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
      sensitivityPatterns: {
        restricted: [".env", ".env.*", "credentials.*", "secrets.*", "*.key", "*.pem"],
        confidential: ["*.env.local", "docker-compose.override.yml"],
        internal: ["*.config", "Dockerfile"],
      },
      piiCategories: { email: true, phone: true, ssn: true, creditCard: true, ipAddress: true },
    },
    trust: { autoApproveBelow: 20, promptAbove: 50, blockAbove: 90 },
    audit: { enabled: true, retentionDays: 90, logLevel: "all" },
    shell: { additionalBlockedPatterns: [], allowedCommands: [] },
    models: { approved: [], blocked: [] },
  },
}

// ============================================================
// Policy Inheritance Tests
// ============================================================

describe("policy inheritance", () => {
  test("child inherits parent's strictness", () => {
    const child = inheritPolicy(defaultPolicy)
    expect(child.security.strictness).toBe("standard")
  })

  test("child cannot escalate: parent=strict, child=permissive → child gets strict", () => {
    const parent: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "strict" } }
    const child = inheritPolicy(parent, { security: { strictness: "permissive" as const } } as Partial<Policy>)
    expect(child.security.strictness).toBe("strict")
  })

  test("child can be more restrictive: parent=permissive, child=strict → child gets strict", () => {
    const parent: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "permissive" as const } }
    const child = inheritPolicy(parent, { security: { strictness: "strict" as const } } as Partial<Policy>)
    expect(child.security.strictness).toBe("strict")
  })

  test("child cannot add pre-approved paths", () => {
    const child = inheritPolicy(defaultPolicy, {
      security: { confinement: { preApprovedPaths: ["/tmp", "/custom/path"] } },
    } as Partial<Policy>)
    expect(child.security.confinement.preApprovedPaths).not.toContain("/custom/path")
    expect(child.security.confinement.preApprovedPaths).toContain("/tmp")
  })

  test("child can remove pre-approved paths", () => {
    const child = inheritPolicy(defaultPolicy, {
      security: { confinement: { preApprovedPaths: [] } },
    } as unknown as Partial<Policy>)
    expect(child.security.confinement.preApprovedPaths.length).toBe(0)
  })

  test("child cannot lower trust thresholds to less restrictive", () => {
    const child = inheritPolicy(defaultPolicy, {
      security: { trust: { autoApproveBelow: 30, promptAbove: 40, blockAbove: 80 } },
    } as Partial<Policy>)
    expect(child.security.trust.autoApproveBelow).toBe(20)
    expect(child.security.trust.promptAbove).toBe(50)
    expect(child.security.trust.blockAbove).toBe(80)
  })

  test("child cannot disable scanners parent has enabled", () => {
    const child = inheritPolicy(defaultPolicy, {
      security: { scanning: { semgrep: { enabled: false, timeout: 30 }, yara: { enabled: true, timeout: 15 }, injection: { enabled: true, sensitivity: "medium" } } },
    } as Partial<Policy>)
    expect(child.security.scanning.semgrep.enabled).toBe(true)
  })

  test("child cannot disable DLP if parent has it enabled", () => {
    const child = inheritPolicy(defaultPolicy, {
      security: { dlp: { enabled: false } },
    } as Partial<Policy>)
    expect(child.security.dlp.enabled).toBe(true)
  })
})

// ============================================================
// Verification Tests
// ============================================================

describe("cascade verification", () => {
  test("valid cascade passes verification", () => {
    const result = verifyCascade(defaultPolicy, defaultPolicy)
    expect(result.valid).toBe(true)
  })

  test("child less restrictive fails verification", () => {
    const parent: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "strict" as const } }
    const child: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "standard" as const } }
    const result = verifyCascade(parent, child)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  test("child more restrictive passes verification", () => {
    const parent: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "permissive" as const } }
    const child: Policy = { ...defaultPolicy, security: { ...defaultPolicy.security, strictness: "strict" as const } }
    const result = verifyCascade(parent, child)
    expect(result.valid).toBe(true)
  })
})

// ============================================================
// Agent Registration Tests
// ============================================================

describe("agent registration", () => {
  afterEach(() => {
    clearRegistry()
  })

  test("register root agent", () => {
    registerAgent("root-1", null, "session-1", defaultPolicy, "/project")
    const ctx = getAgentContext("root-1")
    expect(ctx).not.toBeNull()
    expect(ctx!.parentAgentId).toBeNull()
    expect(ctx!.sessionId).toBe("session-1")
  })

  test("register child agent with parent", () => {
    registerAgent("parent", null, "parent-session", defaultPolicy, "/project")
    registerAgent("child", "parent", "child-session", defaultPolicy, "/project")
    const ctx = getAgentContext("child")
    expect(ctx).not.toBeNull()
    expect(ctx!.parentAgentId).toBe("parent")
  })

  test("registering child with non-existent parent throws", () => {
    expect(() => {
      registerAgent("orphan", "nonexistent", "session", defaultPolicy, "/project")
    }).toThrow()
  })

  test("get parent chain returns correct hierarchy", () => {
    registerAgent("root", null, "s1", defaultPolicy, "/project")
    registerAgent("middle", "root", "s2", defaultPolicy, "/project")
    registerAgent("leaf", "middle", "s3", defaultPolicy, "/project")
    const chain = getParentChain("leaf")
    expect(chain).toEqual(["leaf", "middle", "root"])
  })

  test("deregister removes agent", () => {
    registerAgent("temp", null, "s1", defaultPolicy, "/project")
    expect(getAgentContext("temp")).not.toBeNull()
    deregisterAgent("temp")
    expect(getAgentContext("temp")).toBeNull()
  })
})
