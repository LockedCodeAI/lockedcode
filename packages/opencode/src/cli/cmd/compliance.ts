import type { CommandModule } from "yargs"
import fs from "fs"
import { generateReport } from "../../security/compliance/generator"
import { formatMarkdown, formatJSON } from "../../security/compliance/markdown"

type Args = { framework?: string; since?: string; until?: string; output?: string; format?: string }

export const ComplianceReportCommand = {
  command: "compliance report",
  builder: (yargs: any) =>
    yargs
      .option("framework", { describe: "Compliance framework", type: "string", choices: ["soc2", "iso27001", "hipaa", "fedramp", "all"], default: "all" })
      .option("since", { describe: "Start date (ISO format or relative like 30d)", type: "string" })
      .option("until", { describe: "End date (ISO format)", type: "string" })
      .option("output", { describe: "Output file path", type: "string" })
      .option("format", { describe: "Output format", type: "string", choices: ["markdown", "json"], default: "markdown" }),
  handler: async (args: any) => {
    const framework = args.framework as string
    const output = args.output as string | undefined
    const fmt = args.format as string

    let startTime: number | undefined
    let endTime: number | undefined

    if (args.since) {
      const since = args.since as string
      const match = since.match(/^(\d+)([dh])$/)
      if (match) {
        startTime = Date.now() - parseInt(match[1]) * (match[2] === "h" ? 3600000 : 86400000)
      } else {
        startTime = new Date(since).getTime()
      }
    }

    if (args.until) {
      endTime = new Date(args.until as string).getTime()
    }

    const report = generateReport({ framework, startTime, endTime })
    const result = fmt === "json" ? formatJSON(report) : formatMarkdown(report)

    if (output) {
      fs.writeFileSync(output, result, "utf-8")
      console.log(`Compliance report written to ${output}`)
    } else {
      console.log(result)
    }
  },
} satisfies CommandModule<object, Args>
