import type { CommandModule } from "yargs"
import path from "path"
import fs from "fs"

type Args = { file?: string; model?: string; review?: string }

function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19)
}

export const ProvenanceCommand = {
  command: "provenance [file]",
  builder: (yargs: any) =>
    yargs
      .positional("file", { describe: "File path to check provenance", type: "string" })
      .option("model", { describe: "Show all files by model ID", type: "string" })
      .option("review", { describe: "Show files for review (compromised model)", type: "string" }),
  handler: async (args: any) => {
    console.log("Provenance tracking is stored in the SQLite database.")
    console.log()
    console.log("Query the file_provenance table directly:")
    console.log("  sqlite3 ~/.local/share/lockedcode/opencode-local.db \\")
    console.log('    "SELECT * FROM file_provenance ORDER BY timestamp DESC LIMIT 20"')
    console.log()
    console.log("Or use --model to filter by model ID:")
    console.log("  lockedcode provenance --model deepseek-v4-pro")
    console.log()
    console.log("Or check provenance for a specific file:")
    console.log("  lockedcode provenance src/security/index.ts")

    if (args.model) {
      console.log(`\nFiltering by model: ${args.model}`)
      const cwd = process.cwd()
      const dataDir = path.join(require("os").homedir(), ".local", "share", "lockedcode")
      const dbPath = path.join(dataDir, "opencode-local.db")
      if (fs.existsSync(dbPath)) {
        // Simple SQLite query via bun shell
        const { $ } = await import("bun")
        const result = await $`sqlite3 ${dbPath} "SELECT file_path, operation, timestamp FROM file_provenance WHERE model_id = '${args.model}' ORDER BY timestamp DESC LIMIT 50"`.text()
        console.log(result)
      }
    }
  },
} satisfies CommandModule<object, Args>
