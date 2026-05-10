export interface ParsedInstallCommand {
  readonly packageManager: "npm" | "bun" | "yarn" | "pnpm" | "pip" | "go" | "cargo" | "gem" | "composer" | "unknown"
  readonly packages: Array<{ name: string; version?: string; scope?: string }>
  readonly isGlobal: boolean
  readonly isDev: boolean
  readonly hasIgnoreScripts: boolean
  readonly hasNonRegistrySource: boolean
  readonly raw: string
}

const INSTALL_PATTERNS: Array<{
  manager: ParsedInstallCommand["packageManager"]
  prefix: RegExp
}> = [
  { manager: "npm", prefix: /^npm\s+(install|i|add)(\s|$)/ },
  { manager: "bun", prefix: /^bun\s+(add|install)(\s|$)/ },
  { manager: "yarn", prefix: /^yarn\s+add(\s|$)/ },
  { manager: "pnpm", prefix: /^pnpm\s+(add|install)(\s|$)/ },
  { manager: "pip", prefix: /^(pip|pip3)\s+install(\s|$)/ },
  { manager: "go", prefix: /^go\s+get(\s|$)/ },
  { manager: "cargo", prefix: /^cargo\s+add(\s|$)/ },
  { manager: "gem", prefix: /^gem\s+install(\s|$)/ },
  { manager: "composer", prefix: /^composer\s+require(\s|$)/ },
]

/** Flags to skip when extracting package names. */
const SKIP_FLAGS = new Set([
  "--save-dev", "-D", "--save", "-S",
  "--global", "-g",
  "--dev", "--production", "--no-dev",
  "--save-exact", "-E", "--save-optional", "-O",
  "--no-save",
  "--ignore-scripts",
  "--no-build-isolation",
  "--user", "--upgrade", "-U",
  "-y", "--yes",
])

/** Check if a command is a package install command. */
export function detectInstallCommand(command: string): ParsedInstallCommand | null {
  const trimmed = command.trim()

  for (const { manager, prefix } of INSTALL_PATTERNS) {
    if (prefix.test(trimmed)) {
      return parseInstallCommand(trimmed, manager, prefix)
    }
  }

  return null
}

function parseInstallCommand(command: string, manager: ParsedInstallCommand["packageManager"], prefix: RegExp): ParsedInstallCommand {
  // Remove the prefix (e.g., "npm install ")
  const rest = command.replace(prefix, "").trim()
  const tokens = tokenize(rest)

  const packages: Array<{ name: string; version?: string; scope?: string }> = []
  let isGlobal = false
  let isDev = false
  let hasIgnoreScripts = false
  let hasNonRegistrySource = false

  for (const tok of tokens) {
    if (tok === "--global" || tok === "-g") {
      isGlobal = true
      continue
    }
    if (tok === "--save-dev" || tok === "-D" || tok === "--dev") {
      isDev = true
      continue
    }
    if (tok === "--ignore-scripts") {
      hasIgnoreScripts = true
      continue
    }
    if (SKIP_FLAGS.has(tok) || tok.startsWith("--") || tok.startsWith("-")) {
      continue
    }

    // Check for non-registry source
    if (tok.startsWith(".") || tok.startsWith("/") || tok.startsWith("git") || tok.startsWith("http") || tok.startsWith("file:")) {
      hasNonRegistrySource = true
      continue
    }

    // Extract package name and optional version
    const atIdx = tok.lastIndexOf("@")
    if (atIdx > 0 && !tok.startsWith("@")) {
      // version specifier: pkg@^1.0.0
      const name = tok.slice(0, atIdx)
      const version = tok.slice(atIdx + 1)
      packages.push({ name, version })
    } else if (tok.startsWith("@") && tok.includes("/")) {
      // scoped package: @scope/pkg
      const parts = tok.split("/")
      const scope = parts[0]
      const remaining = parts.slice(1).join("/")
      const scopedAtIdx = remaining.lastIndexOf("@")
      if (scopedAtIdx > 0) {
        packages.push({ name: `${scope}/${remaining.slice(0, scopedAtIdx)}`, version: remaining.slice(scopedAtIdx + 1), scope })
      } else {
        packages.push({ name: tok, scope })
      }
    } else {
      packages.push({ name: tok })
    }
  }

  return {
    packageManager: manager,
    packages,
    isGlobal,
    isDev,
    hasIgnoreScripts,
    hasNonRegistrySource,
    raw: command,
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inQuote = false
  let quoteChar = ""

  for (const c of input) {
    if (inQuote) {
      if (c === quoteChar) { inQuote = false; continue }
      current += c
    } else if (c === '"' || c === "'") {
      inQuote = true
      quoteChar = c
    } else if (c === " ") {
      if (current.length > 0) { tokens.push(current); current = "" }
    } else {
      current += c
    }
  }

  if (current.length > 0) tokens.push(current)
  return tokens
}
