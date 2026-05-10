import type { ScanFinding, Severity } from "../types"
import { detectInstallCommand } from "./parser"
import { checkTyposquat } from "./typosquat"
import { checkPostInstall } from "./postinstall"

export interface DependencyAnalysisResult {
  readonly findings: ScanFinding[]
  readonly severity: Severity
  readonly isInstallCommand: boolean
}

/**
 * Analyze a shell command for dependency-related security issues.
 * Runs when an install command is detected.
 */
export function analyzeDependencies(command: string): DependencyAnalysisResult {
  const installCmd = detectInstallCommand(command)

  if (!installCmd) {
    return { findings: [], severity: "info", isInstallCommand: false }
  }

  const findings: ScanFinding[] = []

  for (const pkg of installCmd.packages) {
    const cleanName = pkg.scope ? `${pkg.scope}/${pkg.name.replace(/^@[^/]+\//, "")}` : pkg.name

    // Typosquatting check
    const typosquats = checkTyposquat(cleanName)
    for (const t of typosquats) {
      findings.push({
        severity: t.severity as Severity,
        ruleId: `dependency.typosquat.${t.similarityType}`,
        scanner: "dependency",
        matchedContent: `${cleanName} → ${t.similarTo}`,
        confidence: t.confidence as any,
        remediation: `Package "${cleanName}" is suspiciously similar to "${t.similarTo}". Verify you intended to install "${t.similarTo}" instead.`,
      })
    }

    // Post-install script check
    const postInstall = checkPostInstall(cleanName, installCmd.packageManager, installCmd.hasIgnoreScripts)
    if (postInstall) {
      findings.push({
        severity: postInstall.severity as Severity,
        ruleId: "dependency.postinstall-scripts",
        scanner: "dependency",
        matchedContent: cleanName,
        confidence: "medium",
        remediation: postInstall.recommendation,
      })
    }
  }

  // Flag non-registry sources
  if (installCmd.hasNonRegistrySource) {
    findings.push({
      severity: "warning" as Severity,
      ruleId: "dependency.non-registry-source",
      scanner: "dependency",
      matchedContent: command.slice(0, 60),
      confidence: "medium",
      remediation: "Installing from a non-registry source. Verify the source is trusted.",
    })
  }

  const sev = highestSeverity(findings)
  return { findings, severity: sev, isInstallCommand: true }
}

function highestSeverity(findings: ScanFinding[]): Severity {
  const order: Severity[] = ["info", "warning", "high", "critical"]
  let highest: Severity = "info"
  for (const f of findings) {
    if (order.indexOf(f.severity) > order.indexOf(highest)) {
      highest = f.severity
    }
  }
  return highest
}
