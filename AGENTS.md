- **Repo identity:** LockedCode — security-hardened fork of OpenCode (anomalyco/opencode). This is a single monorepo. The core agent is in packages/opencode/. It depends on upstream OpenCode for the base agent functionality; LockedCode additions are in packages/opencode/src/security/.

- **Source-of-truth files the agent MUST read first (every session):**
  1. `CONVENTIONS.md` at repo root — Binding engineering conventions. Your output must follow them exactly.
  2. `LockedCode-Architecture.md` at repo root — Canonical architecture specification. Defines the security layer design, service boundaries, module structure, and integration points.

- **Build/test/run commands:**
  - Build: `bun run script/build.ts` from `packages/opencode`
  - Test: `bun test --timeout 30000` from `packages/opencode`
  - Typecheck: `bun turbo typecheck` from repo root (or `tsgo --noEmit` from `packages/opencode`)
  - Lint: `oxlint` from repo root

- **Coverage standard:** Pragmatic. Target 100% on new LockedCode code in `packages/opencode/src/security/`. Inherited OpenCode code retains existing coverage — no retroactive gap-filling unless we modify it.

- **Commit message format:** `LC-NNN: one-line summary`

- **Branch policy:** Push directly to `dev`. No feature branches for solo work.

- **What NOT to do:**
  - Do not add dependencies without architectural justification
  - Do not restructure inherited OpenCode code — add hooks and interception points only
  - Do not add CI workflows
  - Do not add task tracking to any committed file
  - Do not reference or update the audit document
  - Do not write code outside the task's defined scope
  - Do not modify files outside `packages/opencode/src/security/` unless the task explicitly requires it

- **Effect-ts patterns:** All new services use `Context.Service + Layer`. Dependencies injected via `yield*` in `Effect.gen`. Follow existing codebase patterns (131 existing Effect services). Self-reexport at the bottom of each module file: `export * as ModuleName from "."` or `export * as ModuleName from "./filename"`.

- **Security layer location:** All new LockedCode code in `packages/opencode/src/security/` with subdirectories: confinement/, scanning/, dlp/, injection/, secrets/, audit/, policy/, trust/, cascade/.

- **External tools:** Semgrep and YARA are system binaries invoked via child process (detected on PATH). Graceful degradation when unavailable. Never bundled as npm dependencies.

- **Inherited code policy:** Modifications to files outside `packages/opencode/src/security/` must be minimal, surgical, and documented in the task report's NOTES FOR THE ARCHITECT section.

- **Style guide (inherited from OpenCode):**
  - Avoid `try`/`catch` where possible
  - Avoid `any` type
  - Use Bun APIs when possible (e.g., `Bun.file()`)
  - Rely on type inference — avoid explicit type annotations unless necessary for exports
  - Prefer functional array methods (flatMap, filter, map) over for loops
  - Avoid unnecessary destructuring — use dot notation
  - Prefer `const` over `let` and ternaries over reassignment
  - Avoid `else` statements — prefer early returns
  - Snake_case for Drizzle column names
  - No barrel index.ts files in multi-sibling directories

- **Style guide (inherited from OpenCode):**
  - Avoid `try`/`catch` where possible
  - Avoid `any` type
  - Use Bun APIs when possible (e.g., `Bun.file()`)
  - Rely on type inference — avoid explicit type annotations unless necessary for exports
  - Prefer functional array methods (flatMap, filter, map) over for loops
  - Avoid unnecessary destructuring — use dot notation
  - Prefer `const` over `let` and ternaries over reassignment
  - Avoid `else` statements — prefer early returns
  - Snake_case for Drizzle column names
  - No barrel index.ts files in multi-sibling directories

- **Testing:**
  - Avoid mocks as much as possible
  - Test actual implementation, do not duplicate logic into tests
  - Run tests from package dirs (e.g., `packages/opencode`), never from repo root

- **Config module pattern:**
  - Follow the existing self-export pattern at the top of the file (e.g., `export * as ConfigAgent from "./agent"`)
  - New security config modules should follow the same pattern

- **Task completion report:**
  - Every prompt includes the task report template from CONVENTIONS.md
  - Fill every slot with a literal value or "N/A"
  - Do not omit slots or substitute markdown tables
