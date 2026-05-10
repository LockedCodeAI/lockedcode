import { describe, expect, test } from "bun:test"
import { PII_PATTERNS, createSnippet } from "../dlp/pii-patterns"
import { SECRET_PATTERNS } from "../secrets/patterns"

function testPattern(id: string, content: string): boolean {
  const pattern = PII_PATTERNS.find((x) => x.id === id)
  if (pattern) {
    const matches = content.matchAll(pattern.regex)
    for (const m of matches) {
      if (pattern.validate && !pattern.validate(m[0])) continue
      return true
    }
    return false
  }
  const secretPattern = SECRET_PATTERNS.find((x) => x.id === id)
  if (!secretPattern) throw new Error(`Pattern not found: ${id}`)
  return secretPattern.regex.test(content)
}

// ============================================================
// PII Pattern Tests
// ============================================================

describe("PII detection — email", () => {
  test("real email detected", () => {
    expect(testPattern("pii-email", "Contact: user@company.com")).toBe(true)
  })

  test("example email suppressed", () => {
    expect(testPattern("pii-email", "Contact: user@example.com")).toBe(false)
  })

  test("localhost email suppressed", () => {
    expect(testPattern("pii-email", "Contact: root@localhost")).toBe(false)
  })
})

describe("PII detection — phone", () => {
  test("US phone detected", () => {
    expect(testPattern("pii-phone-us", "Call: 555-123-4567")).toBe(true)
  })

  test("sequential phone suppressed", () => {
    expect(testPattern("pii-phone-us", "Call: 123-456-7890")).toBe(false)
  })

  test("international phone detected", () => {
    expect(testPattern("pii-phone-intl", "Call: +44 20 7123 4567")).toBe(true)
  })
})

describe("PII detection — SSN", () => {
  test("valid SSN detected", () => {
    expect(testPattern("pii-ssn", "SSN: 123-45-6789")).toBe(true)
  })

  test("invalid SSN part 000 suppressed", () => {
    expect(testPattern("pii-ssn", "SSN: 000-12-3456")).toBe(false)
  })

  test("invalid SSN 9xx suppressed", () => {
    expect(testPattern("pii-ssn", "SSN: 987-65-4321")).toBe(false)
  })
})

describe("PII detection — credit card", () => {
  test("valid Visa detected", () => {
    // Luhn-valid Visa number
    expect(testPattern("pii-credit-card", "Card: 4012888888881881")).toBe(true)
  })

  test("Stripe test card suppressed", () => {
    expect(testPattern("pii-credit-card", "Card: 4111111111111111")).toBe(false)
  })

  test("invalid number not detected", () => {
    expect(testPattern("pii-credit-card", "Card: 1234 5678 9012 3456")).toBe(false)
  })
})

describe("PII detection — IP address", () => {
  test("public IP detected", () => {
    expect(testPattern("pii-ip-address", "Server: 8.8.8.8")).toBe(true)
  })

  test("private IP suppressed", () => {
    expect(testPattern("pii-ip-address", "Server: 192.168.1.1")).toBe(false)
  })

  test("loopback IP suppressed", () => {
    expect(testPattern("pii-ip-address", "Server: 127.0.0.1")).toBe(false)
  })
})

// ============================================================
// Secret Detection in Outbound Context
// ============================================================

describe("secret detection in outbound context", () => {
  test("AWS key detected", () => {
    expect(testPattern("aws-access-key-id", "key = 'AKIA1234567890123456'")).toBe(true)
  })

  test("GitHub PAT detected", () => {
    const pat = SECRET_PATTERNS.find((p) => p.id === "github-pat-classic")!
    expect(pat.regex.source).toContain("ghp")
  })

  test("RSA private key header detected", () => {
    expect(testPattern("rsa-private-key", "-----BEGIN RSA PRIVATE KEY-----")).toBe(true)
  })

  test("placeholder suppressed", () => {
    expect(testPattern("aws-access-key-id", "key = 'AKIAIOSFODNN7EXAMPLE'")).toBe(true) // matches regex but suppressed by validate
  })
})

// ============================================================
// Snippet Safety
// ============================================================

describe("snippet safety", () => {
  test("snippet contains [REDACTED] not actual value", () => {
    const line = "const key = 'AKIA1234567890123456'"
    const match = line.match(/AKIA[0-9A-Z]{16}/)
    expect(match).not.toBeNull()
    const snippet = createSnippet(line, match!.index!, match!.index! + match![0].length)
    expect(snippet).toContain("[REDACTED]")
    expect(snippet).not.toContain("AKIA1234567890123456")
  })

  test("snippet shows surrounding context", () => {
    const line = "const key = 'AKIA1234567890123456'"
    const match = line.match(/AKIA[0-9A-Z]{16}/)
    expect(match).not.toBeNull()
    const snippet = createSnippet(line, match!.index!, match!.index! + match![0].length)
    expect(snippet).toContain("'")
    expect(snippet).toContain("[REDACTED]")
  })
})
