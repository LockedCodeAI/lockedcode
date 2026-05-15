import { PlanExitTool } from "./plan"
import { Session } from "@/session/session"
import { QuestionTool } from "./question"
import { ShellTool } from "./shell"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { SkillTool } from "./skill"
import * as Tool from "./tool"
import { Config } from "@/config/config"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@opencode-ai/plugin"
import { Schema } from "effect"
import z from "zod"
import { ZodOverride } from "@opencode-ai/core/effect-zod"
import { Plugin } from "../plugin"
import { Provider } from "@/provider/provider"
import { ProviderID, type ModelID } from "../provider/schema"
import { WebSearchTool } from "./websearch"
import { CodeSearchTool } from "./codesearch"
import { RepoCloneTool } from "./repo_clone"
import { RepoOverviewTool } from "./repo_overview"
import { Flag } from "@opencode-ai/core/flag/flag"
import * as Log from "@opencode-ai/core/util/log"
import { LspTool } from "./lsp"
import * as Truncate from "./truncate"
import { ApplyPatchTool } from "./apply_patch"
import { Glob } from "@opencode-ai/core/util/glob"
import path from "path"
import { pathToFileURL } from "url"
import { Effect, Layer, Context, Option } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Ripgrep } from "../file/ripgrep"
import { Format } from "../format"
import { InstanceState } from "@/effect/instance-state"
import { Question } from "../question"
import { Todo } from "../session/todo"
import { LSP } from "@/lsp/lsp"
import { Instruction } from "../session/instruction"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Bus } from "../bus"
import { Agent } from "../agent/agent"
import { Git } from "@/git"
import { Skill } from "../skill"
import { Permission } from "@/permission"
import { Security } from "@/security"
import { hashContent } from "@/security/audit/hash"

const log = Log.create({ service: "tool.registry" })

export function webSearchEnabled(
  providerID: ProviderID,
  flags = { exa: Flag.OPENCODE_ENABLE_EXA, parallel: Flag.OPENCODE_ENABLE_PARALLEL },
) {
  return providerID === ProviderID.opencode || flags.exa || flags.parallel
}

type TaskDef = Tool.InferDef<typeof TaskTool>
type ReadDef = Tool.InferDef<typeof ReadTool>

type State = {
  custom: Tool.Def[]
  builtin: Tool.Def[]
  task: TaskDef
  read: ReadDef
}

export interface Interface {
  readonly ids: () => Effect.Effect<string[]>
  readonly all: () => Effect.Effect<Tool.Def[]>
  readonly named: () => Effect.Effect<{ task: TaskDef; read: ReadDef }>
  readonly tools: (model: { providerID: ProviderID; modelID: ModelID; agent: Agent.Info }) => Effect.Effect<Tool.Def[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ToolRegistry") {}

export const layer: Layer.Layer<
  Service,
  never,
  | Config.Service
  | Plugin.Service
  | Question.Service
  | Todo.Service
  | Agent.Service
  | Skill.Service
  | Session.Service
  | Provider.Service
  | Git.Service
  | LSP.Service
  | Instruction.Service
  | AppFileSystem.Service
  | Security.Service
  | Bus.Service
  | HttpClient.HttpClient
  | ChildProcessSpawner
  | Ripgrep.Service
  | Format.Service
  | Truncate.Service
> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const plugin = yield* Plugin.Service
    const agents = yield* Agent.Service
    const skill = yield* Skill.Service
    const truncate = yield* Truncate.Service
    const security = yield* Security.Service

    const invalid = yield* InvalidTool
    const task = yield* TaskTool
    const read = yield* ReadTool
    const question = yield* QuestionTool
    const todo = yield* TodoWriteTool
    const lsptool = yield* LspTool
    const plan = yield* PlanExitTool
    const webfetch = yield* WebFetchTool
    const websearch = yield* WebSearchTool
    const codesearch = yield* CodeSearchTool
    const repoClone = yield* RepoCloneTool
    const repoOverview = yield* RepoOverviewTool
    const shell = yield* ShellTool
    const globtool = yield* GlobTool
    const writetool = yield* WriteTool
    const edit = yield* EditTool
    const greptool = yield* GrepTool
    const patchtool = yield* ApplyPatchTool
    const skilltool = yield* SkillTool
    const agent = yield* Agent.Service

    const state = yield* InstanceState.make<State>(
      Effect.fn("ToolRegistry.state")(function* (ctx) {
        const custom: Tool.Def[] = []

        function fromPlugin(id: string, def: ToolDefinition): Tool.Def {
          // Plugin tools define their args as a raw Zod shape. Wrap the
          // derived Zod object in a `Schema.declare` so it slots into the
          // Schema-typed framework, and annotate with `ZodOverride` so the
          // walker emits the original Zod object for LLM JSON Schema.
          const zodParams = z.object(def.args)
          const parameters = Schema.declare<unknown>((u): u is unknown => zodParams.safeParse(u).success).annotate({
            [ZodOverride]: zodParams,
          })
          return {
            id,
            parameters,
            description: def.description,
            execute: (args, toolCtx) =>
              Effect.gen(function* () {
                const pluginCtx: PluginToolContext = {
                  ...toolCtx,
                  ask: (req) => toolCtx.ask(req),
                  directory: ctx.directory,
                  worktree: ctx.worktree,
                }
                const result = yield* Effect.promise(() => def.execute(args as any, pluginCtx))
                const output = typeof result === "string" ? result : result.output
                const metadata = typeof result === "string" ? {} : (result.metadata ?? {})
                const info = yield* agent.get(toolCtx.agent)
                const out = yield* truncate.output(output, {}, info)
                return {
                  title: "",
                  output: out.truncated ? out.content : output,
                  metadata: {
                    ...metadata,
                    truncated: out.truncated,
                    ...(out.truncated && { outputPath: out.outputPath }),
                  },
                }
              }).pipe(
                Effect.withSpan("Tool.execute", {
                  attributes: {
                    "tool.name": id,
                    "session.id": toolCtx.sessionID,
                    "message.id": toolCtx.messageID,
                    ...(toolCtx.callID ? { "tool.call_id": toolCtx.callID } : {}),
                  },
                }),
              ),
          }
        }

        const dirs = yield* config.directories()
        const matches = dirs.flatMap((dir) =>
          Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
        )
        if (matches.length) yield* config.waitForDependencies()
        for (const match of matches) {
          const namespace = path.basename(match, path.extname(match))
          // `match` is an absolute filesystem path from `Glob.scanSync(..., { absolute: true })`.
          // Import it as `file://` so Node on Windows accepts the dynamic import.
          const mod = yield* Effect.promise(() => import(pathToFileURL(match).href))
          for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
            custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
          }
        }

        const plugins = yield* plugin.list()
        for (const p of plugins) {
          for (const [id, def] of Object.entries(p.tool ?? {})) {
            custom.push(fromPlugin(id, def))
          }
        }

        yield* config.get()
        const questionEnabled =
          ["app", "cli", "desktop"].includes(Flag.OPENCODE_CLIENT) || Flag.OPENCODE_ENABLE_QUESTION_TOOL

        const tool = yield* Effect.all({
          invalid: Tool.init(invalid),
          shell: Tool.init(shell),
          read: Tool.init(read),
          glob: Tool.init(globtool),
          grep: Tool.init(greptool),
          edit: Tool.init(edit),
          write: Tool.init(writetool),
          task: Tool.init(task),
          fetch: Tool.init(webfetch),
          todo: Tool.init(todo),
          search: Tool.init(websearch),
          code: Tool.init(codesearch),
          repo_clone: Tool.init(repoClone),
          repo_overview: Tool.init(repoOverview),
          skill: Tool.init(skilltool),
          patch: Tool.init(patchtool),
          question: Tool.init(question),
          lsp: Tool.init(lsptool),
          plan: Tool.init(plan),
        })

        return {
          custom,
          builtin: [
            tool.invalid,
            ...(questionEnabled ? [tool.question] : []),
            tool.shell,
            tool.read,
            tool.glob,
            tool.grep,
            tool.edit,
            tool.write,
            tool.task,
            tool.fetch,
            tool.todo,
            tool.search,
            ...(Flag.OPENCODE_EXPERIMENTAL_SCOUT ? [tool.code, tool.repo_clone, tool.repo_overview] : []),
            tool.skill,
            tool.patch,
            ...(Flag.OPENCODE_EXPERIMENTAL_LSP_TOOL ? [tool.lsp] : []),
            ...(Flag.OPENCODE_EXPERIMENTAL_PLAN_MODE && Flag.OPENCODE_CLIENT === "cli" ? [tool.plan] : []),
          ],
          task: tool.task,
          read: tool.read,
        }
      }),
    )

    const all: Interface["all"] = Effect.fn("ToolRegistry.all")(function* () {
      const s = yield* InstanceState.get(state)
      return [...s.builtin, ...s.custom] as Tool.Def[]
    })

    const ids: Interface["ids"] = Effect.fn("ToolRegistry.ids")(function* () {
      return (yield* all()).map((tool) => tool.id)
    })

    const describeSkill = Effect.fn("ToolRegistry.describeSkill")(function* (agent: Agent.Info) {
      const list = yield* skill.available(agent)
      if (list.length === 0) return "No skills are currently available."
      return [
        "Load a specialized skill that provides domain-specific instructions and workflows.",
        "",
        "When you recognize that a task matches one of the available skills listed below, use this tool to load the full skill instructions.",
        "",
        "The skill will inject detailed instructions, workflows, and access to bundled resources (scripts, references, templates) into the conversation context.",
        "",
        'Tool output includes a `<skill_content name="...">` block with the loaded content.',
        "",
        "The following skills provide specialized sets of instructions for particular tasks",
        "Invoke this tool to load a skill when a task matches one of the available skills listed below:",
        "",
        Skill.fmt(list, { verbose: false }),
      ].join("\n")
    })

    const describeTask = Effect.fn("ToolRegistry.describeTask")(function* (agent: Agent.Info) {
      const items = (yield* agents.list()).filter((item) => item.mode !== "primary")
      const filtered = items.filter(
        (item) => Permission.evaluate("task", item.name, agent.permission).action !== "deny",
      )
      const list = filtered.toSorted((a, b) => a.name.localeCompare(b.name))
      const description = list
        .map(
          (item) =>
            `- ${item.name}: ${item.description ?? "This subagent should only be called manually by the user."}`,
        )
        .join("\n")
      return ["Available agent types and the tools they have access to:", description].join("\n")
    })

    const tools: Interface["tools"] = Effect.fn("ToolRegistry.tools")(function* (input) {
      const filtered = (yield* all()).filter((tool) => {
        if (tool.id === WebSearchTool.id) {
          return webSearchEnabled(input.providerID)
        }

        const usePatch =
          input.modelID.includes("gpt-") && !input.modelID.includes("oss") && !input.modelID.includes("gpt-4")
        if (tool.id === ApplyPatchTool.id) return usePatch
        if (tool.id === EditTool.id || tool.id === WriteTool.id) return !usePatch

        return true
      })

      return yield* Effect.forEach(
        filtered,
        Effect.fnUntraced(function* (tool: Tool.Def) {
          using _ = log.time(tool.id)
          const output = {
            description: tool.description,
            parameters: tool.parameters,
          }
          yield* plugin.trigger("tool.definition", { toolID: tool.id }, output)

          // Wrap tool execution with SecurityService interception.
          const originalExecute = tool.execute
          const execute = (args: unknown, ctx: Tool.Context<Record<string, unknown>>) =>
            Effect.gen(function* () {
              const now = Date.now()

              // Extract file path and content from args
              const argsObj = typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {}
              const filePath = String(argsObj.filePath ?? argsObj.file ?? "")
              const rawContent = JSON.stringify(args)
              const contentForHash = hashContent(rawContent)

              // Build rich base details
              function buildDetails(extra: Record<string, unknown> = {}): Record<string, unknown> {
                return {
                  file_path: filePath || null,
                  model_id: ctx.agent || null,
                  session_id: ctx.sessionID || null,
                  message_id: ctx.messageID || null,
                  project_root: filePath ? filePath.split("/").slice(0, -1).join("/") || null : null,
                  content_hash: contentForHash,
                  content_preview: rawContent.length > 200 ? rawContent.slice(0, 100) + "..." : rawContent,
                  ...extra,
                }
              }

              // Step 1: Evaluate policy
              const policy = yield* security.evaluatePolicy(tool.id, {
                sessionID: ctx.sessionID,
                messageID: ctx.messageID,
                agent: ctx.agent,
              })
              if (policy.action === "deny") {
                yield* security.recordAuditEvent({
                  eventType: "policy_blocked",
                  sessionId: ctx.sessionID,
                  timestamp: now,
                  severity: "high",
                  toolName: tool.id,
                  modelId: ctx.agent,
                  contentHash: contentForHash,
                  actionTaken: "blocked",
                  details: buildDetails({ reason: policy.explanation, rule: policy.matchedRule }),
                })
                return { title: `⛔ SECURITY BLOCKED (Policy): ${policy.explanation}`, output: `Blocked by security policy: ${policy.explanation}`, metadata: {} } as Tool.ExecuteResult
              }

              // Record the event first so we can link scan results
              const eventId = yield* security.recordAuditEvent({
                eventType: tool.id === "shell" ? "command_scanned" : "file_write_scanned",
                sessionId: ctx.sessionID,
                timestamp: now,
                severity: "info",
                toolName: tool.id,
                modelId: ctx.agent,
                contentHash: contentForHash,
                actionTaken: "allowed",
                details: buildDetails({ status: "pending" }),
              })

              // Step 1.5: Confinement check for file-read tools (prevents exfiltration to LLM)
              if ((tool.id === "read" || tool.id === "glob" || tool.id === "grep") && filePath) {
                const confinement = yield* security.checkConfinement(filePath, "read")
                if (!confinement.allowed) {
                  yield* security.recordAuditEvent({
                    eventType: "file_write_blocked",
                    sessionId: ctx.sessionID,
                    timestamp: now,
                    severity: "high",
                    toolName: tool.id,
                    modelId: ctx.agent,
                    contentHash: contentForHash,
                    actionTaken: "blocked",
                    details: buildDetails({
                      status: "blocked",
                      block_reason: `Confinement: ${confinement.reason}`,
                      path: confinement.path,
                      escapable: confinement.escapable,
                    }),
                  })
                  return {
                    title: `⛔ SECURITY BLOCKED (Confinement): read path outside project root`,
                    output: `Blocked by directory confinement: ${confinement.reason}\nPath: ${confinement.path}`,
                    metadata: {},
                  } as Tool.ExecuteResult
                }
              }

              // Step 1.6: Confinement check for file-write tools
              if ((tool.id === "write" || tool.id === "edit" || tool.id === "patch") && filePath) {
                const confinement = yield* security.checkConfinement(filePath, "write")
                if (!confinement.allowed) {
                  yield* security.recordAuditEvent({
                    eventType: "file_write_blocked",
                    sessionId: ctx.sessionID,
                    timestamp: now,
                    severity: "high",
                    toolName: tool.id,
                    modelId: ctx.agent,
                    contentHash: contentForHash,
                    actionTaken: "blocked",
                    details: buildDetails({
                      status: "blocked",
                      block_reason: `Confinement: ${confinement.reason}`,
                      path: confinement.path,
                      escapable: confinement.escapable,
                    }),
                  })
                  return {
                    title: `⛔ SECURITY BLOCKED (Confinement): path outside project root`,
                    output: `Blocked by directory confinement: ${confinement.reason}\nPath: ${confinement.path}`,
                    metadata: {},
                  } as Tool.ExecuteResult
                }
              }

              // Step 2: Scan content for write/edit/patch tools
              if (tool.id === "write" || tool.id === "edit" || tool.id === "patch") {
                const scanResult = yield* security.scanContent(rawContent, { securityEventId: eventId, sessionID: ctx.sessionID, toolCallID: ctx.callID })
                if (scanResult.action === "block") {
                  const topFinding = scanResult.findings[0]
                  yield* security.recordAuditEvent({
                    eventType: "file_write_blocked",
                    sessionId: ctx.sessionID,
                    timestamp: now,
                    severity: scanResult.severity,
                    toolName: tool.id,
                    modelId: ctx.agent,
                    contentHash: contentForHash,
                    actionTaken: "blocked",
                    details: buildDetails({
                      status: "blocked",
                      scanner: scanResult.scanner,
                      rule_id: scanResult.ruleId,
                      findings: scanResult.findings,
                      remediation: scanResult.remediation,
                      block_reason: topFinding ? `${topFinding.scanner} detected ${topFinding.severity} severity issue: ${topFinding.ruleId}` : "Content scan failed",
                    }),
                  })
                  const blockedTitle = `⛔ SECURITY BLOCKED: ${scanResult.scanner} detected ${scanResult.severity}-severity issue`
                  const blockedOutput = [
                    `Scanner: ${scanResult.scanner}`,
                    `Rule: ${scanResult.ruleId}`,
                    `Severity: ${scanResult.severity}`,
                    scanResult.remediation ? `\n${scanResult.remediation}` : "",
                    scanResult.findings.length > 0 ? `\nFindings: ${scanResult.findings.map((f) => `${f.ruleId} (${f.severity})`).join(", ")}` : "",
                  ].join("\n")
                  return { title: blockedTitle, output: blockedOutput, metadata: {} } as Tool.ExecuteResult
                }
                if (scanResult.action === "warn") {
                  yield* security.recordAuditEvent({
                    eventType: "file_write_warned",
                    sessionId: ctx.sessionID,
                    timestamp: now,
                    severity: scanResult.severity,
                    toolName: tool.id,
                    modelId: ctx.agent,
                    contentHash: contentForHash,
                    actionTaken: "warned",
                    details: buildDetails({
                      status: "warned",
                      findings: scanResult.findings,
                      remediation: scanResult.remediation,
                    }),
                  })
                }
              }

              // Step 3: Scan commands for shell tools
              if (tool.id === "shell") {
                const commandStr = argsObj.command !== undefined ? String(argsObj.command) : String(args)
                const scanResult = yield* security.scanCommand(commandStr, { securityEventId: eventId, sessionID: ctx.sessionID, toolCallID: ctx.callID })
                if (scanResult.action === "block") {
                  const topFinding = scanResult.findings[0]
                  yield* security.recordAuditEvent({
                    eventType: "command_blocked",
                    sessionId: ctx.sessionID,
                    timestamp: now,
                    severity: scanResult.severity,
                    toolName: tool.id,
                    modelId: ctx.agent,
                    contentHash: contentForHash,
                    actionTaken: "blocked",
                    details: buildDetails({
                      status: "blocked",
                      scanner: scanResult.scanner,
                      rule_id: scanResult.ruleId,
                      command: commandStr.length > 500 ? commandStr.slice(0, 500) : commandStr,
                      findings: scanResult.findings,
                      remediation: scanResult.remediation,
                      block_reason: topFinding ? `${topFinding.scanner} flagged command: ${topFinding.ruleId}` : "Command analysis failed",
                    }),
                  })
                  const blockedTitle = `⛔ SECURITY BLOCKED: ${scanResult.scanner} flagged command`
                  const blockedOutput = [
                    `Scanner: ${scanResult.scanner}`,
                    `Rule: ${scanResult.ruleId}`,
                    `Severity: ${scanResult.severity}`,
                    scanResult.remediation ? `\n${scanResult.remediation}` : "",
                    scanResult.findings.length > 0 ? `\nFindings: ${scanResult.findings.map((f) => `${f.ruleId} (${f.severity})`).join(", ")}` : "",
                  ].join("\n")
                  return { title: blockedTitle, output: blockedOutput, metadata: {} } as Tool.ExecuteResult
                }
              }

              // Step 4: Execute the original tool
              const result = yield* originalExecute(args, ctx)
              yield* security.recordAuditEvent({
                eventType: tool.id === "shell" ? "command_completed" : "file_write_completed",
                sessionId: ctx.sessionID,
                timestamp: now,
                severity: "info",
                toolName: tool.id,
                modelId: ctx.agent,
                contentHash: contentForHash,
                actionTaken: "allowed",
                details: buildDetails({ status: "completed", title: result.title }),
              })
              return result
            }).pipe(Effect.orDie) as Effect.Effect<Tool.ExecuteResult>

          return {
            id: tool.id,
            description: [
              output.description,
              tool.id === TaskTool.id ? yield* describeTask(input.agent) : undefined,
              tool.id === SkillTool.id ? yield* describeSkill(input.agent) : undefined,
            ]
              .filter(Boolean)
              .join("\n"),
            parameters: output.parameters,
            execute,
            formatValidationError: tool.formatValidationError,
          }
        }),
        { concurrency: "unbounded" },
      )
    })

    const named: Interface["named"] = Effect.fn("ToolRegistry.named")(function* () {
      const s = yield* InstanceState.get(state)
      return { task: s.task, read: s.read }
    })

    return Service.of({ ids, all, named, tools })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Config.defaultLayer),
    Layer.provide(Plugin.defaultLayer),
    Layer.provide(Question.defaultLayer),
    Layer.provide(Todo.defaultLayer),
    Layer.provide(Skill.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(Session.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(Git.defaultLayer),
    Layer.provide(LSP.defaultLayer),
    Layer.provide(Instruction.defaultLayer),
    Layer.provide(AppFileSystem.defaultLayer),
    Layer.provideMerge(Security.busLayer),
    Layer.provide(Bus.layer),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Format.defaultLayer),
    Layer.provide(CrossSpawnSpawner.defaultLayer),
    Layer.provide(Ripgrep.defaultLayer),
    Layer.provide(Truncate.defaultLayer),
  ),
)

export * as ToolRegistry from "./registry"
