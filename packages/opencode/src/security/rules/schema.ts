import z from "zod"

/** Rule type determines what kind of content the rule scans. */
export const RuleType = z.enum(["content", "command", "filename", "outbound"])

/** Severity levels. */
export const RuleSeverity = z.enum(["info", "warning", "high", "critical"])

/** Test cases for a rule. */
const TestCases = z.object({
  shouldMatch: z.array(z.string()).optional().default([]),
  shouldNotMatch: z.array(z.string()).optional().default([]),
}).optional()

/** Single custom rule definition. */
export const CustomRuleSchema = z.object({
  id: z.string().min(1, "Rule ID is required"),
  name: z.string().min(1, "Rule name is required"),
  type: RuleType,
  pattern: z.string().min(1, "Pattern is required"),
  flags: z.string().optional().default(""),
  severity: RuleSeverity,
  languages: z.array(z.string()).optional(),
  description: z.string().min(1, "Description is required"),
  remediation: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  enabled: z.boolean().optional().default(true),
  testCases: TestCases,
}).passthrough()

/** A rule file contains an array of rules. */
export const CustomRuleFileSchema = z.object({
  rules: z.array(CustomRuleSchema),
}).passthrough()

/** Compiled custom rule ready for scanning. */
export interface CustomRule {
  readonly id: string
  readonly name: string
  readonly type: "content" | "command" | "filename" | "outbound"
  readonly regex: RegExp
  readonly severity: "info" | "warning" | "high" | "critical"
  readonly languages: string[] | undefined
  readonly description: string
  readonly remediation: string
  readonly tags: string[]
  readonly enabled: boolean
  readonly testCases: { shouldMatch: string[]; shouldNotMatch: string[] } | undefined
  readonly source: string
}

export type CustomRuleType = z.infer<typeof RuleType>
export type CustomRuleSeverity = z.infer<typeof RuleSeverity>
