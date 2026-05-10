import type { ScanFinding, Severity } from "../types"

/** Severity icon mapping. */
const SEVERITY_ICON: Record<Severity, string> = {
  info: "ℹ️",
  warning: "🟡",
  high: "🟠",
  critical: "🔴",
}

/** Severity label mapping. */
const SEVERITY_LABEL: Record<Severity, string> = {
  info: "info",
  warning: "warning",
  high: "high",
  critical: "critical",
}

/**
 * Format a single scan finding for display.
 */
export function formatFinding(finding: ScanFinding): string {
  const icon = SEVERITY_ICON[finding.severity] ?? "•"
  const label = SEVERITY_LABEL[finding.severity] ?? finding.severity
  const line = finding.lineNumber ? `:${finding.lineNumber}` : ""
  return `${icon} [${finding.scanner}] ${finding.ruleId}${line}: ${finding.remediation ?? "no details"}`
}

/**
 * Format a group of findings from the same scan.
 */
export function formatFindings(findings: ScanFinding[]): string[] {
  if (findings.length === 0) return []

  const sevCount: Record<string, number> = {}
  for (const f of findings) {
    sevCount[f.severity] = (sevCount[f.severity] ?? 0) + 1
  }

  const summaryParts: string[] = []
  for (const sev of ["critical", "high", "warning", "info"] as Severity[]) {
    if (sevCount[sev]) {
      summaryParts.push(`${sevCount[sev]} ${SEVERITY_LABEL[sev]}`)
    }
  }

  const header = `🛡️ ${findings.length} ${findings.length === 1 ? "finding" : "findings"} (${summaryParts.join(", ")})`
  const detailLines = findings.map((f) => `  ${formatFinding(f)}`)

  return [header, ...detailLines]
}

/**
 * Format a security status line for the TUI.
 */
export function formatSecurityStatus(opts: {
  confinementActive: boolean
  projectRoot?: string
  strictness: string
  airGap: boolean
  scansDone: number
  warnings: number
  blocks: number
}): string {
  const parts: string[] = []

  // Confinement status
  if (opts.confinementActive && opts.projectRoot) {
    parts.push(`🔒 ${opts.projectRoot}`)
  } else {
    parts.push("⚠️ Confinement inactive")
  }

  // Strictness
  parts.push(`Policy: ${opts.strictness}`)

  // Air-gap
  if (opts.airGap) {
    parts.push("✈️ Air-gap")
  }

  // Scan stats
  if (opts.scansDone > 0) {
    const stats = `Scans: ${opts.scansDone} | W:${opts.warnings} B:${opts.blocks}`
    parts.push(stats)
  }

  return parts.join(" | ")
}

/**
 * Format a security summary block for session end display.
 */
export function formatSessionSummary(opts: {
  projectRoot: string
  strictness: string
  modelId: string
  actionsScanned: number
  findings: { critical: number; high: number; warning: number; info: number }
  blocked: number
  overrides: number
  sessionTrust: number
  sessionTrustLevel: string
  modelTrustFlagRate: number
  modelTrustLevel: string
}): string {
  const separator = "─".repeat(40)
  const lines: string[] = [
    `╭${separator}╮`,
    `│ Security Summary${" ".repeat(24)}│`,
    `├${separator}┤`,
    `│ Confinement: ${opts.projectRoot.padEnd(27)}│`,
    `│ Policy: ${opts.strictness.padEnd(31)}│`,
    `│ Model: ${opts.modelId.padEnd(32)}│`,
    `│${" ".repeat(42)}│`,
    `│ Actions scanned: ${String(opts.actionsScanned).padEnd(23)}│`,
  ]

  const findingParts: string[] = []
  if (opts.findings.critical > 0) findingParts.push(`${opts.findings.critical} critical`)
  if (opts.findings.high > 0) findingParts.push(`${opts.findings.high} high`)
  if (opts.findings.warning > 0) findingParts.push(`${opts.findings.warning} warning`)

  if (findingParts.length > 0) {
    lines.push(`│ Findings: ${findingParts.join(", ").padEnd(29)}│`)
  } else {
    lines.push(`│ Findings: none${" ".repeat(28)}│`)
  }

  lines.push(
    `│ Blocked: ${String(opts.blocked).padEnd(30)}│`,
    `│ Overrides: ${String(opts.overrides).padEnd(28)}│`,
    `│ Session trust: ${opts.sessionTrust} (${opts.sessionTrustLevel})${" ".repeat(13)}│`,
    `│${" ".repeat(42)}│`,
    `│ Model trust: ${opts.modelTrustLevel} (${(opts.modelTrustFlagRate * 100).toFixed(0)}% flag rate)${" ".repeat(7)}│`,
    `╰${separator}╯`,
  )

  return lines.join("\n")
}
