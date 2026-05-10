import type { ComplianceReport } from "./generator"

export function formatMarkdown(report: ComplianceReport): string {
  const md: string[] = []

  md.push(`# LockedCode Compliance Report — ${report.metadata.frameworkName}`)
  md.push("")
  md.push(`**Project:** ${report.metadata.projectName}`)
  md.push(`**Period:** ${new Date(report.metadata.startTime).toISOString().slice(0, 10)} to ${new Date(report.metadata.endTime).toISOString().slice(0, 10)}`)
  md.push(`**Generated:** ${report.metadata.generated}`)
  md.push(`**LockedCode Version:** ${report.metadata.version}`)
  md.push("")
  md.push(`> ${report.metadata.disclaimer}`)
  md.push("")

  md.push("## Summary")
  md.push("")
  md.push(`- Controls with evidence: ${report.summary.evidenced}/${report.summary.totalControls}`)
  md.push(`- Controls with partial evidence: ${report.summary.partial}/${report.summary.totalControls}`)
  md.push(`- Controls with gaps: ${report.summary.gap}/${report.summary.totalControls}`)
  md.push(`- Overall posture: **${report.summary.overall}**`)
  md.push("")

  for (const ctrl of report.controls) {
    const statusIcon = ctrl.status === "evidenced" ? "✓" : ctrl.status === "partial" ? "~" : "✗"
    md.push(`## ${ctrl.controlId} — ${ctrl.controlName}`)
    md.push("")
    md.push(`**Status:** ${statusIcon} ${ctrl.status.charAt(0).toUpperCase() + ctrl.status.slice(1)}`)
    md.push("")
    if (ctrl.evidence.length > 0) {
      md.push("| Metric | Value | Description |")
      md.push("|--------|-------|-------------|")
      for (const e of ctrl.evidence) {
        md.push(`| ${e.metric} | ${e.value} | ${e.description} |`)
      }
      md.push("")
    } else {
      md.push("_No evidence data available._")
      md.push("")
    }
    md.push(`_${ctrl.notes}_`)
    md.push("")
  }

  return md.join("\n")
}

export function formatJSON(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2)
}
