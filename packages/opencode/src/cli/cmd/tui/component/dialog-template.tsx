import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { Glob } from "@opencode-ai/core/util/glob"
import { ConfigMarkdown } from "@/config/markdown"
import * as Log from "@opencode-ai/core/util/log"
import os from "os"
import path from "path"
import fs from "fs/promises"

const log = Log.create({ service: "templates" })
const templatesDir = path.join(os.homedir(), ".lockedcode", "templates")
const cacheDir = path.join(templatesDir, ".cache")

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

async function seedDefaults() {
  try {
    const entries = await fs.readdir(templatesDir).catch(() => [])
    const hasUserTemplates = entries.some((e) => e !== ".cache")
    if (hasUserTemplates) return

    for (const tmpl of DEFAULT_TEMPLATES) {
      const dir = path.join(templatesDir, tmpl.dir)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, tmpl.file), tmpl.content)
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

interface RemoteIndex {
  templates: Array<{ name: string; files: string[] }>
}

async function fetchRemoteTemplates(urls: string[]): Promise<TemplateInfo[]> {
  const results: TemplateInfo[] = []

  for (const rawUrl of urls) {
    const base = rawUrl.endsWith("/") ? rawUrl : `${rawUrl}/`
    const indexUrl = new URL("index.json", base).href

    try {
      const res = await fetch(indexUrl)
      if (!res.ok) {
        log.warn("failed to fetch template index", { url: indexUrl, status: res.status })
        continue
      }
      const data = (await res.json()) as RemoteIndex
      if (!Array.isArray(data.templates)) continue

      for (const entry of data.templates) {
        const mdFile = entry.files?.find((f) => f.endsWith(".md"))
        if (!mdFile) continue

        const fileUrl = new URL(`${entry.name}/${mdFile}`, base).href
        const dest = path.join(cacheDir, entry.name, mdFile)

        try {
          await fs.mkdir(path.dirname(dest), { recursive: true })

          const fileRes = await fetch(fileUrl)
          if (!fileRes.ok) {
            log.warn("failed to download template", { url: fileUrl, status: fileRes.status })
            continue
          }
          const content = await fileRes.text()
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
        const cached = await Glob.scan("*/*.md", { cwd: cacheDir, absolute: true, include: "file" })
        for (const match of cached) {
          try {
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

async function scanLocalTemplates(dirs: string[]): Promise<TemplateInfo[]> {
  const seen = new Map<string, TemplateInfo>()

  for (const dir of dirs) {
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

    // Local templates from ~/.lockedcode/templates/
    const local = await scanLocalTemplates([templatesDir])

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
