import type { DLPDetection } from "../types"

export interface RedactionResult {
  readonly content: string
  readonly redactionCount: number
  readonly redactions: Array<{
    type: "secret" | "pii"
    patternId: string
    lineNumber: number
    originalLength: number
  }>
}

function placeholderFor(d: DLPDetection): string {
  if (d.type === "secret") return `[REDACTED:${d.patternId}]`
  switch (d.patternId) {
    case "pii-email": return "[REDACTED:email]"
    case "pii-phone-us":
    case "pii-phone-intl": return "[REDACTED:phone]"
    case "pii-ssn": return "[REDACTED:ssn]"
    case "pii-credit-card": return "[REDACTED:credit-card]"
    case "pii-ip-address": return "[REDACTED:ip-address]"
    default: return `[REDACTED:${d.patternId}]`
  }
}

/**
 * Redact sensitive content by extracting the snippet's before/after
 * context to locate matches, then replacing with typed placeholders.
 *
 * Processes in reverse line order to maintain correct offsets.
 */
export function redact(content: string, detections: DLPDetection[]): RedactionResult {
  if (detections.length === 0 || !content) {
    return { content, redactionCount: 0, redactions: [] }
  }

  const lines = content.split("\n")
  const redactions: RedactionResult["redactions"] = []

  // Group detections by line number, processing bottom-up
  const byLine = new Map<number, DLPDetection[]>()
  for (const d of detections) {
    const list = byLine.get(d.lineNumber) ?? []
    list.push(d)
    byLine.set(d.lineNumber, list)
  }

  const sortedLines = Array.from(byLine.keys()).sort((a, b) => b - a)

  for (const lineIdx of sortedLines) {
    const dets = byLine.get(lineIdx)!
    const actualIdx = lineIdx - 1
    if (actualIdx < 0 || actualIdx >= lines.length) continue

    let line = lines[actualIdx]

    // Process this line's detections in reverse snippet-order
    // Infer match position from snippet
    for (const d of dets) {
      const snippet = d.snippet
      const redactedIdx = snippet.indexOf("[REDACTED]")
      if (redactedIdx === -1) continue

      const beforeContext = snippet.slice(0, redactedIdx)
      const afterContext = snippet.slice(redactedIdx + "[REDACTED]".length)

      const pos = line.indexOf(beforeContext)
      if (pos === -1) continue

      const matchStart = pos + beforeContext.length
      const afterPos = afterContext.length > 0 ? line.indexOf(afterContext, matchStart) : line.length
      const matchEnd = afterPos !== -1 ? afterPos + afterContext.length : line.length

      const placeholder = placeholderFor(d)
      const originalLength = matchEnd - matchStart

      line = line.slice(0, matchStart) + placeholder + line.slice(matchEnd)

      redactions.push({
        type: d.type === "sensitive_file" ? "secret" as const : d.type as "secret" | "pii",
        patternId: d.patternId,
        lineNumber: lineIdx,
        originalLength,
      })
    }

    lines[actualIdx] = line
  }

  return {
    content: lines.join("\n"),
    redactionCount: redactions.length,
    redactions,
  }
}
