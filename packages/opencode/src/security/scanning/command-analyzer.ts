import type { ScanFinding, Severity } from "../types"
import { parseCommand, isSensitiveVar, isNetworkCommand } from "./command-parser"
import type { ParsedCommand } from "./command-parser"

/**
 * Analyze a shell command for security issues.
 *
 * Returns ScanFinding[], score (0-100), and the highest severity.
 */
export function analyzeCommand(command: string): {
  findings: ScanFinding[]
  score: number
  severity: Severity
} {
  const parsed = parseCommand(command)
  const findings: ScanFinding[] = []
  let currentScore = 10

  // Run all analysis passes
  findings.push(...checkHardBlocked(parsed))
  findings.push(...checkHighRisk(parsed))
  findings.push(...checkMediumRisk(parsed))
  findings.push(...checkPaths(parsed))
  findings.push(...checkEnvVars(parsed, command))

  // Calculate score
  for (const f of findings) {
    const fScore = scoreForSeverity(f.severity)
    if (fScore > currentScore) currentScore = fScore
  }

  // Modifiers
  if (parsed.pipes) currentScore += 10
  if (parsed.subshells.length > 0) currentScore += 10
  if (parsed.redirects.length > 0) currentScore += 5
  if (parsed.envVarReads.some((v) => isSensitiveVar(v))) currentScore += 10

  // Sensitive env var + network = critical
  const hasSensitiveEnv = parsed.envVarReads.some((v) => isSensitiveVar(v))
  const hasNetwork = parsed.segments.some((s) => isNetworkCommand(s.command))
  if (hasSensitiveEnv && hasNetwork) currentScore += 20

  const score = Math.min(currentScore, 100)
  const severity = highestSeverity(findings)

  return { findings, score, severity }
}

function scoreForSeverity(s: Severity): number {
  switch (s) {
    case "critical": return 95
    case "high": return 70
    case "warning": return 40
    case "info": return 20
  }
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

// ============================================================
// Analysis passes
// ============================================================

function checkHardBlocked(parsed: ParsedCommand): ScanFinding[] {
  const findings: ScanFinding[] = []
  const cmdStr = parsed.segments.map((s) => s.raw).join(" | ")
  const raw = parsed.raw

  // Remote code execution via pipe
  if (
    /curl\s.*\|\s*(bash|sh|zsh|dash|ksh)\b/.test(cmdStr) ||
    /wget\s.*\|\s*(bash|sh|zsh|dash|ksh)\b/.test(cmdStr) ||
    /curl\s.*\|\s*(bash|sh)\s*-/.test(cmdStr) ||
    /wget\s.*-O-\s.*\|\s*(sh|bash)\b/.test(cmdStr)
  ) {
    findings.push(makeFinding("shell.hardblocked.remote-exec-pipe", "critical",
      "Remote code execution via pipe from network fetch", cmdStr.slice(0, 100)))
  }

  // System persistence
  if (
    /\bcrontab\b/.test(cmdStr) ||
    /\bsystemctl\s+(enable|start|disable|mask)\b/.test(cmdStr) ||
    /\blaunchctl\s+load\b/.test(cmdStr) ||
    /\bchkconfig\b/.test(cmdStr)
  ) {
    findings.push(makeFinding("shell.hardblocked.persistence", "critical",
      "System persistence modification", cmdStr.slice(0, 100)))
  }

  // SSH configuration — check raw command for file paths
  if (
    /~\/\.ssh\/authorized_keys/.test(raw) ||
    /~\/\.ssh\/config/.test(raw) ||
    /\bssh-copy-id\b/.test(cmdStr)
  ) {
    findings.push(makeFinding("shell.hardblocked.ssh-config", "critical",
      "SSH configuration modification", raw.slice(0, 100)))
  }

  // Shell profile modification
  if (/(~\/)?\.(bashrc|zshrc|profile|bash_profile|zprofile)\b/.test(raw)) {
    findings.push(makeFinding("shell.hardblocked.profile-modify", "critical",
      "Shell profile modification", raw.slice(0, 100)))
  }

  // Raw network listeners
  if (
    /\bnc\s+-l\b/.test(cmdStr) ||
    /\bncat\s+-l\b/.test(cmdStr) ||
    /\bsocat\b.*\bLISTEN\b/.test(cmdStr) ||
    /\bpython\s+-m\s+http\.server\b/.test(cmdStr) ||
    /\bpython\s+-m\s+SimpleHTTPServer\b/.test(cmdStr)
  ) {
    findings.push(makeFinding("shell.hardblocked.network-listener", "critical",
      "Raw network listener", cmdStr.slice(0, 100)))
  }

  return findings
}

function checkHighRisk(parsed: ParsedCommand): ScanFinding[] {
  const findings: ScanFinding[] = []
  const cmdStr = parsed.segments.map((s) => s.raw).join(" | ")

  if (/chmod\s+777\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.permissive-perms", "high",
      "Overly permissive file permissions", cmdStr.slice(0, 100)))
  }
  if (/chmod\s+\+s\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.setuid", "high",
      "SetUID/SetGID permission change", cmdStr.slice(0, 100)))
  }
  if (/\brm\s+-rf\s+(\/|\/\*)\s*$/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.destructive-rm", "critical",
      "Destructive recursive delete", cmdStr.slice(0, 100)))
  }
  if (/\bdd\s+if=.*\s+of=\/dev\//.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.raw-device-write", "critical",
      "Raw device write via dd", cmdStr.slice(0, 100)))
  }
  if (/\bmkfs\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.filesystem-create", "high",
      "Filesystem creation", cmdStr.slice(0, 100)))
  }
  if (/:\{\s*:\|:&\s*\};?\s*:/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.fork-bomb", "critical",
      "Fork bomb pattern detected", cmdStr.slice(0, 100)))
  }
  if (/\bchown\s+root\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.highrisk.chown-root", "high",
      "Changing file ownership to root", cmdStr.slice(0, 100)))
  }

  return findings
}

function checkMediumRisk(parsed: ParsedCommand): ScanFinding[] {
  const findings: ScanFinding[] = []
  const cmdStr = parsed.segments.map((s) => s.raw).join(" | ")

  if (/\bsudo\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.medium.privilege-escalation", "warning",
      "Privilege escalation via sudo", cmdStr.slice(0, 100)))
  }
  if (/\bsu\s+-/.test(cmdStr)) {
    findings.push(makeFinding("shell.medium.user-switch", "warning",
      "User switching via su", cmdStr.slice(0, 100)))
  }
  if (/\bnpm\s+install\s+-g\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.medium.global-npm-install", "warning",
      "Global npm package install", cmdStr.slice(0, 100)))
  }
  if (/\bdocker\s+run\s+--privileged\b/.test(cmdStr)) {
    findings.push(makeFinding("shell.medium.privileged-container", "high",
      "Privileged Docker container", cmdStr.slice(0, 100)))
  }
  if (/\bdocker\s+run\s+-v\s+\/:\//.test(cmdStr)) {
    findings.push(makeFinding("shell.medium.host-root-mount", "critical",
      "Docker host root filesystem mount", cmdStr.slice(0, 100)))
  }

  return findings
}

function checkPaths(parsed: ParsedCommand): ScanFinding[] {
  const findings: ScanFinding[] = []

  for (const p of parsed.paths) {
    if (p.path.includes("..")) {
      findings.push(makeFinding("shell.path.traversal", "warning",
        "Path traversal in shell command argument", p.path))
    }
    if (p.path.startsWith("~/.ssh") || p.path.startsWith("/etc/")) {
      findings.push(makeFinding("shell.path.sensitive-location", "high",
        "Shell command targeting sensitive system path", p.path))
    }
  }

  return findings
}

function checkEnvVars(parsed: ParsedCommand, raw: string): ScanFinding[] {
  const findings: ScanFinding[] = []
  const sensitiveReads = parsed.envVarReads.filter((v) => isSensitiveVar(v))

  if (sensitiveReads.length > 0) {
    const hasNet = parsed.segments.some((s) => isNetworkCommand(s.command))

    if (hasNet) {
      findings.push(makeFinding("shell.env.exfiltration", "critical",
        "Sensitive environment variable read combined with network activity",
        sensitiveReads.join(", ")))
    } else {
      findings.push(makeFinding("shell.env.sensitive-read", "high",
        "Sensitive environment variable referenced in command",
        sensitiveReads.join(", ")))
    }
  }

  const sensitiveSets = parsed.envVarSets.filter((v) => isSensitiveVar(v))
  if (sensitiveSets.length > 0) {
    findings.push(makeFinding("shell.env.sensitive-set", "high",
      "Sensitive environment variable being set", sensitiveSets.join(", ")))
  }

  return findings
}

function makeFinding(ruleId: string, severity: Severity, message: string, matchedContent: string): ScanFinding {
  return {
    severity,
    ruleId,
    scanner: "command-analyzer",
    matchedContent: matchedContent.slice(0, 200),
    confidence: severity === "critical" || severity === "high" ? "high" : "medium",
    remediation: message,
  }
}
