import fs from "fs"
import path from "path"
import * as Log from "@opencode-ai/core/util/log"
import { CustomRuleFileSchema, type CustomRule } from "./schema"
import { checkPathSync } from "../confinement/whitelist"

const log = Log.create({ service: "rules.loader" })

const MAX_REGEX_SOURCE_LENGTH = 1024

/**
 * Discover and load custom rule files from standard paths.
 *
 * Default search path is project-local only: `<projectRoot>/.lockedcode/rules/`.
 * Home-directory rules (`~/.lockedcode/custom-rules/`) are not loaded by default.
 * Pass `allowGlobalRules: true` to enable global rules (not implemented in this
 * version — the flag is recognized but produces a "not implemented" error).
 *
 * @param projectRoot - Project root directory (defaults to cwd)
 * @param options - Optional configuration
 * @param options.customPath - Explicit path to a single rule file
 * @param options.allowGlobalRules - If true, attempt to load global rules (stub — not implemented)
 * @returns Array of compiled CustomRule objects ready for scanning
 */
export function loadCustomRules(
  projectRoot?: string,
  customPath?: string,
  options?: { allowGlobalRules?: boolean },
): CustomRule[] {
  const allRules: CustomRule[] = []
  const cwd = projectRoot ?? process.cwd()
  const seenIds = new Map<string, string>()

  if (options?.allowGlobalRules) {
    log.error("global rules not implemented", {
      message: "The --allow-global-rules flag is recognized but global rules loading is not wired in this version.",
    })
    throw new Error("Global rules loading is not implemented. Remove --allow-global-rules to use project-local rules only.")
  }

  const candidates: string[] = []

  if (customPath) {
    candidates.push(customPath)
  }

  const dirsToScan = [
    customPath,
    path.join(cwd, ".lockedcode", "rules"),
  ].filter(Boolean) as string[]

  for (const dir of dirsToScan) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
        for (const file of files) {
          const filePath = path.join(dir, file)
          const confinement = checkPathSync(filePath, "read", cwd)
          if (!confinement.allowed) {
            log.warn("confinement denied rule file access", { filepath: filePath, reason: confinement.reason })
            continue
          }
          candidates.push(filePath)
        }
      }
    } catch {
      continue
    }
  }

  for (const filepath of candidates) {
    if (filepath === customPath && candidates.filter((c) => c === customPath).length > 1) {
      continue
    }
    try {
      if (!fs.existsSync(filepath)) continue

      const confinement = checkPathSync(filepath, "read", cwd)
      if (!confinement.allowed) {
        log.warn("confinement denied rule file read", { filepath, reason: confinement.reason })
        continue
      }

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

        if (raw.pattern.length > MAX_REGEX_SOURCE_LENGTH) {
          log.warn("regex pattern exceeds maximum length", {
            ruleId: raw.id,
            filepath,
            length: raw.pattern.length,
            maxLength: MAX_REGEX_SOURCE_LENGTH,
          })
          continue
        }

        try {
          const flags = raw.flags ? (raw.flags.includes("u") ? raw.flags : raw.flags + "u") : "u"
          const regex = new RegExp(raw.pattern, flags)
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
