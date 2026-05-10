import type { ScanMetadata } from "../types"
import type { SecretPattern } from "./patterns"

/** Known example/placeholder values that should NOT be flagged as secrets. */
const KNOWN_PLACEHOLDERS = [
  "AKIAIOSFODNN7EXAMPLE",
  "your-api-key-here",
  "your-secret-key-here",
  "your-api-key",
  "replace_me",
  "REPLACE_ME",
  "placeholder",
  "TODO",
  "todo",
  "dummy",
  "fake",
  "sample",
  "test-key",
  "test_secret",
  "test_token",
  "example_key",
  "example-secret",
  "changeme",
  "change_me",
  "CHANGEME",
]

/** Patterns that indicate a value is a placeholder. */
const PLACEHOLDER_PATTERNS = [
  /^x+$/i,
  /^0+$/,
  /^a+$/i,
  /^your[-_]?(key|secret|token|api|password)$/i,
  /^example[-_]?(key|secret|token|api|password)$/i,
  /^test[-_]?(key|secret|token|api|password)$/i,
  /^placeholder$/i,
  /^dummy$/i,
  /^fake$/i,
  /^sample$/i,
]

/** File patterns that suggest test/doc context (lower severity). */
const TEST_FILE_PATTERNS = [
  /test/i, /spec/i, /mock/i, /__tests__/i, /fixture/i,
]

/** File patterns for example/demo files. */
const EXAMPLE_FILE_PATTERNS = [
  /example/i, /sample/i, /demo/i,
]

/** File extensions for documentation files. */
const DOC_EXTENSIONS = new Set([".md", ".rst", ".txt", ".adoc", ".asciidoc"])

/** Env template file names. */
const ENV_TEMPLATE_NAMES = [
  ".env.example", ".env.template", ".env.sample",
  ".env.dist", ".env.local.example",
]

/** Variable names that suggest credential context. */
const CREDENTIAL_VAR_NAMES = [
  /^example/i, /^test/i, /^mock/i, /^fake/i, /^dummy/i, /^sample/i,
]

/**
 * Analyze a matched secret value to determine if it's a known false positive.
 * Returns true if the match should be SUPPRESSED (not reported).
 */
export function isPlaceholder(value: string): boolean {
  const clean = value.trim()
  if (KNOWN_PLACEHOLDERS.includes(clean)) return true
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(clean))) return true
  return false
}

/**
 * Determine the effective severity for a match, considering context.
 * Returns adjusted severity or undefined if the finding should be suppressed entirely.
 */
export function adjustSeverity(
  pattern: SecretPattern,
  value: string,
  metadata: ScanMetadata,
  lineContent: string,
  varName: string | undefined,
): "high" | "critical" | "suppress" {
  // Check for placeholder values
  if (isPlaceholder(value)) return "suppress"

  // Check surrounding line for placeholder indicators
  if (
    /example|test|placeholder|dummy|fake|sample|TODO|FIXME/i.test(lineContent) &&
    !/real|actual|live|prod/i.test(lineContent)
  ) {
    // Line has example/test indicators — suppress unless it says "real" or "live"
    return "suppress"
  }

  // Check variable name context
  if (varName && CREDENTIAL_VAR_NAMES.some((p) => p.test(varName))) {
    return "suppress"
  }

  const filename = metadata.filename ?? ""
  const ext = metadata.extension ?? ""
  let severity = pattern.severity

  // Documentation files: lower severity
  if (DOC_EXTENSIONS.has(ext)) {
    severity = severity === "critical" ? "high" : "warning" as any
    return severity
  }

  // Test/spec files: lower severity
  if (TEST_FILE_PATTERNS.some((p) => p.test(filename))) {
    severity = severity === "critical" ? "high" : "warning" as any
    return severity
  }

  // Example/demo files: lower severity
  if (EXAMPLE_FILE_PATTERNS.some((p) => p.test(filename))) {
    severity = severity === "critical" ? "high" : "warning" as any
    return severity
  }

  // Env template files: lower severity
  if (ENV_TEMPLATE_NAMES.some((name) => filename.endsWith(name))) {
    severity = severity === "critical" ? "high" : "warning" as any
    return severity
  }

  // Check if match is inside a comment
  if (isInsideComment(lineContent, value)) {
    severity = severity === "critical" ? "high" : "warning" as any
    return severity
  }

  return severity
}

/**
 * Check if a matched value appears to be inside a comment.
 */
function isInsideComment(line: string, match: string): boolean {
  const idx = line.indexOf(match)
  if (idx === -1) return false
  const before = line.slice(0, idx).trim()
  // Line comments
  if (before.includes("//") || before.includes("#") || before.includes("-- ")) return true
  // Block comment markers
  if (before.includes("/*") || before.includes("*")) return true
  return false
}

/**
 * Extract the variable name from a line containing a credential assignment.
 * e.g., "const API_KEY = 'abc123'" -> "API_KEY"
 */
export function extractVarName(line: string, matchStart: number): string | undefined {
  // Look backwards for an assignment pattern
  const beforeMatch = line.slice(0, matchStart).trim()
  const varMatch = beforeMatch.match(/(?:const|let|var|export\s+(?:const|let|var))\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*$/)
  if (varMatch) return varMatch[1]
  // Simple assignment: name =
  const simpleMatch = beforeMatch.match(/([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*$/)
  if (simpleMatch) return simpleMatch[1]
  return undefined
}
