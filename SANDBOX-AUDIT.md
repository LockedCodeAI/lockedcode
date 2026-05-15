# Lockedcode Sandbox Confinement Audit

**Date:** 2026-05-15
**Auditor:** David Barnes / Claude Code
**Scope:** Verify that lockedcode only operates within the directory from which it is launched
**Branch:** `feature/templates-home-dir` (commit `88da2b37`)

---

## Executive Summary

The project has a robust confinement system (`security/confinement/`) with proper path canonicalization, symlink resolution, null-byte rejection, and containment checks. Tool-level enforcement blocks user-facing writes/edits/reads outside the project root. **However, several internal subsystems bypass the confinement system entirely and access the user's home directory.**

---

## Violations Found

| # | Subsystem | Escapes To | Severity |
|---|-----------|-----------|----------|
| 1 | Template system | `~/.lockedcode/templates/` | **CRITICAL** |
| 2 | Remote template fetching | `~/.lockedcode/templates/.cache/` | **CRITICAL** |
| 3 | Custom rules loader | `~/.lockedcode/custom-rules/` | **HIGH** |
| 4 | Policy loader | `~/.config/lockedcode/policy.json` | **MEDIUM** |
| 5 | Config variable expansion | Arbitrary paths via `{file:~/path}` | **MEDIUM** |
| 6 | CLI database access | `~/.local/share/lockedcode/lockedcode-local.db` | **LOW** |

---

## Detailed Findings

### 1. CRITICAL — Template System Reads/Writes to Home Directory

**File:** `packages/opencode/src/cli/cmd/tui/component/dialog-template.tsx`

The template system hardcodes a path to `~/.lockedcode/templates/` and performs reads, writes, and directory creation there without any confinement check.

| Line(s) | Code | Issue |
|---------|------|-------|
| 13 | `const templatesDir = path.join(os.homedir(), ".lockedcode", "templates")` | Hard-coded home directory access |
| 14 | `const cacheDir = path.join(templatesDir, ".cache")` | Derived cache path in home directory |
| 59 | `await fs.readdir(templatesDir)` | Reads home directory without permission |
| 64-66 | `await fs.mkdir(dir, { recursive: true })` / `await fs.writeFile(...)` | Writes to home directory |
| 236 | `await scanLocalTemplates([templatesDir])` | Scans home directory templates |

**Impact:** Tool can read and write arbitrary files within `~/.lockedcode/`.

---

### 2. CRITICAL — Remote Template Fetching with Path Traversal Risk

**File:** `packages/opencode/src/cli/cmd/tui/component/dialog-template.tsx`

Remote template sources from configuration are fetched and cached. Template `entry.name` values from the remote index are **not validated for directory traversal** before being joined into file paths.

| Line(s) | Code | Issue |
|---------|------|-------|
| 92-109 | URL construction from config | No URL validation |
| 97-100 | `await fetch(indexUrl)` | Fetches from arbitrary URLs |
| 105-109 | `entry.name` used in path construction | No validation — `../../` traversal possible |
| 110 | `path.join(cacheDir, entry.name, mdFile)` | Attacker-controlled `entry.name` could escape cache dir |
| 115-121 | Content fetched and written to disk | No hash/signature verification |

**Impact:** A malicious template index could write files to arbitrary locations relative to the cache directory via path traversal in `entry.name`.

---

### 3. HIGH — Custom Rules Loaded from Home Directory

**File:** `packages/opencode/src/security/rules/loader.ts`

Custom rules are loaded from `~/.lockedcode/custom-rules/` without confinement checks. These rules contain regex patterns that are compiled at runtime.

| Line(s) | Code | Issue |
|---------|------|-------|
| 30-34 | Scan dirs include `path.join(os.homedir(), ".lockedcode", "custom-rules")` | Home directory access |
| 36-47 | Loop reads all `.json` files from that directory | No path validation |
| 57 | `fs.readFileSync(filepath, "utf-8")` | Direct read without confinement check |
| 76 | Regex patterns compiled from loaded rules | Arbitrary regex execution |

**Impact:** Malicious rule files placed in `~/.lockedcode/custom-rules/` could inject patterns into the scanning system.

---

### 4. MEDIUM — Policy Loaded from Home Directory

**File:** `packages/opencode/src/security/policy/loader.ts`

Security policies are loaded from `~/.config/lockedcode/policy.json` and merged over project-local policy.

| Line(s) | Code | Issue |
|---------|------|-------|
| 43-47 | `xdgConfigDir()` returns `~/.config/lockedcode` | Home directory path |
| 108-115 | `loadPolicyFile(globalPath)` | Reads from home directory |
| 52-56 | `fs.readFileSync(filepath, "utf-8")` then `JSON.parse()` | No confinement check |
| 78-93 | Policy merge algorithm | Home-directory policy applied over project policy |

**Impact:** A modified `~/.config/lockedcode/policy.json` could disable security features or alter confinement behavior.

---

### 5. MEDIUM — Config Variable Expansion Reads Arbitrary Files

**File:** `packages/opencode/src/config/variable.ts`

Configuration files support a `{file:~/path}` syntax that expands tilde references and reads the target file without any confinement check.

| Line(s) | Code | Issue |
|---------|------|-------|
| 60-63 | Tilde expansion: `path.join(os.homedir(), filePath.slice(2))` | Expands `~/` to home directory |
| 65 | `path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath)` | Allows absolute paths |
| 67-68 | `Filesystem.readText(resolvedPath)` | Reads file without confinement check |

**Impact:** Configuration files can reference and read arbitrary files outside the project directory.

---

### 6. LOW — CLI Commands Access Home Directory Database

**Files:** Multiple CLI command files

Several CLI commands access a shared database at `~/.local/share/lockedcode/lockedcode-local.db`.

| File | Line |
|------|------|
| `packages/opencode/src/cli/cmd/models.ts` | 11 |
| `packages/opencode/src/cli/cmd/quarantine.ts` | 12 |
| `packages/opencode/src/cli/cmd/siem.ts` | 10 |
| `packages/opencode/src/cli/cmd/provenance.ts` | 33 |

**Impact:** Low — this is CLI tooling state, not user project data. However, it is still access outside the launch directory.

---

## What's Working Correctly

The confinement system in `security/confinement/` correctly enforces sandbox boundaries for **user-facing tool operations**:

- **Path canonicalization** (`paths.ts`): Resolves relative paths, expands tilde/env vars, resolves symlinks via `realpathSync()`, normalizes dot segments, rejects null bytes
- **Containment checks** (`paths.ts:107-118`): `isSubPath()` validates prefix matching and prevents `/project` matching `/project-foo`
- **Write/edit enforcement** (`tool/registry.ts:392-417`): Calls `security.checkConfinement(filePath, "write")` and blocks operations outside project root with audit logging
- **Read enforcement** (`tool/read.ts:174`): `assertExternalDirectoryEffect()` requires permission for files outside CWD

---

## The Gap

The confinement checks are **not applied** to the tool's own internal operations. User operations are sandboxed, but the tool's infrastructure (templates, rules, policy, config) is not.

```
User tool calls  →  Confinement enforced  ✓
Template loading →  No confinement check  ✗
Rules loading    →  No confinement check  ✗
Policy loading   →  No confinement check  ✗
Config expansion →  No confinement check  ✗
```

---

## Recommendations

### Critical (Fix Immediately)

1. **Validate template `entry.name` for path traversal** — reject any value containing `..`, `/`, or `\` before joining it into a file path. This is externally controllable and the highest-risk finding.

2. **Route template I/O through confinement checks** — either restrict templates to project-local `.lockedcode/templates/` only, or require explicit user consent before accessing the home directory.

3. **Add content integrity verification for remote templates** — hash or signature validation before writing fetched content to disk.

### High (Fix Soon)

4. **Apply confinement to rules loading** — remove or gate `~/.lockedcode/custom-rules/` access; prefer project-local `.lockedcode/rules/` only.

5. **Restrict policy loading** — remove or gate `~/.config/lockedcode/policy.json` access; if global policy is needed, require explicit user consent.

### Medium (Fix in Next Sprint)

6. **Apply `Confinement.checkPath()` to config variable expansion** — validate that `{file:...}` references resolve within the project root before reading.

7. **Document which home-directory paths are intentionally accessed** — if some are genuinely needed (e.g., global DB for CLI state), whitelist them explicitly rather than leaving them as undocumented exceptions to the confinement model.
