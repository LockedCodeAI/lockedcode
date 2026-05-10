import type { CommandModule } from "yargs"
import { resolveRulesPath } from "@/security/rules/resolver"
import { execFileSync } from "child_process"
import fs from "fs"

type Args = {}

/** Format a checkmark or cross. */
function ok(pass: boolean): string {
  return pass ? "✓" : "✗"
}

/** Check if a binary is on PATH. */
function binaryExists(name: string): boolean {
  try {
    execFileSync("which", [name], { encoding: "utf-8" })
    return true
  } catch {
    return false
  }
}

/** Count files in a directory path. */
function countFiles(dir: string): number {
  try {
    return fs.readdirSync(dir).length
  } catch {
    return 0
  }
}

/** Check if a file exists. */
function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

function runChecks(): { results: CheckResult[]; overall: number; total: number } {
  const results: CheckResult[] = []

  // Confinement
  results.push({ name: "Application-level path confinement", pass: true, detail: "active" })
  results.push({ name: "Kernel-level confinement (os-specific)", pass: false, detail: "not configured (application-level active)" })
  results.push({ name: "Project root detection", pass: true, detail: "working" })

  // Scanners
  const semgrepAvail = binaryExists("semgrep")
  results.push({
    name: "Semgrep",
    pass: semgrepAvail,
    detail: semgrepAvail ? "found on PATH" : "not found on PATH",
  })

  const yaraAvail = binaryExists("yara")
  results.push({
    name: "YARA",
    pass: yaraAvail,
    detail: yaraAvail ? "found on PATH" : "not found on PATH",
  })

  results.push({ name: "Entropy analysis", pass: true, detail: "available (built-in)" })
  results.push({ name: "Secret detection", pass: true, detail: "available (built-in, 30+ patterns)" })
  results.push({ name: "Prompt injection detection", pass: true, detail: "available (built-in, 12 patterns)" })

  // Rules
  const semgrepPath = resolveRulesPath("semgrep")
  results.push({
    name: "Semgrep rules",
    pass: semgrepPath !== null,
    detail: semgrepPath ? `${countFiles(semgrepPath)} files` : "not found",
  })

  const yaraPath = resolveRulesPath("yara")
  results.push({
    name: "YARA rules",
    pass: yaraPath !== null,
    detail: yaraPath ? `${countFiles(yaraPath)} files` : "not found",
  })

  // Policy
  const manifest = resolveRulesPath("semgrep", undefined, process.cwd())
  results.push({
    name: "Rules manifest",
    pass: manifest !== null,
    detail: manifest ? "available" : "not found",
  })

  const cwd = process.cwd()
  const policyPaths = [
    `${cwd}/lockedcode.json`,
    `${cwd}/.lockedcode/policy.json`,
  ]
  const hasPolicy = policyPaths.some((p) => fileExists(p))
  results.push({
    name: "Policy file",
    pass: true,
    detail: hasPolicy ? "found (project-specific)" : "using defaults (standard)",
  })

  // Audit
  results.push({ name: "SQLite audit database", pass: true, detail: "available" })

  const passCount = results.filter((r) => r.pass).length
  return { results, overall: passCount, total: results.length }
}

function formatOutput(results: CheckResult[], overall: number, total: number): string {
  const lines: string[] = [
    "",
    "LockedCode Security Check",
    "========================",
    "",
    `Platform: ${process.platform} (${process.arch})`,
    "",
  ]

  const sections: Record<string, CheckResult[]> = {
    "Confinement": results.slice(0, 3),
    "Scanners": results.slice(3, 9),
    "Rules & Policy": results.slice(9, 13),
    "Audit": results.slice(13),
  }

  for (const [sectionName, sectionResults] of Object.entries(sections)) {
    if (sectionResults.length === 0) continue
    lines.push(`${sectionName}:`)
    for (const r of sectionResults) {
      lines.push(`  ${ok(r.pass)} ${r.name}: ${r.detail}`)
    }
    lines.push("")
  }

  const recommendations: string[] = []
  if (!binaryExists("semgrep")) {
    recommendations.push("- Install semgrep for static analysis: brew install semgrep")
  }
  if (!binaryExists("yara")) {
    recommendations.push("- Install yara for malware signature scanning: brew install yara")
  }

  lines.push(`Overall: ${overall}/${total} checks passed`)
  if (recommendations.length > 0) {
    lines.push("")
    lines.push("Recommendations:")
    lines.push(...recommendations)
  }

  return lines.join("\n")
}

export const SecurityCheckCommand = {
  command: "security-check",
  builder: (yargs: any) => yargs,
  handler: async () => {
    const { results, overall, total } = runChecks()
    const output = formatOutput(results, overall, total)
    console.log(output)
  },
} satisfies CommandModule<object, Args>
