/**
 * Template selection dialog for the TUI.
 *
 * Templates are stored project-local under `<projectRoot>/.lockedcode/templates/`.
 * Remote template sources are fetched with URL validation (HTTPS-only),
 * entry name traversal protection, post-join containment checks, and
 * SHA-256 integrity verification.
 */
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { Glob } from "@opencode-ai/core/util/glob"
import { ConfigMarkdown } from "@/config/markdown"
import * as Log from "@opencode-ai/core/util/log"
import { createHash } from "crypto"
import path from "path"
import fs from "fs/promises"
import { checkPathSync } from "../../../../security/confinement/whitelist"
import { canonicalize, isSubPath } from "../../../../security/confinement/paths"

const log = Log.create({ service: "templates" })

/** Regex for allowed template entry names: alphanumeric, dots, hyphens, underscores. */
const SAFE_NAME_RE = /^[A-Za-z0-9._-]+$/

/** Maximum allowed length for template entry names. */
const MAX_ENTRY_NAME_LENGTH = 255

function getProjectRoot(): string {
  return process.cwd()
}

function getTemplatesDir(): string {
  return path.join(getProjectRoot(), ".lockedcode", "templates")
}

function getCacheDir(): string {
  return path.join(getTemplatesDir(), ".cache")
}

const DEFAULT_TEMPLATES: Array<{ dir: string; file: string; content: string }> = [
  {
    dir: "code-review",
    file: "code-review.md",
    content: `---
name: code-review
description: Review recent changes for quality, correctness, and style
---

Review the recent changes on this branch compared to the base branch. Evaluate:
- Correctness and edge cases
- Error handling
- Performance implications
- Code style and readability
- Test coverage gaps
- Security considerations

Provide actionable feedback organized by severity.
`,
  },
  {
    dir: "security-audit",
    file: "security-audit.md",
    content: `---
name: security-audit
description: Run a comprehensive security audit on the current project
---

Perform a comprehensive security audit of this project. Focus on:
- OWASP Top 10 vulnerabilities
- Dependency vulnerabilities (check package.json / lock files)
- Secret/credential exposure in source code
- Injection risks (SQL, command, XSS)
- Authentication and authorization flaws
- Insecure configurations

Report findings with severity levels and remediation steps.
`,
  },
]

/**
 * Seed default templates into the project-local templates directory
 * if no user templates exist yet.
 */
async function seedDefaults() {
  const templatesDir = getTemplatesDir()
  const projectRoot = getProjectRoot()
  try {
    const confinement = checkPathSync(templatesDir, "write", projectRoot)
    if (!confinement.allowed) {
      log.warn("confinement denied template seed", { path: templatesDir, reason: confinement.reason })
      return
    }

    const entries = await fs.readdir(templatesDir).catch(() => [])
    const hasUserTemplates = entries.some((e) => e !== ".cache")
    if (hasUserTemplates) return

    for (const tmpl of DEFAULT_TEMPLATES) {
      const dir = path.join(templatesDir, tmpl.dir)
      const filePath = path.join(dir, tmpl.file)

      const dirCheck = checkPathSync(dir, "write", projectRoot)
      if (!dirCheck.allowed) {
        log.warn("confinement denied template directory creation", { path: dir, reason: dirCheck.reason })
        continue
      }

      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, tmpl.content)
    }
    log.info("seeded default templates", { dir: templatesDir })
  } catch (err) {
    log.warn("failed to seed default templates", { err })
  }
}

interface TemplateInfo {
  name: string
  description?: string
  content: string
  path: string
}

export type DialogTemplateProps = {
  onSelect: (template: TemplateInfo) => void
}

interface RemoteIndexEntry {
  name: string
  files: string[]
  sha256?: string
}

interface RemoteIndex {
  templates: RemoteIndexEntry[]
}

/**
 * Validate a URL is safe for fetching remote templates.
 * Only HTTPS URLs are allowed. Rejects http, file, data, and URLs with credentials.
 *
 * @param rawUrl - URL string to validate
 * @returns true if the URL is safe to fetch
 */
export function isValidTemplateUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== "https:") return false
    if (parsed.username || parsed.password) return false
    return true
  } catch {
    return false
  }
}

/**
 * Validate a template entry name is safe for use in file paths.
 * Rejects names containing path traversal patterns, hidden files, and invalid characters.
 *
 * @param name - Entry name from remote index
 * @returns true if the name is safe to use in path.join
 */
export function isValidEntryName(name: string): boolean {
  if (!name || name.length === 0) return false
  if (name.length > MAX_ENTRY_NAME_LENGTH) return false
  if (name.includes("..")) return false
  if (name.includes("/")) return false
  if (name.includes("\\")) return false
  if (name.includes("\0")) return false
  if (name.startsWith(".")) return false
  if (!SAFE_NAME_RE.test(name)) return false
  return true
}

/**
 * Compute SHA-256 hex digest of a string.
 *
 * @param content - Content to hash
 * @returns Lowercase hex SHA-256 digest
 */
function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex")
}

/**
 * Fetch remote templates from configured URLs with full validation.
 * Enforces HTTPS-only, entry name safety, post-join containment, and SHA-256 integrity.
 */
async function fetchRemoteTemplates(urls: string[]): Promise<TemplateInfo[]> {
  const results: TemplateInfo[] = []
  const cacheDir = getCacheDir()
  const projectRoot = getProjectRoot()

  for (const rawUrl of urls) {
    if (!isValidTemplateUrl(rawUrl)) {
      log.error("rejected non-HTTPS template URL", { url: rawUrl, verdict: "url_rejected" })
      continue
    }

    const base = rawUrl.endsWith("/") ? rawUrl : `${rawUrl}/`
    const indexUrl = new URL("index.json", base).href

    try {
      log.info("fetching remote template index", { url: indexUrl })
      const res = await fetch(indexUrl)
      if (!res.ok) {
        log.warn("failed to fetch template index", { url: indexUrl, status: res.status, verdict: "fetch_failed" })
        continue
      }
      const data = (await res.json()) as RemoteIndex
      if (!Array.isArray(data.templates)) continue

      for (const entry of data.templates) {
        if (!isValidEntryName(entry.name)) {
          log.error("rejected template entry name", {
            name: entry.name,
            url: indexUrl,
            verdict: "entry_name_rejected",
          })
          continue
        }

        const mdFile = entry.files?.find((f) => f.endsWith(".md"))
        if (!mdFile) continue

        if (!isValidEntryName(mdFile.replace(/\.md$/, "").replace(/\./g, "_"))) {
          log.error("rejected template file name", { name: entry.name, file: mdFile, verdict: "file_name_rejected" })
          continue
        }

        const dest = path.join(cacheDir, entry.name, mdFile)

        // Post-join containment check
        const canonDest = canonicalize(dest)
        const canonCache = canonicalize(cacheDir)
        if (!isSubPath(canonDest, canonCache)) {
          log.error("post-join containment check failed", {
            name: entry.name,
            dest,
            cacheDir,
            canonDest,
            canonCache,
            verdict: "containment_failed",
          })
          continue
        }

        const confinement = checkPathSync(dest, "write", projectRoot)
        if (!confinement.allowed) {
          log.error("confinement denied template cache write", {
            path: dest,
            reason: confinement.reason,
            verdict: "confinement_denied",
          })
          continue
        }

        try {
          const fileUrl = new URL(`${entry.name}/${mdFile}`, base).href
          const fileRes = await fetch(fileUrl)
          if (!fileRes.ok) {
            log.warn("failed to download template", { url: fileUrl, status: fileRes.status })
            continue
          }
          const content = await fileRes.text()

          // SHA-256 integrity verification
          if (entry.sha256) {
            const computed = sha256(content)
            if (computed !== entry.sha256.toLowerCase()) {
              log.error("template digest mismatch", {
                name: entry.name,
                expected: entry.sha256,
                computed,
                url: fileUrl,
                verdict: "digest_mismatch",
              })
              continue
            }
            log.info("template digest verified", { name: entry.name, digest: computed, verdict: "fetch_success" })
          } else {
            log.error("template missing sha256 digest — rejected by default", {
              name: entry.name,
              url: fileUrl,
              verdict: "no_digest_rejected",
            })
            continue
          }

          await fs.mkdir(path.dirname(dest), { recursive: true })
          await fs.writeFile(dest, content)

          const md = await ConfigMarkdown.parse(dest)
          const frontmatter = md.data as Record<string, unknown>
          const name = typeof frontmatter.name === "string" ? frontmatter.name : entry.name
          const description =
            typeof frontmatter.description === "string" ? frontmatter.description : undefined

          results.push({
            name,
            description,
            content: md.content.trim(),
            path: dest,
          })
        } catch (err) {
          log.warn("failed to process remote template", { name: entry.name, err })
          try {
            const readCheck = checkPathSync(dest, "read", projectRoot)
            if (!readCheck.allowed) continue
            const md = await ConfigMarkdown.parse(dest)
            const frontmatter = md.data as Record<string, unknown>
            results.push({
              name: typeof frontmatter.name === "string" ? frontmatter.name : entry.name,
              description:
                typeof frontmatter.description === "string" ? frontmatter.description : undefined,
              content: md.content.trim(),
              path: dest,
            })
          } catch {
            continue
          }
        }
      }
    } catch (err) {
      log.warn("failed to fetch template index", { url: indexUrl, err })

      try {
        const cacheCheck = checkPathSync(cacheDir, "read", projectRoot)
        if (!cacheCheck.allowed) continue

        const cached = await Glob.scan("*/*.md", { cwd: cacheDir, absolute: true, include: "file" })
        for (const match of cached) {
          try {
            const matchCheck = checkPathSync(match, "read", projectRoot)
            if (!matchCheck.allowed) continue
            const md = await ConfigMarkdown.parse(match)
            const frontmatter = md.data as Record<string, unknown>
            const filename = path.basename(match, ".md")
            results.push({
              name: typeof frontmatter.name === "string" ? frontmatter.name : filename,
              description:
                typeof frontmatter.description === "string" ? frontmatter.description : undefined,
              content: md.content.trim(),
              path: match,
            })
          } catch {
            continue
          }
        }
      } catch {
        continue
      }
    }
  }

  return results
}

/**
 * Scan local template directories for .md template files.
 * All paths are checked against confinement before reading.
 */
async function scanLocalTemplates(dirs: string[]): Promise<TemplateInfo[]> {
  const seen = new Map<string, TemplateInfo>()
  const projectRoot = getProjectRoot()

  for (const dir of dirs) {
    const confinement = checkPathSync(dir, "read", projectRoot)
    if (!confinement.allowed) {
      log.warn("confinement denied template directory scan", { path: dir, reason: confinement.reason })
      continue
    }

    let matches: string[]
    try {
      matches = await Glob.scan("**/*.md", {
        cwd: dir,
        absolute: true,
        include: "file",
      })
    } catch {
      continue
    }

    for (const match of matches.filter((m) => !m.includes("/.cache/"))) {
      try {
        const matchCheck = checkPathSync(match, "read", projectRoot)
        if (!matchCheck.allowed) {
          log.warn("confinement denied template file read", { path: match, reason: matchCheck.reason })
          continue
        }

        const md = await ConfigMarkdown.parse(match)
        const frontmatter = md.data as Record<string, unknown>
        const filename = path.basename(match, ".md")
        const name = typeof frontmatter.name === "string" ? frontmatter.name : filename
        const description =
          typeof frontmatter.description === "string" ? frontmatter.description : undefined

        seen.set(name, {
          name,
          description,
          content: md.content.trim(),
          path: match,
        })
      } catch {
        continue
      }
    }
  }

  return Array.from(seen.values())
}

export function DialogTemplate(props: DialogTemplateProps) {
  const dialog = useDialog()
  const sync = useSync()
  dialog.setSize("large")

  const [templates] = createResource(async () => {
    await seedDefaults()

    // Remote templates (lowest precedence)
    const urls = (sync.data.config as Record<string, unknown>).templates as
      | { urls?: string[] }
      | undefined
    const remote = urls?.urls?.length ? await fetchRemoteTemplates(urls.urls) : []

    // Local templates from project-local .lockedcode/templates/
    const local = await scanLocalTemplates([getTemplatesDir()])

    // Merge: local wins on name collision
    const merged = new Map<string, TemplateInfo>()
    for (const t of remote) merged.set(t.name, t)
    for (const t of local) merged.set(t.name, t)

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
  })

  const options = createMemo<DialogSelectOption<TemplateInfo>[]>(() => {
    const list = templates() ?? []
    if (list.length === 0) return []
    const maxWidth = Math.max(0, ...list.map((t) => t.name.length))
    return list.map((template) => ({
      title: template.name.padEnd(maxWidth),
      description: template.description,
      value: template,
      onSelect: () => {
        props.onSelect(template)
        dialog.clear()
      },
    }))
  })

  return <DialogSelect title="Templates" placeholder="Search templates..." options={options()} />
}
