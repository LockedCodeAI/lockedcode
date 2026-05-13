import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useProject } from "@tui/context/project"
import { useSDK } from "@tui/context/sdk"
import { Glob } from "@opencode-ai/core/util/glob"
import { ConfigMarkdown } from "@/config/markdown"
import { Global } from "@opencode-ai/core/global"
import path from "path"

interface TemplateInfo {
  name: string
  description?: string
  content: string
  path: string
}

export type DialogTemplateProps = {
  onSelect: (template: TemplateInfo) => void
}

async function scanTemplates(dirs: string[]): Promise<TemplateInfo[]> {
  const seen = new Map<string, TemplateInfo>()

  for (const dir of dirs) {
    let matches: string[]
    try {
      matches = await Glob.scan("*.md", {
        cwd: dir,
        absolute: true,
        include: "file",
      })
    } catch {
      continue
    }

    for (const match of matches) {
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

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function DialogTemplate(props: DialogTemplateProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const project = useProject()
  dialog.setSize("large")

  const [templates] = createResource(async () => {
    const cwd = sdk.directory || process.cwd()
    const worktree = project.instance.path().worktree

    const dirs = [path.join(Global.Path.config, "templates")]
    if (worktree) dirs.push(path.join(worktree, "templates"))
    if (cwd !== worktree) dirs.push(path.join(cwd, "templates"))

    return scanTemplates(dirs)
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
