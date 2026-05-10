import type { CommandModule } from "yargs"
import path from "path"
import fs from "fs"
import os from "os"
import { execFileSync } from "child_process"

type ListArgs = { status?: string; severity?: string }
type ShowArgs = { id: string }
type RestoreArgs = { id: string }
type DiscardArgs = { id: string }

const DB_PATH = path.join(os.homedir(), ".local", "share", "lockedcode", "opencode-local.db")

function query(sql: string): any[] {
  try {
    if (!fs.existsSync(DB_PATH)) return []
    const result = execFileSync("sqlite3", ["-json", DB_PATH, sql], { encoding: "utf-8", maxBuffer: 1024 * 1024 })
    return JSON.parse(result || "[]")
  } catch { return [] }
}

function run(sql: string): void {
  try {
    if (!fs.existsSync(DB_PATH)) return
    execFileSync("sqlite3", [DB_PATH, sql], { encoding: "utf-8" })
  } catch {}
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16)
}

export const QuarantineListCommand = {
  command: "quarantine list",
  builder: (yargs: any) =>
    yargs
      .option("status", { describe: "Filter by status", type: "string", choices: ["quarantined", "restored", "discarded"] })
      .option("severity", { describe: "Filter by severity", type: "string", choices: ["critical", "high", "warning"] }),
  handler: async (args: any) => {
    const status = args.status as string | undefined
    const severity = args.severity as string | undefined

    let sql = "SELECT * FROM quarantine_record"
    const clauses: string[] = []
    if (status) clauses.push(`status = '${status}'`)
    if (severity) clauses.push(`severity = '${severity}'`)
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`
    sql += " ORDER BY quarantined_at DESC LIMIT 50"

    const rows = query(sql)
    if (rows.length === 0) {
      console.log("\nNo quarantine records found.\n")
      return
    }

    console.log("\nQuarantined Changes")
    console.log("═".repeat(55))
    console.log()

    let quarantined = 0, restored = 0, discarded = 0

    for (const r of rows) {
      const icon = r.severity === "critical" ? "🔴" : r.severity === "high" ? "🟠" : "🟡"
      const statusIcon = r.status === "quarantined" ? "⚠" : r.status === "restored" ? "✓" : "✗"
      if (r.status === "quarantined") quarantined++
      else if (r.status === "restored") restored++
      else discarded++

      const findings = Array.isArray(r.scan_findings) ? r.scan_findings : []
      const findingStr = findings.length > 0 ? findings.slice(0, 2).map((f: any) => f.ruleId ?? f).join(", ") : ""

      console.log(`  ${statusIcon} ${r.id.padEnd(8)} ${r.file_path.padEnd(35)} ${icon} ${r.status}`)
      console.log(`     ${formatDate(r.quarantined_at)}  session:${(r.session_id ?? "").slice(0, 8)}`)
      if (findingStr) console.log(`     Findings: ${findingStr}`)
      console.log()
    }

    console.log(`${rows.length} quarantine records (${quarantined} active, ${restored} restored, ${discarded} discarded)`)
  },
} satisfies CommandModule<object, ListArgs>

export const QuarantineShowCommand = {
  command: "quarantine show <id>",
  builder: (yargs: any) => yargs.positional("id", { describe: "Quarantine record ID", type: "string" }),
  handler: async (args: any) => {
    const id = args.id as string
    const rows = query(`SELECT * FROM quarantine_record WHERE id = '${id}'`)

    if (rows.length === 0) {
      console.log(`\nQuarantine record "${id}" not found.\n`)
      return
    }

    const r = rows[0]
    const findings = Array.isArray(r.scan_findings) ? r.scan_findings : []

    console.log(`\nQuarantine Record: ${r.id}`)
    console.log("═".repeat(55))
    console.log()
    console.log(`  File:     ${r.file_path}`)
    console.log(`  Severity: ${r.severity}`)
    console.log(`  Status:   ${r.status}`)
    console.log(`  Date:     ${formatDate(r.quarantined_at)}`)
    console.log(`  Session:  ${r.session_id}`)
    if (r.resolved_at) console.log(`  Resolved: ${formatDate(r.resolved_at)} (${r.resolved_by ?? "unknown"})`)
    console.log()

    if (findings.length > 0) {
      console.log("  Findings:")
      for (const f of findings) {
        const fi = typeof f === "string" ? { ruleId: f, severity: r.severity } : f
        console.log(`    ${fi.severity === "critical" ? "🔴" : "🟠"} ${fi.ruleId ?? fi}`)
      }
      console.log()
    }

    console.log("  To restore: lockedcode quarantine restore " + r.id)
    console.log("  To discard: lockedcode quarantine discard " + r.id)
    console.log()
  },
} satisfies CommandModule<object, ShowArgs>

export const QuarantineRestoreCommand = {
  command: "quarantine restore <id>",
  builder: (yargs: any) => yargs.positional("id", { describe: "Quarantine record ID", type: "string" }),
  handler: async (args: any) => {
    const id = args.id as string
    const rows = query(`SELECT * FROM quarantine_record WHERE id = '${id}'`)

    if (rows.length === 0) {
      console.log(`\nQuarantine record "${id}" not found.\n`)
      return
    }

    const r = rows[0]
    fs.writeFileSync(r.file_path, r.quarantined_content, "utf-8")
    run(`UPDATE quarantine_record SET status = 'restored', resolved_at = ${Date.now()}, resolved_by = 'user' WHERE id = '${id}'`)

    console.log(`\n✓ Restored ${id}: ${r.file_path} (quarantined content written back)\n`)
  },
} satisfies CommandModule<object, RestoreArgs>

export const QuarantineDiscardCommand = {
  command: "quarantine discard <id>",
  builder: (yargs: any) => yargs.positional("id", { describe: "Quarantine record ID", type: "string" }),
  handler: async (args: any) => {
    const id = args.id as string
    run(`UPDATE quarantine_record SET status = 'discarded', resolved_at = ${Date.now()}, resolved_by = 'user' WHERE id = '${id}'`)

    console.log(`\n✗ Discarded ${id} (quarantined content retained in database for audit)\n`)
  },
} satisfies CommandModule<object, DiscardArgs>
