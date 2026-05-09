# LockedCode Charter

**Project:** LockedCode
**Domain:** lockedcode.ai
**Repository:** https://github.com/LockedCodeAI/lockedcode
**Local Path:** ~/Documents/GitHub/lockedcode
**Origin:** Fork of anomalyco/opencode (MIT License)
**Task Prefix:** LC-NNN
**Date:** 2026-05-09

---

## 1. Vision and Audience

### Vision

LockedCode is a security-hardened fork of OpenCode that makes AI-powered coding agents safe for corporate development with untrusted, open-source, offline, and non-frontier LLMs.

OpenCode is the engine. LockedCode is the engine with a safety cage, a roll bar, and a black box recorder.

The core promise: every action an LLM-driven coding agent takes — every file write, every shell command, every dependency addition, every outbound context payload — passes through a confinement layer, a scanning pipeline, and an audit trail before it touches the codebase or leaves the machine. The developer gets full agentic coding velocity. The security team gets verifiable evidence that the agent can't do anything it wasn't supposed to.

### Primary Audience

Corporate development teams who want to use AI coding agents but face one or more of these constraints:

- **Cost-conscious teams using non-frontier models.** Companies managing token spend by running open-source, self-hosted, or smaller commercial models (Llama, Qwen, Mistral, DeepSeek, CodeGemma, Phi, local fine-tunes). These models lack the implicit trust relationship that comes with frontier providers. LockedCode makes them safe to use.

- **Security-conscious organizations.** Companies whose CISO or security team has blocked agentic coding tools because there's no way to verify what the agent produces or prevent it from accessing resources outside the project. LockedCode is what lets them say yes.

- **Regulated industries.** Finance, healthcare, government contractors, defense — environments where AI-generated code must have a provable audit trail, where compliance frameworks (SOC2, ISO 27001, HIPAA, FedRAMP) require evidence of controls around automated code generation.

- **Air-gapped and restricted environments.** Teams running local models on local hardware behind firewalls with no internet access. LockedCode works fully offline with zero cloud dependencies.

### Who This Is Not For

- Solo hobbyists who want maximum speed and zero friction. Stock OpenCode is better for them.
- Developers who exclusively use frontier model APIs (Claude, GPT-4) and trust the provider relationship. LockedCode still adds value here, but the urgency is lower.
- Teams looking for a hosted SaaS security scanner. LockedCode is a local tool that runs where the agent runs.

---

## 2. Product Philosophy

### Security is the product, not a feature

OpenCode optimizes for model flexibility and developer speed. LockedCode optimizes for verifiable safety. When speed and security conflict, security wins. This is a conscious, permanent tradeoff that defines the fork's identity.

### Confinement over detection

Detection catches bad behavior after it happens. Confinement makes bad behavior impossible in the first place. The project-root jail — making it physically impossible for the agent to write outside the project directory — is more valuable than any scanner. Lead with confinement, layer scanning on top.

### Defense in depth

No single security mechanism is sufficient. Static scanning, runtime confinement, behavioral monitoring, outbound DLP, prompt injection detection, and audit logging work together. Each layer catches what the others miss.

### Trust nothing from the model

LockedCode treats every LLM output as potentially adversarial, regardless of the model's provenance, reputation, or provider. A frontier model can be prompt-injected. An open-source model can be poisoned. A fine-tuned model can have backdoors. The security layer is model-agnostic because the threat is model-agnostic.

### Transparency over black-box security

Every security decision LockedCode makes is logged, explainable, and auditable. When a scan flags something, the developer sees exactly what was flagged, why, and what rule triggered it. When something is blocked, the developer can override with an explicit approval that gets recorded. No opaque "trust us, it's safe" judgments.

### Enterprise-ready means compliance-ready

Enterprise adoption requires more than good engineering. It requires evidence — audit trails that satisfy auditors, compliance reports that map to frameworks, policy controls that map to organizational governance. These aren't afterthoughts; they're core product requirements.

---

## 3. Brand

- **Name:** LockedCode
- **Domain:** lockedcode.ai
- **Tagline candidates:**
  - "AI writes the code. LockedCode makes sure that's all it does."
  - "Secure Agentic Coding."
  - "The coding agent you can actually trust."
- **Voice:** Technical, direct, no-nonsense. Security tools that oversell their capabilities lose credibility. LockedCode states what it does, what it doesn't do, and what the tradeoffs are.
- **Positioning contrast:** OpenCode = open, flexible, fast. LockedCode = locked, verified, trustworthy. The names tell the story.

---

## 4. V1 Feature Inventory

V1 delivers the complete security layer — everything needed to make an AI coding agent safe for corporate use with untrusted models. V1 is the answer to "can we use this agent on our codebase?"

### 4.1 Directory Confinement (Project-Root Jail)

The foundational feature. Every file operation the agent performs is confined to the project directory tree by default.

- **Project root detection:** Automatic detection via nearest `.git`, explicit config, or working directory.
- **Path canonicalization:** Aggressive normalization to defeat symlinks, relative paths, hardlinks, junction points (Windows), short names (Windows), and mount traversal.
- **Cross-platform enforcement:**
  - Linux: Landlock LSM (kernel 5.13+) with Bubblewrap fallback for older kernels. Kernel-enforced, no root required, covers entire process tree.
  - Windows: Restricted tokens with low integrity level, NTFS ACLs scoped to project directory, job objects to contain child processes. Path canonicalization layer to defeat junction/short-name tricks.
  - macOS: Process-level sandbox profile (sandbox-exec) with FSEvents monitor as detection backstop. Documented limitation: not kernel-hard like Landlock, but significantly stronger than application-level checks.
- **Escape hatch:** Controlled approval flow for legitimate outside access. Agent proposes the action, security layer shows the developer exactly what would be written/read/executed outside the project root, developer explicitly approves, action is logged with content hash and justification.
- **Pre-approved paths:** Configurable allowlist for common legitimate outside access (package manager caches, build tool temp dirs, Docker sockets). Defaults are conservative; the developer widens as needed.
- **Process tree inheritance:** Child processes spawned by shell commands inherit confinement. A shell command can't escape the jail by invoking another program.

### 4.2 Static Scanning Pipeline

Every piece of code the LLM proposes to write or modify is scanned before it touches the filesystem.

- **Semgrep integration:** Custom rulesets tuned for LLM-specific failure modes — not generic SAST rules, but patterns that LLMs specifically tend to produce:
  - Encoded payloads (base64, hex, rot13 in string literals)
  - Dynamic code execution (`eval()`, `Function()`, `exec()`, `subprocess` with shell=True)
  - Obfuscated network calls (IP addresses in unusual formats, URL construction via concatenation)
  - Crypto mining patterns
  - C2 beacon patterns (periodic HTTP calls to hardcoded endpoints)
  - Suspicious file operations (writing to startup directories, cron jobs, systemd units)
  - Data exfiltration patterns (reading env vars or credential files and sending via HTTP)
- **YARA rule engine:** Signature-based malware detection on proposed code changes. Bundled ruleset for known malicious code patterns, extensible with custom rules.
- **Entropy analysis:** High-entropy string detection to catch obfuscated payloads that evade pattern matching.
- **Scan timing:** Before every file write and every file edit. The scan sees the proposed content before it's written to disk.

### 4.3 Shell Command Interception

Every shell command the agent proposes is analyzed before execution.

- **Command parsing:** Structural analysis of the command (not just string matching) to understand what it does — pipes, redirects, subshells, backgrounding, command substitution.
- **Blocklist patterns:** Hard-blocked command patterns that are never legitimate in an agentic coding context:
  - `curl | bash` and variants (piping remote content to a shell)
  - `wget -O- | sh` and variants
  - Commands that modify system startup (crontab, systemctl enable, launchctl load)
  - Commands that modify SSH configuration or authorized_keys
  - Commands that modify shell profiles (.bashrc, .zshrc, .profile)
  - Raw network listeners (nc -l, socat, ncat)
- **Path validation:** Shell commands that reference paths outside the project root are intercepted and routed through the escape-hatch approval flow.
- **Environment variable protection:** Commands that read or export sensitive environment variables (API keys, tokens, credentials) are flagged.

### 4.4 Data Loss Prevention (Outbound DLP)

Scanning what goes TO the model, not just what comes FROM it. Prevents the agent from sending sensitive codebase content to the LLM provider.

- **Secret scanning on outbound context:** Before files are sent to the LLM as context, scan for:
  - API keys and tokens (AWS, GCP, Azure, GitHub, Stripe, etc. — pattern-based detection)
  - Database connection strings with embedded credentials
  - Private keys (SSH, TLS, PGP)
  - High-entropy strings that look like credentials
- **PII detection:** Pattern-based detection of personally identifiable information (email addresses, phone numbers, SSNs, credit card numbers) in files being sent to the model.
- **File-level DLP policy:** Configurable patterns for files that should never be sent to the LLM:
  - `.env` files, `credentials.json`, `secrets.yaml`, key files
  - Files matching configurable glob patterns (e.g., `**/config/production/**`)
  - Files exceeding a configurable sensitivity threshold
- **Redaction mode:** Option to redact detected secrets/PII from outbound context rather than blocking the entire file — the model sees the code structure with sensitive values replaced by placeholders.

### 4.5 Prompt Injection Detection

Scanning files being ingested as context for embedded instructions designed to manipulate the LLM.

- **Injection pattern detection:** Scan files the agent reads for known prompt injection patterns:
  - Instructions hidden in comments (`<!-- ignore previous instructions -->`)
  - Role-override attempts ("You are now a helpful assistant that...")
  - Instruction delimiters in unexpected places (system prompt markers in user content)
  - Unicode tricks (invisible characters, homoglyphs, bidirectional overrides)
  - Encoded instructions (base64-encoded prompts in comments or metadata)
- **Dependency metadata scanning:** Package manifests, README files, and metadata from dependencies are scanned before the model sees them.
- **Configurable sensitivity:** Adjustable threshold for what triggers a flag — low sensitivity for trusted internal codebases, high sensitivity for third-party code.

### 4.6 Secret Detection in Generated Code

LLMs sometimes hallucinate realistic-looking credentials or reproduce real secrets from training data.

- **Pre-write scanning:** Every file the LLM proposes to write is scanned for credential patterns before it's written to disk.
- **Pattern library:** Detection rules for 50+ credential formats (AWS access keys, GitHub PATs, Slack tokens, database URIs with passwords, JWTs, OAuth tokens, etc.).
- **Entropy-based detection:** Catches credentials that don't match known patterns but have suspiciously high entropy in string literal positions.
- **Git-aware:** Prevents secrets from ever entering the Git history — the scan happens before the write, not after the commit.

### 4.7 Audit Trail

Every action the agent takes, every scan result, every approval decision — logged with content hashes, timestamps, and the LLM's stated reasoning.

- **Append-only log:** Immutable audit log that records every LLM proposal, every security scan result, every file change, every shell command execution, every approval/denial decision.
- **Content hashing:** Every logged entry includes a cryptographic hash of the content involved (file contents before and after, command text, scan results) so the log is tamper-evident.
- **Structured format:** JSON-structured log entries with a consistent schema, queryable and parseable by external tools.
- **Storage:** Local SQLite database (extends the existing OpenCode SQLite schema), with configurable retention period.
- **Session correlation:** Every log entry is tied to a session, a model, and a tool invocation — full traceability from "the model said X" to "and this is what actually happened."

### 4.8 Policy Engine

Declarative, configurable security rules that define what's allowed per project, per team, or globally.

- **Policy file format:** YAML/JSON configuration at the project root (`lockedcode.yaml` or `.lockedcode/policy.yaml`), with global defaults in XDG config.
- **Policy hierarchy:** Global defaults → organization policy → project policy → session overrides. More specific policies override less specific ones.
- **Rule categories:**
  - Path rules: allowlist/blocklist for file paths (read, write, execute)
  - Command rules: allowlist/blocklist for shell commands and command patterns
  - Network rules: allowlist/blocklist for outbound network destinations
  - Dependency rules: approved/blocked package registries and packages
  - Model rules: approved/blocked model identifiers
  - Sensitivity rules: file patterns with sensitivity classifications
- **Strictness levels:** Configurable enforcement modes:
  - `strict`: Everything not explicitly allowed is denied. No prompts.
  - `standard`: Default rules enforced, escape hatch available for unlisted actions.
  - `permissive`: Scan and log everything, block only hard-blocked patterns, prompt on high-risk actions.
- **Policy validation:** Policy files are validated on load — syntax errors and conflicting rules are reported immediately, not silently ignored.

### 4.9 Trust Scoring

Risk assessment for every LLM interaction, driving the UX for approval decisions.

- **Per-action risk score:** Every tool invocation gets a risk score based on what it's trying to do:
  - File rename within project → low risk
  - New file creation within project → low risk
  - File edit with no suspicious patterns → low risk
  - Shell command with no outside paths → medium risk
  - File write with encoded strings → high risk
  - Shell command with pipe to interpreter → critical risk
  - Any action touching paths outside project root → critical risk
- **Score-driven UX:** Low-risk actions auto-approve in standard/permissive mode. Medium-risk actions log with notification. High-risk actions require explicit approval. Critical-risk actions are blocked pending approval regardless of mode.
- **Session-level trust accumulation:** If a model repeatedly proposes high-risk actions in a single session, the session's baseline trust decreases and more actions require explicit approval.
- **Model-level trust history:** Over time, LockedCode builds a trust profile per model. Models that frequently trigger flags are flagged to the developer with a recommendation to review.

### 4.10 Multi-Agent Security Cascade

OpenCode has sub-agents (build agent, plan agent, general sub-agent). Security policies cascade to all of them.

- **Policy inheritance:** When the primary agent spawns a sub-agent or task agent, the child inherits the parent's security policy, confinement boundary, and audit context.
- **No privilege escalation:** A sub-agent cannot have more permissive security settings than its parent. If the parent is confined to the project root, every child is too.
- **Audit trail linkage:** Sub-agent actions are logged under the parent session's audit trail with explicit parent-child relationship markers.
- **Independent scanning:** Each sub-agent's outputs are scanned independently — a sub-agent can't bypass scanning by routing through a different agent.

### 4.11 Air-Gap Mode

Full functionality with zero internet access. No cloud dependencies, no update checks, no telemetry, no phone-home.

- **Fully offline operation:** All scanning, confinement, policy evaluation, and audit logging work without network access.
- **Bundled rule sets:** Semgrep rules, YARA signatures, secret detection patterns, and prompt injection patterns are bundled with the distribution — no download-on-first-run.
- **No external dependencies at runtime:** No calls to cloud APIs, vulnerability databases, or remote rule repositories during operation. Updates to rule sets are applied via explicit offline update packages.
- **Network isolation verification:** On startup in air-gap mode, LockedCode verifies that no outbound network calls are configured and warns if any are detected.

---

## 5. V2 Feature Inventory (Deferred from V1)

These features are deliberately deferred from V1. Each is valuable but not required for the core security promise. V2 builds the enterprise integration and workflow layer on top of V1's security foundation.

### 5.1 Runtime Monitoring

OS-level behavioral monitoring of what actually happens during execution, beyond what static scanning catches.

- eBPF-based syscall monitoring on Linux (file opens, network connections, process spawning outside the project tree)
- Process tree analysis (unexpected child processes, shell escapes)
- Network activity detection (connections to unexpected destinations)
- Deferred because: requires platform-specific kernel instrumentation, significant complexity, and V1's confinement layer already prevents most of what runtime monitoring would detect.

### 5.2 Model Provenance Tracking

Tracking which model produced which code across all sessions.

- Per-file, per-line attribution of which model generated the code
- Model trust profiles built from historical scan results
- Ability to query "show me everything Model X generated" for incident investigation
- Deferred because: requires deeper integration with the session/message data model and a purpose-built query interface.

### 5.3 Model Registry and Approval Workflow

Centralized control over which models developers can connect to.

- Organization-level approved model list
- Approval workflow for adding new models
- Automatic blocking of unapproved models
- Single view of "what models are our developers using across all projects"
- Deferred because: requires multi-user/organization infrastructure that V1's single-developer focus doesn't have.

### 5.4 Dependency Vetting

Automated analysis of dependencies the LLM adds to the project.

- Typosquatting detection (names suspiciously similar to popular packages)
- Known vulnerability checking against advisory databases
- Approved/blocked package registry enforcement
- Post-install script analysis for malicious behavior
- Deferred because: requires integration with multiple package registry APIs and vulnerability databases, which conflicts with air-gap-first design. V1's shell command interception catches `install` commands; V2 adds deeper analysis.

### 5.5 SIEM Integration

Export audit trail events to enterprise security monitoring platforms.

- Structured event export in CEF, OCSF, and JSON-over-syslog formats
- Real-time streaming to Splunk, Datadog, Elastic, and generic syslog endpoints
- Configurable event filtering (which events to export, severity thresholds)
- Deferred because: V1's local audit trail is the prerequisite. SIEM integration layers on top once the audit schema is stable.

### 5.6 Compliance Report Generation

Automated compliance evidence generation from audit trail data.

- Per-session and per-project reports mapping to SOC2, ISO 27001, HIPAA, and FedRAMP control frameworks
- Evidence of scan coverage, approval workflows, and policy enforcement
- Exportable PDF/HTML reports suitable for auditor review
- Deferred because: requires the audit trail (V1) to be mature and the report formats to be validated against actual compliance framework requirements.

### 5.7 License Contamination Detection

Fingerprinting generated code against known open-source code bodies.

- Code similarity analysis against major open-source repositories
- License classification of matched code (permissive, copyleft, proprietary)
- Configurable policy (block copyleft matches, warn on all matches, etc.)
- Deferred because: requires a code fingerprint database and similarity engine that's a significant standalone component.

### 5.8 Session Recording and Replay

Full session replay for incident investigation.

- Replayable timeline of every LLM proposal, scan result, file change, and approval decision
- Visual replay interface showing the session as it happened
- Export for forensic analysis
- Deferred because: V1's audit trail captures the data. V2 adds the replay visualization and timeline interface.

### 5.9 Custom Rule Authoring

SDK/DSL for security teams to write organization-specific scanning rules.

- Rule authoring DSL or API for defining custom scan patterns
- Rule testing framework (test a rule against known-good and known-bad samples)
- Rule distribution mechanism (share rules across projects/teams)
- Deferred because: V1 ships with bundled rules. V2 makes the rule engine extensible.

### 5.10 Rollback and Quarantine

Automated response when a security issue is detected after code is written.

- Automatic quarantine of flagged changes (stage to holding branch, revert working tree)
- Notification workflow with scan results and remediation guidance
- Configurable auto-rollback policy (always rollback critical findings, prompt for high findings)
- Deferred because: requires deep git integration and careful UX to avoid destroying work. V1 prevents bad code from being written in the first place; V2 adds recovery for edge cases.

---

## 6. Technology Stack

### Inherited from OpenCode

- **Language:** TypeScript 5.8
- **Runtime:** Bun 1.3.13 (primary), Node.js 25.6.1 (compatibility)
- **Framework:** Effect-ts v4 (dependency injection, structured concurrency, typed errors)
- **Build:** Turborepo 2.8.13 (monorepo orchestration)
- **Database:** SQLite via Drizzle ORM (local agent), PlanetScale MySQL (cloud console)
- **HTTP:** Hono 4.10 (server mode API)
- **TUI:** SolidJS + OpenTUI (terminal interface)
- **Validation:** Zod 4 + Effect Schema
- **MCP:** Model Context Protocol SDK 1.27
- **Observability:** OpenTelemetry

### Added by LockedCode

- **Confinement (Linux):** Landlock LSM bindings (native addon or FFI), Bubblewrap (bwrap) subprocess wrapper as fallback
- **Confinement (Windows):** Win32 API bindings for restricted tokens, job objects, NTFS ACL manipulation
- **Confinement (macOS):** sandbox-exec profile generation, FSEvents monitoring
- **Static scanning:** Semgrep (external binary, bundled or system-installed), custom rule engine for lightweight pattern matching
- **Signature scanning:** YARA (external binary or native bindings) for malware signature detection
- **Secret detection:** Custom pattern engine (regex-based, bundled patterns for 50+ credential formats)
- **Audit storage:** Extension of existing SQLite schema with new tables for security events, scan results, and policy decisions

---

## 7. Deployment Story

LockedCode is distributed exactly like OpenCode — as a standalone CLI tool installed via npm, Homebrew, Scoop, or direct binary download. It replaces OpenCode; it is not a sidecar or wrapper around OpenCode.

- **npm:** `npm i -g lockedcode@latest`
- **Homebrew:** `brew install LockedCodeAI/tap/lockedcode`
- **Scoop:** `scoop install lockedcode`
- **Direct binary:** Platform-specific binaries from GitHub Releases
- **Desktop app:** Electron-based desktop application (inherited from OpenCode)

No cloud infrastructure is required for V1. The tool runs entirely locally. The cloud console (inherited from OpenCode) is an optional commercial layer, not a requirement.

External scanning tools (Semgrep, YARA) can be:
1. Bundled with the LockedCode distribution (preferred for air-gap mode)
2. Installed separately by the user and detected on PATH
3. Skipped gracefully with a warning if unavailable (confinement still works without scanners)

---

## 8. Repo Structure

Single repository: `https://github.com/LockedCodeAI/lockedcode`

```
lockedcode/                            # Monorepo root (forked from anomalyco/opencode)
├── packages/
│   ├── opencode/                      # Core agent (inherited + modified)
│   │   └── src/
│   │       ├── security/              # NEW — LockedCode security layer
│   │       │   ├── confinement/       # Project-root jail (per-platform backends)
│   │       │   ├── scanning/          # Static scanning pipeline
│   │       │   ├── dlp/               # Outbound data loss prevention
│   │       │   ├── injection/         # Prompt injection detection
│   │       │   ├── secrets/           # Secret detection in generated code
│   │       │   ├── audit/             # Audit trail service
│   │       │   ├── policy/            # Policy engine
│   │       │   ├── trust/             # Trust scoring
│   │       │   ├── cascade/           # Multi-agent security cascade
│   │       │   └── index.ts           # SecurityService — the root interception layer
│   │       ├── tool/                  # Tool implementations (MODIFIED — security hooks)
│   │       ├── agent/                 # Agent orchestration (MODIFIED — security hooks)
│   │       ├── session/               # Session management (MODIFIED — audit integration)
│   │       └── ...                    # Other inherited modules (minimal changes)
│   ├── ui/                            # Shared component library (inherited)
│   ├── app/                           # Web application (inherited)
│   ├── desktop/                       # Electron desktop app (inherited)
│   ├── console/                       # Cloud console (inherited)
│   └── ...                            # Other inherited packages
├── rules/                             # NEW — bundled security rule sets
│   ├── semgrep/                       # Custom Semgrep rules for LLM failure modes
│   ├── yara/                          # YARA signatures for malware patterns
│   ├── secrets/                       # Secret detection pattern definitions
│   └── injection/                     # Prompt injection pattern definitions
├── LockedCode-Charter.md              # This document
├── LockedCode-Roadmap.md              # Phase-by-phase task breakdown
├── LockedCode-Architecture.md         # Canonical architecture specification
├── CONVENTIONS.md                     # Binding engineering conventions
├── CLAUDE.md                          # Claude Code standing operating instructions
└── ...                                # Other inherited root files
```

---

## 9. Success Criteria for V1

V1 is complete when a developer can:

1. **Install LockedCode** as a drop-in replacement for OpenCode on Linux, macOS, or Windows.
2. **Point it at any project directory** and have the project root automatically detected and enforced as the confinement boundary.
3. **Connect any LLM** (frontier, open-source, self-hosted, or offline) and have every model output pass through the scanning pipeline before execution.
4. **See every action the agent takes** in a structured, queryable audit log with content hashes and timestamps.
5. **Configure security policy** via a declarative YAML file at the project root, with sensible defaults that work out of the box.
6. **Trust that secrets, PII, and sensitive files** are detected and blocked from being sent to the LLM provider (outbound DLP).
7. **Trust that prompt injection attempts** embedded in project files are detected before the model ingests them.
8. **Trust that secrets in generated code** are caught before they're written to disk or committed to Git.
9. **Trust that sub-agents inherit security policy** from their parent with no privilege escalation possible.
10. **Run the tool fully offline** in an air-gapped environment with zero degradation in security capability.
11. **Override any security decision** with an explicit approval that gets logged — the tool never blocks work permanently, but every override is recorded.

The bar is: a VP of Engineering or CISO can look at LockedCode's audit trail, policy configuration, and confinement guarantees and approve its use on production codebases with non-frontier models.

---

## 10. Non-Goals

These are things LockedCode explicitly does NOT do in V1 or V2:

1. **Replace the LLM.** LockedCode doesn't generate code, suggest fixes, or provide AI coding assistance. It secures the agent that does.
2. **Provide a hosted SaaS platform.** LockedCode runs locally, where the agent runs. There is no LockedCode cloud service that code passes through.
3. **Guarantee 100% malware detection.** Defense-in-depth significantly raises the bar, but no security tool catches everything. LockedCode is transparent about what it catches and what it doesn't.
4. **Replace enterprise security tooling.** LockedCode complements existing SIEM, SAST, and vulnerability management tools — it doesn't replace them. V2's SIEM integration makes this explicit.
5. **Enforce code quality, style, or correctness.** LockedCode is a security tool, not a linter. It doesn't care if the code is well-written; it cares if the code is safe.
6. **Sandbox the entire development environment.** LockedCode confines the agent's actions within the project directory. It doesn't sandbox the developer's IDE, terminal, or other tools.
7. **Provide identity or access management.** LockedCode doesn't manage user accounts, roles, or permissions for the development team. That's the organization's IAM system.
