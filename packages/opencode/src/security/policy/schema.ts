import z from "zod"

/** Strictness levels. */
const Strictness = z.enum(["strict", "standard", "permissive"])

/** Confinement policy section. */
const ConfinementPolicy = z.object({
  enabled: z.boolean().default(true),
  projectRoot: z.string().optional(),
  preApprovedPaths: z.array(z.string()).default(["/tmp", "~/.npm", "~/.bun", "~/.cache"]),
})

/** Semgrep scanner config. */
const SemgrepConfig = z.object({
  enabled: z.boolean().default(true),
  rulesPath: z.string().optional(),
  timeout: z.number().int().positive().default(30),
})

/** YARA scanner config. */
const YaraConfig = z.object({
  enabled: z.boolean().default(true),
  rulesPath: z.string().optional(),
  timeout: z.number().int().positive().default(15),
})

/** Entropy scanner config. */
const EntropyConfig = z.object({
  enabled: z.boolean().default(true),
  threshold: z.number().min(0).max(8).default(4.5),
  minStringLength: z.number().int().positive().default(20),
})

/** Secrets scanner config. */
const SecretsConfig = z.object({
  enabled: z.boolean().default(true),
})

/** Injection scanner config. */
const InjectionConfig = z.object({
  enabled: z.boolean().default(true),
  sensitivity: z.enum(["low", "medium", "high"]).default("medium"),
})

/** Scanning policy section. */
const ScanningPolicy = z.object({
  enabled: z.boolean().default(true),
  scanOnWrite: z.boolean().default(true),
  scanOnEdit: z.boolean().default(true),
  semgrep: SemgrepConfig.default(() => ({ enabled: true, timeout: 30 })),
  yara: YaraConfig.default(() => ({ enabled: true, timeout: 15 })),
  entropy: EntropyConfig.default(() => ({ enabled: true, threshold: 4.5, minStringLength: 20 })),
  secrets: SecretsConfig.default(() => ({ enabled: true })),
  injection: InjectionConfig.default(() => ({ enabled: true, sensitivity: "medium" as const })),
})

/** PII category toggles. */
const PiiCategories = z.object({
  email: z.boolean().default(true),
  phone: z.boolean().default(true),
  ssn: z.boolean().default(true),
  creditCard: z.boolean().default(true),
  ipAddress: z.boolean().default(true),
})

/** DLP policy section. */
const DLPPolicy = z.object({
  enabled: z.boolean().default(true),
  scanSecrets: z.boolean().default(true),
  scanPii: z.boolean().default(true),
  redactionMode: z.boolean().default(true),
  blockRestrictedFiles: z.boolean().default(true),
  sensitivityPatterns: z.object({
    restricted: z.array(z.string()).default([".env", ".env.*", "credentials.*", "secrets.*", "*.key", "*.pem"]),
    confidential: z.array(z.string()).default(["*.env.local", "docker-compose.override.yml"]),
    internal: z.array(z.string()).default(["*.config", "Dockerfile"]),
  }).default(() => ({
    restricted: [".env", ".env.*", "credentials.*", "secrets.*", "*.key", "*.pem"],
    confidential: ["*.env.local", "docker-compose.override.yml"],
    internal: ["*.config", "Dockerfile"],
  })),
  piiCategories: PiiCategories.default(() => ({ email: true, phone: true, ssn: true, creditCard: true, ipAddress: true })),
})

/** Trust scoring config. */
const TrustPolicy = z.object({
  autoApproveBelow: z.number().min(0).max(100).default(20),
  promptAbove: z.number().min(0).max(100).default(50),
  blockAbove: z.number().min(0).max(100).default(90),
})

/** Audit policy section. */
const AuditPolicy = z.object({
  enabled: z.boolean().default(true),
  retentionDays: z.number().int().positive().default(90),
  logLevel: z.enum(["all", "warnings", "critical"]).default("all"),
})

/** Shell policy section. */
const ShellPolicy = z.object({
  additionalBlockedPatterns: z.array(z.string()).default([]),
  allowedCommands: z.array(z.string()).default([]),
})

/** Model approval section. */
const ModelsPolicy = z.object({
  approved: z.array(z.string()).default([]),
  blocked: z.array(z.string()).default([]),
})

/** Air-gap policy section. */
const AirGapPolicy = z.object({
  enabled: z.boolean().default(false),
  verifyOnStartup: z.boolean().default(true),
  allowExternalScanners: z.boolean().default(false),
})

/**
 * Complete policy document schema.
 */
export const SecuritySectionSchema = z.object({
  strictness: Strictness.default("standard"),
  enabled: z.boolean().default(true),
  confinement: ConfinementPolicy.default(() => ({
    enabled: true,
    preApprovedPaths: ["/tmp", "~/.npm", "~/.bun", "~/.cache"],
  })),
  scanning: ScanningPolicy.default(() => ({
    enabled: true, scanOnWrite: true, scanOnEdit: true,
    semgrep: { enabled: true, timeout: 30 },
    yara: { enabled: true, timeout: 15 },
    entropy: { enabled: true, threshold: 4.5, minStringLength: 20 },
    secrets: { enabled: true },
    injection: { enabled: true, sensitivity: "medium" as const },
  })),
  dlp: DLPPolicy.default(() => ({
    enabled: true, scanSecrets: true, scanPii: true, redactionMode: true, blockRestrictedFiles: true,
    sensitivityPatterns: {
      restricted: [".env", ".env.*", "credentials.*", "secrets.*", "*.key", "*.pem"],
      confidential: ["*.env.local", "docker-compose.override.yml"],
      internal: ["*.config", "Dockerfile"],
    },
    piiCategories: { email: true, phone: true, ssn: true, creditCard: true, ipAddress: true },
  })),
  trust: TrustPolicy.default(() => ({ autoApproveBelow: 20, promptAbove: 50, blockAbove: 90 })),
  audit: AuditPolicy.default(() => ({ enabled: true, retentionDays: 90, logLevel: "all" as const })),
  shell: ShellPolicy.default(() => ({ additionalBlockedPatterns: [], allowedCommands: [] })),
  models: ModelsPolicy.default(() => ({ approved: [], blocked: [] })),
  airGap: AirGapPolicy.default(() => ({ enabled: false, verifyOnStartup: true, allowExternalScanners: false })),
})

export const PolicyDocumentSchema = z.object({
  security: SecuritySectionSchema.default(() => SecuritySectionSchema.parse({})),
}).passthrough()

/** Exported Policy type matching the schema. */
export interface Policy {
  readonly security: {
    readonly strictness: "strict" | "standard" | "permissive"
    readonly enabled: boolean
    readonly confinement: z.infer<typeof ConfinementPolicy>
    readonly scanning: z.infer<typeof ScanningPolicy>
    readonly dlp: z.infer<typeof DLPPolicy>
    readonly trust: z.infer<typeof TrustPolicy>
    readonly audit: z.infer<typeof AuditPolicy>
    readonly shell: z.infer<typeof ShellPolicy>
    readonly models: z.infer<typeof ModelsPolicy>
    readonly airGap: z.infer<typeof AirGapPolicy>
  }
}
