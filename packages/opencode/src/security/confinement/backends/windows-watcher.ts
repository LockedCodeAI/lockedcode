import fs from "fs"
import path from "path"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "confinement.watcher" })

export interface FSViolation {
  readonly eventType: "change" | "rename"
  readonly filePath: string
  readonly timestamp: number
}

export interface MonitorHandle {
  readonly close: () => void
}

/**
 * Start filesystem monitoring for writes outside the project root.
 * Uses Node/Bun built-in fs.watch (cross-platform equivalent of FSEvents).
 */
export function startWatcher(
  projectRoot: string,
  callback: (violation: FSViolation) => void,
): MonitorHandle {
  const watchers: fs.FSWatcher[] = []
  const projectDir = path.resolve(projectRoot)

  function isInsideProject(filePath: string): boolean {
    const resolved = path.resolve(filePath)
    return resolved.startsWith(projectDir) || resolved === projectDir
  }

  function watchDir(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) return
      const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
        if (!filename) return
        const fullPath = path.join(dirPath, filename)
        if (!isInsideProject(fullPath)) {
          const violation: FSViolation = {
            eventType: eventType as any,
            filePath: fullPath,
            timestamp: Date.now(),
          }
          log.warn("File watcher: write detected outside project root", { path: fullPath })
          callback(violation)
        }
      })
      watchers.push(watcher)
    } catch {}
  }

  // Watch parent directories
  const targets = [
    path.dirname(projectDir),
    process.env.USERPROFILE || "C:\\Users",
    process.env.TEMP || "C:\\Windows\\Temp",
  ]

  for (const target of targets) {
    watchDir(target)
  }

  log.info("Windows file watcher started", { projectRoot, watchCount: watchers.length })

  return {
    close: () => {
      for (const w of watchers) {
        try { w.close() } catch {}
      }
      log.info("File watcher stopped")
    },
  }
}
