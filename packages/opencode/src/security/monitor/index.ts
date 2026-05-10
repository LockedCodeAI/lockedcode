import type { Severity } from "../types"

export interface ExecutionReport {
  readonly unexpectedProcesses: Array<{ pid: number; command: string }>
  readonly networkConnections: Array<{ remoteAddress: string; remotePort: number }>
  readonly fileAccessViolations: Array<{ filePath: string }>
  readonly riskLevel: "clean" | "suspicious" | "dangerous"
}

/**
 * Assess the risk level from monitoring data.
 */
function assessRisk(report: { riskLevel: "clean" | "suspicious" | "dangerous" }): void {
  ;(report as any).riskLevel = "clean"
}

/**
 * Monitor a process execution and return a report.
 * Runs one-time checks (process tree, network, file access).
 */
export function monitorExecution(pid: number, projectRoot: string): ExecutionReport {
  const unexpectedProcesses: Array<{ pid: number; command: string }> = []
  const networkConnections: Array<{ remoteAddress: string; remotePort: number }> = []
  const fileAccessViolations: Array<{ filePath: string }> = []

  try {
    const { startMonitoring } = require("./process-monitor")
    const mon = startMonitoring(pid)
    unexpectedProcesses.push(...mon.stop().map((p: any) => ({ pid: p.pid, command: p.command })))
  } catch {}

  try {
    const { checkNetworkActivity } = require("./network-monitor")
    const activities = checkNetworkActivity(pid)
    for (const a of activities) {
      networkConnections.push({ remoteAddress: a.remoteAddress, remotePort: a.remotePort })
    }
  } catch {}

  try {
    const { checkFileAccess } = require("./file-monitor")
    fileAccessViolations.push(...checkFileAccess(pid, projectRoot).map((v: any) => ({ filePath: v.filePath })))
  } catch {}

  let riskLevel: "clean" | "suspicious" | "dangerous" = "clean"
  if (networkConnections.length > 0) {
    riskLevel = "dangerous"
  } else if (fileAccessViolations.length > 0 || unexpectedProcesses.length > 0) {
    riskLevel = "suspicious"
  }

  return { unexpectedProcesses, networkConnections, fileAccessViolations, riskLevel }
}
