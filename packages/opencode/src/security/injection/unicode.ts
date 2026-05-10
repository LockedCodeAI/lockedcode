export interface UnicodeDetection {
  readonly codePoint: number
  readonly char: string
  readonly name: string
  readonly category: "invisible" | "bidi" | "homoglyph" | "tag"
  readonly lineNumber: number
  readonly column: number
  readonly severity: "warning" | "critical"
}

/** Invisible Unicode character ranges. */
const INVISIBLE_CHARS = new Map<number, string>([
  [0x200B, "Zero Width Space"],
  [0x200C, "Zero Width Non-Joiner"],
  [0x200D, "Zero Width Joiner"],
  [0x200E, "Left-to-Right Mark"],
  [0x200F, "Right-to-Left Mark"],
  [0x2060, "Word Joiner"],
  [0x2061, "Function Application"],
  [0x2062, "Invisible Times"],
  [0x2063, "Invisible Separator"],
  [0x2064, "Invisible Plus"],
  [0xFEFF, "Byte Order Mark / Zero Width No-Break Space"],
])

/** Bidirectional override characters. */
const BIDI_CHARS = new Map<number, string>([
  [0x202A, "Left-to-Right Embedding"],
  [0x202B, "Right-to-Left Embedding"],
  [0x202C, "Pop Directional Formatting"],
  [0x202D, "Left-to-Right Override"],
  [0x202E, "Right-to-Left Override"],
  [0x2066, "Left-to-Right Isolate"],
  [0x2067, "Right-to-Left Isolate"],
  [0x2068, "First Strong Isolate"],
  [0x2069, "Pop Directional Isolate"],
])

/** Unicode tag characters range. */
const TAG_START = 0xE0000
const TAG_END = 0xE007F

/** Cyrillic characters that look like Latin ASCII. */
const HOMOGLYPH_MAP: Array<{ cyrillic: number; latin: string }> = [
  { cyrillic: 0x0430, latin: "a" }, // а
  { cyrillic: 0x0435, latin: "e" }, // е
  { cyrillic: 0x043E, latin: "o" }, // о
  { cyrillic: 0x0440, latin: "p" }, // р
  { cyrillic: 0x0441, latin: "c" }, // с
  { cyrillic: 0x0445, latin: "x" }, // х
  { cyrillic: 0x0456, latin: "i" }, // і
  { cyrillic: 0x0432, latin: "v" }, // в
  { cyrillic: 0x043D, latin: "h" }, // н
  { cyrillic: 0x043A, latin: "k" }, // к
  { cyrillic: 0x043C, latin: "m" }, // м
  { cyrillic: 0x0442, latin: "t" }, // т
  { cyrillic: 0x0443, latin: "y" }, // у
  { cyrillic: 0x0438, latin: "i" }, // и
]

/** Detect invisible Unicode characters. */
export function detectInvisibleChars(content: string): UnicodeDetection[] {
  return detectChars(content, INVISIBLE_CHARS, "invisible", "warning")
}

/** Detect bidirectional override characters. */
export function detectBidiOverrides(content: string): UnicodeDetection[] {
  return detectChars(content, BIDI_CHARS, "bidi", "critical")
}

/** Detect Unicode tag characters. */
export function detectTagChars(content: string): UnicodeDetection[] {
  return detectCharsInRange(content, TAG_START, TAG_END, "tag", "critical", "Unicode Tag Character")
}

/** Detect Cyrillic homoglyphs in otherwise Latin-looking strings. */
export function detectHomoglyphs(content: string): UnicodeDetection[] {
  const detections: UnicodeDetection[] = []
  const lines = content.split("\n")

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    let cyrCount = 0
    let homoglyphPos = -1

    for (let ci = 0; ci < line.length; ci++) {
      const cp = line.charCodeAt(ci)
      if (HOMOGLYPH_MAP.some((h) => h.cyrillic === cp)) {
        cyrCount++
        if (homoglyphPos === -1) homoglyphPos = ci
      }
    }

    // Flag if multiple homoglyphs on the same line
    if (cyrCount >= 3 && homoglyphPos >= 0) {
      detections.push({
        codePoint: line.charCodeAt(homoglyphPos),
        char: line[homoglyphPos],
        name: "Cyrillic homoglyph in Latin text context",
        category: "homoglyph",
        lineNumber: li + 1,
        column: homoglyphPos + 1,
        severity: "warning",
      })
    }
  }

  return detections
}

/** Detect all Unicode manipulation types at once. */
export function detectAll(content: string): UnicodeDetection[] {
  return [
    ...detectInvisibleChars(content),
    ...detectBidiOverrides(content),
    ...detectTagChars(content),
    ...detectHomoglyphs(content),
  ]
}

function detectChars(content: string, charMap: Map<number, string>, category: UnicodeDetection["category"], severity: UnicodeDetection["severity"]): UnicodeDetection[] {
  const detections: UnicodeDetection[] = []
  const lines = content.split("\n")
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    for (let ci = 0; ci < line.length; ci++) {
      const cp = line.charCodeAt(ci)
      if (charMap.has(cp)) {
        detections.push({
          codePoint: cp,
          char: line[ci],
          name: charMap.get(cp)!,
          category,
          lineNumber: li + 1,
          column: ci + 1,
          severity,
        })
      }
    }
  }
  return detections
}

function detectCharsInRange(content: string, start: number, end: number, category: UnicodeDetection["category"], severity: UnicodeDetection["severity"], name: string): UnicodeDetection[] {
  const detections: UnicodeDetection[] = []
  const lines = content.split("\n")
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    for (let ci = 0; ci < line.length; ci++) {
      const cp = line.charCodeAt(ci)
      if (cp >= start && cp <= end) {
        detections.push({
          codePoint: cp,
          char: line[ci],
          name: `${name} (U+${cp.toString(16).toUpperCase().padStart(5, "0")})`,
          category,
          lineNumber: li + 1,
          column: ci + 1,
          severity,
        })
      }
    }
  }
  return detections
}
