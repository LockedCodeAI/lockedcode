import fs from "fs"
import { CustomRuleFileSchema, type CustomRule } from "./schema"

export interface RuleTestCaseResult {
  readonly ruleId: string
  readonly ruleName: string
  readonly passed: number
  readonly failed: number
  readonly failures: Array<{ type: "shouldMatch" | "shouldNotMatch"; input: string; message: string }>
  readonly skipped: boolean
}

export interface RuleFileTestResult {
  readonly filepath: string
  readonly valid: boolean
  readonly rules: RuleTestCaseResult[]
  readonly totalPassed: number
  readonly totalFailed: number
  readonly error?: string
}

/**
 * Test a single custom rule against its test cases.
 */
export function testRule(rule: CustomRule): RuleTestCaseResult {
  if (!rule.testCases) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      passed: 0,
      failed: 0,
      failures: [],
      skipped: true,
    }
  }

  const failures: RuleTestCaseResult["failures"] = []
  let passed = 0
  let failed = 0

  for (const input of rule.testCases.shouldMatch) {
    if (rule.regex.test(input)) {
      passed++
    } else {
      failed++
      failures.push({
        type: "shouldMatch",
        input,
        message: `Expected "${input}" to match pattern "${rule.regex.source}", but it did not.`,
      })
    }
  }

  for (const input of rule.testCases.shouldNotMatch) {
    if (rule.regex.test(input)) {
      failed++
      failures.push({
        type: "shouldNotMatch",
        input,
        message: `Expected "${input}" to NOT match pattern "${rule.regex.source}", but it did.`,
      })
    } else {
      passed++
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    passed,
    failed,
    failures,
    skipped: false,
  }
}

/**
 * Test all rules in a rule file.
 */
export function testRuleFile(filepath: string): RuleFileTestResult {
  try {
    if (!fs.existsSync(filepath)) {
      return { filepath, valid: false, rules: [], totalPassed: 0, totalFailed: 0, error: "File not found" }
    }

    const content = fs.readFileSync(filepath, "utf-8")
    const parsed = JSON.parse(content)
    const result = CustomRuleFileSchema.safeParse(parsed)

    if (!result.success) {
      return {
        filepath,
        valid: false,
        rules: [],
        totalPassed: 0,
        totalFailed: 0,
        error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      }
    }

    const ruleResults: RuleTestCaseResult[] = []
    let totalPassed = 0
    let totalFailed = 0

    for (const raw of result.data.rules) {
      try {
        const regex = raw.flags ? new RegExp(raw.pattern, raw.flags) : new RegExp(raw.pattern)
        const rule: CustomRule = {
          id: raw.id,
          name: raw.name,
          type: raw.type as any,
          regex,
          severity: raw.severity as any,
          languages: raw.languages,
          description: raw.description,
          remediation: raw.remediation ?? "",
          tags: raw.tags ?? [],
          enabled: raw.enabled !== false,
          testCases: raw.testCases ? { shouldMatch: raw.testCases.shouldMatch ?? [], shouldNotMatch: raw.testCases.shouldNotMatch ?? [] } : undefined,
          source: filepath,
        }
        const tr = testRule(rule)
        ruleResults.push(tr)
        totalPassed += tr.passed
        totalFailed += tr.failed
      } catch (reErr: any) {
        ruleResults.push({
          ruleId: raw.id,
          ruleName: raw.name,
          passed: 0,
          failed: 0,
          failures: [{ type: "shouldMatch", input: "", message: `Regex compilation error: ${reErr.message}` }],
          skipped: false,
        })
        totalFailed++
      }
    }

    return {
      filepath,
      valid: true,
      rules: ruleResults,
      totalPassed,
      totalFailed,
    }
  } catch (err: any) {
    return {
      filepath,
      valid: false,
      rules: [],
      totalPassed: 0,
      totalFailed: 0,
      error: err.message,
    }
  }
}

/**
 * Format test results as a readable string.
 */
export function formatTestResults(result: RuleFileTestResult): string {
  const lines: string[] = [result.filepath]

  if (result.error) {
    lines.push(`  ERROR: ${result.error}`)
    return lines.join("\n")
  }

  for (const rule of result.rules) {
    if (rule.skipped) {
      lines.push(`  - ${rule.ruleId} (skipped — no test cases)`)
      continue
    }
    const status = rule.failed === 0 ? "✓" : "✗"
    lines.push(`  ${status} ${rule.ruleId} (${rule.passed} pass, ${rule.failed} fail)`)
    for (const f of rule.failures) {
      lines.push(`    ${f.type}: ${f.message}`)
    }
  }

  if (result.rules.length > 0) {
    const status = result.totalFailed === 0 ? "✓" : "✗"
    lines.push(`  ${status} ${result.totalPassed}/${result.totalPassed + result.totalFailed} test cases passed`)
  }

  return lines.join("\n")
}
