/**
 * Normalized n-gram code fingerprinting engine.
 *
 * Steps:
 * 1. Strip comments
 * 2. Normalize whitespace
 * 3. Normalize identifiers (variable names → VAR)
 * 4. Normalize string/number literals → STR/NUM
 * 5. Generate n-gram hashes from normalized tokens
 */

/** Default n-gram size. */
const N = 5

/**
 * A code fingerprint — set of n-gram hashes.
 */
export interface CodeFingerprint {
  readonly ngrams: Set<number>
  readonly size: number
}

/**
 * Strip line and block comments from source code.
 */
function stripComments(code: string): string {
  return code
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/#.*$/gm, "")
    .replace(/--.*$/gm, "")
}

/**
 * Normalize variable-like identifiers.
 * Replaces names that look like variables/function names with placeholders.
 */
function normalizeIdentifiers(code: string): string {
  let counter = 0
  const seen = new Map<string, string>()

  return code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
    // Don't normalize keywords
    if (/^(if|else|for|while|do|switch|case|break|continue|return|function|class|const|let|var|import|export|from|require|def|int|float|string|void|public|private|static|new|this|super|null|undefined|true|false)$/.test(match)) {
      return match
    }
    if (!seen.has(match)) {
      seen.set(match, `VAR${counter++}`)
    }
    return seen.get(match)!
  })
}

/**
 * Normalize string and number literals.
 */
function normalizeLiterals(code: string): string {
  return code
    .replace(/"[^"]*"/g, "STR")
    .replace(/'[^']*'/g, "STR")
    .replace(/`[^`]*`/g, "STR")
    .replace(/\b\d+\.?\d*\b/g, "NUM")
}

/**
 * Tokenize code into a sequence of tokens for n-gram generation.
 * Tokens include: normalized words, operators, and punctuation.
 */
function tokenize(code: string): string[] {
  const normalized = normalizeLiterals(normalizeIdentifiers(stripComments(code)))
  const tokens: string[] = []

  let current = ""
  for (const c of normalized) {
    if (/\s/.test(c)) {
      if (current) { tokens.push(current); current = "" }
      // Skip whitespace
    } else if (/[a-zA-Z0-9_]/.test(c)) {
      current += c
    } else {
      if (current) { tokens.push(current); current = "" }
      tokens.push(c)
    }
  }
  if (current) tokens.push(current)

  return tokens
}

/**
 * Generate a simple hash for a string (used for n-gram hashing).
 */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return h
}

/**
 * Fingerprint a piece of code.
 */
export function fingerprint(code: string): CodeFingerprint {
  if (!code || code.trim().length === 0) {
    return { ngrams: new Set(), size: 0 }
  }

  const tokens = tokenize(code)
  const ngrams = new Set<number>()

  for (let i = 0; i <= tokens.length - N; i++) {
    const ngram = tokens.slice(i, i + N).join(" ")
    ngrams.add(hash(ngram))
  }

  return { ngrams, size: ngrams.size }
}

/**
 * Jaccard similarity between two fingerprints.
 */
export function similarity(fp1: CodeFingerprint, fp2: CodeFingerprint): number {
  if (fp1.size === 0 || fp2.size === 0) return 0

  let intersection = 0
  for (const h of fp1.ngrams) {
    if (fp2.ngrams.has(h)) intersection++
  }

  const union = fp1.size + fp2.size - intersection
  return union > 0 ? intersection / union : 0
}
