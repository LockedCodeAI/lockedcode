import type { Severity } from "../types"

export type InjectionSensitivity = "low" | "medium" | "high"

export interface InjectionPattern {
  readonly id: string
  readonly name: string
  readonly test: (content: string, filename: string) => InjectionMatch[]
  readonly severity: Severity
  readonly category: string
  readonly description: string
  readonly minSensitivity: InjectionSensitivity
}

export interface InjectionMatch {
  readonly lineNumber: number
  readonly column: number
  readonly matched: string
  readonly patternId: string
}

/**
 * Injection detection patterns across all categories.
 */
export const INJECTION_PATTERNS: InjectionPattern[] = [
  // ============================================================
  // Role Override
  // ============================================================
  {
    id: "injection.role-override.ignore-instructions",
    name: "Ignore Previous Instructions",
    severity: "critical",
    category: "role-override",
    description: "Instructions telling the model to ignore its previous directives",
    minSensitivity: "low",
    test: (content) => findLines(content, /ignore\s+(all\s+)?(previous|prior|your)\s+(instructions|directives|rules|commands)/i),
  },
  {
    id: "injection.role-override.override-safety",
    name: "Override Safety Instructions",
    severity: "critical",
    category: "role-override",
    description: "Instructions to bypass safety guidelines",
    minSensitivity: "low",
    test: (content) => findLines(content, /(override|bypass|disregard|ignore)\s+(your\s+)?(safety|guidelines|restrictions|boundaries|constraints)/i),
  },
  {
    id: "injection.role-override.you-are-now",
    name: "Role Redefinition",
    severity: "high",
    category: "role-override",
    description: "Attempt to redefine the model's role or persona",
    minSensitivity: "low",
    test: (content) => findLines(content, /(you are now|from now on,? you will|your new (instructions|role|persona) (is|are))/i),
  },
  {
    id: "injection.role-override.pretend",
    name: "Pretend/Roleplay Request",
    severity: "warning",
    category: "role-override",
    description: "Request for the model to pretend or roleplay as something",
    minSensitivity: "medium",
    test: (content) => findLines(content, /(pretend|act as if|roleplay|imagine you are)\s+(you\s+are\s+)?(a|an|the)/i),
  },

  // ============================================================
  // System Prompt Markers
  // ============================================================
  {
    id: "injection.system-markers.pipe-delimiter",
    name: "Model-specific Prompt Delimiter",
    severity: "high",
    category: "system-markers",
    description: "Model-specific prompt delimiter found in file content",
    minSensitivity: "low",
    test: (content) => findLines(content, /<\|(system|user|assistant|tool|model)\|>/i),
  },
  {
    id: "injection.system-markers.llama-inst",
    name: "Llama Instruction Marker",
    severity: "high",
    category: "system-markers",
    description: "LLaMA-style instruction marker found in file content",
    minSensitivity: "low",
    test: (content) => findLines(content, /\[INST\]|\[\/INST\]/, /<<SYS>>|<<\/SYS>>/),
  },
  {
    id: "injection.system-markers.conversation-delimiters",
    name: "Conversation Delimiter",
    severity: "warning",
    category: "system-markers",
    description: "Conversation delimiter (Human:/Assistant:) found in file content",
    minSensitivity: "medium",
    test: (content) => {
      const lines = content.split("\n")
      const matches: InjectionMatch[] = []
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim()
        if (/^(Human|Assistant|System|User):/.test(trimmed)) {
          matches.push({ lineNumber: i + 1, column: lines[i].indexOf(trimmed[0]) + 1, matched: trimmed.split(":")[0], patternId: "injection.system-markers.conversation-delimiters" })
        }
      }
      return matches
    },
  },

  // ============================================================
  // Comment Injection
  // ============================================================
  {
    id: "injection.comment.html-override",
    name: "HTML Comment Instruction Override",
    severity: "high",
    category: "comment-injection",
    description: "HTML comment containing instruction override markers",
    minSensitivity: "low",
    test: (content) => findLines(content, /<!--[\s\S]*?(ignore|override|system|instruction|IMPORTANT)[\s\S]*?-->/i),
  },
  {
    id: "injection.comment.code-override",
    name: "Code Comment Instruction Override",
    severity: "high",
    category: "comment-injection",
    description: "Code comment containing instruction override directives",
    minSensitivity: "low",
    test: (content) => findLines(content, /\/\/.*(ignore|override|disregard|forget)\s+(all\s+)?(previous|prior|your|the)\s+(instructions|directives|rules)/i),
  },
  {
    id: "injection.comment.yaml-override",
    name: "YAML Comment Override",
    severity: "warning",
    category: "comment-injection",
    description: "YAML/script comment with override instruction",
    minSensitivity: "medium",
    test: (content) => findLines(content, /#\s*(AI|SYSTEM|INSTRUCTION|OVERRIDE):/i),
  },
  {
    id: "injection.comment.markdown-hidden",
    name: "Markdown Hidden Comment",
    severity: "high",
    category: "comment-injection",
    description: "Markdown hidden comment syntax with instruction",
    minSensitivity: "medium",
    test: (content) => findLines(content, /\[\\\/\/\]:\s*#\s*\(.+?(ignore|override|instruction)/i),
  },

  // ============================================================
  // Encoded Instructions
  // ============================================================
  {
    id: "injection.encoded.base64-instruction",
    name: "Base64-encoded Instruction",
    severity: "high",
    category: "encoded",
    description: "Base64-encoded text in content that decodes to instruction-like content",
    minSensitivity: "medium",
    test: (content) => {
      const matches: InjectionMatch[] = []
        const b64Re = /[A-Za-z0-9+/]{36,}={0,2}/g
      const lines = content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        let m: RegExpExecArray | null
        while ((m = b64Re.exec(lines[i])) !== null) {
          try {
            const decoded = decodeB64(m[0])
            if (/ignore (instructions|previous)|you are now|override system/i.test(decoded)) {
              matches.push({ lineNumber: i + 1, column: m.index + 1, matched: "base64-encoded instruction detected", patternId: "injection.encoded.base64-instruction" })
            }
          } catch {}
        }
      }
      return matches
    },
  },

  // ============================================================
  // Metadata Poisoning (simplified — filename-based)
  // ============================================================
  {
    id: "injection.metadata.package-description",
    name: "Package Metadata Instruction",
    severity: "warning",
    category: "metadata",
    description: "Package metadata file with suspicious description content",
    minSensitivity: "high",
    test: (content, filename) => {
      if (!/package\.json|pyproject\.toml|setup\.py|\.gemspec/i.test(filename)) return []
      return findLines(content, /"description"\s*:.*?(ignore|override|bypass|you are now)/i)
    },
  },
]

function findLines(content: string, ...patterns: RegExp[]): InjectionMatch[] {
  const lines = content.split("\n")
  const matches: InjectionMatch[] = []
  for (const pat of patterns) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pat)
      if (m) {
        matches.push({
          lineNumber: i + 1,
          column: (m.index ?? 0) + 1,
          matched: m[0].slice(0, 60),
          patternId: pat.source.slice(0, 30),
        })
      }
    }
  }
  return matches
}

function decodeB64(s: string): string {
  return Buffer.from(s, "base64").toString("utf-8")
}
