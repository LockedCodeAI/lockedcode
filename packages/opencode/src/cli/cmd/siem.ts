import type { CommandModule } from "yargs"
import path from "path"
import fs from "fs"
import os from "os"
import { execFileSync } from "child_process"

type ExportArgs = { format: string; since?: string; severity?: string; output?: string }
type StreamArgs = { host: string; port: number; protocol?: string; format?: string; severity?: string }

const DB_PATH = path.join(os.homedir(), ".local", "share", "lockedcode", "opencode-local.db")

function query(sql: string): any[] {
  try {
    if (!fs.existsSync(DB_PATH)) return []
    const result = execFileSync("sqlite3", ["-json", DB_PATH, sql], { encoding: "utf-8", maxBuffer: 1024 * 1024 })
    return JSON.parse(result || "[]")
  } catch {
    return []
  }
}

function formatCEF(row: any): string {
  const severityMap: Record<string, string> = { info: "3", warning: "5", high: "7", critical: "9" }
  const sev = severityMap[row.severity] ?? "5"
  return `CEF:0|LockedCode|LockedCode|1.0|${row.event_type}|Security event|${sev}|src=${row.session_id} act=${row.action_taken}`
}

function formatOCSF(row: any): string {
  return JSON.stringify({
    class_uid: 2001, category_uid: 2, severity_id: row.severity === "critical" ? 5 : row.severity === "high" ? 4 : row.severity === "warning" ? 3 : 1,
    activity_id: 1, time: row.timestamp,
    message: `Security event: ${row.event_type} (${row.action_taken})`,
    metadata: { product: { name: "LockedCode", vendor_name: "LockedCodeAI", version: "1.0.0" }, version: "1.1.0" },
    actor: { session: { uid: row.session_id } },
    finding_info: { uid: row.id, title: row.event_type, types: [row.event_type] },
    severity: row.severity, status: row.action_taken,
  }, null, 2)
}

function formatJSON(row: any): string {
  return JSON.stringify({
    timestamp: new Date(row.timestamp).toISOString(),
    facility: "local0", severity: row.severity, hostname: os.hostname(),
    appname: "lockedcode", procid: String(process.pid), msgid: row.event_type,
    structured_data: { "lockedcode@0": { session_id: row.session_id, event_type: row.event_type, action_taken: row.action_taken } },
    message: `Security event: ${row.event_type} (${row.action_taken})`,
  })
}

export const SIEMExportCommand = {
  command: "siem export",
  describe: "SIEM event export",
  builder: (yargs: any) =>
    yargs
      .option("format", { describe: "Export format", type: "string", choices: ["cef", "ocsf", "json"], default: "json" })
      .option("since", { describe: "Time range (24h, 7d, or ISO date)", type: "string" })
      .option("severity", { describe: "Minimum severity", type: "string", choices: ["info", "warning", "high", "critical"] })
      .option("output", { describe: "Output file", type: "string" }),
  handler: async (args: any) => {
    const fmt = args.format as string
    const since = args.since as string | undefined
    const severity = args.severity as string | undefined
    const output = args.output as string | undefined

    let timeFilter = ""
    if (since) {
      const match = since.match(/^(\d+)([hd])$/)
      if (match) {
        const ms = parseInt(match[1]) * (match[2] === "h" ? 3600000 : 86400000)
        timeFilter = `WHERE timestamp > ${Date.now() - ms}`
      } else {
        timeFilter = `WHERE timestamp > ${new Date(since).getTime()}`
      }
    }

    let sevFilter = ""
    if (severity) {
      const sevOrder = ["info", "warning", "high", "critical"]
      const sevIdx = sevOrder.indexOf(severity)
      if (sevIdx >= 0) {
        const cond = timeFilter ? "AND" : "WHERE"
        sevFilter = `${cond} CASE severity WHEN 'critical' THEN 3 WHEN 'high' THEN 2 WHEN 'warning' THEN 1 WHEN 'info' THEN 0 END >= ${sevIdx}`
      }
    }

    const rows = query(`SELECT * FROM security_event ${timeFilter} ${sevFilter} ORDER BY timestamp DESC LIMIT 1000`)
    if (rows.length === 0) {
      console.log("No events to export.")
      return
    }

    const formatter = fmt === "cef" ? formatCEF : fmt === "ocsf" ? formatOCSF : formatJSON
    const formatted = rows.map(formatter)

    const result = fmt === "ocsf" ? `[\n${formatted.join(",\n")}\n]` : formatted.join("\n")

    if (output) {
      fs.writeFileSync(output, result, "utf-8")
      console.log(`Exported ${rows.length} events to ${output}`)
    } else {
      console.log(result)
    }
  },
} satisfies CommandModule<object, ExportArgs>

export const SIEMStreamCommand = {
  command: "siem stream",
  describe: "SIEM event streaming",
  builder: (yargs: any) =>
    yargs
      .option("host", { describe: "Syslog host", type: "string", demandOption: true })
      .option("port", { describe: "Syslog port", type: "number", demandOption: true })
      .option("protocol", { describe: "Transport protocol", type: "string", choices: ["udp", "tcp"], default: "udp" })
      .option("format", { describe: "Output format", type: "string", choices: ["cef", "ocsf", "json"], default: "json" })
      .option("severity", { describe: "Minimum severity", type: "string", choices: ["info", "warning", "high", "critical"] }),
  handler: async (args: any) => {
    const host = args.host as string
    const port = args.port as number
    const protocol = args.protocol as string
    const fmt = args.format as string

    console.log(`Streaming to ${host}:${port} via ${protocol} in ${fmt} format...`)
    console.log("Press Ctrl+C to stop.")

    // Poll for new events every 5 seconds
    const lastID = [""]
    const interval = setInterval(() => {
      const rows = query(`SELECT * FROM security_event WHERE id > '${lastID[0]}' ORDER BY timestamp ASC`)
      for (const row of rows) {
        const formatter = fmt === "cef" ? formatCEF : fmt === "ocsf" ? formatOCSF : formatJSON
        console.log(formatter(row))
        lastID[0] = row.id
      }
    }, 5000)

    process.on("SIGINT", () => {
      clearInterval(interval)
      console.log("\nStreaming stopped.")
      process.exit(0)
    })

    // Keep alive
    await new Promise(() => {})
  },
} satisfies CommandModule<object, StreamArgs>
