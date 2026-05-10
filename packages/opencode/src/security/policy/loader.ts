import fs from "fs"
import path from "path"
import os from "os"
import * as Log from "@opencode-ai/core/util/log"
import { PolicyDocumentSchema } from "./schema"
import type { Policy } from "./schema"

export type { Policy }

/** Default policy when no file is found. */
export const DEFAULT_POLICY: Policy = {
  security: {
    strictness: "standard",
    enabled: true,
    confinement: { enabled: true, preApprovedPaths: ["/tmp", "~/.npm", "~/.bun", "~/.cache"] },
    scanning: {
      enabled: true, scanOnWrite: true, scanOnEdit: true,
      semgrep: { enabled: true, timeout: 30 },
      yara: { enabled: true, timeout: 15 },
      entropy: { enabled: true, threshold: 4.5, minStringLength: 20 },
      secrets: { enabled: true },
      injection: { enabled: true, sensitivity: "medium" },
    },
    dlp: {
      enabled: true, scanSecrets: true, scanPii: true,
      redactionMode: true, blockRestrictedFiles: true,
      sensitivityPatterns: {
        restricted: [".env", ".env.*", "credentials.*", "secrets.*", "*.key", "*.pem"],
        confidential: ["*.env.local", "docker-compose.override.yml"],
        internal: ["*.config", "Dockerfile"],
      },
      piiCategories: { email: true, phone: true, ssn: true, creditCard: true, ipAddress: true },
    },
    trust: { autoApproveBelow: 20, promptAbove: 50, blockAbove: 90 },
    audit: { enabled: true, retentionDays: 90, logLevel: "all" },
    shell: { additionalBlockedPatterns: [], allowedCommands: [] },
    models: { approved: [], blocked: [] },
    airGap: { enabled: false, verifyOnStartup: true, allowExternalScanners: false },
  },
}

/** Resolve XDG config directory for global policy. */
function xdgConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) return path.join(xdg, "lockedcode")
  return path.join(os.homedir(), ".config", "lockedcode")
}

/** Try to find and load a policy file. Returns null if not found. */
function loadPolicyFile(filepath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filepath)) return null
    const content = fs.readFileSync(filepath, "utf-8")
    // Parse as JSON (YAML support deferred — needs yaml parser dependency)
    const parsed = JSON.parse(content)
    return parsed
  } catch (err: any) {
    // File exists but can't be parsed — fail loudly
    throw new Error(`Policy file ${filepath} is invalid: ${err.message ?? err}`)
  }
}

/** Validate a raw policy object against the schema. Returns validated policy with defaults filled in. */
function validatePolicy(raw: Record<string, unknown>, source: string): Policy {
  const result = PolicyDocumentSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Policy validation failed in ${source}:\n${issues}`)
  }
  return result.data
}

/**
 * Deep merge two policy objects.
 * Arrays are replaced, not concatenated.
 * Nested objects are recursively merged.
 */
function deepMerge(target: any, source: any): any {
  if (source === undefined || source === null) return target
  if (target === undefined || target === null) return source
  if (typeof target !== "object" || typeof source !== "object") return source
  if (Array.isArray(target) || Array.isArray(source)) return source

  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (key in target) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

/**
 * Load and merge policy files with hierarchy:
 * 1. Global defaults (built-in)
 * 2. Global policy: ~/.config/lockedcode/policy.json (XDG)
 * 3. Project policy: projectRoot/lockedcode.json
 * 4. Session overrides (in-memory)
 *
 * Returns the merged Policy.
 */
export function loadPolicy(projectRoot?: string, sessionOverrides?: Record<string, unknown>): { policy: Policy; sources: string[] } {
  let current: Record<string, unknown> = DEFAULT_POLICY as any
  const sources: string[] = ["built-in defaults"]

  // Global XDG policy
  const globalPath = path.join(xdgConfigDir(), "policy.json")
  const globalRaw = loadPolicyFile(globalPath)
  if (globalRaw) {
    const validated = validatePolicy(globalRaw, globalPath)
    current = deepMerge(current, validated)
    sources.push(globalPath)
  }

  // Project policy
  if (projectRoot) {
    const projectPaths = [
      path.join(projectRoot, "lockedcode.json"),
      path.join(projectRoot, ".lockedcode", "policy.json"),
    ]
    for (const pp of projectPaths) {
      const projectRaw = loadPolicyFile(pp)
      if (projectRaw) {
        const validated = validatePolicy(projectRaw, pp)
        current = deepMerge(current, validated)
        sources.push(pp)
      }
    }
  }

  // Session overrides
  if (sessionOverrides) {
    current = deepMerge(current, sessionOverrides)
    sources.push("session override")
  }

  // Final validation
  const finalPolicy = validatePolicy(current, sources.join(", "))
  return { policy: finalPolicy, sources }
}
