import fs from "fs"
import path from "path"
import os from "os"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "confinement.root" })

/** Project markers, checked in order of preference. */
const PROJECT_MARKERS = [
  ".git",
  "lockedcode.json",
  "lockedcode.jsonc",
  "package.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "pom.xml",
]

/**
 * Detect the project root directory.
 *
 * Algorithm:
 * 1. If explicit `projectRoot` is provided, use it (canonicalized).
 * 2. Walk up from `cwd` looking for `.git` directory or file (worktrees).
 * 3. Walk up looking for lockedcode.json/lockedcode.jsonc.
 * 4. Walk up looking for common project markers.
 * 5. Fall back to cwd.
 *
 * The detected root is cached for the session lifetime.
 */
export function detectProjectRoot(cwd: string, explicitRoot?: string): string {
  if (explicitRoot) {
    const canon = canonicalizeInternal(explicitRoot, cwd)
    log.info("LockedCode: Project root (explicit config) at", { root: canon })
    return canon
  }

  const visited = new Set<string>()
  let current = path.resolve(cwd)

  while (true) {
    if (visited.has(current)) break
    visited.add(current)

    for (const marker of PROJECT_MARKERS) {
      const markerPath = path.join(current, marker)
      try {
        if (fs.existsSync(markerPath)) {
          const root = canonicalizeInternal(current, cwd)
          log.info("LockedCode: Project root detected at", { root, marker })
          return root
        }
      } catch {
        // Permission denied or other error — skip and continue
      }
    }

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  const fallback = canonicalizeInternal(cwd, cwd)
  log.info("LockedCode: Project root (cwd fallback) at", { root: fallback })
  return fallback
}

/**
 * Canonicalize a path during root detection (simple version — resolves, realpaths).
 */
function canonicalizeInternal(input: string, cwd: string): string {
  let resolved = input.trim()

  if (resolved.length === 0) return path.resolve(cwd)

  if (resolved.startsWith("~")) {
    resolved = path.join(os.homedir(), resolved.slice(1))
  }

  const abs = path.resolve(cwd, resolved)
  try {
    return fs.realpathSync(abs)
  } catch {
    return abs
  }
}
