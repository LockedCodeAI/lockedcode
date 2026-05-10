import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import type { ScanFinding, ScanMetadata, Severity } from "../types"
import type { Scanner } from "../scanning/scanner"
import type { CustomRule } from "./schema"
import { loadCustomRules } from "./loader"

const log = Log.create({ service: "rules.custom" })

/** File extension to language mapping for language filtering. */
const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".c": "c", ".h": "c",
  ".cpp": "cpp", ".hpp": "cpp",
  ".cs": "csharp",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell",
  ".yaml": "yaml", ".yml": "yaml",
  ".json": "json",
  ".xml": "xml",
  ".html": "html", ".htm": "html",
  ".css": "css",
  ".md": "markdown",
}

/**
 * Create a CustomScanner instance.
 * Runs custom rules loaded from user-configured rule files.
 */
export function CustomScanner(projectRoot?: string): Effect.Effect<Scanner> {
  return Effect.gen(function* () {
    const rules = loadCustomRules(projectRoot)
    const availableRules = rules.filter((r) => r.enabled)

    const isAvailable = Effect.fn("CustomRules.isAvailable")(function* () {
      return availableRules.length > 0
    })

    const scan = Effect.fn("CustomRules.scan")(function* (content: string, metadata: ScanMetadata) {
      if (content.length === 0) return [] as ScanFinding[]

      const findings: ScanFinding[] = []
      const ext = metadata.extension ?? ""
      const lang = EXT_TO_LANG[ext]
      const operation = metadata.operation

      for (const rule of availableRules) {
        // Skip rules whose type doesn't match the current scan context
        if (operation === "command" && rule.type !== "command") continue
        if ((operation === "write" || operation === "edit" || operation === "patch") && rule.type === "command") continue
        if (operation === "context" && rule.type === "command") continue
        if (operation === "context" && rule.type !== "outbound" && rule.type !== "content") continue

        // Language filtering
        if (rule.languages && rule.languages.length > 0 && lang && !rule.languages.includes(lang)) continue

        // Run the regex
        const matches = content.matchAll(rule.regex)
        for (const match of matches) {
          findings.push({
            severity: rule.severity as Severity,
            ruleId: rule.id,
            scanner: "custom",
            matchedContent: match[0].slice(0, 60),
            confidence: rule.severity === "critical" ? "high" : "medium",
            remediation: rule.remediation || rule.description,
          })
          // One finding per rule per scan is enough — no need to flood with 1000 matches
          break
        }
      }

      if (findings.length > 0) {
        log.info("custom rules detected", { count: findings.length })
      }

      return findings
    })

    return { name: "custom", isAvailable, scan }
  })
}
