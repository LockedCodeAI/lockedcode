import type { CommandModule } from "yargs"
import fs from "fs"
import path from "path"
import { fingerprint, similarity } from "../../security/license/fingerprint"
import { loadSignatures } from "../../security/license/signatures"
import { classifyLicense } from "../../security/license/classify"
import { checkPathSync } from "../../security/confinement/whitelist"

type ScanArgs = { file: string; threshold?: number }
type ReportArgs = { since?: string }

export const LicenseScanCommand = {
  command: "license scan <file>",
  describe: "license contamination scanning",
  builder: (yargs: any) =>
    yargs
      .positional("file", { describe: "File to scan for license contamination", type: "string" })
      .option("threshold", { describe: "Similarity threshold (0.0-1.0)", type: "number", default: 0.6 }),
  handler: async (args: any) => {
    const filepath = args.file as string
    const threshold = args.threshold as number

    if (!fs.existsSync(filepath)) {
      console.error(`File not found: ${filepath}`)
      process.exit(1)
    }

    const resolved = path.resolve(filepath)
    const readCheck = checkPathSync(resolved, "read", process.cwd())
    if (!readCheck.allowed) {
      console.error(`Confinement: cannot read ${resolved} — ${readCheck.reason}`)
      process.exit(1)
    }

    const content = fs.readFileSync(filepath, "utf-8")
    const fp = fingerprint(content)
    const signatures = loadSignatures()

    console.log(`\nLicense Scan: ${filepath}`)
    console.log("═".repeat(Math.min(55, filepath.length + 16)))
    console.log()

    let found = false

    for (const sig of signatures) {
      const sim = similarity(fp, sig.fp)
      if (sim >= threshold) {
        found = true
        const cls = classifyLicense(sig.licenseSPDX)
        const icon = cls.risk === "copyleft" ? "🔴" : cls.risk === "weak-copyleft" ? "🟡" : "🟠"
        console.log(`  ${icon} ${(sim >= 0.8 ? "High" : "Medium")} confidence match (similarity: ${sim.toFixed(2)})`)
        console.log(`     Source: ${sig.sourceProject}/${sig.moduleName} (${sig.licenseSPDX})`)
        console.log(`     Risk: ${cls.description}`)
        console.log()
      }
    }

    if (!found) {
      console.log("  ✓ No license contamination detected.\n")
    }
  },
} satisfies CommandModule<object, ScanArgs>

export const LicenseReportCommand = {
  command: "license report",
  describe: "license contamination report",
  builder: (yargs: any) =>
    yargs.option("since", { describe: "Time range", type: "string" }),
  handler: async (args: any) => {
    console.log("\nLicense report requires audit trail data with license findings.")
    console.log("Run the agent first to generate scan data, then run this command.")
    console.log()
  },
} satisfies CommandModule<object, ReportArgs>
