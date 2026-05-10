import fs from "fs"

/**
 * Capture the current state of a file before modification.
 * Reads the file if it exists (returns null for new files).
 */
export function captureFileState(filePath: string): { exists: boolean; content: string | null } {
  try {
    if (fs.existsSync(filePath)) {
      return { exists: true, content: fs.readFileSync(filePath, "utf-8") }
    }
  } catch {}
  return { exists: false, content: null }
}

/**
 * Rollback a file to its pre-change state.
 * If originalContent is null and the file exists, deletes it (new file that was quarantined).
 * If originalContent is provided, restores it.
 */
export function rollbackFile(filePath: string, originalContent: string | null): void {
  if (originalContent !== null) {
    fs.writeFileSync(filePath, originalContent, "utf-8")
  } else if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

/**
 * Generate a simple unified diff between two strings.
 * Line-based, no external dependencies.
 */
export function createDiff(original: string | null, quarantined: string): string {
  const origLines = (original ?? "").split("\n")
  const quarLines = quarantined.split("\n")

  const lines: string[] = ["--- original", "+++ quarantined"]

  const maxLen = Math.max(origLines.length, quarLines.length)
  for (let i = 0; i < maxLen; i++) {
    const orig = i < origLines.length ? origLines[i] : undefined
    const quar = i < quarLines.length ? quarLines[i] : undefined

    if (orig === undefined && quar !== undefined) {
      lines.push(`+ ${quar}`)
    } else if (orig !== undefined && quar === undefined) {
      lines.push(`- ${orig}`)
    } else if (orig !== quar) {
      lines.push(`- ${orig}`)
      lines.push(`+ ${quar}`)
    } else {
      lines.push(`  ${orig}`)
    }
  }

  return lines.join("\n")
}
