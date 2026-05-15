---
name: sandbox-audit
description: Recurring audit to verify project-root confinement and security safeguards
---

# Sandbox Confinement Audit

You are performing a **read-only security audit** of the lockedcode codebase. Do NOT modify any code. Your job is to verify that the sandbox confinement invariants hold and to detect any regressions or new violations introduced since the last audit.

## Context

LockedCode must only operate within the directory from which it is launched (the "project root"). Any access outside that boundary must go through the confinement system (`checkPathSync` or the Effect-based `checkPath`) or be explicitly registered via `registerExternalPath` with an auditable reason.

The confinement foundation lives in:
- `packages/opencode/src/security/confinement/whitelist.ts` — standalone module (no Effect deps)
- `packages/opencode/src/security/confinement/index.ts` — Effect-based layer, re-exports whitelist
- `packages/opencode/src/security/confinement/paths.ts` — `canonicalize()`, `isSubPath()`

## Audit Procedure

Work through each section below. For every check, report **PASS**, **FAIL**, or **NEW FINDING** with file path, line number, and a one-sentence explanation.

---

### Section 1: Regression Checks (Original 6 Findings)

These are the findings from the baseline audit. Verify each fix is still intact.

#### F1 — Template System (CRITICAL)
**Invariant:** Templates default to `<projectRoot>/.lockedcode/templates/`, never `~/.lockedcode/templates/`.

Check `packages/opencode/src/cli/cmd/tui/component/dialog-template.tsx`:
- [ ] `getTemplatesDir()` returns `path.join(getProjectRoot(), ".lockedcode", "templates")` — no `os.homedir()`
- [ ] `seedDefaults()` calls `checkPathSync(templatesDir, "write", projectRoot)` before any `fs.mkdir` or `fs.writeFile`
- [ ] `scanLocalTemplates()` calls `checkPathSync` on each directory and each file before reading
- [ ] `fetchRemoteTemplates()` calls `isValidTemplateUrl()` (HTTPS-only, no credentials)
- [ ] `fetchRemoteTemplates()` calls `isValidEntryName()` on every entry name and file name
- [ ] `fetchRemoteTemplates()` performs post-join containment: `isSubPath(canonicalize(dest), canonicalize(cacheDir))`
- [ ] `fetchRemoteTemplates()` rejects entries without `sha256` digest
- [ ] No import of `os.homedir` in the template component (grep the file)

#### F2 — Remote Template Fetch (CRITICAL)
**Invariant:** Remote content is only fetched over HTTPS with entry-name validation, containment, and integrity checks.

Check `dialog-template.tsx` exports:
- [ ] `isValidTemplateUrl()` rejects `http:`, `file:`, `data:`, and URLs with embedded credentials
- [ ] `isValidEntryName()` rejects: empty, >255 chars, `..`, `/`, `\`, null bytes, leading `.`, non-`[A-Za-z0-9._-]`
- [ ] Every `fetch()` call in `fetchRemoteTemplates` is preceded by URL validation
- [ ] SHA-256 is computed via `createHash("sha256")` and compared case-insensitively
- [ ] Cache writes go through `checkPathSync` before `fs.writeFile`

#### F3 — Custom Rules (HIGH)
**Invariant:** Rules load only from project-local paths, never `~/.lockedcode/custom-rules`.

Check `packages/opencode/src/security/rules/loader.ts`:
- [ ] `dirsToScan` does NOT contain any path starting with `os.homedir()` or `~`
- [ ] `dirsToScan` only contains the `customPath` argument and `path.join(cwd, ".lockedcode", "rules")`
- [ ] Every `fs.readFileSync` call is preceded by a `checkPathSync` call
- [ ] Regex source length is capped (`MAX_REGEX_SOURCE_LENGTH`) before `new RegExp()`
- [ ] Regex compilation forces the Unicode flag (`u`)
- [ ] If an `allowGlobalRules` option exists, it either throws "not implemented" or is properly gated with confinement

Also check `packages/opencode/src/security/rules/resolver.ts`:
- [ ] If this file references `os.homedir()` for rules paths, verify it routes through confinement

#### F4 — Policy Loader (MEDIUM)
**Invariant:** Global XDG policy (`~/.config/lockedcode/policy.json`) is NOT loaded unless `options.allowGlobalPolicy` is explicitly `true`.

Check `packages/opencode/src/security/policy/loader.ts`:
- [ ] `loadPolicy()` signature includes `options?: { allowGlobalPolicy?: boolean }`
- [ ] The XDG config path is only accessed inside `if (options?.allowGlobalPolicy)` guard
- [ ] XDG path access calls `checkPathSync` before `loadPolicyFile`
- [ ] `deepMerge()` applies source tagging when `sourceName` is provided
- [ ] `stripSourceTags()` removes `__source` metadata before final schema validation
- [ ] No caller in production code passes `allowGlobalPolicy: true` (grep for it)

#### F5 — Config Variable Expansion (MEDIUM)
**Invariant:** `{file:...}` token expansion is confined to the config directory / project root.

Check `packages/opencode/src/config/variable.ts`:
- [ ] The `{file:...}` expansion branch calls `checkPathSync(resolvedPath, "read", confinementRoot)`
- [ ] `confinementRoot` is `configDir || process.cwd()`, not hardcoded to `process.cwd()` alone
- [ ] Denied paths throw `InvalidError` with a message containing "confinement denied"
- [ ] Tilde (`~`) in file paths is expanded before the confinement check (not after)

#### F6 — CLI Database Access (LOW)
**Invariant:** CLI commands that access `~/.local/share/lockedcode/` call `checkPathSync` first, and the path is registered via `registerExternalPath` at startup.

Check `packages/opencode/src/index.ts`:
- [ ] `registerExternalPath(path.join(os.homedir(), ".local", "share", "lockedcode"), ...)` is called at module scope

Check each CLI command that constructs `DB_PATH` with `os.homedir()`:
- [ ] `packages/opencode/src/cli/cmd/models.ts` — has `assertDbAccess()` calling `checkPathSync` before every `query()` and `run()`
- [ ] `packages/opencode/src/cli/cmd/siem.ts` — has `assertDbAccess()` calling `checkPathSync` before every `query()`
- [ ] `packages/opencode/src/cli/cmd/quarantine.ts` — has `assertDbAccess()` calling `checkPathSync` before every `query()` and `run()`
- [ ] `packages/opencode/src/cli/cmd/provenance.ts` — has confinement check before DB access

---

### Section 2: Known Surface Area (Monitor for Drift)

These paths use `os.homedir()` or access external locations by design. Verify they remain properly gated.

#### DB-Accessing Modules Without assertDbAccess (Potential Gaps)
Check whether these files access `DB_PATH` with `os.homedir()` and whether they have confinement checks:
- [ ] `packages/opencode/src/security/compliance/generator.ts` — sqlite3 query on DB_PATH
- [ ] `packages/opencode/src/security/session/list.ts` — sqlite3 query on DB_PATH
- [ ] `packages/opencode/src/security/session/timeline.ts` — sqlite3 query on DB_PATH

If any of these lack confinement checks, report as **NEW FINDING** (severity: LOW).

#### Home Directory Access in Non-Security Code
Verify these are either read-only informational or properly confined:
- [ ] `packages/opencode/src/cli/cmd/tui/context/editor-zed.ts` — reads Zed DB at `~/.local/share/zed/`
- [ ] `packages/opencode/src/cli/cmd/tui/context/editor.ts` — reads `~/.claude/ide/`
- [ ] `packages/opencode/src/lsp/server.ts` — sets `DOTNET_CLI_HOME`, reads vscode extensions at `~/.vscode/`
- [ ] `packages/opencode/src/file/protected.ts` — uses `os.homedir()` for protected file detection
- [ ] `packages/opencode/src/permission/index.ts` — expands `~/` and `$HOME` in permission patterns
- [ ] `packages/opencode/src/session/prompt.ts` — tilde expansion
- [ ] `packages/opencode/src/tool/shell.ts` — shell variable expansion

For each: is the access read-only? Is it user-initiated? Could it be exploited to exfiltrate data? Report concerns as findings.

#### Confinement Backend Paths
- [ ] `packages/opencode/src/security/confinement/backends/sandbox-profile.ts` — hardcodes macOS paths for sandbox-exec; verify these are system paths only
- [ ] `packages/opencode/src/security/confinement/backends/bubblewrap.ts` — verify bind mounts are read-only where possible
- [ ] `packages/opencode/src/security/confinement/root.ts` — verify tilde expansion only for `projectRoot` override config

---

### Section 3: New Violation Detection

Run these searches across the entire `packages/opencode/src/` tree (excluding `__tests__/` and `test/`). Report any hits that are NOT listed in Sections 1 or 2.

#### 3a. New `os.homedir()` usage
```
grep -rn "os\.homedir()" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
**Expected known hits:** index.ts, models.ts, siem.ts, quarantine.ts, provenance.ts, policy/loader.ts, confinement/whitelist.ts, confinement/index.ts, confinement/root.ts, confinement/paths.ts, confinement/backends/*, config/variable.ts, file/protected.ts, permission/index.ts, session/prompt.ts, tool/shell.ts, lsp/server.ts, editor-zed.ts, editor.ts, compliance/generator.ts, session/list.ts, session/timeline.ts, cli/cmd/uninstall.ts, cli/cmd/providers.ts, rules/resolver.ts

Any hit NOT in this list is a **NEW FINDING**.

#### 3b. New `fs.readFileSync` / `fs.writeFileSync` without confinement
```
grep -rn "fs\.\(readFileSync\|writeFileSync\)" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
For each hit, verify either:
1. The path is inside `process.cwd()` / project root, OR
2. A `checkPathSync` call precedes it in the same function, OR
3. The module's DB_PATH is registered via `registerExternalPath`

Unprotected hits are **NEW FINDINGS**.

#### 3c. New `fs.writeFile` / `fs.mkdir` (async) without confinement
```
grep -rn "fs\.\(writeFile\|mkdir\)\|await.*writeFile\|await.*mkdir" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
Same verification as 3b.

#### 3d. New `fetch()` calls fetching remote content
```
grep -rn "await.*fetch(" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
For each hit, verify either:
1. The URL is a well-known API endpoint (GitHub, provider OAuth), OR
2. URL validation (HTTPS-only, no credentials) is applied, OR
3. Content integrity is verified (hash, signature)

Unvalidated remote content fetches are **NEW FINDINGS**.

#### 3e. New `execFileSync` / `execSync` / `spawn` with user-controlled arguments
```
grep -rn "execFileSync\|execSync\|\.spawn(" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
For each hit, verify:
1. Arguments are not constructed from untrusted input (user content, file names, template values)
2. If running sqlite3, the query string is not interpolated from user input (SQL injection risk)

Command injection vectors are **NEW FINDINGS** (severity: HIGH).

#### 3f. New `registerExternalPath` calls
```
grep -rn "registerExternalPath" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
**Expected:** exactly 1 call in `index.ts`. Any additional production calls need justification.

#### 3g. Dynamic path construction with user input
```
grep -rn "path\.join.*\(args\.\|argv\.\|input\.\|body\.\|query\.\|params\.\)" packages/opencode/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\."
```
Each hit should have a confinement check between construction and use. Unprotected hits are **NEW FINDINGS**.

---

### Section 4: Test Coverage Verification

- [ ] Run `find packages/opencode/src -path "*/__tests__/*confinement*" -name "*.test.ts"` and list all confinement test files
- [ ] Verify each test file has tests that actually assert confinement denial (not just success paths)
- [ ] Run the confinement tests: `cd packages/opencode && bun test --timeout 30000 src/security/__tests__/confinement-whitelist.test.ts src/security/__tests__/policy-loader-confinement.test.ts src/security/__tests__/rules-loader-confinement.test.ts src/config/__tests__/variable-confinement.test.ts src/cli/cmd/tui/component/__tests__/dialog-template-confinement.test.ts`
- [ ] Report pass/fail counts and any failures

---

## Output Format

Produce a structured report with this exact format:

```markdown
# Sandbox Confinement Audit Report
**Date:** YYYY-MM-DD
**Auditor:** [name]
**Commit:** [short SHA]
**Branch:** [branch name]

## Executive Summary
[1-2 sentences: overall posture, number of findings]

## Regression Checks
| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| F1 Template system | CRITICAL | PASS/FAIL | ... |
| F2 Remote fetch | CRITICAL | PASS/FAIL | ... |
| F3 Custom rules | HIGH | PASS/FAIL | ... |
| F4 Policy loader | MEDIUM | PASS/FAIL | ... |
| F5 Config expansion | MEDIUM | PASS/FAIL | ... |
| F6 CLI DB access | LOW | PASS/FAIL | ... |

## Known Surface Area
| Module | Status | Notes |
|--------|--------|-------|
| compliance/generator.ts | PASS/GAP | ... |
| session/list.ts | PASS/GAP | ... |
| ... | ... | ... |

## New Findings
| # | File:Line | Severity | Description |
|---|-----------|----------|-------------|
| N1 | path:line | SEV | ... |
| ... | ... | ... | ... |

[If no new findings: "No new findings detected."]

## Test Results
- Confinement test suites: X/Y passing
- Failures: [list any]

## Recommendations
[Bulleted list of actions, if any]
```

---

## Rules for the Auditor

1. **Read-only.** Do not modify, create, or delete any files.
2. **Be specific.** Every finding must include `file:line`.
3. **Distinguish regression from new.** A regression is a previously-fixed finding that has broken. A new finding is surface area not covered by the original 6.
4. **Severity scale:** CRITICAL (escapes sandbox by default), HIGH (escapable with crafted input), MEDIUM (gated but gate is weak), LOW (audit trail gap), INFO (surface area to monitor).
5. **False positives are OK.** Better to flag and explain why it's safe than to miss a real issue.
6. **Check git blame.** If a suspicious line was added after the remediation commit (`9fc153c23`), flag it as "post-remediation addition."
