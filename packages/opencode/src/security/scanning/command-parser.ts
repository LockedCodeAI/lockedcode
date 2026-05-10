/**
 * Security-focused shell command parser.
 *
 * This is NOT a full POSIX shell parser. It extracts the security-relevant
 * structure from shell commands that LLMs typically produce.
 *
 * Known limitations:
 * - Does not handle heredocs (<<EOF)
 * - Does not handle complex nested quoting (escaped quotes inside quotes)
 * - Does not handle brace expansion
 * - Does not handle aliases
 * - Glob patterns are not expanded
 * - Variable expansion is purely syntactic (not semantic)
 */

export interface ParsedCommand {
  readonly raw: string
  readonly segments: CommandSegment[]
  readonly pipes: boolean
  readonly redirects: Redirect[]
  readonly backgrounded: boolean
  readonly subshells: string[]
  readonly paths: ExtractedPath[]
  readonly envVarReads: string[]
  readonly envVarSets: string[]
}

export interface CommandSegment {
  readonly command: string
  readonly args: string[]
  readonly raw: string
}

export interface Redirect {
  readonly type: "stdout" | "stderr" | "stdin" | "append"
  readonly target: string
}

export interface ExtractedPath {
  readonly path: string
  readonly context: "argument" | "redirect" | "subshell"
  readonly operation: "read" | "write" | "execute" | "unknown"
}

/** Sensitive environment variable patterns. */
const SENSITIVE_VAR_PATTERNS = [
  /^AWS_ACCESS_KEY_ID$/,
  /^AWS_SECRET_ACCESS_KEY$/,
  /^AWS_SESSION_TOKEN$/,
  /^GITHUB_TOKEN$/,
  /^GH_TOKEN$/,
  /^DATABASE_URL$/,
  /^DB_PASSWORD$/,
  /^DB_USERNAME$/,
  /^API_KEY$/,
  /^AUTH_TOKEN$/,
  /^OPENAI_API_KEY$/,
  /^ANTHROPIC_API_KEY$/,
  /.*_KEY$/,
  /.*_SECRET$/,
  /.*_TOKEN$/,
  /.*_PASSWORD$/,
  /.*_CREDENTIAL$/,
]

/** Non-sensitive variables that look like sensitive patterns but aren't. */
const NON_SENSITIVE_VARS = new Set([
  "HOME", "PATH", "USER", "PWD", "SHELL", "TERM", "LANG",
  "NODE_ENV", "BUN_ENV", "CI",
])

/**
 * Parse a shell command string into its security-relevant structure.
 */
export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim()
  const subshells: string[] = []
  const envVarReads: string[] = []
  const envVarSets: string[] = []
  const redirects: Redirect[] = []
  const pipes = trimmed.includes("|")
  const backgrounded = trimmed.endsWith("&") && !trimmed.endsWith("&&") && !trimmed.endsWith("&>")

  let cleaned = trimmed
  if (backgrounded) cleaned = trimmed.slice(0, -1).trim()

  // Extract command substitutions ($(...))
  const dollarParenRe = /\$\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = dollarParenRe.exec(cleaned)) !== null) {
    subshells.push(match[1])
  }

  // Extract backtick substitutions
  const backtickRe = /`([^`]+)`/g
  while ((match = backtickRe.exec(cleaned)) !== null) {
    subshells.push(match[1])
  }

  // Tokenize respecting quotes
  const tokens = tokenize(cleaned)

  // Extract redirects
  const extractedRedirects = extractRedirects(tokens)
  redirects.push(...extractedRedirects.redirects)
  const filteredTokens = extractedRedirects.remaining

  // Extract env var reads and sets
  const envInfo = extractEnvVarInfo(tokens, trimmed)
  envVarReads.push(...envInfo.reads)
  envVarSets.push(...envInfo.sets)

  // Split into pipeline/chain segments
  const segmentsRaw = splitSegments(filteredTokens)
  const segments: CommandSegment[] = segmentsRaw.map((segTokens) => ({
    command: segTokens[0] ?? "",
    args: segTokens.slice(1),
    raw: segTokens.join(" "),
  }))

  // Extract paths from arguments
  const paths = extractPaths(filteredTokens)

  return {
    raw,
    segments,
    pipes,
    redirects,
    backgrounded,
    subshells,
    paths,
    envVarReads,
    envVarSets,
  }
}

/**
 * Tokenize a command string respecting single and double quotes.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inSingle = false
  let inDouble = false
  let i = 0

  while (i < input.length) {
    const c = input[i]
    const prev = i > 0 ? input[i - 1] : ""

    if (c === "'" && !inDouble && prev !== "\\") {
      inSingle = !inSingle
      current += c
    } else if (c === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble
      current += c
    } else if (c === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += c
    }
    i++
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Extract redirect operators and their targets from token list.
 */
function extractRedirects(tokens: string[]): { redirects: Redirect[]; remaining: string[] } {
  const redirects: Redirect[] = []
  const remaining: string[] = []
  let skip = false

  for (let i = 0; i < tokens.length; i++) {
    if (skip) { skip = false; continue }

    const tok = tokens[i]
    const next = i + 1 < tokens.length ? tokens[i + 1] : undefined

    if (tok === ">" && next) {
      redirects.push({ type: "stdout", target: stripQuotes(next) })
      skip = true
    } else if (tok === ">>" && next) {
      redirects.push({ type: "append", target: stripQuotes(next) })
      skip = true
    } else if (tok === "<" && next) {
      redirects.push({ type: "stdin", target: stripQuotes(next) })
      skip = true
    } else if ((tok === "2>" || tok === "2>>") && next) {
      redirects.push({
        type: tok === "2>" ? "stderr" : "append",
        target: stripQuotes(next),
      })
      skip = true
    } else if (tok.startsWith(">") && !tok.includes(">", 1) && next) {
      redirects.push({ type: "stdout", target: stripQuotes(next) })
      skip = true
    } else {
      remaining.push(tok)
    }
  }

  return { redirects, remaining }
}

/**
 * Split tokens by pipeline and chain operators.
 */
function splitSegments(tokens: string[]): string[][] {
  const segments: string[][] = []
  let current: string[] = []
  let inSingle = false
  let inDouble = false

  for (const tok of tokens) {
    // Track quote state
    for (const c of tok) {
      if (c === "'" && !inDouble) inSingle = !inSingle
      if (c === '"' && !inSingle) inDouble = !inDouble
    }

    if (!inSingle && !inDouble && (tok === "|" || tok === "&&" || tok === "||" || tok === ";")) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
      continue
    }

    current.push(tok)
  }

  if (current.length > 0) {
    segments.push(current)
  }

  return segments
}

/**
 * Extract environment variable reads and sets from tokens.
 */
function extractEnvVarInfo(tokens: string[], raw: string): { reads: string[]; sets: string[] } {
  const reads: string[] = []
  const sets: string[] = []

  // Check for VAR=value at the start
  const varAssignRe = /^([A-Za-z_][A-Za-z0-9_]*)=/
  for (const tok of tokens) {
    const assignMatch = tok.match(varAssignRe)
    if (assignMatch) {
      sets.push(assignMatch[1])
    }
  }

  // Check for $VAR and ${VAR} references
  const varRefRe = /\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g
  let m: RegExpExecArray | null
  while ((m = varRefRe.exec(raw)) !== null) {
    reads.push(m[1] ?? m[2])
  }

  return { reads: [...new Set(reads)], sets: [...new Set(sets)] }
}

/**
 * Extract file paths from tokens using heuristics.
 */
function extractPaths(tokens: string[]): ExtractedPath[] {
  const paths: ExtractedPath[] = []

  for (const tok of tokens) {
    const clean = stripQuotes(tok)

    // Skip flags and non-path-looking tokens
    if (clean.startsWith("-")) continue
    if (clean.startsWith("$")) continue
    if (clean === "") continue
    if (/^[0-9]+$/.test(clean)) continue
    if (/^[A-Z_]+=$/.test(clean)) continue

    // Path-like: contains /, starts with ./ or ../, starts with ~, is a drive letter on Windows
    const looksLikePath =
      clean.includes("/") ||
      clean.startsWith(".") ||
      clean.startsWith("~") ||
      /^[A-Za-z]:[/\\]/.test(clean)

    if (looksLikePath) {
      const op = determineOperation(clean)
      paths.push({ path: clean, context: "argument", operation: op })
    }
  }

  return paths
}

function determineOperation(path: string): "read" | "write" | "execute" | "unknown" {
  if (path.endsWith(".sh") || path.endsWith(".bash") || path.endsWith(".exe")) {
    return "execute"
  }
  if (path.startsWith("~/.ssh") || path.startsWith("/etc/")) {
    return "write"
  }
  return "unknown"
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/**
 * Check if a variable name matches sensitive patterns.
 */
export function isSensitiveVar(name: string): boolean {
  if (NON_SENSITIVE_VARS.has(name)) return false
  return SENSITIVE_VAR_PATTERNS.some((re) => re.test(name))
}

/**
 * Check if a command involves network activity.
 */
export function isNetworkCommand(command: string): boolean {
  const networkCmds = ["curl", "wget", "nc", "ncat", "socat", "netcat", "telnet", "ssh"]
  return networkCmds.some((c) => command === c || command.startsWith(c + " ") || command.startsWith(c + "\t"))
}
