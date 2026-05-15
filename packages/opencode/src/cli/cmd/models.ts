import type { CommandModule } from "yargs"
import path from "path"
import fs from "fs"
import os from "os"
import { execFileSync } from "child_process"
import * as Log from "@opencode-ai/core/util/log"
import { checkPathSync } from "../../security/confinement/whitelist"

const log = Log.create({ service: "cli.models" })

type ListArgs = {}
type ApproveArgs = { modelId: string; reason?: string }
type BlockArgs = { modelId: string; reason?: string }
type ReportArgs = { modelId?: string }

const DB_PATH = path.join(os.homedir(), ".local", "share", "lockedcode", "lockedcode-local.db")

function assertDbAccess(): void {
  const result = checkPathSync(DB_PATH, "read", process.cwd())
  if (!result.allowed) {
    log.error("confinement denied CLI database access", { path: DB_PATH, reason: result.reason })
    throw new Error(`Confinement: access denied to ${DB_PATH} — ${result.reason}`)
  }
  log.debug("CLI database access", { subcommand: "models", path: DB_PATH })
}

function query(sql: string): any[] {
  try {
    assertDbAccess()
    if (!fs.existsSync(DB_PATH)) return []
    const result = execFileSync("sqlite3", ["-json", DB_PATH, sql], { encoding: "utf-8", maxBuffer: 1024 * 1024 })
    return JSON.parse(result || "[]")
  } catch {
    return []
  }
}

function run(sql: string): void {
  try {
    assertDbAccess()
    if (!fs.existsSync(DB_PATH)) return
    execFileSync("sqlite3", [DB_PATH, sql], { encoding: "utf-8" })
  } catch {}
}

function formatDate(ts: number): string {
  if (!ts) return "never"
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16)
}

export const ModelsListCommand = {
  command: "models list",
  describe: "manage model registry",
  builder: (yargs: any) => yargs,
  handler: async () => {
    const models = query("SELECT * FROM model_registry ORDER BY last_seen DESC")

    if (models.length === 0) {
      console.log("\nNo models registered yet. Run an agent session to populate.")
      return
    }

    console.log("\nModel Registry")
    console.log("═".repeat(55))
    console.log()

    let approved = 0, blocked = 0, unknown = 0, pending = 0

    for (const m of models) {
      const trust = query(`SELECT * FROM model_trust WHERE model_id = '${m.model_id}'`)[0]
      const provenance = query(`SELECT COUNT(*) as total, file_path FROM file_provenance WHERE model_id = '${m.model_id}' GROUP BY file_path`)

      const flagRate = trust ? ((trust.flagged_actions / Math.max(trust.total_actions, 1)) * 100).toFixed(1) : "?"
      const files = provenance ? provenance.length : "?"
      const status = m.status

      if (status === "approved") approved++
      else if (status === "blocked") blocked++
      else if (status === "pending") pending++
      else unknown++

      const statusIcon = status === "approved" ? "✓" : status === "blocked" ? "✗" : "?"
      console.log(`  ${statusIcon} ${m.model_id.padEnd(28)} ${status} (${m.added_by})`)
      if (m.reason) console.log(`    Reason: ${m.reason}`)
      console.log(`    Trust: ${trust?.average_score?.toFixed(1) ?? "?"} avg | Flag rate: ${flagRate}% | Sessions: ${m.session_count} | Files: ${files}`)
      console.log(`    Last used: ${formatDate(m.last_seen)}`)
      console.log()
    }

    console.log(`${models.length} models registered (${approved} approved, ${blocked} blocked, ${unknown} unknown, ${pending} pending)`)
  },
} satisfies CommandModule<object, ListArgs>

export const ModelsApproveCommand = {
  command: "models approve <modelId>",
  describe: "approve a model for use",
  builder: (yargs: any) =>
    yargs
      .positional("modelId", { describe: "Model ID to approve", type: "string" })
      .option("reason", { describe: "Approval reason", type: "string" }),
  handler: async (args: any) => {
    const modelId = args.modelId as string
    const reason = args.reason as string | undefined

    run(`INSERT INTO model_registry (model_id, status, added_by, reason, first_seen, last_seen, session_count, time_created, time_updated)
      VALUES ('${modelId}', 'approved', 'cli', ${reason ? `'${reason}'` : "NULL"}, ${Date.now()}, ${Date.now()}, 0, ${Date.now()}, ${Date.now()})
      ON CONFLICT(model_id) DO UPDATE SET status = 'approved', added_by = 'cli', reason = ${reason ? `'${reason}'` : "NULL"}, time_updated = ${Date.now()}`)

    console.log(`\n✓ Model "${modelId}" approved.${reason ? ` Reason: ${reason}` : ""}\n`)
  },
} satisfies CommandModule<object, ApproveArgs>

export const ModelsBlockCommand = {
  command: "models block <modelId>",
  describe: "block a model from use",
  builder: (yargs: any) =>
    yargs
      .positional("modelId", { describe: "Model ID to block", type: "string" })
      .option("reason", { describe: "Block reason", type: "string" }),
  handler: async (args: any) => {
    const modelId = args.modelId as string
    const reason = args.reason as string | undefined

    run(`INSERT INTO model_registry (model_id, status, added_by, reason, first_seen, last_seen, session_count, time_created, time_updated)
      VALUES ('${modelId}', 'blocked', 'cli', ${reason ? `'${reason}'` : "NULL"}, ${Date.now()}, ${Date.now()}, 0, ${Date.now()}, ${Date.now()})
      ON CONFLICT(model_id) DO UPDATE SET status = 'blocked', added_by = 'cli', reason = ${reason ? `'${reason}'` : "NULL"}, time_updated = ${Date.now()}`)

    console.log(`\n✗ Model "${modelId}" blocked.${reason ? ` Reason: ${reason}` : ""}\n`)
  },
} satisfies CommandModule<object, BlockArgs>

export const ModelsReportCommand = {
  command: "models report [modelId]",
  describe: "model usage report",
  builder: (yargs: any) =>
    yargs.positional("modelId", { describe: "Model ID for detailed report", type: "string" }),
  handler: async (args: any) => {
    const modelId = args.modelId as string | undefined

    if (modelId) {
      const m = query(`SELECT * FROM model_registry WHERE model_id = '${modelId}'`)[0]
      if (!m) {
        console.log(`\nModel "${modelId}" not found in registry.\n`)
        return
      }
      const trust = query(`SELECT * FROM model_trust WHERE model_id = '${modelId}'`)[0]
      const provenance = query(`SELECT operation, COUNT(*) as cnt FROM file_provenance WHERE model_id = '${modelId}' GROUP BY operation`)
      const files = query(`SELECT COUNT(DISTINCT file_path) as cnt FROM file_provenance WHERE model_id = '${modelId}'`)[0]

      console.log(`\nModel Report: ${modelId}`)
      console.log("═".repeat(Math.min(55, modelId.length + 16)))
      console.log()
      console.log(`  Status:        ${m.status} (${m.added_by})`)
      if (m.reason) console.log(`  Reason:        ${m.reason}`)
      console.log(`  First seen:    ${formatDate(m.first_seen)}`)
      console.log(`  Last seen:     ${formatDate(m.last_seen)}`)
      console.log(`  Sessions:      ${m.session_count}`)
      console.log()

      if (trust) {
        const flagRate = ((trust.flagged_actions / Math.max(trust.total_actions, 1)) * 100).toFixed(1)
        console.log(`  Trust Profile:`)
        console.log(`    Total actions: ${trust.total_actions}`)
        console.log(`    Flagged:       ${trust.flagged_actions} (${flagRate}%)`)
        console.log(`    Blocked:       ${trust.blocked_actions}`)
        console.log(`    Average score: ${trust.average_score?.toFixed(1)}`)
        console.log()
      }

      console.log(`  Provenance:`)
      for (const p of provenance) {
        console.log(`    ${p.operation}: ${p.cnt}`)
      }
      console.log(`    Total files:  ${files?.cnt ?? 0}`)
      console.log()
    } else {
      const rows = query(`SELECT m.*, t.flagged_actions, t.total_actions,
        (SELECT COUNT(*) FROM file_provenance WHERE model_id = m.model_id) as total_ops
        FROM model_registry m LEFT JOIN model_trust t ON m.model_id = t.model_id
        ORDER BY m.last_seen DESC`)

      if (rows.length === 0) {
        console.log("\nNo models registered yet.\n")
        return
      }

      console.log("\nModel Registry Report")
      console.log("═".repeat(55))
      console.log()

      for (const r of rows) {
        const flagRate = r.total_actions ? ((r.flagged_actions / r.total_actions) * 100).toFixed(1) : "?"
        const icon = r.status === "approved" ? "✓" : r.status === "blocked" ? "✗" : "?"
        console.log(`  ${icon} ${r.model_id}`)
        console.log(`     Status: ${r.status} (${r.added_by}) | Sessions: ${r.session_count} | Ops: ${r.total_ops ?? 0} | Flags: ${flagRate}%`)
        console.log(`     Last: ${formatDate(r.last_seen)}`)
        console.log()
      }
    }
  },
} satisfies CommandModule<object, ReportArgs>
