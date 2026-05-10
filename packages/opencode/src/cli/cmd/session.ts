import type { CommandModule } from "yargs"
import fs from "fs"
import { buildTimeline } from "../../security/session/timeline"
import { formatTimeline, formatTimelineJSON } from "../../security/session/formatter"
import { listSessions } from "../../security/session/list"

type ListArgs = { limit?: number; since?: string }
type ReplayArgs = { sessionId: string }
type ExportArgs = { sessionId: string; output?: string }

export const SessionListCommand = {
  command: "session list",
  describe: "list recorded sessions",
  builder: (yargs: any) =>
    yargs
      .option("limit", { describe: "Max sessions", type: "number", default: 20 })
      .option("since", { describe: "Time range (7d, 24h)", type: "string" }),
  handler: async (args: any) => {
    const limit = args.limit as number
    const since = args.since as string | undefined
    let sinceMs: number | undefined
    if (since) {
      const m = since.match(/^(\d+)([dh])$/)
      if (m) sinceMs = Date.now() - parseInt(m[1]) * (m[2] === "h" ? 3600000 : 86400000)
    }

    const sessions = listSessions({ limit, since: sinceMs })

    if (sessions.length === 0) {
      console.log("\nNo sessions found.\n")
      return
    }

    console.log("\nRecent Sessions")
    console.log("═".repeat(55))
    console.log()

    for (const s of sessions) {
      const dur = Math.floor((s.endTime - s.startTime) / 60000)
      const startStr = new Date(s.startTime).toISOString().slice(0, 16).replace("T", " ")
      const trust = s.trustScore > 50 ? "high" : s.trustScore > 20 ? "medium" : "low"
      console.log(`  ${s.sessionId.slice(0, 8)}  ${s.modelId.padEnd(18)} ${startStr}  ${dur}m`)
      console.log(`          Actions: ${s.eventCount} | Findings: ${s.findingCount} | Blocked: ${s.blockedCount} | Trust: ${trust}`)
      console.log()
    }

    console.log(`${sessions.length} sessions`)
  },
} satisfies CommandModule<object, ListArgs>

export const SessionReplayCommand = {
  command: "session replay <sessionId>",
  describe: "replay a recorded session",
  builder: (yargs: any) => yargs.positional("sessionId", { describe: "Session ID to replay", type: "string" }),
  handler: async (args: any) => {
    const sessionId = args.sessionId as string
    const timeline = buildTimeline(sessionId)

    if (timeline.entries.length === 0) {
      console.log(`\nNo events found for session "${sessionId}".\n`)
      return
    }

    console.log()
    console.log(formatTimeline(timeline))
    console.log()
  },
} satisfies CommandModule<object, ReplayArgs>

export const SessionExportCommand = {
  command: "session export <sessionId>",
  describe: "export session data",
  builder: (yargs: any) =>
    yargs
      .positional("sessionId", { describe: "Session ID to export", type: "string" })
      .option("output", { describe: "Output file path", type: "string" }),
  handler: async (args: any) => {
    const sessionId = args.sessionId as string
    const output = args.output as string | undefined
    const timeline = buildTimeline(sessionId)

    if (timeline.entries.length === 0) {
      console.log(`\nNo events found for session "${sessionId}".\n`)
      return
    }

    const json = formatTimelineJSON(timeline)

    if (output) {
      fs.writeFileSync(output, json, "utf-8")
      console.log(`Session exported to ${output}`)
    } else {
      console.log(json)
    }
  },
} satisfies CommandModule<object, ExportArgs>
