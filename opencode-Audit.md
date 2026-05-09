
### 2. Directory Structure

**2101 source/config files** across the monorepo. Key layout:

```
opencode/                          # Monorepo root
├── packages/                      # Workspace packages
│   ├── opencode/                  # Core AI agent (TUI/CLI)
│   │   └── src/                   # 43 subdirectories: cli, agent, session,
│   │                              #   provider, tool, server, effect, config,
│   │                              #   project, mcp, lsp, storage, bus,
│   │                              #   sync, share, v2, acp, control-plane,
│   │                              #   shell, git, skill, patch, install, etc.
│   ├── ui/                        # Shared SolidJS component library
│   ├── app/                       # Web application (SolidJS + Vite)
│   ├── web/                       # Marketing website (Astro)
│   ├── storybook/                 # UI component storybook
│   ├── desktop/                   # Electron desktop app
│   ├── console/                   # Cloud console (Cloudflare Workers)
│   │   ├── app/                   #   Console web app (SolidJS SSR)
│   │   ├── core/                  #   Console backend (Drizzle, services)
│   │   ├── function/              #   Cloud functions
│   │   └── resource/              #   Infrastructure resources
│   ├── sdk/js/                    # JavaScript SDK
│   ├── plugin/                    # Plugin system
│   ├── core/                      # Shared core library
│   ├── docs/                      # Documentation (Mintlify)
│   ├── slack/                     # Slack integration
│   ├── enterprise/                # Enterprise features
│   ├── llm/                       # LLM utility package
│   ├── extensions/                # Editor extensions (Zed)
│   ├── function/                  # Cloud functions package
│   ├── http-recorder/             # HTTP recording/replay
│   ├── containers/                # Docker container definitions
│   ├── identity/                  # Brand assets
│   ├── script/                    # Scripting utilities
│   └── ext/                       # (additional)
├── sdks/
│   └── vscode/                    # VS Code extension
├── github/                        # GitHub Action (@opencode-ai/github-action)
├── infra/                         # SST Ion infrastructure (Cloudflare, Stripe)
├── nix/                           # Nix packaging
├── script/                        # Build/release scripts
├── specs/                         # Design specs & migration plans
├── patches/                       # Patched dependencies
├── .github/                       # CI/CD (27 workflows)
├── .opencode/                     # Agent config, skills, commands
└── .husky/                        # Git hooks
```

Monorepo with ~20 workspace packages. Main source in `packages/opencode/src/` (~500+ TS files). Web app in `packages/app/src/`. Console split across `packages/console/app/` (SolidJS SSR frontend), `packages/console/core/` (backend logic), and `packages/console/function/` (cloud functions).

### 3. Build & Dependency Manifest

**Build System:** Turborepo 2.8.13 (monorepo orchestration), Bun 1.3.13 (package manager + runtime)

**Root `package.json`** (`/package.json`):
- Bundled dependencies: catalog (`workspaces.catalog`) for shared version pinning
- Key devDeps: `oxlint` 1.60.0 (linting), `prettier` 3.6.2 (formatting), `husky` 9.1.7 (hooks), `turbo` 2.8.13, `sst` 3.18.10 (infra)

**Core package `packages/opencode/package.json`** (v1.14.44):

| Category | Key Dependencies |
|---|---|
| **LLM/Provider SDKs** | `ai` 6.0.168 (Vercel AI SDK), 18+ provider SDKs (@ai-sdk/openai, anthropic, google, azure, amazon-bedrock, mistral, groq, perplexity, cohere, togetherai, cerebras, deepinfra, xai, alibaba, gateway, google-vertex, vercel, openai-compatible) + @openrouter/ai-sdk-provider, gitlab-ai-provider, venice-ai-sdk-provider, ai-gateway-provider |
| **Effect System** | `effect` 4.0.0-beta.59, `@effect/platform-node` beta.57, `@effect/opentelemetry` beta.57 |
| **Database** | `drizzle-orm` 1.0.0-beta.19, `drizzle-kit` 1.0.0-beta.19 (SQLite) |
| **TUI** | `solid-js` 1.9.10, `@opentui/core` 0.2.6, `@opentui/solid` 0.2.6, `@opentui/keymap` 0.2.6, `opentui-spinner` 0.0.6 |
| **HTTP** | `hono` 4.10.7, `@hono/zod-validator` 0.4.2 |
| **Validation** | `zod` 4.1.8, `@standard-schema/spec` 1.0.0 |
| **MCP** | `@modelcontextprotocol/sdk` 1.27.1, `@agentclientprotocol/sdk` 0.21.0 |
| **Code Parsing** | `tree-sitter-bash` 0.25.0, `tree-sitter-powershell` 0.25.10, `web-tree-sitter` 0.25.10 |
| **Auth** | `@openauthjs/openauth` (pre-release), `opencode-gitlab-auth`, `opencode-poe-auth` |
| **Observability** | `@opentelemetry/api`, sdk-trace-base/node, exporter-trace-otlp-http |
| **Terminal** | `@lydell/node-pty`, `bun-pty`, `@parcel/watcher`, `chokidar` |
| **Git/CI** | `@actions/core`, `@actions/github`, `@octokit/rest`, `@octokit/graphql` |

**Build commands:**
```
Build:   bun run script/build.ts (from packages/opencode)
Test:    bun test --timeout 30000 (from packages/opencode)
Run:     bun run --conditions=browser src/index.ts (from packages/opencode)
Dev:     bun run --cwd packages/opencode --conditions=browser src/index.ts (from root)
Lint:    oxlint (from root)
Typecheck: bun turbo typecheck (from root)
Package: Turborepo cached outputs to dist/**
```

### 4. Configuration & Infrastructure Summary

**Configuration files:**

| File | Path | Key facts |
|---|---|---|
| `sst.config.ts` | `/sst.config.ts` | SST ION v3, Cloudflare home, providers: Stripe, PlanetScale, Honeycomb, Random. Stages: production (retain+protect), dev (remove). |
| `bunfig.toml` | `/bunfig.toml` | Exact installs enabled, root test blocked. |
| `tsconfig.json` | `/tsconfig.json` | Extends `@tsconfig/bun`. |
| `drizzle.config.ts` | `/packages/opencode/drizzle.config.ts` | Schema: `./src/**/*.sql.ts`, output: `./migration`. |
| `drizzle.config.ts` | `/packages/console/core/drizzle.config.ts` | Console DB schema config. |
| `turbo.json` | `/turbo.json` | Cached pipelines for typecheck, build, test:ci. Global env passthrough: CI, OPENCODE_DISABLE_SHARE. |

**Infrastructure (SST/Cloudflare):**
- `infra/app.ts` — API Worker (Cloudflare), docs site (Astro), web app (SolidJS static)
- `infra/console.ts` — PlanetScale MySQL database, Auth Worker, Console (SolidStart SSR), Stripe billing/products/coupons, S3-compatible bucket, SES email, Honeycomb observability, LogProcessor worker
- `infra/enterprise.ts`, `infra/monitoring.ts`, `infra/secret.ts`, `infra/stage.ts`

**Connection map:**
```
Database: SQLite (local, in-process) + PlanetScale MySQL (cloud console, port 3306)
Cache: None (in-memory only)
Message Broker: None
External APIs: GitHub (Octokit), Stripe (payments), AWS SES (email), Honeycomb (observability), Salesforce (CRM)
Cloud Services: Cloudflare Workers/Pages/KV/R2/Buckets, AWS S3, AWS SES
```

**CI/CD:** 27 GitHub Actions workflows in `.github/workflows/` — test, typecheck, publish, deploy, containers, nix, community management, docs sync, Discord notification.

**Docker:** 6 Dockerfiles (`packages/containers/base, bun-node, publish, rust, tauri-linux`; `packages/opencode/Dockerfile`).

**Secrets:** Managed via SST Secrets (`sst.Secret`), not committed. `.env.example` in `packages/slack/`.

### 5. Startup & Runtime Behavior

**Entry point:** `packages/opencode/src/index.ts`

**Startup sequence:**
1. Process metadata initialized (`ensureProcessMetadata`)
2. Unhandled rejection/exception handlers registered
3. Yargs CLI parses subcommand (run, serve, generate, account, providers, agent, upgrade, uninstall, models, debug, stats, mcp, github, export, import, attach, web, pr, session, db, plugin, acp)
4. Middleware: initializes logging (file + stderr), starts Heap analytics, sets env vars (AGENT=1, OPENCODE=1, OPENCODE_PID)
5. On first run: runs JSON migration (one-time DB schema migration for SQLite), reports progress to stderr
6. Subcommand executes

**CLI commands available:**
- `run` — Main agent mode (TUI or headless)
- `serve` — HTTP API server mode
- `generate` — Shell completion generation
- `account` — Cloud account management
- `providers` — LLM provider configuration
- `agent` — Agent configuration
- `upgrade` / `uninstall` — Self-update/removal
- `models` — Model listing
- `debug`, `stats`, `mcp`, `github`, `pr`, `session`, `export`, `import`, `attach`, `web`, `db`, `plugin`, `acp`

**Scheduled/background tasks:** None explicit. Agent mode forks persistent effects via `Effect.forkDetach`. Server mode runs Hono HTTP server.

**Health check:** In server mode (`serve`), the Hono-based HTTP API exposes endpoints. No dedicated `/health` endpoint identified in source.

### 6. Data Model / Entity Layer

Two database systems: **SQLite** (local agent, Drizzle ORM with bun-sqlite) and **MySQL** on PlanetScale (cloud console, Drizzle ORM with mysql-core).

---

#### Local SQLite Models (packages/opencode/)

```
=== SessionTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: session
PK: id (text, SessionID)
Fields:
  - id: text (SessionID) [PK]
  - project_id: text (ProjectID) [NOT NULL, FK → ProjectTable.id, onDelete cascade]
  - workspace_id: text (WorkspaceID) [nullable]
  - parent_id: text (SessionID) [nullable]
  - slug: text [NOT NULL]
  - directory: text [NOT NULL]
  - path: text [nullable]
  - title: text [NOT NULL]
  - version: text [NOT NULL]
  - share_url: text [nullable]
  - summary_additions: integer [nullable]
  - summary_deletions: integer [nullable]
  - summary_files: integer [nullable]
  - summary_diffs: json (Snapshot.FileDiff[]) [nullable]
  - revert: json [{messageID, partID?, snapshot?, diff?}] [nullable]
  - permission: json (Permission.Ruleset) [nullable]
  - agent: text [nullable]
  - model: json [{id, providerID, variant?}] [nullable]
  - time_created: integer [NOT NULL, auto]
  - time_updated: integer [NOT NULL, auto]
  - time_compacting: integer [nullable]
  - time_archived: integer [nullable]
Indexes: session_project_idx, session_workspace_idx, session_parent_idx

=== MessageTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: message
PK: id (text, MessageID)
Fields:
  - id: text [PK]
  - session_id: text [NOT NULL, FK → SessionTable.id, onDelete cascade]
  - time_created: integer [NOT NULL, auto]
  - time_updated: integer [NOT NULL, auto]
  - data: json (MessageV2.Info) [NOT NULL]
Index: message_session_time_created_id_idx (session_id, time_created, id)

=== PartTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: part
PK: id (text, PartID)
Fields:
  - id: text [PK]
  - message_id: text [NOT NULL, FK → MessageTable.id, onDelete cascade]
  - session_id: text [NOT NULL]
  - time_created: integer [NOT NULL, auto]
  - time_updated: integer [NOT NULL, auto]
  - data: json (MessageV2.Part) [NOT NULL]
Indexes: part_message_id_id_idx, part_session_idx

=== TodoTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: todo
PK: (session_id, position) [composite]
Fields:
  - session_id: text [NOT NULL, FK → SessionTable.id, onDelete cascade]
  - content: text [NOT NULL]
  - status: text [NOT NULL]
  - priority: text [NOT NULL]
  - position: integer [NOT NULL]
  - time_created/updated: integer [auto]

=== SessionMessageTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: session_message
PK: id (text, SessionMessage.ID)
Fields:
  - id: text [PK]
  - session_id: text [NOT NULL, FK → SessionTable.id, onDelete cascade]
  - type: text [NOT NULL]
  - time_created/updated: integer [auto]
  - data: json [NOT NULL]
Indexes: session_message_session_idx, session_message_session_type_idx, session_message_time_created_idx

=== ProjectTable (file: packages/opencode/src/project/project.sql.ts) ===
Table: project
PK: id (text, ProjectID)
Fields:
  - id: text [PK]
  - worktree: text [NOT NULL]
  - vcs: text [nullable]
  - name: text [nullable]
  - icon_url: text [nullable]
  - icon_url_override: text [nullable]
  - icon_color: text [nullable]
  - time_created/updated: integer [auto]
  - time_initialized: integer [nullable]
  - sandboxes: json (string[]) [NOT NULL]
  - commands: json [{start?: string}] [nullable]

=== AccountTable (file: packages/opencode/src/account/account.sql.ts) ===
Table: account
PK: id (text, AccountID)
Fields:
  - id: text [PK]
  - email: text [NOT NULL]
  - url: text [NOT NULL]
  - access_token: text [NOT NULL]
  - refresh_token: text [NOT NULL]
  - token_expiry: integer [nullable]
  - time_created/updated: integer [auto]

=== AccountStateTable (file: packages/opencode/src/account/account.sql.ts) ===
Table: account_state
PK: id (integer, auto)
Fields:
  - id: integer [PK, auto]
  - active_account_id: text [FK → AccountTable.id, onDelete set null]
  - active_org_id: text [nullable]

=== WorkspaceTable (file: packages/opencode/src/control-plane/workspace.sql.ts) ===
Table: workspace
PK: id (text, WorkspaceID)
Fields:
  - id: text [PK]
  - type: text [NOT NULL]
  - name: text [NOT NULL, default ""]
  - branch: text [nullable]
  - directory: text [nullable]
  - extra: json [nullable]
  - project_id: text [NOT NULL, FK → ProjectTable.id, onDelete cascade]
  - time_used: integer [NOT NULL, auto]

=== EventSequenceTable / EventTable (file: packages/opencode/src/sync/event.sql.ts) ===
Table: event_sequence — aggregate_id (PK), seq (NOT NULL), owner_id
Table: event — id (PK), aggregate_id (FK → event_sequence, onDelete cascade), seq (NOT NULL), type (NOT NULL), data (json)

=== SessionShareTable (file: packages/opencode/src/share/share.sql.ts) ===
Table: session_share — session_id (PK, FK → SessionTable.id, onDelete cascade), id, secret, url, timestamps
```

```
=== PermissionTable (file: packages/opencode/src/session/session.sql.ts) ===
Table: permission
PK: project_id (text, FK → ProjectTable.id, onDelete cascade)
Fields: project_id, time_created/updated, data (json — Permission.Ruleset)
```

---

#### Cloud Console MySQL Models (packages/console/core/)

```
=== AccountTable (file: packages/console/core/src/schema/account.sql.ts) ===
Table: account — id (ulid PK), timestamps

=== AuthTable (file: packages/console/core/src/schema/auth.sql.ts) ===
Table: auth — id (ulid PK), timestamps, provider (enum: email/github/google), subject (varchar), account_id (ulid FK)
Indexes: unique(provider, subject), index(account_id)

=== WorkspaceTable (file: packages/console/core/src/schema/workspace.sql.ts) ===
Table: workspace — id (ulid PK), slug (varchar, unique), name (varchar), timestamps

=== UserTable (file: packages/console/core/src/schema/user.sql.ts) ===
Table: user — workspaceColumns (workspace_id, id), timestamps, account_id (ulid), email (varchar), name (varchar), time_seen, color (int), role (enum: admin/member), monthly_limit/capped fields
Indexes: unique(workspace_id, account_id), unique(workspace_id, email), global indexes on account_id/email

=== BillingTable (file: packages/console/core/src/schema/billing.sql.ts) ===
Table: billing — workspaceColumns, customer/subscription/payment fields, balance, monthly limit/usage, reload config, subscription json (seats/plan/coupon), lite json
Indexes: unique(customer_id), unique(subscription_id)

=== SubscriptionTable / LiteTable / PaymentTable / UsageTable (billing.sql.ts) ===
Usage tracking per model/provider with token counts, costs, key/session enrichment

=== KeyTable (file: packages/console/core/src/schema/key.sql.ts) ===
Table: key — workspaceColumns, name, key (varchar, unique global), user_id, time_used

=== ModelTable (file: packages/console/core/src/schema/model.sql.ts) ===
Table: model — workspaceColumns, model (varchar), unique(workspace_id, model)

=== ProviderTable (file: packages/console/core/src/schema/provider.sql.ts) ===
Table: provider — workspaceColumns, provider (varchar), credentials (text encrypted), unique(workspace_id, provider)

=== IpTable / IpRateLimitTable / KeyRateLimitTable / ModelTpmRateLimitTable (ip.sql.ts) ===
Rate limiting tables with PK on (ip) or (ip, interval) or (key, interval)

=== BenchmarkTable (file: packages/console/core/src/schema/benchmark.sql.ts) ===
Table: benchmark — id, timestamps, model, agent, result (mediumtext), index(time_created)

=== CouponTable (file: packages/console/core/src/schema/billing.sql.ts) ===
Table: coupon — email, type (enum: 5 coupon types), time_redeemed. PK: (email, type)
```

**Audit timestamps:** All models include `time_created` and `time_updated` via `Timestamps` mixin (SQLite) or `timestamps` helper (MySQL). SQLite uses integer epoch ms; MySQL uses `utc` type.

**Cascade deletes:** Nearly all child tables use `onDelete: "cascade"` — Session, Message, Part, Todo, Event, Share all cascade. `AccountState` uses `onDelete: "set null"`.

**No soft delete pattern detected** in any model.

### 7. Enum / Constant Inventory

```
=== UserRole (file: packages/console/core/src/schema/user.sql.ts) ===
Values: "admin", "member"
Used in: UserTable.role

=== AuthProvider (file: packages/console/core/src/schema/auth.sql.ts) ===
Values: "email", "github", "google"
Used in: AuthTable.provider

=== BlackPlans (file: packages/console/core/src/schema/billing.sql.ts) ===
Values: "20", "100", "200"
Used in: BillingTable.subscriptionPlan, SubscriptionTable

=== CouponType (file: packages/console/core/src/schema/billing.sql.ts) ===
Values: "BUILDATHON", "GOFREEMONTH", "GO3MONTHS100", "GO6MONTHS100", "GO12MONTHS100"
Used in: CouponTable.type

=== Log.Level (file: packages/core) ===
Values: DEBUG, INFO, WARN, ERROR
Used in: CLI startup, logging initialization

=== Permission types (file: packages/opencode/src/permission/index.ts) ===
Permission.Ruleset — authorization rules stored as json in SessionTable.permission and PermissionTable

=== SessionMessage.Type (file: packages/opencode/src/session/session.sql.ts) ===
Referenced as SessionMessage.Type — discriminator for session_message.type field
```

Additional enum-like configs: LLM provider names (18+ providers in `@ai-sdk/*` packages), model IDs defined in provider config modules.

### 8. Data Access / Repository Layer

**Pattern:** No separate repository/DAO layer. Data access is inline in service code using Drizzle ORM queries. The database client and schema are accessed directly from service modules.

**Key data-access files:**

| File | Purpose |
|---|---|
| `packages/opencode/src/storage/db.ts` | Database client initialization, exports `Database.Client()` |
| `packages/opencode/src/storage/db.bun.ts` | Bun-specific SQLite database client |
| `packages/opencode/src/storage/db.node.ts` | Node-specific SQLite database client |
| `packages/opencode/src/storage/schema.ts` | Exports and re-exports all table definitions |
| `packages/opencode/src/storage/schema.sql.ts` | Shared `Timestamps` mixin |
| `packages/opencode/src/storage/json-migration.ts` | JSON-based migration runner for legacy data |
| `packages/opencode/drizzle.config.ts` | Drizzle Kit config (schema: `./src/**/*.sql.ts`, output: `./migration`) |

**Query patterns:** Effect services use `drizzle()` client directly — e.g., `yield* db.select().from(SessionTable).where(eq(...))`. No repository abstractions, no custom query methods beyond the ORM.

**Console cloud DB:** `packages/console/core/` uses Drizzle MySQL client with similar inline query patterns.

### 9. Service / Business Logic Layer — Full Method Signatures

The codebase uses **Effect-ts v4** `Service` pattern (`Context.Tag` + `Layer`) extensively. Key service modules in `packages/opencode/src/`:

```
=== SessionService (scattered across src/session/) ===
Session lifecycle: create, load, fork, archive, revert, compact
Message CRUD: add message, add part, get messages, get parts
Prompt building: build prompts from session history (src/session/prompt.ts)
Status tracking: todo items, session state transitions
LLM processing: retry logic, overflow handling, stream processing

=== AgentService (src/agent/) ===
Agent orchestration: plan building, tool selection, response generation
Prompt templates: system prompts, tool definitions

=== ToolService (src/tool/) ===
45+ tool implementations: read, write, edit, grep, glob, shell, apply_patch, codesearch, lsp, question, task, skill, webfetch, websearch, repo_clone, todo, truncate, registry
Each tool has: name, description, parameters (Zod schema), execute function

=== ProviderService (src/provider/) ===
LLM provider abstraction: auth, model listing, chat completion, streaming
SDK adapters for 18+ providers (OpenAI, Anthropic, Google, etc.)
Copilot provider: custom SDK implementing OpenAI-compatible protocol

=== ServerService (src/server/) ===
HTTP API server (Hono): routes, auth, CORS, mDNS, event system
REST endpoints for remote agent control

=== ConfigService (src/config/) ===
22 config modules: agent, commands, formatters, layouts, LSP, MCP, model IDs, permissions, plugins, providers, references, skills, variables, etc.
Configuration loading from XDG paths, JSON/TOML format

=== MCPService (src/mcp/) ===
Model Context Protocol: MCP server/client management, auth, OAuth

=== LSPService (src/lsp/) ===
Language Server Protocol: client management, diagnostics, language detection

=== ProjectService (src/project/) ===
Project/instance lifecycle: bootstrap, VCS, workspace management, sandboxes

=== SyncService (src/sync/) ===
Event-based sync engine: event tracking, schema management

=== ControlPlaneService (src/control-plane/) ===
Cloud control plane: account linking, workspace sync, provider sync

=== BusService (src/bus/) ===
Typed event bus: global events, pub/sub for cross-module communication

=== StorageService (src/storage/) ===
Database client, schema definitions, migration runner
```

**Key pattern:** Services extend `Context.Tag` and are composed via `Layer` using `Effect.gen`. Dependencies injected via `yield*` syntax. No traditional class-based services with constructor injection.

### 10. Controller / Handler / Route Layer — Method Signatures Only

**CLI Controllers (yargs commands):**

All command handlers live in `packages/opencode/src/cli/cmd/`. Each exports a yargs `CommandModule`:

```
=== RunCommand (src/cli/cmd/run.ts) ===
Entry: opencode run [--model] [--provider] [--directory] [--tui] [--headless]
Starts: Agent session (TUI or headless)

=== ServeCommand (src/cli/cmd/serve.ts) ===
Entry: opencode serve [--port] [--host]
Starts: Hono HTTP API server

=== McpCommand (src/cli/cmd/mcp.ts) ===
MCP server management: opencode mcp [setup|list|...]

=== Other commands ===
account, providers, agent, upgrade, uninstall, models, debug, stats, github, pr, session, export, import, attach, web, db, plugin, generate, acp
```

**HTTP API Server (Hono):**

```
=== Server (src/server/) ===
Base path: /api/v1/
Dependencies: SessionService, ProjectService, ToolService, AuthService
Endpoints: CRUD for sessions, messages, tool execution, project management, streaming
```

**Cloud Console (SolidStart SSR + Hono functions in packages/console/):**

```
=== Console Routes (packages/console/app/src/routes/) ===
/auth/* → OAuth callback, login, logout, status
/api/enterprise → Enterprise API
/stripe/webhook → Stripe webhook
/honeycomb/webhook → Honeycomb webhook
/workspace/[id]/* → Workspace management UI (billing, members, keys, models, providers)
/bench/* → Benchmark submissions
/docs/* → Documentation pages
/download/* → Platform downloads
```

Error handling and request validation use Hono + Zod (`@hono/zod-validator`). Session auth via `@openauthjs/openauth`.

### 11. Security Configuration

```
Authentication: Basic Auth (server mode) + OAuth2 (cloud console via @openauthjs/openauth)
Token issuer/validator: Local server — env var credentials (OPENCODE_SERVER_PASSWORD/USERNAME)
  Cloud console — GitHub OAuth, Google OAuth, email-based auth
Password hashing: N/A — server uses Basic auth with plaintext comparison via Redacted
  Cloud console handled by external OAuth providers

Public endpoints (no auth required):
  - / (CORS preflight / health)
  - WebSocket connections (upgrade)
  - Static assets (web app, docs)

Protected endpoints:
  - /api/* → Basic auth (server password) or bearer token (console API keys)

CORS: Configurable via CorsConfig reference. Default allows:
  - http://localhost:* (any port)
  - http://127.0.0.1:*
  - oc://renderer
  - tauri://localhost, http://tauri.localhost, https://tauri.localhost
  - *.opencode.ai
  - + any custom origins from config

CSRF: Not configured

Rate limiting: Present in cloud console (IpRateLimitTable, KeyRateLimitTable, ModelTpmRateLimitTable — MySQL),
  not present in local agent
```

### 12. Custom Security Components

```
=== ServerAuth (file: packages/opencode/src/server/auth.ts) ===
Type: Config service + utility functions
Purpose: Basic auth for HTTP API server mode
Extracts credentials from: Authorization header (Basic auth)
Validates via: OPENCODE_SERVER_PASSWORD env var, compared via Redacted
Sets user context: No — credentials validated per-request, no session

=== Authorization Middleware (file: packages/opencode/src/server/routes/instance/httpapi/middleware/authorization.ts) ===
Type: Hono middleware
Purpose: Validates requests against server auth config before route processing

=== Auth Service (file: packages/opencode/src/auth/index.ts) ===
Type: Effect Service (Context.Tag + Layer)
Purpose: Manage provider auth credentials (OAuth tokens, API keys, well-known tokens)
Storage: JSON file at XDG data path (auth.json), permissions 0o600
Auth types: Oauth (refresh/access tokens + expiry), Api (API key + metadata), WellKnown (key + token)
Can load from: OPENCODE_AUTH_CONTENT env var (overrides file)

=== Cloud Console Auth (packages/console/) ===
OAuth via @openauthjs/openauth with GitHub and Google providers
Session cookies handled by SolidStart framework
Auth routes: /auth/login, /auth/callback, /auth/logout, /auth/status
```

### 13. Exception / Error Handling

```
=== Error Middleware (file: packages/opencode/src/server/routes/instance/httpapi/middleware/error.ts) ===
Mechanism: Effect HttpRouter middleware — catches all Effect defects, prevents empty 500s
Error Mappings:
  - NotFoundError → 404 (NamedError → toObject)
  - Provider.ModelNotFoundError → 400
  - ProviderAuthValidationFailed → 400
  - Worktree* errors → 400
  - Session.BusyError → 400
  - Unhandled defects → 500 (includes stack trace in body)
  - HttpServerResponse/HttpServerError/HttpServerRespondable → passthrough (already handled)

Standard error response format (NamedError):
  { "name": "...", "data": { "message": "..." } }

=== Api Errors (file: packages/opencode/src/server/routes/instance/httpapi/errors.ts) ===
ApiNotFoundError: { name: "NotFoundError", data: { message } } → HTTP 404
Uses Schema.ErrorClass from Effect (Schema-based error types with httpApiStatus)

=== CLI Error Handling (file: packages/opencode/src/index.ts) ===
Mechanism: try/catch around yargs.parse()
NamedError → logged + formatted via FormatError for user display
Unhandled → generic message with log file path
Always exits via process.exit() to prevent hanging subprocesses

=== Domain Errors ===
AuthError: Schema.TaggedErrorClass (message + optional defect cause)
NotFoundError: NamedError from storage layer
Session.BusyError: Error for concurrent session access
Provider.ModelNotFoundError: Missing model error
Additional Effect Schema.TaggedErrorClass errors throughout service modules
```

### 14. Mappers / Data Transformation

No dedicated mapper layer. The codebase uses direct serialization:

- **Drizzle ORM** maps between SQL rows and TypeScript types via `$type<T>()` generic type assertions
- **JSON columns** (`text({ mode: "json" })`) handle complex nested data (PartData, InfoData, Snapshot diffs, Permission rulesets)
- **Effect Schema** (`Schema.Class`, `Schema.TaggedErrorClass`) handles typed encoding/decoding for auth data, v2 message schemas, and API error types
- **Zod 4** validates configuration parsing, tool parameters, and request bodies
- No AutoMapper, class-transformer, or similar mapping framework
- No separate DTO layer — API responses are often direct Effect Schema types

### 15. Utility Modules & Shared Components

```
=== @opencode-ai/core (packages/core/src/) ===
Shared utilities:
  - Log: Structured logging framework
  - Flag: Feature flags / env-var-driven configuration
  - Global: XDG path management, global state
  - Filesystem: AppFileSystem (Effect service for file I/O)
  - Schema: Common schema types (NonNegativeInt, etc.)
  - EffectZod: Zod ↔ Effect Schema bridge
  - Process: Process metadata, role tracking

=== local utilities (packages/opencode/src/util/) ===
- effect-http-client.ts: Effect-based HTTP client wrapper
- token.ts: Token counting for LLM context management
- filesystem.ts: Filesystem helper (exists, etc.)
- archive.ts: File archiving
- error.ts: errorMessage helper
- color.ts: Terminal color utilities
- format.ts: Text formatting
- queue.ts: Async queue
- defer.ts, lock.ts, abort.ts, signal.ts, timeout.ts: Concurrency primitives
- lazy.ts: Lazy initialization
- scrap.ts: Scraping utilities
- repository.ts: Repository path resolution
- network.ts: Network detection
- locale.ts: Locale detection
```

### 16. Database Schema (Live)

Database not available for live schema check (local SQLite DB only created on agent run; cloud PlanetScale MySQL requires SST infrastructure).

Schema definitions are documented in Section 6 (Data Model). All migrations are managed via Drizzle Kit.

### 17. Message Broker Configuration

No message broker detected.

### 18. Cache Layer

No caching layer detected (no Redis, Memcached, or similar). In-memory caches used via Effect's `Effect.cached` for deduplication, and `ScopedCache` in InstanceState — both in-process only.

### 19. Environment Variable Inventory

```
Variable | Used In | Default | Required in Prod
---------|---------|---------|------------------
OPENCODE_SERVER_PASSWORD | ServerAuth config | (none) | NO (optional, enables auth)
OPENCODE_SERVER_USERNAME | ServerAuth config | "opencode" | NO
OPENCODE_AUTH_CONTENT | Auth service | (none) | NO (override for auth.json)
OPENCODE_PURE | CLI middleware | (none) | NO (disables plugins)
OPENCODE_DISABLE_SHARE | Config/sync | (none) | NO
AGENT | CLI startup | (none) | YES (set automatically)
OPENCODE | CLI startup | (none) | YES (set automatically)
OPENCODE_PID | CLI startup | (none) | YES (set automatically)
STRIPE_SECRET_KEY | SST config | (none) | YES (console)
STRIPE_PUBLISHABLE_KEY | SST config | (none) | YES (console)
GITHUB_CLIENT_ID_CONSOLE | SST config | (none) | YES (console auth)
GITHUB_CLIENT_SECRET_CONSOLE | SST config | (none) | YES (console auth)
GOOGLE_CLIENT_ID | SST config | (none) | YES (console auth)
CLOUDFLARE_DEFAULT_ACCOUNT_ID | SST config | (none) | YES (deploy)
CLOUDFLARE_API_TOKEN | SST config | (none) | YES (deploy)
AWS_SES_ACCESS_KEY_ID | SST config | (none) | YES (email)
AWS_SES_SECRET_ACCESS_KEY | SST config | (none) | YES (email)
HONEYCOMB_API_KEY | SST config | (none) | YES (observability)
SALESFORCE_CLIENT_ID/SECRET | SST config | (none) | NO (CRM)
```

### 20. Service Dependency Map

```
This Service → Depends On
--------------------------
OpenCode Agent (local): No inter-service dependencies. Standalone CLI tool.
  - LLM Providers (18+): External HTTP APIs
  - Git: Local git binary
  - LSP: Local language servers
  - MCP: Local MCP server processes
  - GitHub API: api.github.com (via Octokit)

OpenCode Console (cloud): Cloudflare Workers + PlanetScale + Stripe + AWS
  - PlanetScale MySQL (database)
  - Stripe (payments, billing)
  - AWS SES (email)
  - GitHub OAuth + Google OAuth (authentication)
  - Honeycomb (observability)
  - Salesforce (CRM — optional)

Downstream Consumers (services calling OpenCode):
  - VS Code Extension (via HTTP API)
  - Web App (via HTTP API/WebSocket)
  - GitHub Action (via npm package)
```

### 21. Known Technical Debt & Issues

**CRITICAL — TODO/Placeholder Scan Results:**

31 TODO/FIXME/HACK markers found in `packages/opencode/src/` (excluding tests, stories, i18n):

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| TODO: make proper events for this | plugin/index.ts:221 | MEDIUM | Placeholder event emission in plugin system |
| TODO: fix this stupid inefficient dogshit function | provider/transform.ts:59 | HIGH | Self-identified inefficient transform |
| TODO: lost type safety on Chunk, MOST FIX | provider/sdk/copilot/chat/...ts:386 | CRITICAL | Lost type safety in Copilot chat SDK |
| TODO: Using process.env directly | provider/provider.ts:277,516 | MEDIUM | Effect Env.set bypassed intentionally |
| TODO: upstream a fix | server/.../cors-vary.ts:11 | LOW | Upstream bug workaround |
| TODO: clean up provider specific logic | agent/agent.ts:455 | MEDIUM | Provider logic bleeding into agent core |
| TODO: this should be its own command | cli/cmd/tui/component/prompt/...tsx:474 | LOW | UX improvement |
| TODO(v2): Temporary dual-write | session/prompt.ts, processor.ts | MEDIUM | 12+ occurrences of v2 session migration dual-write |
| TODO: move this to a proper hook | session/llm.ts:100 | LOW | Refactoring opportunity |
| TODO: combine formatters | format/index.ts:148 | LOW | Formatter sharing opportunity |
| TODO: When there are multiple orgs | account/account.ts:418 | MEDIUM | Incomplete org selection |
| TODO: look into tapError | control-plane/workspace.ts:515 | LOW | Error handling refinement |
| TODO: remove this hack | tool/tool.ts:12 | MEDIUM | Acknowledged hack in tool system |

**Additional observations:**
- **No soft delete** pattern across any model (all hard deletes with cascade)
- **No pagination** detected in local data access (Session/Message listing is in-memory)
- **No explicit health check endpoint** in server mode
- **No cache layer** — all data loaded fresh from SQLite on each access
- **Inconsistent doc comment coverage** — Effect services use TSDoc in some places, not in others (verified via scorecard)
- **V2 migration dual-write** — temporary code writing to both v1 and v2 session message tables, pending migration completion
- **Copilot provider type safety gap** — TODO says type safety lost on Chunk type, marked MUST FIX
- **process.env bypass** — Provider service bypasses Effect's Env.set for process.env mutations

### 22. Security Vulnerability Scan (Snyk)

**Scan Date:** 2026-05-09T20:20:52Z
**Snyk CLI Version:** 1.1303.0

**Result: SKIPPED — Snyk CLI not authenticated.**

Snyk CLI is installed but requires authentication (`snyk auth` or `SNYK_TOKEN` env var). No dependency vulnerability data available.

**Gap:** Dependency vulnerability scanning is not integrated into CI. Consider adding Snyk, Dependabot, or similar to the 27 GitHub Actions workflows.

**No Snyk code (SAST) or IaC scans were run.**
