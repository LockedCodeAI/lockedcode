# LockedCode Architecture

**Project:** LockedCode
**Repository:** https://github.com/LockedCodeAI/lockedcode
**Local Path:** ~/Documents/GitHub/lockedcode
**Origin:** Fork of anomalyco/opencode (MIT License)
**Date:** 2026-05-09

---

## 1. Project Overview

LockedCode is a security-hardened fork of OpenCode, the open-source AI coding agent. LockedCode adds a comprehensive security layer between the LLM's intent and the agent's execution: every file write passes through static scanning, every shell command is structurally parsed and analyzed, every outbound context payload is checked for secrets and PII, every action is confined to the project directory at the operating system level, and everything is logged in an immutable, content-hashed audit trail.

LockedCode is not a wrapper around OpenCode — it *is* OpenCode with a security layer. All original OpenCode capabilities (provider integrations, TUI, LSP support, MCP, client/server architecture, plugin system) are fully preserved. The fork diverges only where security confinement, scanning, and audit require additional code. The goal is to stay mergeable with upstream OpenCode.

The security layer targets three chokepoints:
1. **Tool execution** — every tool invocation (file read/write/edit, shell command, network call) passes through SecurityService before executing
2. **Shell execution** — every shell command is structurally parsed, path-extracted, and validated against the confinement boundary before spawning
3. **Outbound context** — every file read that becomes LLM context is scanned for secrets, PII, and prompt injection before leaving the machine

This document describes the current state of the inherited OpenCode architecture (Section 2) and the intended design of the LockedCode security layer (Sections 3–8). All sections describing inherited architecture were produced by reading actual source files on disk — they describe reality, not intent.

---

## 2. Inherited Architecture

### 2.1 Monorepo Structure

The repository is a Bun + Turborepo monorepo at `https://github.com/LockedCodeAI/lockedcode`. Source tree:

```
lockedcode/
├── packages/
│   ├── opencode/                 # Core AI agent (the main deliverable)
│   │   └── src/
│   │       ├── cli/              # CLI entrypoint (yargs), all subcommands (run, serve, generate, account, providers, agent, upgrade, uninstall, models, serve, debug, stats, mcp, github, export, import, attach, web, pr, session, db, plugin, acp)
│   │       ├── agent/            # Agent orchestration — Info schema, built-in agents, config merging
│   │       ├── session/          # Session lifecycle, prompt building, LLM loop, context management
│   │       ├── provider/         # LLM provider integrations (auth, models, schema, transforms, SDK adapters)
│   │       ├── tool/             # 45+ tool implementations (read, write, edit, grep, glob, shell, etc.)
│   │       ├── server/           # HTTP API server (Hono) with routes, auth, CORS, mDNS, events
│   │       ├── effect/           # Effect-ts system services (runtimes, bootstrap, config, instance management)
│   │       ├── config/           # Configuration parsing — 22 modules (agent, commands, formatters, layouts, LSP, MCP, model IDs, permissions, plugins, providers, references, skills, variables, etc.)
│   │       ├── project/          # Project/instance lifecycle (bootstrap, VCS, instance context/layer/runtime/store)
│   │       ├── mcp/              # Model Context Protocol (server/client management, auth, OAuth)
│   │       ├── lsp/              # Language Server Protocol (client management, diagnostics, language detection)
│   │       ├── storage/          # Database layer — SQLite via Drizzle ORM, Bun and Node adapters, JSON migration
│   │       ├── bus/              # Typed event bus — global events, pub/sub, per-instance scoping
│   │       ├── sync/             # Event-based sync engine (event tracking, schema, replication)
│   │       ├── share/            # Session sharing (export/import, share links)
│   │       ├── permission/       # Permission system — Ruleset, evaluate(), ask/reply flow
│   │       ├── control-plane/    # Cloud control plane integration (adapters, workspace management)
│   │       ├── v2/               # v2 session/message schema (auth, events, models, tool output)
│   │       ├── acp/              # Agent Client Protocol implementation
│   │       ├── shell/            # Shell execution abstraction
│   │       ├── git/              # Git operations
│   │       ├── skill/            # Skill discovery system
│   │       ├── patch/            # File patching
│   │       ├── install/          # Installation management
│   │       ├── account/          # Cloud account management
│   │       ├── auth/             # Provider auth credential management (OAuth, API key, well-known)
│   │       ├── command/          # Command definitions
│   │       ├── file/             # File system operations (watcher, ignore, protected, ripgrep)
│   │       ├── format/           # Code formatting
│   │       ├── id/               # ID generation (ULID-based)
│   │       ├── ide/              # IDE integration
│   │       ├── permission/       # Permission evaluation
│   │       ├── plugin/           # Plugin system (loading, lifecycle, GitHub Copilot, Azure, Cloudflare)
│   │       ├── pty/              # PTY abstraction (Bun + Node adapters)
│   │       ├── question/         # User question prompts
│   │       ├── snapshot/         # Snapshot/diff operations
│   │       ├── util/             # Utility modules (30+ files — filesystem, error, format, color, queue, lock, etc.)
│   │       └── worktree/         # Worktree management
│   ├── ui/                       # Shared SolidJS component library (components, hooks, i18n, theme, styles, storybook)
│   ├── app/                      # Web application (SolidJS + Vite, SolidStart, Tailwind v4, Playwright e2e)
│   ├── web/                      # Marketing website (Astro, static site, i18n)
│   ├── storybook/                # UI component storybook
│   ├── desktop/                  # Electron desktop app (electron-vite, electron-builder)
│   ├── console/                  # Cloud console (Cloudflare Workers / SST)
│   │   ├── app/                  #   Console web app (SolidJS SSR)
│   │   ├── core/                 #   Console backend (Drizzle schema, accounts, billing, subscriptions)
│   │   ├── function/             #   Cloud functions (auth, log processor)
│   │   └── resource/             #   Infrastructure resources
│   ├── sdk/js/                   # JavaScript SDK for the HTTP API
│   ├── plugin/                   # Plugin system package
│   ├── core/                     # Shared core library (Log, Flag, Global, Filesystem, Schema effect wrappers)
│   ├── docs/                     # Documentation (Mintlify, MDX)
│   ├── slack/                    # Slack integration
│   ├── enterprise/               # Enterprise features
│   ├── llm/                      # LLM utility package
│   ├── containers/               # Docker container definitions (base, bun-node, rust, tauri-linux)
│   ├── http-recorder/            # HTTP recording/replay for testing
│   ├── identity/                 # Brand assets and logos
│   └── extensions/               # Editor extensions (Zed)
├── sdks/
│   └── vscode/                   # VS Code extension
├── github/                       # GitHub Action (@opencode-ai/github-action)
├── infra/                        # SST Ion infrastructure (Cloudflare Workers, Stripe, PlanetScale)
├── nix/                          # Nix packaging (flakes, overlays for opencode and opencode-desktop)
├── script/                       # Build/release scripts (publish, version, changelog, stats)
├── specs/                        # Design specs and v2 migration plans
├── patches/                      # Patched dependencies (solid-js, @npmcli/agent)
├── .github/                      # CI/CD (27 GitHub Actions workflows)
├── .opencode/                    # OpenCode agent config (skills, commands, glossary)
├── .husky/                       # Git hooks (pre-push)
└── rules/                        # NEW — bundled security rule sets (LockedCode addition)
```
### 2.2 Monorepo Build and Dependencies

**Build system:** Turborepo 2.8.13 with Bun 1.3.13 as package manager. Workspace packages defined in root `package.json` via `workspaces.packages` array. Shared dependency versions pinned through Bun workspace catalogs.

**Key dependencies:**
- **Effect-ts** `4.0.0-beta.59` — dependency injection, structured concurrency, typed errors, schema validation
- **Vercel AI SDK** (`ai` 6.0.168) — LLM interaction with 18+ provider SDKs
- **Drizzle ORM** `1.0.0-beta.19` — SQLite (local) + MySQL (cloud console) database access with Drizzle Kit for migrations
- **SolidJS** `1.9.10` + **OpenTUI** `0.2.6` — terminal UI rendering
- **Hono** `4.10.7` — HTTP server framework
- **Zod** `4.1.8` — schema validation for config and tool parameters
- **tree-sitter** — bash and PowerShell parsing for permission-aware shell command analysis

### 2.3 Effect-ts Service Pattern

Every service follows a consistent pattern with 131 instances across the codebase:

```typescript
// 1. Define the interface
export interface Interface {
  readonly get: (key: string) => Effect.Effect<Info | undefined, AuthError>
  readonly set: (key: string, info: Info) => Effect.Effect<void, AuthError>
}

// 2. Create the service tag
export class Service extends Context.Service<Service, Interface>()("@opencode/ServiceName") {}

// 3. Create the layer (implementation)
export const layer = Layer.effect(Service, Effect.gen(function* () {
  const dep = yield* DependencyService  // inject dependencies via yield*
  const get = Effect.fn("Service.get")(function* (key: string) { ... })
  const set = Effect.fn("Service.set")(function* (key: string, info: Info) { ... })
  return Service.of({ get, set })
}))

// 4. Default layer with standard dependencies
export const defaultLayer = layer.pipe(Layer.provide(Dependency.defaultLayer))
```

**Concrete examples found in the codebase:**
- `Auth.Service` at `packages/opencode/src/auth/index.ts:51` — interface with `get`, `all`, `set`, `remove` methods
- `Session.Service` at `packages/opencode/src/session/session.ts` — 30+ methods including `list`, `create`, `fork`, `get`, `setTitle`, `messages`, `children`, `remove`
- `ToolRegistry.Service` at `packages/opencode/src/tool/registry.ts` — interface with `ids`, `all`, `named`, `tools` methods
- `Config.Service` at `packages/opencode/src/config/config.ts` — interface with `get`, `getGlobal`, `update`, `invalidate`, `directories` methods

### 2.4 Tool System Architecture

**File location:** `packages/opencode/src/tool/`

**45+ tool implementations** following a consistent pattern:

```typescript
// Each tool is defined in its own file via Tool.define()
export const ReadTool = Tool.define(
  "read",
  Effect.gen(function* () {
    const instance = yield* InstanceState.context    // resolve dependencies
    return {
      description: DESCRIPTION,                      // from read.txt
      parameters: Parameters,                         // Schema.Struct({...})
      execute: (params, ctx) => Effect.gen(function* () {
        yield* ctx.ask(...)                           // permission check
        // ... actual implementation
      }),
    }
  }),
)
```

**Registration and discovery:** All tools are registered in `registry.ts` (376 lines). Inside the initialization layer, each tool is yielded individually:

```typescript
const read = yield* ReadTool
const write = yield* WriteTool
const edit = yield* EditTool
const shell = yield* ShellTool
// ... 45+ tools
```

Tools are then resolved via `Tool.init()` inside `Effect.all()` and assembled into a `State` object with `custom`, `builtin`, `task`, and `read` categories. The `tools()` method filters tools based on `modelID` and `providerID` — e.g., `WebSearchTool` is gated by provider capability.

**Plugin-provided tools** are discovered by scanning `{tool,tools}/*.{js,ts}` files in config directories via `Glob.scanSync`.

**Execution flow:** When a tool is called:
1. `Tool.wrap()` decorates the execute function with Schema decoding, output truncation, and OTel tracing
2. The tool's `execute(params, ctx)` runs inside `Effect.gen`
3. Permission checking via `ctx.ask(permissionRequest)` happens before side effects
4. Output is returned as `{ title, metadata, output, attachments? }`

**Key tool files:**
- `tool.ts` (162 lines) — core `Tool.define()`, `Tool.init()`, `Tool.wrap()`, `Context<M>`, `Def<Parameters, M>`, `Info<Parameters, M>` types
- `schema.ts` (16 lines) — `ToolID` branded type
- `registry.ts` (376 lines) — central registry, initialization, filtering
- `read.ts`, `write.ts`, `edit.ts`, `shell.ts`, `grep.ts`, `glob.ts` — core tools
- `task.ts`, `plan.ts`, `webfetch.ts`, `websearch.ts`, `codesearch.ts`, `repo_clone.ts` — complex tools
- `apply_patch.ts`, `invalid.ts`, `todo.ts`, `skill.ts`, `lsp.ts` — utility tools
- Descriptions stored in parallel `.txt` files (e.g., `read.txt`, `edit.txt`)

### 2.5 Agent Orchestration

**File location:** `packages/opencode/src/agent/`

Agent definitions are `Schema.Struct({...})` types with fields: `name`, `description`, `mode` (subagent/primary/all), `native`, `hidden`, `permission`, `model`, `prompt`, `options`, `steps`.

**Built-in agents:**
| Agent ID | Mode | Description |
|---|---|---|
| `build` | primary | Default full-access agent |
| `plan` | primary | Read-only planning agent |
| `general` | subagent | Multi-step multi-tool sub-agent |
| `explore` | subagent | Read-only codebase exploration |
| `scout` | subagent | Docs/dependency research (experimental) |
| `compaction` | primary/hidden | Context compaction |
| `title` | primary/hidden | Title generation |
| `summary` | primary/hidden | Summary generation |

**Agent selection flow:** The prompt building system (`session/prompt.ts`) resolves the current agent via `Agent.Service.get(agentName)`, merges user config overrides via `Permission.merge()`, and builds the system prompt from the agent's prompt template file. Tool resolution calls `ToolRegistry.tools(model)` which filters tools available to the current agent.

**Sub-agent spawning:** When a `SubtaskPart` is found in user messages, the system calls `TaskTool.execute()` which creates a new agent context with its own prompt, tool set, and permission scope. Sub-agents inherit their parent's permission configuration.

### 2.6 Session and Context Building

**File location:** `packages/opencode/src/session/`

The session system manages the full lifecycle of conversations between the user and the LLM agent.

**Session lifecycle:**
1. `SessionService.create()` — creates a new session with ID, slug, project/directory/time
2. Messages and parts are created and stored via CRUD operations on `MessageV2` types
3. Sessions support forking (`fork()`) which copies messages with new IDs
4. Sessions can be archived, reverted, compacted, and summarized

**Context building (`prompt.ts`, 2500+ lines):** The core LLM loop orchestration:
1. `createUserMessage()` — builds the user message from prompt parts (file references, agent references, text, images, etc.)
2. `resolveTools()` — calls `ToolRegistry.tools()` for the current agent/model, wraps each tool with context/permission/plugin hooks
3. `handleSubtask()` — launches sub-agent tasks via `TaskTool.execute()` with permission checking
4. `ensureTitle()` — generates conversational title using the "title" agent
5. `insertReminders()` — conditionally injects plan mode instructions and build-switch prompts

**LLM streaming (`llm.ts`):** Wraps `streamText` from the Vercel AI SDK with tool call handling, streaming output processing, error handling, and retry logic.

**Tool call processing (`processor.ts`):** Handles the streaming loop — processes tool calls as they arrive from the LLM, tracks executions, detects doom loops, and manages the roundtrip between LLM output and tool execution.

### 2.7 Permission System

**File location:** `packages/opencode/src/permission/`

**Core types:**
```typescript
export const Action = Schema.Literals(["allow", "deny", "ask"])
export const Rule = Schema.Struct({
  permission: Schema.String,   // e.g., "read", "edit", "bash", "*"
  pattern: Schema.String,      // glob pattern, e.g., "*.env", "*"
  action: Action,
})
export const Ruleset = Schema.mutable(Schema.Array(Rule))
```

**Evaluation logic** (`evaluate.ts`, 15 lines): Rules are evaluated by iterating in reverse order (last match wins). The default action when no rule matches is `"ask"`:

```typescript
export function evaluate(permission: string, pattern: string, ...rulesets: Rule[][]): Rule {
  const rules = rulesets.flat()
  const match = rules.findLast(
    (rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern),
  )
  return match ?? { action: "ask", permission, pattern: "*" }
}
```

**Ask/reply flow** (`index.ts`, lines 179–260):
1. `ask()` evaluates permission requests against the merged ruleset
2. If any pattern evaluates to `"deny"` → throws `DeniedError`
3. If all evaluate to `"allow"` → returns immediately
4. If any evaluates to `"ask"` → creates a `Deferred`, publishes `Event.Asked` on the bus, awaits user response
5. `reply()` handles user response — `"reject"` fails the deferred, `"once"` succeeds it, `"always"` adds the pattern to the approved list

**Storage:** Permission rulesets are stored as JSON blobs in `SessionTable.permission` (per-session) and `PermissionTable` (per-project).

### 2.8 Event Bus

**File location:** `packages/opencode/src/bus/`

**Typed pub/sub event bus** with instance scoping:

```typescript
export interface Interface {
  readonly publish: <D>(def: D, properties: BusProperties<D>) => Effect.Effect<void>
  readonly subscribe: <D>(def: D) => Stream.Stream<Payload<D>>
  readonly subscribeAll: () => Stream.Stream<Payload>
  readonly subscribeCallback: <D>(def: D, callback) => Effect.Effect<() => void>
}
```

**Architecture:** Instance-scoped (per-project) backed by `InstanceState.make<State>` which creates an unbounded `PubSub` for typed and wildcard subscriptions. `publish()` emits to both the typed PubSub (for specific subscribers) and the wildcard PubSub (for catch-all). Also emits via `GlobalBus.emit("event", ...)` for cross-instance communication.

**Event definition:** Events are defined via `BusEvent.define(type, propertiesSchema)` which returns a typed `Definition<Type, Properties>`. Each definition carries a `type` string and a `properties` schema.

**Built-in event:** `InstanceDisposed` — published when a service instance is cleaned up.

### 2.9 Configuration System

**File location:** `packages/opencode/src/config/`

**22 config modules** each following the self-export pattern:
```typescript
export * as ConfigAgent from "./agent"  // at TOP of file
```

**Config loading chain** (`config.ts`, 843 lines):
1. Well-known remote configs from account auth providers
2. Global config files at XDG path: `config.json`, `opencode.json`, `opencode.jsonc`
3. `OPENCODE_CONFIG` env var
4. Project-local config files from worktree config paths
5. `OPENCODE_CONFIG_DIR` and `.opencode/` directories
6. Plugin installation from `@opencode-ai/plugin` in each config directory
7. Command definitions from `command/*.{ts,js}`
8. Agent configs from `{agent,agents}/*.md` and `{mode,modes}/*.md` (frontmatter-parsed)
9. `OPENCODE_CONFIG_CONTENT` env var
10. Console/account-provided config
11. Managed config directory
12. macOS MDM preferences
13. `OPENCODE_PERMISSION` env var
14. Tools config translated to permission

All sources are deep-merged via `mergeConfigConcatArrays()` (deep merge with array concatenation).

### 2.10 Database Layer

**File location:** `packages/opencode/src/storage/`

**Local SQLite database** via Drizzle ORM with Bun SQLite adapter:
```typescript
// db.bun.ts
export function init(path: string) {
  const sqlite = new Database(path, { create: true })
  return drizzle({ client: sqlite })
}
```

**Key SQLite tables:** `session`, `message`, `part`, `todo`, `session_message`, `permission`, `project`, `account`, `account_state`, `workspace`, `event_sequence`, `event`, `session_share`

**Table conventions:** snake_case columns, `<entity>_id` join columns, `<table>_<column>_idx` index names. Shared `Timestamps` mixin provides `time_created` and `time_updated`. JSON columns use `text({ mode: "json" }).$type<T>()` for structured data. Typed IDs use branded Effect Schema types.

**Migrations:** Drizzle Kit generates timestamped migration folders (`<timestamp>_<slug>/`) containing `migration.sql` and `snapshot.json`. Applied via `bun run db generate --name <slug>`.

**JSON file storage** (`storage.ts`): A separate file-based key-value store at `Global.Path.data + "/storage"`. Each key array maps to a `.json` file. Uses `RcMap` + `TxReentrantLock` for per-file locking. Two data migrations defined (for project/session reorganization and summary diff extraction).

### 2.11 Shell Execution

**File location:** `packages/opencode/src/tool/shell.ts` and `packages/opencode/src/shell/shell.ts`

The ShellTool uses `tree-sitter` WASM parsers (bash and PowerShell) to extract file paths from command strings for permission checking. The shell execution itself delegates to the PTY abstraction (`packages/opencode/src/pty/`) which has Bun and Node adapters.

Shell commands flow through the permission system via `ctx.ask()` before spawning. The `ShellTool.execute()` method:
1. Parses the command using tree-sitter to extract referenced file paths
2. Validates extracted paths against the permission ruleset
3. Calls `ctx.ask("bash", patterns)` to check if the command is permitted
4. Forks a shell process via the PTY layer
5. Streams output back through the session

---

## 3. Security Layer Architecture

### 3.1 SecurityService — Root Interception Service

`SecurityService` is a new Effect service at `packages/opencode/src/security/index.ts`. It sits at three interception points in the existing agent pipeline, wrapping every LLM-proposed action before execution.

**Interface:**
```typescript
export interface Interface {
  readonly scan: (input: ScanInput) => Effect.Effect<ScanResult, SecurityError>
  readonly confine: (input: ConfineInput) => Effect.Effect<ConfineResult, SecurityError>
  readonly audit: (input: AuditInput) => Effect.Effect<void, SecurityError>
  readonly evaluatePolicy: (input: PolicyInput) => Effect.Effect<PolicyResult, SecurityError>
  readonly scoreTrust: (input: TrustInput) => Effect.Effect<TrustScore, SecurityError>
}
```

**Service tag:**
```typescript
export class Service extends Context.Service<Service, Interface>()("@lockedcode/Security") {}
```

### 3.2 Integration Model — Three Chokepoints

SecurityService intercepts at three specific points in the inherited pipeline. Each interception is a hook (not a rewrite) that calls SecurityService and returns a decision.

#### Chokepoint 1: Tool Execution

**Location to modify:** `packages/opencode/src/tool/registry.ts` — the `tools()` method that resolves tool definitions for the agent, wrapping each tool's `execute` function.

**Modification:** After tools are initialized and resolved, wrap each tool's `execute` function with a security interceptor. Before the tool's own execute runs:
1. Call `SecurityService.evaluatePolicy({ action: tool.id, params, model })` → get policy decision
2. Call `SecurityService.scoreTrust({ action: tool.id, params, policyResult })` → get trust score
3. If policy denies → return blocked response with explanation
4. If trust score exceeds prompt threshold → insert permission prompt via `ctx.ask()`
5. Call `SecurityService.confine({ paths })` for any tool that touches filesystem
6. Call `SecurityService.scan({ content, action: tool.id })` for any tool that writes files
7. Proceed to original execute

After execution completes:
8. Call `SecurityService.audit({ action, decision, scanResult, trustScore, output })` → record audit entry

#### Chokepoint 2: Shell Execution

**Location to modify:** `packages/opencode/src/tool/shell.ts` — the `ShellTool.execute()` function, between command parsing and process spawning.

**Modification:** After the shell command is parsed by tree-sitter and paths are extracted:
1. Call `SecurityService.evaluatePolicy({ action: "shell", command, extractedPaths })`
2. Call `SecurityService.confine({ paths: extractedPaths })` → validate all paths against confinement boundary
3. Check hard-blocked command patterns
4. Call `SecurityService.scoreTrust({ action: "shell", command })`

If any check produces a `"deny"`, the command is blocked with an explanation before any process spawns.

#### Chokepoint 3: Outbound Context

**Location to modify:** `packages/opencode/src/session/prompt.ts` — the context building functions that assemble file contents into LLM prompt context.

**Modification:** Before file contents are added to the prompt context:
1. Call `SecurityService.scan({ content: fileContents, action: "dlp", metadata: { filePath, sensitivity } })` → scan for secrets, PII, and prompt injection
2. If sensitive content detected → apply policy action (block file, warn, or redact)
3. If redaction mode → replace sensitive values with typed placeholders

### 3.3 Module Structure

All LockedCode security code lives under `packages/opencode/src/security/`:

```
packages/opencode/src/security/
├── index.ts              # SecurityService — root service, exports, integration wiring
├── confinement/          # Project-root jail (per-platform backends)
│   ├── index.ts          #   ConfinementService interface and platform-agnostic logic
│   ├── linux.ts          #   Landlock LSM backend + Bubblewrap fallback
│   ├── macos.ts          #   sandbox-exec profile generation + FSEvents monitor
│   ├── windows.ts        #   Restricted tokens, NTFS ACLs, job objects
│   └── common.ts         #   Shared: path canonicalization, process tree model, pre-approved paths
├── scanning/             # Static scanning pipeline
│   ├── index.ts          #   ScanningService interface, scan orchestration, result aggregation
│   ├── semgrep.ts        #   Semgrep integration (CLI invocation, rule management)
│   ├── yara.ts           #   YARA integration (CLI invocation, signature management)
│   └── entropy.ts        #   Entropy analysis (high-entropy string detection)
├── dlp/                  # Outbound data loss prevention
│   ├── index.ts          #   DLPService interface, outbound interception hook
│   ├── scanner.ts        #   Secret + PII scanning on outbound content
│   ├── redact.ts         #   Redaction engine (typed placeholders)
│   └── policy.ts         #   File-level sensitivity policy matching
├── injection/            # Prompt injection detection
│   ├── index.ts          #   InjectionScanner (plugs into ScanningService)
│   └── patterns.ts       #   Injection pattern library
├── secrets/              # Secret detection in generated code
│   ├── index.ts          #   SecretScanner (plugs into ScanningService)
│   └── patterns.ts       #   50+ credential pattern definitions
├── audit/                # Audit trail
│   ├── index.ts          #   AuditService interface
│   ├── schema.sql.ts     #   SQLite schema (security_event, scan_result, policy_decision)
│   └── query.ts          #   Query interface and retention policy
├── policy/               # Policy engine
│   ├── index.ts          #   PolicyEngine interface, evaluation, hierarchy merging
│   └── schema.ts         #   Zod validation schema for lockedcode.yaml
├── trust/                # Trust scoring
│   └── index.ts          #   TrustService interface, scoring model, session decay
└── cascade/              # Multi-agent security cascade
    └── index.ts          #   CascadeService — policy inheritance, privilege escalation prevention
```

#### 3.3.1 confinement/index.ts — ConfinementService

```typescript
export interface Interface {
  readonly confine: (projectRoot: string) => Effect.Effect<void, ConfinementError>
  readonly checkPath: (path: string, operation: "read" | "write" | "execute") => Effect.Effect<ConfineResult, ConfinementError>
  readonly requestEscape: (path: string, operation: string, reason: string) => Effect.Effect<EscapeResult, ConfinementError>
  readonly releaseConfinement: () => Effect.Effect<void, ConfinementError>
  readonly detectBackend: () => Effect.Effect<ConfinementBackend>
}
```

**Platform detection:** On startup, `detectBackend()` checks OS + kernel capabilities:
- Linux: checks `/proc/sys/kernel/arch` for Landlock support, falls back to Bubblewrap
- macOS: checks `sandbox-exec` availability, reports FSEvents capability
- Windows: checks restricted token and job object API availability

#### 3.3.2 confinement/common.ts — Shared Infrastructure

**Path canonicalization:** Cross-platform normalization that:
1. Resolves `~` to home directory (via `os.homedir()`)
2. Resolves relative paths (`../`) against project root
3. Resolves symlinks via `fs.realpathSync()` or equivalent
4. Normalizes platform-specific encodings: Windows short names (8.3), junction points, UNC paths, `\\?\` prefixes, macOS `/private/var` → `/var` aliases
5. Returns canonical absolute path for confinement checks

**Project root detection** (tries in order):
1. Nearest `.git` directory walking up from cwd (handles worktrees, submodules, monorepo roots)
2. Explicit `project_root` field in `lockedcode.yaml`
3. Fallback to `process.cwd()`

**Process tree model:** Maintains parent-child agent relationships via a `Map<AgentID, AgentNode>` where each node stores `parentID`, `confinementBoundary`, and `effectivePolicy`. When a sub-agent spawns a process, the child inherits the parent's node context.

**Pre-approved paths:** Default set: `/tmp`, `~/.cache`, `~/.npm`, `~/.bun`. Configurable via policy. These paths bypass the escape hatch but are still logged.

**Escape hatch flow:**
1. SecurityService intercepts action targeting path outside project root
2. Checks pre-approved path list → auto-approve if matched
3. Creates `SecurityEvent.escape_requested` with path, operation, model ID, content hash
4. Publishes to bus → TUI shows approval prompt
5. Waits for explicit user approval or denial
6. On approval: executes action, logs `SecurityEvent.escape_approved`
7. On denial: blocks action, logs `SecurityEvent.escape_denied`

#### 3.3.3 scanning/index.ts — ScanningService

```typescript
export interface Interface {
  readonly register: (scanner: Scanner) => Effect.Effect<void>
  readonly scan: (input: ScanInput) => Effect.Effect<ScanResult[], ScanningError>
  readonly getScanners: () => Effect.Effect<Scanner[]>
}

// Each scanner implements:
export interface Scanner {
  readonly name: string
  readonly scan: (content: string, metadata: ScanMetadata) => Effect.Effect<ScanFinding[], ScannerError>
  readonly available: () => Effect.Effect<boolean>
}

export interface ScanFinding {
  ruleID: string
  severity: "info" | "warning" | "high" | "critical"
  message: string
  matchStart: number
  matchEnd: number
  matchedContent: string
  remediation?: string
}
```

**Scan orchestration:** `SecurityService.scan()` calls all registered scanners in parallel via `Effect.all(scanners.map(s => s.scan(content)))`. Results are aggregated and the highest severity finding determines the overall result. Scans can run in parallel for up to a configurable timeout (default: 10 seconds).

**Graceful degradation:** Each scanner's `available()` method checks whether the external binary is on PATH (Semgrep, YARA). Unavailable scanners are skipped with a logged warning — they don't block the pipeline.

#### 3.3.4 dlp/index.ts — DLPService

```typescript
export interface Interface {
  readonly scanOutbound: (content: string, filePath: string) => Effect.Effect<DLPResult, DLPError>
  readonly classifyFile: (filePath: string) => Effect.Effect<FileSensitivity>
  readonly redact: (content: string, findings: DLPFinding[]) => Effect.Effect<string>
}

export interface DLPResult {
  findings: DLPFinding[]
  action: "allow" | "block" | "redact"
}

export type FileSensitivity = "public" | "internal" | "confidential" | "restricted"
```

**Outbound interception:** Hooks into `session/prompt.ts` at the point where file contents are read and added to the context window. Each file is scanned before it's included. Sensitive files are blocked or redacted per policy.

#### 3.3.5 injection/index.ts — InjectionScanner

Plugs into `ScanningService` as a registered scanner. Scans file content for prompt injection patterns before the content enters the LLM context window.

**Pattern categories:**
- Role-override attempts: "You are now a...", "Ignore previous instructions", "Forget all prior instructions"
- System prompt markers: `<|system|>`, `[INST]`, `[SYS]`, delimiter sequences
- Instruction injection in comments: `// IMPORTANT: override`, `<!-- ignore all prior instructions -->`
- Unicode tricks: invisible characters (U+200B, U+200C), bidirectional overrides (U+202E), homoglyphs
- Encoded instructions: base64-encoded prompts in comments, metadata, or string literals
- Indirect injection via dependency metadata

#### 3.3.6 secrets/index.ts — SecretScanner

Plugs into `ScanningService`. Scans proposed file content for credential patterns before the file is written to disk.

**Pattern library** (50+ formats in `rules/secrets/`):
- AWS access keys (`AKIA...`, `ASIA...`) and secret keys
- GitHub PATs (`ghp_...`, `github_pat_...`), OAuth tokens, installation tokens
- Google API keys, service account JSON key headers
- Stripe test/live keys (`sk_test_...`, `sk_live_...`, `rk_live_...`)
- Twilio, SendGrid, Slack tokens, Discord bot tokens
- Database URIs with embedded passwords (postgres://, mysql://, mongodb://, etc.)
- Private key headers (`-----BEGIN RSA PRIVATE KEY-----`, etc.)
- JWTs (detected by `header.payload.signature` pattern)
- Generic high-entropy strings in assignment contexts

**Context-aware scanning:** Distinguishes actual secrets from test fixtures by:
- Checking known example patterns (e.g., `AKIAIOSFODNN7EXAMPLE` is AWS's documented example key)
- Checking file path against test/fixture directories
- Checking for "example" or "test" in surrounding context

#### 3.3.7 audit/index.ts — AuditService

```typescript
export interface Interface {
  readonly record: (event: SecurityEvent) => Effect.Effect<void, AuditError>
  readonly query: (filters: AuditFilters) => Effect.Effect<SecurityEvent[], AuditError>
  readonly prune: () => Effect.Effect<number, AuditError>  // returns count of pruned entries
}
```

**Append-only behavior:** `record()` is the only write operation. No `update()` or `delete()` methods on audit records. Retention is handled by `prune()` which removes entries older than the configured retention period.

**Content hashing:** Every audit entry includes `contentHash: string` computed via SHA-256 of the relevant content (file contents, command text, scan input). The hash is computed before any modification so it's tamper-evident.

**Session correlation:** Every audit entry is linked to the current `sessionID`, `messageID`, `toolCallID`, and `modelID` from the execution context.

#### 3.3.8 policy/index.ts — PolicyEngine

```typescript
export interface Interface {
  readonly evaluate: (input: PolicyInput) => Effect.Effect<PolicyResult, PolicyError>
  readonly load: (paths: string[]) => Effect.Effect<PolicyDocument, PolicyError>
  readonly reload: () => Effect.Effect<void, PolicyError>
}

export interface PolicyResult {
  decision: "allow" | "deny" | "ask"
  matchedRule: string
  explanation: string
}
```

**Policy hierarchy:** Global defaults (built-in) → XDG-level policy → project `lockedcode.yaml` → session overrides. Merging is explicit: `merge(parent, child)` where child rules override parent rules on conflict. All merges are logged in the audit trail.

**Policy validation:** On `load()`, the policy is validated against the Zod schema. Syntax errors, unknown keys, and conflicting rules produce descriptive error messages. Invalid policies fail loudly — they don't silently fall back to defaults.

#### 3.3.9 trust/index.ts — TrustService

```typescript
export interface Interface {
  readonly score: (input: TrustInput) => Effect.Effect<TrustScore, TrustError>
  readonly trustDecay: (sessionID: SessionID) => Effect.Effect<void, TrustError>
  readonly getModelHistory: (modelID: string) => Effect.Effect<ModelTrustProfile, TrustError>
}
```

**Scoring model:** Actions are scored on a 0–100 scale:
- File rename/move within project: 0–10
- New file creation within project: 0–10
- File edit with no scan findings: 10–30
- Shell command within project, no outside paths: 30–50
- File write with scan warnings: 50–70
- Shell command with pipes or redirects: 50–70
- Any action involving outside paths: 70–90
- Shell command matching soft-blocked patterns: 80–100

**Thresholds** (configurable per policy strictness level):
- `autoApproveBelow`: execute silently, log only
- `promptAbove`: require explicit user approval
- `blockAbove`: hard block, no override

#### 3.3.10 cascade/index.ts — CascadeService

```typescript
export interface Interface {
  readonly inherit: (childSessionID: SessionID, parentSessionID: SessionID) => Effect.Effect<void, CascadeError>
  readonly verifyEscalation: (child: AgentID, parent: AgentID) => Effect.Effect<boolean, CascadeError>
}
```

**Policy inheritance:** When a sub-agent is created (via `TaskTool.execute()` or `handleSubtask()`), `CascadeService.inherit()` copies the parent's security state:
- SecurityService instance (same service, shared state)
- Confinement boundary (same `projectRoot`, same backend)
- Policy document (same merged policy at parent's resolution)
- Audit context (new entries tagged with `parentSessionID`)

**No privilege escalation:** `verifyEscalation()` enforces that the child's effective policy is the intersection of the parent's policy and any sub-agent-specific restrictions — never more permissive. This is a runtime assertion checked on every tool invocation within the sub-agent.

**Audit trail linkage:** Sub-agent security events include a `parentSessionID` field. The query interface supports `findByParentSession(id)` for investigation.

### 3.4 Security Event Types

The following typed events extend the existing `BusService`:

```typescript
// Defined in packages/opencode/src/security/event.ts
export const ScanStarted = BusEvent.define("security.scan_started", Schema.Struct({
  sessionID: SessionID, toolCallID: ToolCallID, scanners: Schema.Array(Schema.String)
}))

export const ScanCompleted = BusEvent.define("security.scan_completed", Schema.Struct({
  sessionID: SessionID, findings: Schema.Array(ScanFindingSchema), highestSeverity: Severity, duration: Schema.Number
}))

export const ActionBlocked = BusEvent.define("security.action_blocked", Schema.Struct({
  sessionID: SessionID, toolName: Schema.String, reason: Schema.String, ruleID: Schema.String, contentHash: Schema.String
}))

export const ActionApproved = BusEvent.define("security.action_approved", Schema.Struct({
  sessionID: SessionID, toolName: Schema.String, approver: Schema.String, justification: Schema.String
}))

export const PolicyViolation = BusEvent.define("security.policy_violation", Schema.Struct({
  sessionID: SessionID, policyRuleID: Schema.String, severity: Severity, explanation: Schema.String
}))

export const ConfinementEscapeRequested = BusEvent.define("security.confinement_escape_requested", Schema.Struct({
  sessionID: SessionID, path: Schema.String, operation: Schema.String, modelID: Schema.String, contentHash: Schema.String
}))

export const ConfinementEscapeApproved = BusEvent.define("security.confinement_escape_approved", Schema.Struct({...}))
export const ConfinementEscapeDenied = BusEvent.define("security.confinement_escape_denied", Schema.Struct({...}))

export const DLPSecretDetected = BusEvent.define("security.dlp_secret_detected", Schema.Struct({
  sessionID: SessionID, filePath: Schema.String, secretType: Schema.String, action: Schema.String
}))

export const DLPPIIDetected = BusEvent.define("security.dlp_pii_detected", Schema.Struct({
  sessionID: SessionID, filePath: Schema.String, piiType: Schema.String, action: Schema.String
}))

export const InjectionDetected = BusEvent.define("security.injection_detected", Schema.Struct({
  sessionID: SessionID, filePath: Schema.String, patternID: Schema.String, severity: Severity
}))

export const TrustThresholdCrossed = BusEvent.define("security.trust_threshold_crossed", Schema.Struct({
  sessionID: SessionID, score: Schema.Number, threshold: Schema.Number, action: Schema.String
}))
```

### 3.5 Configuration Schema

The `lockedcode.yaml` configuration file uses this schema (defined in `packages/opencode/src/security/policy/schema.ts`):

```typescript
export const PolicyDocument = Schema.Struct({
  security: Schema.Struct({
    strictness: Schema.Literal("strict", "standard", "permissive"),

    confinement: Schema.Struct({
      project_root: Schema.optional(Schema.String),
      pre_approved_paths: Schema.optional(Schema.Array(Schema.String)),
      enforcement: Schema.optional(Schema.Literal("kernel", "application", "detection")),
    }),

    scanning: Schema.Struct({
      semgrep: Schema.optional(Schema.Boolean),
      yara: Schema.optional(Schema.Boolean),
      entropy: Schema.optional(Schema.Boolean),
      secrets: Schema.optional(Schema.Boolean),
      custom_rule_paths: Schema.optional(Schema.Array(Schema.String)),
      severity_threshold: Schema.optional(Schema.Literal("info", "warning", "high", "critical")),
    }),

    dlp: Schema.Struct({
      enabled: Schema.optional(Schema.Boolean),
      redaction_mode: Schema.optional(Schema.Boolean),
      pii_detection: Schema.optional(Schema.Boolean),
      sensitivity_patterns: Schema.optional(Schema.Array(Schema.String)),
    }),

    injection: Schema.Struct({
      enabled: Schema.optional(Schema.Boolean),
      sensitivity: Schema.optional(Schema.Literal("low", "medium", "high")),
      custom_patterns: Schema.optional(Schema.Array(Schema.String)),
    }),

    secrets: Schema.Struct({
      enabled: Schema.optional(Schema.Boolean),
      additional_patterns: Schema.optional(Schema.Array(Schema.String)),
      allowlisted_values: Schema.optional(Schema.Array(Schema.String)),
    }),

    shell: Schema.Struct({
      additional_blocked_patterns: Schema.optional(Schema.Array(Schema.String)),
      allowed_commands: Schema.optional(Schema.Array(Schema.String)),
    }),

    trust: Schema.Struct({
      auto_approve_below: Schema.optional(Schema.Number),
      prompt_above: Schema.optional(Schema.Number),
      block_above: Schema.optional(Schema.Number),
      session_trust_decay: Schema.optional(Schema.Number),
    }),

    audit: Schema.Struct({
      enabled: Schema.optional(Schema.Boolean),
      retention_days: Schema.optional(Schema.Number),
    }),

    models: Schema.Struct({
      approved: Schema.optional(Schema.Array(Schema.String)),
      blocked: Schema.optional(Schema.Array(Schema.String)),
    }),
  }),
})
```

**Sensible defaults** (when no `lockedcode.yaml` exists):
- `strictness`: `"standard"`
- `confinement.pre_approved_paths`: `["/tmp", "~/.cache", "~/.npm", "~/.bun"]`
- `scanning.severity_threshold`: `"high"`
- `dlp.redaction_mode`: `true`
- `injection.sensitivity`: `"medium"`
- `trust.auto_approve_below`: `30`
- `trust.prompt_above`: `60`
- `trust.block_above`: `90`
- `audit.retention_days`: `90`
- All `enabled` flags default to `true`

---

## 4. Cross-Platform Confinement Details

### 4.1 Linux — Landlock LSM

**Approach:** Linux Landlock (kernel 5.13+) provides kernel-enforced filesystem confinement. The agent process creates a Landlock ruleset that restricts access to the project directory tree. No root privileges required.

**Landlock ABI versioning:**
- ABI v1 (kernel 5.13): `LANDLOCK_ACCESS_FS_EXECUTE`, `WRITE_FILE`, `READ_FILE`, `READ_DIR`, `REMOVE_DIR`, `REMOVE_FILE`, `MAKE_CHAR`, `MAKE_DIR`, `MAKE_REG`, `MAKE_SOCK`, `MAKE_FIFO`, `MAKE_BLOCK`, `MAKE_SYM`
- ABI v2 (kernel 5.19): Adds `TRUNCATE`
- ABI v3 (kernel 6.2): Adds `IOCTL`

LockedCode queries `/sys/kernel/security/lsm` for Landlock availability and uses the highest supported ABI. Falls back gracefully on older kernels.

**Capability detection flow:**
1. Check kernel version >= 5.13
2. Check `/sys/kernel/security/lsm` contains "landlock"
3. Check `/proc/sys/kernel/landlock/` for ABI version file
4. If Landlock unavailable → fall back to Bubblewrap
5. If Bubblewrap unavailable → use application-level path checks with warning

**Bubblewrap fallback:** Invokes `bwrap` as a subprocess wrapper. Creates a mount namespace where the project directory is the only writable surface. Package manager caches are mounted read-only or read-write per policy configuration.

**Restrictions:**
- Landlock restricts filesystem access only — it does not restrict network, IPC, or other resources
- Landlock rules cannot be removed once applied — the confinement is permanent for the process lifetime
- Landlock applies to the entire process tree — child processes inherit the restrictions

### 4.2 macOS — sandbox-exec

**Approach:** macOS's `sandbox-exec` creates a process-level sandbox using the Seatbelt sandbox profile language. LockedCode generates a sandbox profile that allows read-write to the project directory, read-only to system libraries and package manager caches, and denies everything else.

**Seatbelt profile example (generated):**
```
(version 1)
(deny default)
(allow file-read* file-write* (subpath "/path/to/project"))
(allow file-read* (subpath "/Library"))
(allow file-read* (subpath "/usr/lib"))
(allow file-read* (subpath "/tmp"))
(allow file-read* file-write* (subpath (param "HOME") "/.npm"))
(allow file-read* file-write* (subpath (param "HOME") "/.bun"))
(allow process-exec* (subpath "/usr/bin"))
(allow process-exec* (subpath "/bin"))
(allow network-outbound (local)))
```

**FSEvents monitor:** A background watcher using `fsevents` or `chokidar` monitors the filesystem tree outside the project root. If a write event is detected on a file outside the sandbox boundary (indicating a sandbox escape), an alert is logged in the audit trail and sent to the TUI.

**Documented limitations:**
- `sandbox-exec` is deprecated by Apple (no new features, existing functionality maintained)
- macOS sandbox is not kernel-hard like Linux Landlock — application-level sandboxing can be bypassed
- FSEvents monitoring is a detection, not prevention, backstop
- Network sandboxing via `(deny network*)` is possible but may interfere with legitimate package installs

### 4.3 Windows — Restricted Tokens

**Approach:** Windows confinement uses three mechanisms:

1. **Restricted token:** The agent process (and its children) runs with a restricted access token. The token has:
   - `SID` deny-only for all groups outside the project scope
   - Low integrity level (`SID_INTEGRITY_LOW`)
   - Privileges removed (`SeTakeOwnershipPrivilege`, `SeDebugPrivilege`, etc.)

2. **NTFS ACLs:** The project directory's ACL grants full control to the restricted token. All other directories have read-only or no access for the restricted token.

3. **Job object:** All agent processes are assigned to a Windows job object that:
   - Prevents child processes from escaping
   - Limits process priority and CPU affinity
   - Limits memory usage
   - Notifies on child process creation

**Path canonicalization challenges:**
- Short names (8.3): `C:\PROGRA~1` must be resolved to canonical form
- Junction points: directory symlinks can point outside the project tree
- UNC paths: `\\server\share` path references must be detected
- `\\?\` prefix: long path syntax bypasses MAX_PATH but must not bypass confinement
- Drive letter aliasing: `subst` and mapped drives

### 4.4 Common — Pre-Approved Paths

Default pre-approved paths (configurable via policy):

| Platform | Paths |
|----------|-------|
| Linux | `/tmp`, `~/.cache`, `~/.npm`, `~/.bun`, `~/.cargo` |
| macOS | `/tmp`, `~/.cache`, `~/.npm`, `~/.bun`, `~/Library/Caches` |
| Windows | `%TEMP%`, `%LOCALAPPDATA%\npm-cache`, `%LOCALAPPDATA%\bun` |

**Process tree inheritance:** On all platforms, child processes spawned by shell commands inherit the confinement context. This is:
- Automatic on Linux (Landlock rules apply to process tree)
- Automatic on Windows (job object contains all children)
- Sandbox profile on macOS (child processes start inside the sandbox)

---

## 5. Scanning Rule Architecture

### 5.1 Directory Structure

```
rules/
├── semgrep/                 # Semgrep rules (YAML)
│   ├── encoded-payloads/    # Base64, hex, rot13 detection
│   ├── dynamic-exec/        # eval(), exec(), subprocess patterns
│   ├── network/             # Obfuscated network calls, C2 beaconing
│   ├── crypto/              # Cryptomining detection
│   ├── exfil/               # Data exfiltration patterns
│   └── persistence/         # Startup dirs, cron, systemd writes
├── yara/                    # YARA signatures
│   ├── malware/             # Known malware patterns
│   ├── reverse-shells/      # Reverse shell detection
│   ├── credential-stealers/ # Credential harvesting patterns
│   └── webshells/           # Web shell detection
├── secrets/                 # Secret detection patterns (JSON)
│   ├── cloud-keys.json      # AWS, GCP, Azure patterns
│   ├── tokens.json          # GitHub, Slack, Discord patterns
│   ├── db-strings.json      # Database connection string patterns
│   └── private-keys.json    # Private key header patterns
└── injection/               # Prompt injection patterns (JSON)
    ├── role-override.json   # "Ignore previous instructions" patterns
    ├── system-markers.json  # System prompt delimiter patterns
    ├── unicode.json         # Unicode trick patterns
    └── encoded.json         # Encoded instruction patterns
```

### 5.2 Rule Loading and Caching

Rules are loaded at service startup from the `rules/` directory (bundled with the distribution). Each rule directory is recursive-scanned, and rules are cached in memory with their file modification timestamps for cache invalidation.

**Rule format — Semgrep:**
```yaml
rules:
  - id: lockedcode.encoded-payloads.base64-string-literal
    pattern-either:
      - pattern: |
          $X = "..." | base64_decode(...)
    message: "Base64-decoded string literal — possible encoded payload"
    severity: WARNING
    languages: [python, javascript, typescript, ruby, go, rust, java, csharp]
```

**Rule format — secrets patterns (JSON):**
```json
{
  "name": "aws-access-key",
  "pattern": "AKIA[0-9A-Z]{16}",
  "entropy_min": 4.5,
  "context_patterns": ["aws_access_key_id", "AWS_ACCESS_KEY"],
  "false_positive_patterns": ["AKIAIOSFODNN7EXAMPLE"],
  "severity": "critical"
}
```

### 5.3 Air-Gap Mode

All rules are bundled with the distribution — no network fetches on first run or any subsequent run. Rule updates are distributed as versioned packages that the developer manually installs. LockedCode verifies on startup (when air-gap mode is configured) that no outbound network calls are configured.

---

## 6. Data Model Additions

### 6.1 SQLite Schema

Three new tables extend the existing OpenCode SQLite schema:

```typescript
// packages/opencode/src/security/audit/schema.sql.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const SecurityEventTable = sqliteTable("security_event", {
  id: text().primaryKey(),
  session_id: text().notNull(),
  message_id: text(),
  tool_call_id: text(),
  model_id: text(),
  event_type: text().notNull(),       // "scan.completed", "action.blocked", etc.
  severity: text().notNull(),          // "info", "warning", "high", "critical"
  action_taken: text().notNull(),      // "allowed", "blocked", "overridden", "redacted"
  content_hash: text(),                // SHA-256 of relevant content
  parent_session_id: text(),           // for sub-agent event linkage
  details: text({ mode: "json" }),     // event-specific structured data
  time_created: integer().notNull(),
}, (table) => [
  index("sec_evt_session_idx").on(table.session_id),
  index("sec_evt_type_idx").on(table.event_type),
  index("sec_evt_severity_idx").on(table.severity),
  index("sec_evt_time_idx").on(table.time_created),
  index("sec_evt_parent_idx").on(table.parent_session_id),
])

export const ScanResultTable = sqliteTable("scan_result", {
  id: text().primaryKey(),
  security_event_id: text()
    .notNull()
    .references(() => SecurityEventTable.id, { onDelete: "cascade" }),
  scanner_name: text().notNull(),      // "semgrep", "yara", "entropy", "secrets", "injection"
  rule_id: text().notNull(),
  severity: text().notNull(),
  matched_content_hash: text(),
  file_path: text(),
  line_start: integer(),
  line_end: integer(),
  remediation: text(),
  time_created: integer().notNull(),
}, (table) => [
  index("scan_res_event_idx").on(table.security_event_id),
  index("scan_res_scanner_idx").on(table.scanner_name),
])

export const PolicyDecisionTable = sqliteTable("policy_decision", {
  id: text().primaryKey(),
  security_event_id: text()
    .notNull()
    .references(() => SecurityEventTable.id, { onDelete: "cascade" }),
  policy_rule_id: text().notNull(),
  evaluation_result: text().notNull(),  // "allow", "deny", "ask"
  override_by: text(),                  // "user", "policy", or null
  override_reason: text(),
  strictness_level: text().notNull(),
  time_created: integer().notNull(),
}, (table) => [
  index("pol_dec_event_idx").on(table.security_event_id),
])
```

### 6.2 Relationships to Existing Tables

```
SecurityEventTable.session_id → SessionTable.id
SecurityEventTable.parent_session_id → SessionTable.id (for sub-agent linkage)
ScanResultTable.security_event_id → SecurityEventTable.id (cascade delete)
PolicyDecisionTable.security_event_id → SecurityEventTable.id (cascade delete)
```

### 6.3 Indexing Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| security_event | session_id | Find all events for a session |
| security_event | event_type | Filter by event type |
| security_event | severity | Find high-severity events |
| security_event | time_created | Time-range queries |
| security_event | parent_session_id | Sub-agent audit trail linkage |
| scan_result | security_event_id | Find scan results for an event |
| scan_result | scanner_name | Filter by scanner |
| policy_decision | security_event_id | Find policy decisions for an event |

---

## 7. Upstream Merge Strategy

### 7.1 Minimal Modifications to Inherited Code

LockedCode's security layer is designed to minimize modifications to inherited OpenCode code. The principle is **hooks, not rewrites**.

**Files that require modification:**

| File | Modification | Nature |
|------|-------------|--------|
| `packages/opencode/src/tool/registry.ts` | Wrap tool execute with SecurityService call | Add ~30 lines in tool resolution loop |
| `packages/opencode/src/tool/shell.ts` | Insert SecurityService calls after parsing | Add ~20 lines in execute function |
| `packages/opencode/src/session/prompt.ts` | Insert DLP scanning before context assembly | Add ~15 lines in context building |
| `packages/opencode/src/config/config.ts` | Add `security` key to Info schema | Add one Schema field (~5 lines) |
| `packages/opencode/src/effect/bootstrap-runtime.ts` | Add SecurityService layer to runtime | Add one layer composition (~3 lines) |

**Total modification surface:** approximately 5 files, 70–80 lines added. All modifications are additive — they don't remove, restructure, or alter existing functionality.

### 7.2 Clean Separation

All new LockedCode code lives in `packages/opencode/src/security/`. The inherited module directories (`tool/`, `session/`, `config/`, `agent/`) remain structurally unchanged. Modifications to inherited files are:

1. **Tool execution hook:** In `registry.ts`, after tools are resolved, iterate over them and wrap each `execute` function with a security interceptor. The wrapping pattern mirrors the existing `Tool.wrap()` decorator.

2. **Shell interception hook:** In `shell.ts`, after tree-sitter parsing and path extraction, insert SecurityService calls. The call pattern is: `yield* SecurityService.evaluatePolicy(...)` and `yield* SecurityService.confine(...)`.

3. **Context interception hook:** In `prompt.ts`, before file contents are added to the LLM prompt context, insert `yield* SecurityService.scan({ content, action: "dlp" })`.

### 7.3 Version Tracking

The fork is based on `anomalyco/opencode` commit `dcdbdb218fafc4ce2d0495f90bf022a08fc51d80`. Upstream updates are evaluated for merging on a case-by-case basis. The merge conflict surface is low due to the additive nature of LockedCode's modifications.

---

## 8. Non-Goals and Boundaries

LockedCode explicitly does NOT cover:

1. **Replacing the LLM.** LockedCode doesn't generate code, suggest fixes, or provide AI coding assistance. It secures the agent that does.

2. **Providing a hosted SaaS platform.** LockedCode runs locally. No security-relevant data passes through any LockedCode-operated cloud service.

3. **Guaranteeing 100% malware detection.** Defense-in-depth significantly raises the bar, but no security tool catches everything. LockedCode is transparent about capabilities and limitations.

4. **Replacing enterprise security tooling.** LockedCode complements existing SIEM, SAST, and vulnerability management tools. It doesn't replace them.

5. **Enforcing code quality, style, or correctness.** LockedCode is a security tool, not a linter. It doesn't evaluate code quality.

6. **Sandboxing the entire development environment.** LockedCode confines the agent's actions within the project directory. It doesn't sandbox the IDE, terminal, or other developer tools.

7. **Providing identity or access management.** LockedCode doesn't manage user accounts, roles, or permissions. That's the organization's IAM system.

8. **Runtime monitoring (V2).** eBPF-based syscall monitoring, process tree analysis, and network activity detection are deferred to V2.

9. **Model provenance tracking (V2).** Per-file, per-line attribution of which model generated the code is deferred.

10. **Dependency vetting (V2).** Typosquatting detection, vulnerability checking, and package registry enforcement are deferred.
