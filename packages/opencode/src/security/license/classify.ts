import type { Severity } from "../types"

export type LicenseRisk = "copyleft" | "weak-copyleft" | "permissive" | "unknown"

export interface LicenseClassification {
  readonly risk: LicenseRisk
  readonly description: string
}

const LICENSE_CLASSIFICATION: Record<string, LicenseClassification> = {
  "GPL-2.0": { risk: "copyleft", description: "GNU General Public License v2 — Using this code may require releasing your entire project under GPL-2.0" },
  "GPL-3.0": { risk: "copyleft", description: "GNU General Public License v3 — Using this code may require releasing your entire project under GPL-3.0" },
  "AGPL-3.0": { risk: "copyleft", description: "GNU Affero General Public License v3 — Even network interaction triggers copyleft obligations" },
  "LGPL-2.1": { risk: "weak-copyleft", description: "GNU Lesser General Public License v2.1 — Restrictions apply to the modified library, not the whole project" },
  "LGPL-3.0": { risk: "weak-copyleft", description: "GNU Lesser General Public License v3 — Similar to LGPL-2.1 with additional patent protections" },
  "MPL-2.0": { risk: "weak-copyleft", description: "Mozilla Public License 2.0 — File-level copyleft; other files can remain proprietary" },
  "MIT": { risk: "permissive", description: "MIT License — Permissive. Attribution required." },
  "Apache-2.0": { risk: "permissive", description: "Apache License 2.0 — Permissive with patent grant. Attribution required." },
  "BSD-2-Clause": { risk: "permissive", description: "BSD 2-Clause — Permissive. Attribution required." },
  "BSD-3-Clause": { risk: "permissive", description: "BSD 3-Clause — Permissive. Attribution required." },
}

export function classifyLicense(spdxId: string): LicenseClassification {
  return LICENSE_CLASSIFICATION[spdxId] ?? { risk: "unknown", description: `License "${spdxId}" unknown — review manually` }
}
