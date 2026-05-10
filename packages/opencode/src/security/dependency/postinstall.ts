import type { Severity } from "../types"

export interface PostInstallFinding {
  readonly packageName: string
  readonly packageManager: string
  readonly hasIgnoreScripts: boolean
  readonly severity: Severity
  readonly description: string
  readonly recommendation: string
}

/**
 * Check if an install command may trigger post-install scripts.
 */
export function checkPostInstall(
  packageName: string,
  packageManager: string,
  hasIgnoreScripts: boolean,
): PostInstallFinding | null {
  // If --ignore-scripts is already present, no concern
  if (hasIgnoreScripts) return null

  // npm/bun/yarn/pnpm packages often have postinstall scripts
  if (["npm", "bun", "yarn", "pnpm"].includes(packageManager)) {
    return {
      packageName,
      packageManager,
      hasIgnoreScripts: false,
      severity: "warning",
      description: `Package "${packageName}" may have post-install scripts that execute arbitrary code`,
      recommendation: `Add --ignore-scripts to disable install hooks, or review ${packageName}'s scripts before installing`,
    }
  }

  // pip packages from source may trigger build scripts
  if (packageManager === "pip") {
    return {
      packageName,
      packageManager,
      hasIgnoreScripts: false,
      severity: "warning",
      description: `pip package "${packageName}" may run build scripts during installation`,
      recommendation: "Review the package before installing, or use --no-build-isolation for source packages",
    }
  }

  return null
}
