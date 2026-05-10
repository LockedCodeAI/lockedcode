import fs from "fs"
import path from "path"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "confinement.fsevents" })

export interface FSViolation {
  readonly eventType: "change" | "rename"
  readonly filePath: string
  readonly timestamp: number
}

export interface MonitorHandle {
  readonly close: () => void
}

/**
 * Start an FSEvents monitor that watches for writes outside the project root.
 * Uses Node/Bun built-in fs.watch.
 */
export function startFSEventsMonitor(
  projectRoot: string,
  callback: (violation: FSViolation) => void,
): MonitorHandle {
  const watchers: fs.FSWatcher[] = []
  const watchedDirs = new Set<string>()
  const projectDir = path.resolve(projectRoot)

  /**
   * Check if a path is within the project root.
   */
  function isInsideProject(filePath: string): boolean {
    const resolved = path.resolve(filePath)
    return resolved.startsWith(projectDir) || resolved === projectDir
  }

  /**
   * Watch a directory for filesystem events.
   */
  function watchDir(dirPath: string): void {
    if (watchedDirs.has(dirPath)) return
    watchedDirs.add(dirPath)

    try {
      const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
        if (!filename) return
        const fullPath = path.join(dirPath, filename)

        // Check if the event is outside the project root
        if (!isInsideProject(fullPath)) {
          const violation: FSViolation = {
            eventType: eventType as any,
            filePath: fullPath,
            timestamp: Date.now(),
          }
          log.warn("FSEvents: write detected outside project root", {
            path: fullPath,
            eventType,
          })
          callback(violation)
        }
      })
      watchers.push(watcher)
    } catch {}
  }

  // Watch key parent directories for writes outside the project
  const homeDir = require("os").homedir()
  const watchTargets = [
    path.dirname(projectDir),
    homeDir,
    "/tmp",
    "/private/tmp",
  ]

  for (const target of watchTargets) {
    try {
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        watchDir(target)
      }
    } catch {}
  }

  log.info("FSEvents monitor started", { projectRoot, watchCount: watchers.length })

  return {
    close: () => {
      for (const w of watchers) {
        try { w.close() } catch {}
      }
      watchedDirs.clear()
      log.info("FSEvents monitor stopped")
    },
  }
}
