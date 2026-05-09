# CONVENTIONS.md

**Project:** LockedCode
**Repository:** https://github.com/LockedCodeAI/lockedcode
**Local Path:** ~/Documents/GitHub/lockedcode
**Task Prefix:** LC-NNN

---

## Developer Velocity and Effort Discipline

I am an AI-first developer producing code at 500x traditional speed. AI writes 100% of production code. Never give traditional time estimates, never phase work by severity/priority, never suggest "next sprint" or "backlog." Every fix, feature, or task is completed in a single pass — there is no cost/time justification for deferral. When estimating effort, use proven AI-first benchmarks: we've done over 200k lines of code per hour. Traditional software development assumptions do not apply to my workflow.

NEVER assume, infer, or guess about any codebase. You have no filesystem access. Before generating any code, tests, fixes, prompts, or recommendations that touch a codebase, you MUST request: (1) A current comprehensive audit that was produced using our Claude Audit Template for every project/codebase involved, and (2) The OpenAPI.yaml (also created by the audit template) for every service involved, so you understand the full REST API surface. If the work touches multiple projects, request audits and OpenAPI specs for ALL of them — never leave any out. Do not proceed until you have these. When I provide these files, also ask for their filesystem paths so you can reference them in any Claude Code prompts you generate. Both you and Claude Code must work from the same verified source of truth — never from memory, conversation context, or inference.

---

## Source-of-Truth Files

The following files are the canonical source of truth for this project. Both Claude (the chat assistant) and the executing agent work from these verified files, never from memory or inference.

| File | Path | Purpose |
|------|------|---------|
| CONVENTIONS.md | ~/Documents/GitHub/lockedcode/CONVENTIONS.md | Binding engineering conventions (this file) |
| LockedCode-Architecture.md | ~/Documents/GitHub/lockedcode/LockedCode-Architecture.md | Canonical architecture specification for the security layer |
| LockedCode-Charter.md | ~/Documents/GitHub/lockedcode/LockedCode-Charter.md | Product vision, audience, scope, feature inventory |
| LockedCode-Roadmap.md | ~/Documents/GitHub/lockedcode/LockedCode-Roadmap.md | Phase-by-phase task breakdown |
| AGENTS.md | ~/Documents/GitHub/lockedcode/AGENTS.md | Agent standing operating instructions (read automatically by OpenCode) |

The audit document (`lockedcode-Audit.md`) is for Claude (the chat assistant) only — it is NOT listed in any STOP preamble and is NOT referenced by the executing agent. The agent reads the actual code.

---

## STOP Preamble Template

Every prompt to the executing agent begins with:

> "STOP: Before writing ANY code, read these files completely:
> 1. ~/Documents/GitHub/lockedcode/CONVENTIONS.md — Binding engineering conventions. Your code must follow them exactly.
> 2. ~/Documents/GitHub/lockedcode/LockedCode-Architecture.md — The architecture spec defines the security layer design, service boundaries, module structure, and integration points.
> Do not rely on the descriptions in this prompt alone. If this prompt conflicts with the source files, the source files win."

If any of these files are missing, STOP, and ask for them before proceeding.

---

## Prompt Close Template

Each prompt must end with:

> Compile, Run, Test, Commit, Push to Github

---

## Task Completion Report Template

Every prompt includes the following report template at position #3 (after Goal, before Constraints). The agent fills in every slot with a literal value or "N/A". No slot is omitted. Markdown tables do not substitute for the per-line slot format. Reports missing slots are rejected.

```
PROMPT: LC-NNN
REPO: lockedcode
TASK: <one-line title>
STATUS: <complete | partial | blocked>

GIT COMMIT HASH: <full 40-character SHA>
BRANCH: dev
COMMITS IN THIS TASK: <number>

MODULES/SERVICES CREATED OR MODIFIED:
  <module name>: <created | modified | unchanged>
  ...

TESTS:
  Unit tests: <count> pass
  Integration tests: <count> pass
  Total: <count>
  Coverage (new LockedCode code): <percentage>

LOCAL VERIFICATION:
  bun test: <pass | fail>
  bun run typecheck: <pass | fail>
  Compilation warnings: <count or "none">

DEVIATIONS FROM PROMPT: <explicit list or "None">
ISSUES ENCOUNTERED: <problems and resolutions or "None">

FILES CREATED:
  <full path> (<line count>): <one-line note>
  ...

FILES MODIFIED:
  <full path>: <change summary>
  ...

FILES DELETED:
  <full path>: <reason>
  ... or "None"

NOTES FOR THE ARCHITECT: <free-form>
NEXT RECOMMENDED PROMPT: <LC-NNN or notes>
```

---

## Testing and Coverage

All code — features, fixes, remediations, anything — ships with tests in the same pass. Tests are never a follow-up task.

**Coverage standard (pragmatic, application project):**

- Every new LockedCode service and module ships with thorough unit tests covering happy paths and non-trivial error branches. Target 100% on new LockedCode code.
- Inherited OpenCode code retains its existing test coverage. We do not retroactively close coverage gaps on upstream code unless we modify it.
- When modifying inherited code, add tests covering the modified behavior.
- Every security feature has at least one integration test proving it works in the integrated pipeline.
- Coverage is reported as an informational metric. Build does not fail below an arbitrary threshold on inherited code.
- Tests run via `bun test --timeout 30000` from `packages/opencode`.

---

## Build and Runtime

- **Language:** TypeScript 5.8
- **Runtime:** Bun 1.3.13 (primary), Node.js 25.6.1 (compatibility)
- **Package Manager:** Bun (workspace catalogs). Never use npm, yarn, or pnpm for this project.
- **Build System:** Turborepo 2.8.13 for monorepo orchestration. Never use Gradle.
- **Build command:** `bun run script/build.ts` (from packages/opencode)
- **Test command:** `bun test --timeout 30000` (from packages/opencode)
- **Typecheck command:** `bun turbo typecheck` (from root)
- **Lint command:** `oxlint` (from root)
- **Framework:** Effect-ts v4 for dependency injection, structured concurrency, and typed errors. All new services follow the `Context.Tag + Layer` pattern.

---

## Database Migration Policy

We never use Flyway during development. Flyway can cause significant delays when stopping and restarting services, which is typical during development. We only use Flyway when we move a project into production. Before that, we use the ORM's native migration tooling.

For LockedCode specifically: Drizzle ORM manages all schema changes. Drizzle Kit generates migrations (`bun drizzle-kit generate`). SQLite is the local database. No Flyway, no manual SQL migration files during development.

---

## Password and Auth Requirements

During development, when repeatedly testing, we want minimal requirements to make logins fast and easy. Strong password requirements (length, special characters, numbers, etc.) are for production only.

---

## Documentation Requirements

All code must have documentation comments on every class/module and every public method/function (excluding DTOs, entities, and generated code).

- TypeScript/JavaScript uses TSDoc/JSDoc (`/** */` blocks)
- Documentation ships in the same pass as the code — never a follow-up task

---

## Logging

All software projects must have centralized logging. LockedCode inherits OpenCode's structured logging framework (`@opencode-ai/core/util/Log`). All new LockedCode services use this framework. Security events are logged through both the standard logging framework and the dedicated AuditService.

---

## Prompt Format

All prompts to the executing agent must be .md file artifacts. Claude never writes code of any kind in any prompt. This includes implementation code, test code, configuration snippets, YAML, shell commands, and code examples. Prompts direct the agent with goals, constraints, and instructions — never with code. The agent has direct filesystem access and must read actual source files before producing any output. If achieving a goal requires code, the prompt tells the agent what to accomplish and what files to read, not how to write it.

---

## Naming Conventions

- **Task IDs:** LC-NNN (LockedCode), sequential, contiguous. No FX-NNN cross-cutting prefixes. Suffix variants (LC-001b, LC-001c) are allowed for surgical follow-ups.
- **Branch:** dev (push directly, no feature branches for solo work)
- **Commit format:** `LC-NNN: <one-line summary>`
- **Architecture document:** LockedCode-Architecture.md (not Architecture.md, not lockedcode-architecture.md)
- **Audit document:** lockedcode-Audit.md (generated by developer, not by task prompts)

---

## No Manual Operations

Every change goes through an agent prompt with a Git commit hash. The developer never manually runs git commands, build commands, file operations, editor operations, or test runs. If something needs to happen against the repo or filesystem, someone writes a prompt and the agent does the work.

---

## NEVER ADD WITHOUT EXPLICIT REQUEST

The following are never added unless the developer explicitly requests them by name:

- Continuous Integration / GitHub Actions / any CI workflows
- Auto-generated project-internal task tracking inside any committed file
- Adding the audit document to any STOP preamble or task prompt
- Branch protection rules, required status checks, mandatory PR reviews
- Issue templates, PR templates, contributing guides, code of conduct files
- Telemetry, analytics, crash reporting (Sentry, Bugsnag, Crashlytics)
- Public package publishing (npm publish, Maven Central, pub.dev)
- License files beyond what the developer specifies
- Security policy files (SECURITY.md)
- Funding/sponsor configuration (FUNDING.yml)

Note: The existing CI workflows inherited from OpenCode (27 GitHub Actions workflows in .github/workflows/) remain as-is. This rule prevents adding NEW CI workflows, not removing inherited ones.

---

## Project-Specific Conventions

### Effect-ts Service Pattern

All new LockedCode services follow the Effect-ts v4 `Context.Tag + Layer` pattern consistent with the existing codebase (131 existing Effect services). Dependencies are injected via `yield*` syntax within `Effect.gen`. No traditional class-based services with constructor injection.

### Security Layer Location

All LockedCode security code lives under `packages/opencode/src/security/`. Subdirectories match the feature areas defined in the Charter and Architecture document: `confinement/`, `scanning/`, `dlp/`, `injection/`, `secrets/`, `audit/`, `policy/`, `trust/`, `cascade/`.

### Inherited Code Modification Policy

When modifying inherited OpenCode code (anything outside `packages/opencode/src/security/`), changes should be minimal and surgical — add hooks and interception points, don't restructure. The goal is to stay mergeable with upstream OpenCode.

### Validation

Follow the existing codebase pattern: Zod 4 for configuration and tool parameter validation, Effect Schema for typed data encoding/decoding and API error types. New security policy configuration uses Zod validation.

### External Tool Integration

Semgrep and YARA are external binaries. They are invoked via child process, detected on PATH, and gracefully degraded when unavailable. They are never bundled as npm dependencies — they are system-level tools.
