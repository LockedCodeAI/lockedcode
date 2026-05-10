import type { CommandModule } from "yargs"
import { loadCustomRules } from "../../security/rules/loader"
import { testRuleFile, formatTestResults } from "../../security/rules/tester"
import { resolveRulesPath } from "../../security/rules/resolver"
import fs from "fs"
import path from "path"

type Args = { path?: string }

function countActiveRules(): { bundled: number; custom: number; customSources: Set<string> } {
  const bundled = countBundledRules()
  const customRules = loadCustomRules()
  const customSources = new Set(customRules.map((r) => r.source))
  return { bundled, custom: customRules.filter((r) => r.enabled).length, customSources }
}

function countBundledRules(): number {
  let count = 0
  for (const type of ["semgrep", "yara"] as const) {
    const p = resolveRulesPath(type)
    if (p) {
      try { count += fs.readdirSync(p).length } catch {}
    }
  }
  // Secrets and injection are hardcoded in TypeScript — approximate
  count += 30 + 12 // secrets patterns + injection patterns
  return count
}

export const RulesListCommand = {
  command: "rules list",
  describe: "manage scanning rules",
  builder: (yargs: any) => yargs,
  handler: async () => {
    const { bundled, custom, customSources } = countActiveRules()
    const lines: string[] = [
      `Active Rules (${bundled + custom} total)`,
      "",
      `Bundled (${bundled}):`,
      "  semgrep: 6 rule files in rules/semgrep/",
      "  yara: 5 rule files in rules/yara/",
      "  secrets: 30+ patterns (built-in)",
      "  injection: 12 patterns (built-in)",
    ]
    if (custom > 0) {
      lines.push("", `Custom (${custom}):`)
      for (const src of customSources) {
        const count = loadCustomRules().filter((r) => r.source === src).length
        lines.push(`  ${src}: ${count} rules`)
      }
    } else {
      lines.push("", "Custom: none")
    }
    console.log(lines.join("\n"))
  },
} satisfies CommandModule<object, Args>

export const RulesTestCommand = {
  command: "rules test [path]",
  describe: "test a rule against sample content",
  builder: (yargs: any) =>
    yargs.positional("path", {
      describe: "Path to a specific rule file (optional)",
      type: "string",
    }),
  handler: async (args: any) => {
    const filepath = args.path as string | undefined

    if (filepath) {
      // Test a specific file
      const absPath = path.resolve(filepath)
      if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`)
        process.exit(1)
      }
      const result = testRuleFile(absPath)
      console.log()
      console.log(formatTestResults(result))
      console.log()
      if (result.totalFailed > 0 || !result.valid) process.exit(1)
      return
    }

    // Test all custom rule files
    const customRules = loadCustomRules()
    const sources = [...new Set(customRules.map((r) => r.source))]

    if (sources.length === 0) {
      console.log("\nNo custom rule files found.")
      console.log("Create rules at .lockedcode/rules/ or ~/.lockedcode/custom-rules/\n")
      return
    }

    console.log("\nTesting custom rules...\n")

    let totalPassed = 0
    let totalFailed = 0
    let fileErrors = 0

    for (const src of sources) {
      const result = testRuleFile(src)
      if (result.error) {
        console.log(`${src}`)
        console.log(`  ERROR: ${result.error}\n`)
        fileErrors++
        continue
      }
      console.log(formatTestResults(result))
      console.log()
      totalPassed += result.totalPassed
      totalFailed += result.totalFailed
    }

    const total = totalPassed + totalFailed
    console.log(`Results: ${totalPassed}/${total} test cases passed, ${fileErrors} file errors`)
    if (totalFailed > 0 || fileErrors > 0) process.exit(1)
  },
} satisfies CommandModule<object, Args>
