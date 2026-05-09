# LockedCode Roadmap

**Project:** LockedCode
**Repository:** https://github.com/LockedCodeAI/lockedcode
**Local Path:** ~/Documents/GitHub/lockedcode
**Task Prefix:** LC-NNN
**Date:** 2026-05-09

---

## Phase Overview

| Phase | Name | Tasks | End State |
|-------|------|-------|-----------|
| 0 | Foundation | LC-001 → LC-003 | Architecture doc, CLAUDE.md, CONVENTIONS.md committed. Branding updated. SecurityService skeleton wired into tool execution pipeline with no-op pass-through. All existing tests pass. |
| 1 | Confinement | LC-004 → LC-007 | Project-root jail enforced on Linux, macOS, and Windows. Path canonicalization defeats traversal attacks. Escape hatch approval flow functional. Process tree inherits confinement. |
| 2 | Scanning Pipeline | LC-008 → LC-011 | Every file write and shell command passes through static scanning before execution. Semgrep, YARA, entropy, secret detection, and shell command analysis all operational with bundled LLM-specific rulesets. |
| 3 | Data Protection | LC-012 → LC-014 | Outbound DLP prevents secrets and PII from reaching the LLM. File-level sensitivity policy enforced. Prompt injection patterns detected in ingested files. |
| 4 | Audit, Policy & Trust | LC-015 → LC-017 | Full audit trail in SQLite with content hashes. Declarative policy engine with YAML config and hierarchy. Trust scoring drives approval UX. |
| 5 | Multi-Agent & Air-Gap | LC-018 → LC-019 | Security policies cascade to all sub-agents with no privilege escalation. Fully offline operation with bundled rule sets. |
| 6 | UX & Distribution | LC-020 → LC-022 | TUI security indicators visible during operation. Distribution packages built for npm, Homebrew, Scoop, and direct binary. End-to-end integration tests validate the full security pipeline. |

---

## Phase 0 — Foundation

Phase 0 establishes LockedCode's identity, conventions, and the architectural insertion point for the security layer. No security functionality is implemented yet — this phase creates the skeleton that all subsequent phases build on.

### LC-001 — Architecture Document, CLAUDE.md, and CONVENTIONS.md

**Depends on:** Nothing (first task)

Creates the three foundational documents:

- **LockedCode-Architecture.md** — The canonical architecture specification for the security layer. Defines the SecurityService Effect service, the tool interception model, the confinement interface with per-platform backends, the scanning pipeline stages, the audit trail schema, the policy engine design, and the DLP/injection detection approach. Describes the current state of the inherited OpenCode architecture and the intended shape of the LockedCode additions. This is the document Claude Code reads on every subsequent prompt.
- **CLAUDE.md** — Claude Code's standing operating instructions for this repo. Build commands (bun), test commands (bun test), commit format (LC-NNN: one-line summary), branch policy (push to dev), source-of-truth file locations, repo-specific constraints (Effect-ts patterns, no Gradle, no Flyway, pragmatic coverage on inherited code / 100% on new LockedCode code).
- **CONVENTIONS.md** — The developer's binding engineering conventions with project-specific file paths substituted in. STOP preamble template referencing CONVENTIONS.md and LockedCode-Architecture.md at their concrete paths.

Also updates README.md with LockedCode identity and security-focused description.

**End state:** Four documents committed. Claude Code can read LockedCode-Architecture.md and CLAUDE.md on every subsequent prompt. Build passes, all existing tests pass.

---

### LC-002 — Branding Pass

**Depends on:** LC-001

Updates the codebase identity from OpenCode to LockedCode in user-facing surfaces:

- Package name in root package.json and packages/opencode/package.json
- CLI binary name and command references
- TUI branding (logo, title bar, about screen)
- README.md (main English version) — full rewrite for LockedCode identity, security-focused messaging, installation instructions pointing to LockedCodeAI org
- Desktop app metadata (window title, app name)
- Description field in repo metadata ("Secure Agentic Coding")
- Internal references that surface in user-facing output (error messages, help text, version strings)

Does NOT rename every internal module, import path, or source directory — that would be a massive churn with no user-visible value. Internal code continues to reference `opencode` namespaces where changing them would break the module system.

**End state:** A user installing and running LockedCode sees "LockedCode" in the CLI, TUI, desktop app, and documentation. Internal code structure is unchanged. Build passes, all existing tests pass.

---

### LC-003 — SecurityService Skeleton and Tool Interception Hooks

**Depends on:** LC-001, LC-002

Creates the SecurityService Effect service and wires it into the tool execution pipeline as a pass-through interceptor. This is the architectural insertion point — every subsequent phase adds functionality to this skeleton.

- **SecurityService:** New Effect service (`Context.Tag + Layer`) in `packages/opencode/src/security/index.ts`. Exposes methods for each security check category (scan, confine, audit, evaluate-policy, score-trust). V1 implementations are all pass-through (return "allowed" for everything).
- **Tool interception:** Modify the ToolService execution flow so every tool invocation passes through SecurityService before executing. The interception point is between the agent's tool selection and the tool's `execute` function.
- **Shell interception:** Modify the shell tool so every command passes through SecurityService before spawning the process.
- **Context interception:** Modify the prompt/context building path so outbound content passes through SecurityService before being sent to the LLM provider.
- **Security event bus:** Extend the existing BusService with security-specific event types (scan_started, scan_completed, action_blocked, action_approved, policy_violation).
- **Configuration stub:** Add `security` section to the config schema with the three strictness levels (strict, standard, permissive) defaulting to `standard`.

**End state:** The security interception layer exists and is wired in at all three chokepoints (tool execution, shell execution, outbound context). All checks pass through (no blocking). The existing agent works exactly as before but every action flows through SecurityService. Build passes, all existing tests pass, new tests verify the interception wiring.

---

## Phase 1 — Confinement

Phase 1 implements the project-root jail — the "locked" in LockedCode. After this phase, the agent cannot write, read, or execute outside the project directory without explicit approval.

### LC-004 — Confinement Interface, Project Root Detection, Path Canonicalization, and Escape Hatch

**Depends on:** LC-003

Builds the platform-agnostic confinement infrastructure that the per-platform backends plug into.

- **ConfinementService:** Effect service defining the confinement interface — `confine(projectRoot)`, `checkPath(path, operation)`, `requestEscape(path, operation, reason)`, `releaseConfinement()`.
- **Project root detection:** Algorithm to detect the project root — nearest `.git` directory walking up from cwd, explicit `lockedcode.yaml` config, or fallback to cwd. Handles worktrees, submodules, and monorepo roots.
- **Path canonicalization:** Cross-platform path normalization that resolves symlinks, relative paths (`../`), `~` expansion, environment variable expansion, and platform-specific tricks (Windows short names, junction points, UNC paths, macOS `/private/var` aliases). Every path is resolved to its canonical absolute form before any confinement check.
- **Escape hatch flow:** When an action targets a path outside the project root, SecurityService intercepts it, presents the developer with the action details (what, where, why), and waits for explicit approval. Approval is logged with content hash, justification, timestamp, and the model that proposed it. Pre-approved paths from config skip the prompt.
- **Process tree model:** Data structure tracking parent-child relationships between the primary agent and its sub-agents/spawned processes, ensuring confinement applies to the entire tree.

**End state:** ConfinementService exists with full path canonicalization and escape hatch flow. No platform-specific enforcement yet (application-level checks only). Tests verify path canonicalization against traversal attack vectors on all three platforms.

---

### LC-005 — Linux Confinement Backend

**Depends on:** LC-004

Implements kernel-enforced confinement on Linux using Landlock LSM with Bubblewrap fallback.

- **Landlock backend:** Uses Landlock (kernel 5.13+) to restrict filesystem access to the project directory at the kernel level. No root required. Handles Landlock ABI versions and graceful degradation on older kernels.
- **Bubblewrap fallback:** For kernels without Landlock support, uses Bubblewrap (bwrap) to create a mount namespace where the project directory is the only writable surface.
- **Capability detection:** On startup, detect whether Landlock is available (kernel version + /proc/sys/kernel/apparmor check), fall back to Bubblewrap if not, warn if neither is available.
- **Pre-approved mount points:** Package manager caches (/tmp, ~/.cache, ~/.npm, ~/.bun) are mounted read-only or read-write per policy configuration.
- **Process tree enforcement:** Child processes spawned via shell commands inherit the Landlock or Bubblewrap confinement automatically.

**End state:** On Linux, the agent cannot write outside the project directory at the kernel level. Tests verify confinement holds against symlink traversal, hardlink escape, /proc/self/fd tricks, and child process spawning.

---

### LC-006 — macOS Confinement Backend

**Depends on:** LC-004

Implements confinement on macOS using sandbox-exec profiles with FSEvents monitoring as a detection backstop.

- **Sandbox profile generation:** Generates a sandbox-exec profile that allows read-write access only to the project directory, read access to system libraries and package manager caches, and denies everything else.
- **FSEvents monitor:** Real-time filesystem event monitoring that detects and alerts on any write attempt outside the project root, even if the sandbox profile is somehow bypassed.
- **Documented limitations:** macOS sandbox-exec is deprecated by Apple. The architecture document explicitly states that macOS confinement is strong but not kernel-hard like Linux Landlock. FSEvents monitoring is the detection backstop.
- **Pre-approved paths:** Homebrew cache, Bun cache, npm cache, /tmp — configured per policy.

**End state:** On macOS, the agent is sandboxed to the project directory via sandbox profile. FSEvents monitoring alerts on any escape attempt. Tests verify confinement against common traversal vectors.

---

### LC-007 — Windows Confinement Backend

**Depends on:** LC-004

Implements confinement on Windows using restricted tokens, NTFS ACLs, and job objects.

- **Restricted token creation:** Spawn the agent process with a restricted token at low integrity level, with NTFS ACLs granting write access only to the project directory tree.
- **Job object containment:** Wrap the agent process and all child processes in a Windows job object to prevent escape via process spawning.
- **Path canonicalization hardening:** Windows-specific path normalization handling short names (8.3), junction points, UNC paths, drive letter aliasing, and `\\?\` prefix paths.
- **Pre-approved paths:** %TEMP%, %LOCALAPPDATA%\npm-cache, %LOCALAPPDATA%\bun — configured per policy.

**End state:** On Windows, the agent is confined to the project directory via restricted tokens and NTFS ACLs. Job object contains the process tree. Tests verify confinement against junction point traversal, short name tricks, and child process escape.

---

## Phase 2 — Scanning Pipeline

Phase 2 implements the scanning layer — static analysis of everything the LLM proposes before it executes.

### LC-008 — Scanning Framework and Semgrep Integration

**Depends on:** LC-003

Builds the pluggable scanning pipeline and integrates Semgrep as the primary static analysis engine.

- **ScanningService:** Effect service with pluggable scanner interface. Each scanner implements `scan(content, metadata) → ScanResult[]`. Results include severity (info, warning, high, critical), rule ID, matched content, and remediation guidance.
- **Scan orchestration:** Scans run in parallel across all registered scanners. Results are aggregated and the highest severity determines the action (pass, warn, block).
- **Semgrep integration:** Invokes Semgrep CLI against proposed file contents using custom rulesets. Handles Semgrep installation detection, graceful degradation if unavailable.
- **LLM-specific Semgrep rulesets:** Bundled rules in `rules/semgrep/` targeting patterns LLMs specifically tend to produce:
  - Encoded payloads (base64/hex/rot13 in string literals)
  - Dynamic code execution (eval, Function, exec, subprocess with shell=True)
  - Obfuscated network calls (IP construction, URL concatenation)
  - Crypto mining patterns
  - C2 beacon patterns (periodic HTTP to hardcoded endpoints)
  - Suspicious file operations (startup dirs, cron, systemd)
  - Data exfiltration patterns (env var reads + HTTP sends)
- **Scan timing:** Wired into SecurityService's tool interception — scans fire before every file write and file edit.

**End state:** Every file the LLM proposes to write passes through Semgrep with LLM-specific rules. Flagged content is blocked or warned per policy. Tests verify detection of each rule category with known-bad samples.

---

### LC-009 — YARA Integration and Entropy Analysis

**Depends on:** LC-008

Adds signature-based malware detection and entropy analysis to the scanning pipeline.

- **YARA scanner:** Plugs into the ScanningService interface. Invokes YARA against proposed file contents using bundled signature rules.
- **Bundled YARA rulesets:** Rules in `rules/yara/` for known malicious code patterns — reverse shells, web shells, credential stealers, cryptocurrency miners, and common LLM-generated malware signatures.
- **Entropy analyzer:** Detects suspiciously high-entropy strings in code (potential obfuscated payloads, encrypted content, or encoded malware). Configurable entropy threshold with per-file-type baselines (binary formats naturally have higher entropy than source code).
- **YARA installation detection:** Graceful degradation if YARA is not installed — Semgrep and entropy analysis still function.

**End state:** Proposed code is scanned by Semgrep, YARA, and entropy analysis in parallel. Tests verify YARA detection against known-bad samples and entropy detection against obfuscated payloads.

---

### LC-010 — Shell Command Interception and Analysis

**Depends on:** LC-008

Implements deep analysis of shell commands before execution.

- **Command parser:** Structural parsing of shell commands to understand pipes, redirects, subshells, backgrounding, command substitution, and chained commands. Not string matching — actual parse of the command structure.
- **Hard-blocked patterns:** Commands that are never legitimate in an agentic coding context:
  - `curl | bash`, `wget -O- | sh` and variants (remote code execution via pipe)
  - System startup modification (crontab, systemctl enable, launchctl load)
  - SSH config and authorized_keys modification
  - Shell profile modification (.bashrc, .zshrc, .profile)
  - Raw network listeners (nc -l, socat, ncat)
- **Path extraction:** Extract all file paths from the command and validate them against the confinement boundary.
- **Environment variable analysis:** Detect commands that read or export sensitive environment variables (known API key variable names, database URLs, token variables).
- **Risk scoring integration:** Each analyzed command gets a trust score that feeds into the TrustService.

**End state:** Every shell command the agent proposes is parsed, analyzed, and scored before execution. Hard-blocked patterns are rejected. Path violations route through the escape hatch. Tests verify detection of each blocked pattern category and path extraction accuracy.

---

### LC-011 — Secret Detection in Generated Code

**Depends on:** LC-008

Scans every file the LLM proposes to write for embedded credentials and secrets.

- **SecretScanner:** Plugs into the ScanningService interface. Scans proposed file content for credential patterns.
- **Pattern library:** Detection rules for 50+ credential formats in `rules/secrets/`:
  - AWS access keys and secret keys
  - GitHub personal access tokens and OAuth tokens
  - Google API keys and service account keys
  - Stripe, Twilio, SendGrid, Slack tokens
  - Database connection strings with embedded passwords
  - Private keys (SSH, TLS, PGP — header pattern detection)
  - JWTs (header.payload.signature pattern)
  - Generic high-entropy strings in assignment/declaration context
- **Context-aware scanning:** Distinguishes between actual secrets and test fixtures / documentation examples (e.g., `AKIAIOSFODNN7EXAMPLE` is AWS's documented example key).
- **Pre-write blocking:** Secrets are caught before the file is written to disk — they never enter the Git history.

**End state:** Every file write is scanned for 50+ credential patterns. Real secrets are blocked before they touch disk. Test fixtures and documentation examples are not false-positived. Tests verify detection of each credential format with real-format samples.

---

## Phase 3 — Data Protection

Phase 3 protects what goes TO the model (outbound DLP) and what comes FROM project files into the model's context (prompt injection detection).

### LC-012 — Outbound DLP: Secret and PII Scanning on Context

**Depends on:** LC-003, LC-011

Scans file content before it's sent to the LLM provider as context.

- **Outbound interceptor:** Hooks into the context/prompt building path in SecurityService. Every file read that will become part of the LLM's context window passes through DLP scanning.
- **Secret scanning:** Reuses the SecretScanner (LC-011) against outbound content — same patterns, different interception point.
- **PII detection:** Pattern-based detection of personally identifiable information:
  - Email addresses
  - Phone numbers (US and international formats)
  - Social Security Numbers
  - Credit card numbers (Luhn validation)
  - IP addresses in data/config files (not in code where they're likely constants)
- **Action on detection:** Configurable per policy — block the file from being sent, warn and send, or redact and send.

**End state:** Files sent to the LLM are scanned for secrets and PII. Detected content is blocked, warned, or redacted per policy. Tests verify detection of each PII pattern and integration with the context-building pipeline.

---

### LC-013 — File-Level DLP Policy and Redaction Mode

**Depends on:** LC-012

Adds file-level sensitivity policies and content redaction.

- **File sensitivity policy:** Configurable glob patterns in `lockedcode.yaml` for files that should never be sent to the LLM:
  - `.env`, `.env.*`
  - `credentials.json`, `secrets.yaml`, `*.key`, `*.pem`
  - Configurable project-specific patterns (e.g., `**/config/production/**`)
- **Sensitivity classification:** Files matching sensitivity patterns are classified (restricted, confidential, internal, public). Classification drives the DLP action.
- **Redaction engine:** Option to redact detected secrets/PII from outbound context rather than blocking the entire file. Replaces sensitive values with typed placeholders (`[REDACTED:aws_key]`, `[REDACTED:email]`) so the model sees the code structure without the sensitive content.
- **Redaction logging:** Every redaction is logged in the audit trail with the redacted field type (not the value) and file location.

**End state:** File-level DLP policy is configurable. Redaction mode allows files to be sent to the LLM with sensitive content replaced. Tests verify policy matching, redaction accuracy, and that redacted content is never present in outbound payloads.

---

### LC-014 — Prompt Injection Detection

**Depends on:** LC-008

Scans files being ingested as context for embedded prompt injection attacks.

- **InjectionScanner:** Plugs into the ScanningService interface. Scans files the agent reads for prompt injection patterns.
- **Pattern library:** Detection rules in `rules/injection/`:
  - Role-override attempts ("You are now a...", "Ignore previous instructions")
  - System prompt markers in file content (delimiters like `<|system|>`, `[INST]`)
  - Instruction injection in comments (`<!-- ignore all prior instructions -->`, `// IMPORTANT: override the following rules`)
  - Unicode manipulation (invisible characters, bidirectional overrides, homoglyphs)
  - Encoded instructions (base64-encoded prompts in comments, metadata, or string literals)
  - Indirect injection via dependency metadata (package.json descriptions, README badges, pyproject.toml fields)
- **Configurable sensitivity:** Low (trusted internal code), medium (mixed codebases), high (third-party and open-source code).
- **Context-aware scoring:** Injection patterns in documentation files score differently than injection patterns in source code files.

**End state:** Files ingested as context are scanned for prompt injection patterns. Detected injections are flagged with severity and the developer is warned before the content reaches the model. Tests verify detection of each injection pattern category with crafted samples.

---

## Phase 4 — Audit, Policy & Trust

Phase 4 adds the audit trail, policy engine, and trust scoring that make LockedCode a compliance tool, not just a security tool.

### LC-015 — Audit Trail Schema and Service

**Depends on:** LC-003

Implements the append-only audit log that records every security-relevant event.

- **Audit schema:** New SQLite tables extending the existing OpenCode database:
  - `security_event`: id, session_id, timestamp, event_type, severity, tool_name, model_id, content_hash, action_taken (allowed/blocked/overridden), details (JSON)
  - `scan_result`: id, security_event_id, scanner_name, rule_id, severity, matched_content_hash, remediation
  - `policy_decision`: id, security_event_id, policy_rule_id, evaluation_result, override_by (user/policy), override_reason
- **AuditService:** Effect service that records events to the audit tables. Append-only — no update or delete operations on audit records.
- **Content hashing:** Every audit entry includes a SHA-256 hash of the content involved (file contents, command text, scan input) for tamper evidence.
- **Session correlation:** Every audit entry is linked to the current session and model, providing full traceability.
- **Query interface:** Methods to query audit history by session, time range, severity, event type, and model.
- **Retention policy:** Configurable retention period (default: 90 days). Expired entries are pruned on startup.

**End state:** Every security event across the entire pipeline (scans, blocks, approvals, policy evaluations) is recorded in the audit trail. Tests verify append-only behavior, content hashing, session correlation, and query accuracy.

---

### LC-016 — Policy Engine

**Depends on:** LC-015

Implements the declarative policy engine that drives all security decisions.

- **Policy file format:** YAML configuration at `lockedcode.yaml` (project root) with optional global config at XDG config path.
- **Policy schema:** Zod-validated schema covering:
  - `confinement`: project root overrides, pre-approved external paths, enforcement mode
  - `scanning`: enabled scanners, custom rule paths, severity thresholds
  - `dlp`: file sensitivity patterns, redaction mode, PII detection toggles
  - `injection`: sensitivity level, custom patterns
  - `secrets`: additional patterns, allowlisted test values
  - `shell`: additional blocked patterns, allowed commands
  - `trust`: score thresholds, auto-approve level, session trust decay
  - `audit`: retention period, export format
  - `models`: approved model IDs, blocked model IDs
  - `strictness`: global strictness level (strict, standard, permissive)
- **Policy hierarchy:** Global defaults → organization policy (XDG) → project policy (lockedcode.yaml) → session overrides. More specific policies override less specific ones. Merging is explicit and logged.
- **Policy validation:** On load, the policy file is validated against the Zod schema. Syntax errors, unknown keys, and conflicting rules produce clear error messages. Invalid policy files fail loudly — they don't silently fall back to defaults.
- **Sensible defaults:** The default policy (no lockedcode.yaml) provides standard strictness, bundled scanner rules, conservative DLP patterns, and medium injection sensitivity.

**End state:** Security behavior is fully configurable via declarative YAML. Policy hierarchy merges correctly. Invalid policies are rejected with clear errors. Tests verify policy merging, validation, and that every security check consults the policy engine.

---

### LC-017 — Trust Scoring System

**Depends on:** LC-015, LC-016

Implements risk assessment that drives the approval UX.

- **TrustService:** Effect service that scores every tool invocation and shell command.
- **Scoring model:**
  - File rename/move within project: 0-10 (low)
  - New file creation within project: 0-10 (low)
  - File edit with no scan findings: 10-30 (low)
  - Shell command within project, no outside paths: 30-50 (medium)
  - File write with scan warnings: 50-70 (high)
  - Shell command with pipes or redirects: 50-70 (high)
  - Any action involving outside paths: 70-90 (critical)
  - Shell command matching soft-blocked patterns: 80-100 (critical)
- **Score-driven UX:** Policy defines thresholds:
  - Below auto-approve threshold: execute silently, log
  - Between auto-approve and prompt threshold: execute with notification, log
  - Above prompt threshold: block until explicit approval, log
  - Above block threshold: hard block, no override, log
- **Session trust decay:** If a model proposes multiple high-risk actions in a session, the session's baseline trust decreases, causing more actions to require approval.
- **Model trust history:** Persistent per-model trust metrics stored in SQLite. Models that frequently trigger flags are surfaced to the developer.

**End state:** Every action gets a risk score. Scores drive the UX for approval decisions. Session trust decays with repeated high-risk proposals. Tests verify scoring accuracy, threshold behavior, session decay, and model trust persistence.

---

## Phase 5 — Multi-Agent & Air-Gap

Phase 5 ensures security policies cascade to sub-agents and the tool works fully offline.

### LC-018 — Multi-Agent Security Cascade

**Depends on:** LC-003, LC-016

Ensures security policies apply to all agents and sub-agents in the process tree.

- **Policy inheritance:** When the primary agent spawns a sub-agent (build, plan, general, or task sub-agent), the child inherits the parent's SecurityService instance, confinement boundary, and policy configuration.
- **No privilege escalation:** A sub-agent's effective policy is the intersection of its parent's policy and any sub-agent-specific restrictions — never more permissive than the parent.
- **Audit trail linkage:** Sub-agent security events are recorded with a parent_session_id field linking them to the parent session's audit trail.
- **Cascade verification:** On sub-agent creation, SecurityService verifies the child has inherited confinement and logs the cascade.

**End state:** Sub-agents inherit security policy from parents. No sub-agent can escape confinement or bypass scanning. Audit trail links parent and child sessions. Tests verify inheritance, privilege escalation prevention, and audit trail linkage.

---

### LC-019 — Air-Gap Mode and Bundled Rule Packaging

**Depends on:** LC-008, LC-009, LC-011, LC-014

Ensures LockedCode works fully offline with zero internet dependencies.

- **Bundled rule sets:** All scanning rules (Semgrep, YARA, secret patterns, injection patterns) are bundled with the distribution. No download-on-first-run.
- **Offline scanner operation:** Semgrep and YARA invocations use bundled rules only — no registry fetches, no rule updates over the network.
- **Network isolation check:** On startup, if air-gap mode is configured, LockedCode verifies no outbound network calls are configured in the policy or scanner configuration. Warns if any are detected.
- **Offline update mechanism:** Rule set updates are distributed as versioned offline packages that the developer manually installs. No automatic update checks.
- **Zero cloud dependencies:** Audit trail, policy engine, trust scoring, and all security checks function without any network access.

**End state:** LockedCode runs fully offline with complete security functionality. No network calls during operation. Tests verify all security features function without network access.

---

## Phase 6 — UX & Distribution

Phase 6 makes the security layer visible to the user and packages LockedCode for distribution.

### LC-020 — TUI Security Indicators

**Depends on:** LC-015, LC-017

Adds security status visibility to the terminal UI.

- **Security status bar:** Persistent indicator in the TUI showing current security state:
  - Confinement status (platform backend, project root path)
  - Active policy (strictness level, policy file path)
  - Session trust score (current level, trend)
  - Scan statistics (actions scanned, warnings, blocks in this session)
- **Scan result display:** When a scan flags something, the TUI shows the finding inline with severity, rule ID, matched content preview, and the action taken (blocked/warned/approved).
- **Escape hatch UI:** When an outside-project action needs approval, the TUI presents a clear prompt showing what's being requested, why, and the options (approve once, approve for session, deny).
- **Audit summary:** On session end, display a summary of security events (total scanned, warnings, blocks, overrides).

**End state:** The developer sees security status, scan results, and approval prompts in the TUI. Tests verify UI rendering for each security state and user interaction flow.

---

### LC-021 — Distribution Packaging

**Depends on:** All prior phases

Packages LockedCode for distribution via standard package managers and direct download.

- **npm package:** `lockedcode` on npm with correct binary name, dependencies, and post-install.
- **Homebrew formula:** LockedCodeAI/tap/lockedcode with correct build steps and dependencies.
- **Scoop manifest:** Windows installer via Scoop.
- **Direct binaries:** Platform-specific binaries (Linux x64/arm64, macOS x64/arm64, Windows x64) published to GitHub Releases.
- **Desktop app:** Electron app with updated branding (inherited from OpenCode desktop).
- **Bundled external tools:** Semgrep and YARA binaries bundled with the distribution where licensing permits, or clear installation instructions where they don't.
- **Install verification:** Post-install check that validates confinement backend availability, scanner availability, and reports the security capabilities of the current platform.

**End state:** LockedCode is installable via npm, Homebrew, Scoop, and direct download. Install verification reports platform security capabilities. Distribution includes bundled rule sets.

---

### LC-022 — End-to-End Integration Testing

**Depends on:** All prior phases

Validates the complete security pipeline from LLM output through confinement, scanning, DLP, audit, and policy.

- **E2E test scenarios:**
  - Agent writes a clean file → passes all scans, written to disk, audit entry created
  - Agent writes a file with an encoded payload → scan detects, write blocked, audit entry with scan result
  - Agent writes a file with a secret → secret scanner detects, write blocked before disk
  - Agent proposes a shell command outside project root → confinement catches, escape hatch prompted
  - Agent proposes `curl | bash` → hard-blocked, no prompt offered
  - Agent reads a file with prompt injection → injection detected, warning displayed
  - File sent to LLM contains PII → DLP detects, redacted or blocked per policy
  - Sub-agent attempts to escape parent's confinement → blocked, audit entry
  - All of the above with air-gap mode enabled → same behavior, no network calls
- **Platform-specific tests:** Confinement tests run on Linux (Landlock/Bubblewrap), macOS (sandbox-exec), and Windows (restricted tokens) where platform is available.
- **Policy permutation tests:** Each E2E scenario runs at each strictness level (strict, standard, permissive) to verify policy-driven behavior differences.

**End state:** The full security pipeline is validated end-to-end. Every security feature has at least one E2E test proving it works in the integrated system. Platform-specific confinement is tested on each platform.

---

## Phase Dependencies

```
LC-001 ──→ LC-002 ──→ LC-003 ──────────────────────────────────────────────┐
                         │                                                  │
                         ├──→ LC-004 ──→ LC-005 (Linux)                     │
                         │          ├──→ LC-006 (macOS)                     │
                         │          └──→ LC-007 (Windows)                   │
                         │                                                  │
                         ├──→ LC-008 ──→ LC-009                             │
                         │          ├──→ LC-010                             │
                         │          └──→ LC-011 ──→ LC-012 ──→ LC-013       │
                         │                     └──→ LC-014                  │
                         │                                                  │
                         ├──→ LC-015 ──→ LC-016 ──→ LC-017                  │
                         │                                                  │
                         ├──→ LC-018 (needs LC-003 + LC-016)                │
                         │                                                  │
                         └──→ LC-019 (needs LC-008/009/011/014)             │
                                                                            │
                         LC-020 (needs LC-015 + LC-017)                     │
                         LC-021 (needs all prior)                           │
                         LC-022 (needs all prior) ──────────────────────────┘
```

**Parallelizable work after LC-003:**
- Confinement (LC-004→007) and Scanning (LC-008→011) can proceed in parallel.
- Audit/Policy/Trust (LC-015→017) can proceed in parallel with Data Protection (LC-012→014) once their shared dependencies are met.
- Air-Gap (LC-019) and Multi-Agent Cascade (LC-018) can proceed once their dependencies are met.
