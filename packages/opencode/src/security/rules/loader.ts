import fs from "fs"
import path from "path"
import os from "os"
import * as Log from "@opencode-ai/core/util/log"
import { CustomRuleFileSchema, type CustomRule } from "./schema"

const log = Log.create({ service: "rules.loader" })

/**
 * Discover and load custom rule files from standard paths.
 *
 * Search order:
 * 1. Project-local: <projectRoot>/.lockedcode/rules/
 * 2. User home: ~/.lockedcode/custom-rules/
 *
 * Returns an array of compiled CustomRule objects ready for scanning.
 */
export function loadCustomRules(projectRoot?: string, customPath?: string): CustomRule[] {
  const allRules: CustomRule[] = []
  const cwd = projectRoot ?? process.cwd()
  const seenIds = new Map<string, string>() // ruleId → source file

  // Collect candidate files
  const candidates: string[] = []

  if (customPath) {
    candidates.push(customPath)
  }

  const dirsToScan = [
    customPath,
    path.join(cwd, ".lockedcode", "rules"),
    path.join(os.homedir(), ".lockedcode", "custom-rules"),
  ].filter(Boolean) as string[]

  for (const dir of dirsToScan) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
        for (const file of files) {
          candidates.push(path.join(dir, file))
        }
      }
    } catch {
      continue
    }
  }

  // Load and validate each file
  for (const filepath of candidates) {
    // Skip files already added by explicit path
    if (filepath === customPath && candidates.filter((c) => c === customPath).length > 1) {
      continue
    }
    try {
      if (!fs.existsSync(filepath)) continue
      const content = fs.readFileSync(filepath, "utf-8")
      const parsed = JSON.parse(content)
      const result = CustomRuleFileSchema.safeParse(parsed)

      if (!result.success) {
        log.warn("custom rule file has validation errors", {
          filepath,
          errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        })
        continue
      }

      for (const raw of result.data.rules) {
        if (seenIds.has(raw.id)) {
          log.info("custom rule overrides previous rule", { ruleId: raw.id, filepath, previous: seenIds.get(raw.id) })
        }
        seenIds.set(raw.id, filepath)

        try {
          const regex = raw.flags ? new RegExp(raw.pattern, raw.flags) : new RegExp(raw.pattern)
          allRules.push({
            id: raw.id,
            name: raw.name,
            type: raw.type as any,
            regex,
            severity: raw.severity as any,
            languages: raw.languages,
            description: raw.description,
            remediation: raw.remediation ?? "",
            tags: raw.tags ?? [],
            enabled: raw.enabled !== false,
            testCases: raw.testCases ? { shouldMatch: raw.testCases.shouldMatch ?? [], shouldNotMatch: raw.testCases.shouldNotMatch ?? [] } : undefined,
            source: filepath,
          })
        } catch (reErr: any) {
          log.warn("failed to compile regex for custom rule", { ruleId: raw.id, filepath, error: reErr.message })
        }
      }
    } catch (err: any) {
      log.warn("failed to load custom rule file", { filepath, error: err.message })
    }
  }

  log.info("custom rules loaded", { count: allRules.length, sources: [...new Set(allRules.map((r) => r.source))] })
  return allRules
}
