import fs from "fs"
import path from "path"
import os from "os"

/**
 * Normalize a path to its canonical absolute form.
 *
 * This is security-critical — all confinement checks depend on
 * canonicalization being correct. If a path can bypass canonicalization,
 * the jail can be bypassed.
 *
 * Handles:
 * - Relative paths (`./foo`, `../bar`) — resolved against cwd
 * - Tilde expansion (`~/foo`) — home directory
 * - Environment variable expansion (`$HOME/foo`, `${VAR}`) — process.env
 * - Dot segments (`/foo/./bar/../baz`) → `/foo/baz`
 * - Trailing slashes — normalized away (except root `/`)
 * - Multiple slashes (`/foo//bar`) → `/foo/bar`
 * - Symlink resolution — realpath via fs.realpathSync
 * - Null byte rejection — returns empty string for paths with null bytes
 * - Non-existent files — resolves parent directory, appends filename
 *
 * Platform-specific:
 * - Windows: backslash → forward slash, drive letter case normalization,
 *   UNC path handling
 * - macOS: /private/var vs /var aliases
 *
 * @param input - The path to canonicalize
 * @param cwd - Current working directory (default: process.cwd())
 * @returns The canonical absolute path, or empty string if invalid
 */
export function canonicalize(input: string, cwd?: string): string {
  const wd = cwd ?? process.cwd()

  if (input === "") return wd
  if (input.includes("\0")) return ""

  let resolved = input.trim()

  // Environment variable expansion
  resolved = resolved.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name1, name2) => {
    const name = name1 ?? name2
    return process.env[name] ?? `\${${name}}`
  })

  // Tilde expansion
  if (resolved.startsWith("~")) {
    const sep = resolved.indexOf("/")
    if (sep === -1) {
      return os.homedir()
    }
    resolved = os.homedir() + resolved.slice(sep)
  }

  // Platform: macOS /private/var alias
  if (process.platform === "darwin") {
    resolved = resolved.replace(/^\/var\//, "/private/var/")
  }

  // Platform: Windows normalization
  if (process.platform === "win32") {
    resolved = resolved.replace(/\\/g, "/")
    // Normalize drive letter to uppercase
    resolved = resolved.replace(/^([a-z]):/, (_, letter: string) => `${letter.toUpperCase()}:`)
  }

  // Resolve against cwd if relative
  const abs = path.resolve(wd, resolved)

  // Normalize (collapses . and .., handles trailing slashes)
  const normalized = path.normalize(abs)

  // Remove trailing slash except for root
  const clean = normalized.endsWith("/") && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized

  // Try to resolve symlinks
  try {
    return fs.realpathSync(clean)
  } catch {
    // File doesn't exist yet — resolve the parent and append
    try {
      const parent = path.dirname(clean)
      const base = path.basename(clean)
      const realParent = fs.realpathSync(parent)
      return path.join(realParent, base)
    } catch {
      // Parent doesn't exist either — return the cleaned path
      return clean
    }
  }
}

/**
 * Check if `child` is a sub-path of `parent` (or equal to it).
 *
 * Uses proper prefix matching — `/project` is NOT considered inside
 * `/project-foo` because it checks the separator after the prefix.
 *
 * Both paths should already be canonicalized before calling this function.
 *
 * @param child - The candidate sub-path (must be canonical)
 * @param parent - The parent directory (must be canonical)
 * @returns true if child is within or equal to parent
 */
export function isSubPath(child: string, parent: string): boolean {
  if (!child || !parent) return false
  if (child === parent) return true

  const prefix = parent.endsWith("/") ? parent : parent + "/"

  if (process.platform === "win32") {
    return child.toLowerCase().startsWith(prefix.toLowerCase())
  }

  return child.startsWith(prefix)
}
