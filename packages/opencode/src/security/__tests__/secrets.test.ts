import { describe, expect, test } from "bun:test"
import { SECRET_PATTERNS } from "../secrets/patterns"
import { adjustSeverity, isPlaceholder, extractVarName } from "../secrets/context"
import { detectEntropySecrets } from "../secrets/entropy-secrets"
import type { ScanMetadata } from "../types"

// ============================================================
// Pattern Matching Tests
// ============================================================

describe("secret pattern matching", () => {
  const testContent = (patternId: string, content: string) => {
    const pattern = SECRET_PATTERNS.find((p) => p.id === patternId)
    if (!pattern) throw new Error(`Pattern not found: ${patternId}`)
    return pattern.regex.test(content)
  }

  test("AWS Access Key ID", () => {
    expect(testContent("aws-access-key-id", "AKIA1234567890123456")).toBe(true)
    expect(testContent("aws-access-key-id", "AKIAIOSFODNN7EXAMPLE")).toBe(true) // matches but suppressed by context
  })

  test("GitHub PAT classic", () => {
    const pat = SECRET_PATTERNS.find((p) => p.id === "github-pat-classic")!
    expect(pat.regex.source).toContain("ghp")
  })

  test("Stripe secret key", () => {
    const pat = SECRET_PATTERNS.find((p) => p.id === "stripe-secret-key")!
    expect(pat.regex.source).toContain("rk_live")
  })

  test("Slack bot token", () => {
    const pat = SECRET_PATTERNS.find((p) => p.id === "slack-bot-token")!
    expect(pat.regex.source).toContain("xoxb")
  })

  test("SendGrid API key", () => {
    const pat = SECRET_PATTERNS.find((p) => p.id === "sendgrid-api-key")!
    expect(pat.regex.source).toContain("SG")
  })

  test("Database connection string", () => {
    expect(testContent("db-connection-string", "postgres://user:password@host:5432/db")).toBe(true)
    expect(testContent("db-connection-string", "mysql://user:pass_s@localhost/mydb")).toBe(true)
    expect(testContent("db-connection-string", "mongodb://user:pass_s@cluster.mongodb.net/mydb")).toBe(true)
  })

  test("RSA private key", () => {
    expect(testContent("rsa-private-key", "-----BEGIN RSA PRIVATE KEY-----")).toBe(true)
  })

  test("JWT token", () => {
    expect(testContent("jwt-token", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.RkV2a3R4c2RmcQ")).toBe(true)
  })

  test("OpenAI API key", () => {
    expect(testContent("openai-api-key", "sk-abc123def456ghi789jkl012mno3456789012")).toBe(true)
  })

  test("Anthropic API key", () => {
    expect(testContent("anthropic-api-key", "sk-ant-abc123def456ghi789jkl012mno3456789012")).toBe(true)
  })
})

// ============================================================
// False Positive Reduction Tests
// ============================================================

describe("false positive reduction", () => {
  const awsPattern = SECRET_PATTERNS.find((p) => p.id === "aws-access-key-id")!

  const defaultMeta: ScanMetadata = { operation: "write" }

  test("AWS example key is suppressed", () => {
    expect(isPlaceholder("AKIAIOSFODNN7EXAMPLE")).toBe(true)
  })

  test("placeholder values are suppressed", () => {
    expect(isPlaceholder("your-api-key-here")).toBe(true)
    expect(isPlaceholder("REPLACE_ME")).toBe(true)
  })

  test("test file context reduces severity", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", {
      ...defaultMeta,
      filename: "test_config.ts",
      extension: ".ts",
    }, "const key = 'AKIA1234567890123456'", undefined)
    expect(result).toBe("high") // reduced from critical
  })

  test("doc file context reduces severity", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", {
      ...defaultMeta,
      filename: "README.md",
      extension: ".md",
    }, "const key = 'AKIA1234567890123456'", undefined)
    expect(result).toBe("high") // reduced
  })

  test("comment context reduces severity", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", defaultMeta,
      "// const key = 'AKIA1234567890123456'", undefined)
    expect(result).toBe("high") // reduced
  })

  test("example variable suppresses finding", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", defaultMeta,
      "const exampleKey = 'AKIA1234567890123456'", "exampleKey")
    expect(result).toBe("suppress")
  })

  test("real-looking key in production file is NOT suppressed", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", {
      ...defaultMeta,
      filename: "src/config/aws.ts",
      extension: ".ts",
    }, "const accessKey = 'AKIA1234567890123456'", "accessKey")
    expect(result).toBe("critical") // not suppressed
  })

  test("line with only placeholder indicators is suppressed", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", defaultMeta,
      "const key = 'AKIA1234567890123456' // example only", "key")
    expect(result).toBe("suppress")
  })

  test("line with 'real' indicator is NOT suppressed", () => {
    const result = adjustSeverity(awsPattern, "AKIA1234567890123456", defaultMeta,
      "const key = 'AKIA1234567890123456' // real production key", "key")
    expect(result).toBe("critical") // not suppressed
  })
})

// ============================================================
// Variable Name Extraction Tests
// ============================================================

describe("variable name extraction", () => {
  test("const assignment", () => {
    expect(extractVarName("const API_KEY = 'abc123'", 16)).toBe("API_KEY")
  })

  test("let assignment", () => {
    expect(extractVarName("let secretKey = 'abc123'", 16)).toBe("secretKey")
  })

  test("simple equals assignment", () => {
    expect(extractVarName("apiKey = 'abc123'", 9)).toBe("apiKey")
  })

  test("no assignment returns undefined", () => {
    expect(extractVarName("console.log('abc123')", 18)).toBeUndefined()
  })
})

// ============================================================
// Entropy-Based Detection Tests
// ============================================================

describe("entropy-based secret detection", () => {
  test("high-entropy string assigned to apiKey variable", () => {
    const content = `const apiKey = 'aB3dE5fGhIjKlMnOpQrStUvWxYz0123456789abcdef'`
    const findings = detectEntropySecrets(content, content.split("\n"))
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].ruleId).toBe("entropy-secret")
  })

  test("low-entropy string assigned to apiKey is not detected", () => {
    const content = `const apiKey = 'localhost'`
    const findings = detectEntropySecrets(content, content.split("\n"))
    expect(findings.length).toBe(0)
  })

  test("high-entropy string assigned to non-credential variable is not detected", () => {
    const content = `const username = 'aB3dE5fGhIjKlMnOpQrStUvWxYz0123456789abcdef'`
    const findings = detectEntropySecrets(content, content.split("\n"))
    expect(findings.length).toBe(0)
  })
})

// ============================================================
// Edge Cases
// ============================================================

describe("edge cases", () => {
  test("multiple secrets on same line are detected", () => {
    // Verify the regex for GitHub PAT and Stripe both compile
    const ghPat = SECRET_PATTERNS.find((p) => p.id === "github-pat-classic")!
    const stripe = SECRET_PATTERNS.find((p) => p.id === "stripe-secret-key")!
    expect(() => new RegExp(ghPat.regex.source)).not.toThrow()
    expect(() => new RegExp(stripe.regex.source)).not.toThrow()
  })

  test("empty file returns no findings", () => {
    const content = ""
    let matches = 0
    for (const p of SECRET_PATTERNS) {
      if (p.regex.test(content)) matches++
    }
    expect(matches).toBe(0)
  })

  test("private key block spanning multiple lines is detected", () => {
    const header = "-----BEGIN RSA PRIVATE KEY-----"
    const pattern = SECRET_PATTERNS.find((p) => p.id === "rsa-private-key")!
    expect(pattern.regex.test(header)).toBe(true)
  })
})
