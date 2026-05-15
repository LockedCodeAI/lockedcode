import fs from "fs"
import path from "path"
import * as Log from "@opencode-ai/core/util/log"
import { checkPathSync } from "../confinement/whitelist"

const log = Log.create({ service: "rules.resolver" })

type RuleType = "semgrep" | "yara" | "secrets" | "injection"

const resolvedCache = new Map<string, string | null>()

/**
 * Resolve the path to a rules directory for a given rule type.
 *
 * Search order:
 * 1. Custom path from policy config
 * 2. Project-local: <projectRoot>/rules/<ruleType>/
 * 3. User home: ~/.lockedcode/rules/<ruleType>/
 * 4. Repo-relative (dev): <repoRoot>/rules/<ruleType>/
 * 5. Distribution-bundled: <packagePath>/rules/<ruleType>/
 *
 * Returns the first path that exists and contains rule files, or null.
 */
export function resolveRulesPath(ruleType: RuleType, customPath?: string, projectRoot?: string): string | null {
  const cacheKey = `${ruleType}:${customPath ?? "default"}:${projectRoot ?? process.cwd()}`
  if (resolvedCache.has(cacheKey)) return resolvedCache.get(cacheKey) ?? null

  const candidates: string[] = []

  // 1. Custom path
  if (customPath) {
    candidates.push(customPath)
  }

  // 2. Project-local
  const cwd = projectRoot ?? process.cwd()
  candidates.push(path.join(cwd, "rules", ruleType))

  // 3. User home — skipped, global rules not supported (see loader.ts allowGlobalRules guard)

  // 4. Repo-relative (development) — walk up looking for rules/ dir
  let current = path.resolve(cwd)
  for (let i = 0; i < 10; i++) {
    const repoRules = path.join(current, "rules", ruleType)
    candidates.push(repoRules)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  // 5. Try relative to the security module path
  candidates.push(path.join(__dirname, "..", "..", "..", "..", "rules", ruleType))

  for (const dir of candidates) {
    try {
      const result = checkPathSync(dir, "read", cwd)
      if (!result.allowed) {
        log.debug("confinement denied rules path", { dir, reason: result.reason })
        continue
      }
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const files = fs.readdirSync(dir)
        if (files.length > 0) {
          log.debug("resolved rules path", { ruleType, path: dir })
          resolvedCache.set(cacheKey, dir)
          return dir
        }
      }
    } catch {
      continue
    }
  }

  log.warn("no rules path found", { ruleType })
  resolvedCache.set(cacheKey, null)
  return null
}

/**
 * Clear the resolver cache (for testing).
 */
export function clearResolverCache(): void {
  resolvedCache.clear()
}
