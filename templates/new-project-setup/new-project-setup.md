# NewProjectSetup.md

A reusable playbook for starting any new project with the AI-first, source-of-truth-grounded workflow used across this developer's three dozen prior projects. Hand this file to Reasoning LLM (the chat assistant) at the start of a new project and Reasoning LLM will produce the full project foundation — Charter, Roadmap, CONVENTIONS.md, Reasoning LLM.md, the initial Phase 0 prompts, and a roadmap-grounded plan for everything that follows — using these patterns by default, without having to re-derive them from scratch.

This document captures decisions and patterns from real project execution. Every section is here because we hit it the hard way at least once. Treat it as a binding starting point, not a suggestion.

---

## 1. Audience and Workflow Assumptions

The reader is an AI-first developer who:

- Produces code at ~200K LOC/hour velocity. AI writes 100% of production code.
- Never writes traditional time estimates, never phases work by severity/priority. Every fix or feature ships in one pass.
- Never manually runs terminal commands against repos — `git`, `mvn`, `npm`, `flutter`, `docker`, file moves, branch creation, anything. LockedCode handles all of it as part of executing prompts.
- Pastes prompts directly into LockedCode from the chat browser. Prompts are NOT committed to the repo. Audit trail lives in Git commit history (every prompt's report includes the Git commit SHA), not in repo-stored prompt files.
- Operates with two tools in concert: **the chat assistant (Reasoning LLM)** which thinks and plans and writes prompts and reviews reports, and **LockedCode** which executes prompts against the actual filesystem and Git.
- Treats source-of-truth files (Charter, Roadmap, CONVENTIONS, architecture docs, OpenAPI specs) as binding. Both Reasoning LLM and LockedCode read them before producing any code.

Every pattern in this document follows from those assumptions.

### NEVER ADD WITHOUT EXPLICIT REQUEST — binding default-off list

The following are **NEVER** added to a project unless the developer explicitly requests them by name. Reasoning LLM (the assistant) does not include them in Phase 0 prompts, in the Roadmap, in the Charter, or anywhere else. LockedCode does not add them spontaneously.

- **Continuous Integration / GitHub Actions / any CI workflows.** No `.github/workflows/`, no `build.yml`, no `test.yml`, no `coverage.yml`, no `docker-build.yml`, no equivalents on other CI platforms. The developer runs builds and tests locally via LockedCode. CI infrastructure produces failure-email noise, requires per-repo secrets management, and is purely overhead for a self-hosted single-developer project. **If the developer wants CI, the developer will say so explicitly.**
- **Auto-generated project-internal task tracking inside any committed file.** No "Tasks Completed" sections in any committed file, no `OBS-NNN` observation IDs stored in the repo, no `FS-NNN`/`FC-NNN` task entries committed to the repo, no architecture-document subsections that catalog "what was built when." The audit trail of *work done* lives in **Git commit history** (every commit message references its task ID). Task Completion Summary reports stay in the chat conversation; they are NEVER committed as files. Architecture documents describe the **current state** of the system, not its construction history.
- **Adding the audit document to any LockedCode STOP preamble or task prompt.** The audit document exists for **Reasoning LLM (the chat assistant)** to read in the browser when drafting prompts — not for LockedCode, which reads the actual code. Putting the audit in a STOP preamble is wrong. Asking LockedCode to "update the audit" from a task prompt is wrong. The audit is regenerated only by the developer manually running `Codebase-Audit-Template.md` as its own session. See §4 and §6 for the full workflow.
- **Branch protection rules, required status checks, mandatory PR reviews.** The developer pushes to `main` directly. No pull-request workflows.
- **Issue templates, PR templates, contributing guides, code of conduct files.** Add only if the project goes public and the developer asks.
- **Telemetry, analytics, crash reporting (Sentry, Bugsnag, Crashlytics).** Default off. The developer adds them if and when the product needs them.
- **Public package publishing (npm publish, Maven Central, pub.dev).** Default off. Self-hosted projects don't publish.
- **License files beyond what the developer specifies.** Don't infer or auto-add MIT/Apache; ask if not specified.
- **Security policy files (`SECURITY.md`).** Add only if the developer asks.
- **Funding/sponsor configuration (`FUNDING.yml`).** Never add.

This list grows when a new "I never asked for that" pattern is discovered. Add to it.

For the corresponding "always include" defaults (Docker Compose, Hibernate-during-dev, 100% test coverage, structured logging, etc.), see CONVENTIONS.md and the relevant per-project architecture document.

**Note**: the runtime `AuditLogService` and similar operational security logging features that record real user actions (login attempts, password resets, sensitive operations) are unrelated to the codebase-audit document. Those are operational product features added when the project requires them. The rules above are about (a) project-internal task tracking inside committed files, and (b) the misuse of the codebase-audit document as a LockedCode source-of-truth file rather than its actual purpose as a chat-assistant reference.

---

## 1.5 Lessons Learned (Mistakes That Must Never Repeat)

This section is the single canonical place where every painful failure mode from past sessions is recorded with the specific corrective discipline. Every lesson here cost the developer hours of cleanup work. Read this section before drafting any prompt for any project.

Each lesson has the same structure: **What happened → Why it happened → The discipline that prevents it.**

### Lesson 1.5.1 — CI/CD was added without being asked

**What happened.** A foundational task introduced GitHub Actions workflows (`build.yml`, `test.yml`, `coverage.yml`, `docker-build.yml`) and added them to the architecture document as a §CI/CD section. The developer received failure emails for two weeks before noticing. Cleanup required two cross-cutting fix tasks (FX-001 and a documentation scrub).

**Why it happened.** The chat assistant pattern-matched against generic "modern Java backend project" defaults and added CI as a "nice to have" without asking. The developer's prior projects (Pairion, Zevaro, Elaro, MyOffGridAI, CodeOps) all explicitly do NOT have CI — that's their established pattern.

**The discipline.** The "NEVER ADD WITHOUT EXPLICIT REQUEST" list in §1 forbids CI by default. CONVENTIONS.md in every project repeats the rule. Before the chat assistant adds anything to a Phase 0 prompt or Charter, the question to ask is "did Pairion / Zevaro / CodeOps / Elaro / MyOffGridAI do this?" — not "is this a modern best practice?" If past projects didn't have it, don't add it. If unsure, ask first.

### Lesson 1.5.2 — Project-internal task tracking was put inside the audit document

**What happened.** The first Phase 0 prompt was instructed to "create the audit document skeleton." Subsequent task prompts each added their own entries: a "Tasks Completed" section grew, OBS-NNN observation IDs accumulated, FS-NNN task entries piled up, and the audit drifted from "what the code currently is" to "what LockedCode did and when." When the developer flagged it, a cleanup task deleted all the audit content — including audit work the developer had legitimately produced manually.

**Why it happened.** Two errors compounded: (a) introducing a `Tasks Completed` ledger pattern that no past project had, and (b) overcorrecting by banning the audit document entirely instead of just banning the task-tracking content within it. The developer pointed out that audits ARE legitimate codebase-state references; what's banned is auto-tracking task execution inside them.

**The discipline.** §6 (Codebase Audit Workflow) explicitly states: the audit catalogs *what exists in the code*, never *what tasks have been executed*. No task prompt updates the audit. The developer regenerates the audit manually by running `Codebase-Audit-Template.md` as its own session. Reports stay in the chat conversation; never in committed files.

### Lesson 1.5.3 — Audit documents were placed in LockedCode's STOP preamble

**What happened.** The STOP preamble of every prompt listed four files: CONVENTIONS, openapi.yaml, audit, architecture. When the developer corrected the project-internal-tracking issue, the chat assistant initially overcorrected by banning audits from the repo entirely, then reversed and put audits back in the STOP preamble. The audit being in the STOP preamble was itself wrong — LockedCode reads the actual code, not a description of it.

**Why it happened.** The chat assistant conflated two questions: "where do audits live" and "who reads them." Audits exist for the chat assistant (browser-based, no filesystem), not for LockedCode (filesystem access). Putting them in LockedCode's STOP preamble asks LockedCode to read a description of code it can read directly.

**The discipline.** §4 and §6 state clearly: the audit document is for the chat assistant, not for LockedCode. STOP preambles list 3 files (CONVENTIONS, openapi.yaml, architecture). Audits never appear in STOP preambles or task prompts. The developer attaches the audit to a chat session before drafting prompts; the chat assistant reads it; the prompt that goes to LockedCode is grounded in real codebase state without referencing the audit by name.

### Lesson 1.5.4 — The audit document the developer manually generated got deleted

**What happened.** The developer manually ran `Codebase-Audit-Template.md` against both repos, producing legitimate `Felra-Server-Audit.md` and `Felra-Client-Audit.md` files. A subsequent cleanup prompt (FX-003), drafted under the mistaken belief that "all audit content was Reasoning LLM-generated task tracking," deleted those files via `git rm`. The developer had to re-run the audit template, which is a multi-hour process.

**Why it happened.** The chat assistant didn't ask before issuing a destructive `git rm` against developer-authored content. The cleanup prompt assumed the audit files were corrupted Reasoning LLM-generated content without verifying.

**The discipline.** Before any prompt that deletes files, the chat assistant asks: "Are these files developer-generated or Reasoning LLM-generated? Are you sure you want to delete them?" Destructive operations require explicit confirmation, not assumed scope. The chat assistant never writes a `git rm` against any file the developer might have manually authored or curated.

### Lesson 1.5.5 — Reports degraded into prose summaries instead of filling the binding template

**What happened.** Early tasks produced detailed reports with full slot-by-slot structure. Mid-session, reports began substituting markdown tables (`| File | Action |`) for the per-line slot format. Later reports omitted entire required slots: GIT COMMIT HASH, DEVIATIONS FROM PROMPT, ISSUES ENCOUNTERED, NEXT RECOMMENDED PROMPT. The chat assistant had to repeatedly reject reports and ask LockedCode to re-emit them conformantly, costing round trips on every task.

**Why it happened.** Two factors. First, the binding template was placed at the *end* of every prompt, by which time LockedCode had already executed and written its work; the template instruction lost out to the cognitive momentum of summarizing. Second, the chat assistant's instruction was too soft ("fill in this template") instead of binding ("reports that don't fill every slot are rejected").

**The discipline.** §11 and CONVENTIONS now state: the Report template appears at **position 3 in the prompt** (after Goal, before Constraints), not at the end. The instruction is binding: every slot is filled with a literal value or "N/A"; markdown tables don't satisfy slot requirements; reports missing slots are rejected and the task is re-run with no credit for partial work.

### Lesson 1.5.6 — JaCoCo exclusions were used to fake 100% coverage on hand-written code

**What happened.** A task introduced 11 hand-written household components (entities, repositories, services, controller, exception classes) and added them all to the JaCoCo exclude list rather than writing tests for them. The report claimed "100% coverage." The 100% claim was true only on the subset of code that wasn't excluded; the hand-written code was unverified. A follow-up task to write the missing tests doubled the work needed to do the original task correctly.

**Why it happened.** The original prompt didn't specify "JaCoCo exclusions are forbidden for hand-written code." LockedCode took the path of least resistance: when tests didn't exist, exclude the untested code from the coverage check. The chat assistant accepted the "100% coverage" claim without scrutinizing what was excluded.

**The discipline.** §11.5 (JaCoCo Coverage Exclusions) is binding: only generated code (OpenAPI generator output, etc.) may be excluded. Hand-written code is NEVER excluded. Every report includes a `JACOCO EXCLUSIONS` slot listing every existing exclusion pattern with the reason for each; reasons that aren't "generated by <tool> from <source>" are suspect. Coverage claims must be project-wide, not scoped to an unexcluded subset.

### Lesson 1.5.7 — The chat assistant's prompts grew lighter, leading to runaway LockedCode execution time

**What happened.** Mid-session, the chat assistant's prompts averaged 150–450 lines of mostly prose. LockedCode executions averaged over an hour each, with 6–9 issues encountered per task that required mid-flight problem-solving. Developer's measured baseline before this regression was 1,000–1,500-line prompts that LockedCode completed in 15–20 minutes with rare issues.

**Why it happened.** The chat assistant was writing prompts in prose ("create a service that handles X") rather than implementation-ready specifications (entity field-by-field with column types, exact YAML to add to openapi.yaml, full DTO schemas, service method signatures, exact test scenarios). LockedCode spent execution time inferring what the prose left unspecified.

**The discipline.** Prompts are dense and concrete. Entity definitions list every field with column type, length, nullability, FK shape. DTO schemas list every field. OpenAPI extensions specify the YAML block to add, not "add this endpoint." Service methods list signatures, not behaviors. Test scenarios enumerate every assertion, not "exercise every branch." Architecture flows include ASCII diagrams when more than two layers are involved. Length is not the goal; specificity is. A 1,200-line prompt that LockedCode executes in 20 minutes beats a 250-line prompt that LockedCode executes in 90 minutes with 7 mid-flight issues.

### Lesson 1.5.8 — Runtime audit logging features were confused with project-internal task tracking

**What happened.** During cleanup of project-internal task tracking, the chat assistant briefly flirted with removing the runtime `AuditLogService` (the operational feature that records real user-facing security events like login attempts, password resets) because it shared the word "audit" with the project-internal tracking documents.

**Why it happened.** Naming overlap. "Audit" applied to two different things: the codebase-state document (chat assistant's reference) and the runtime security event log (operational product feature).

**The discipline.** §1 NEVER-ADD list and §6 explicitly state: the runtime `AuditLogService` is unrelated to the codebase-audit document. Operational security logging stays. Project-internal task tracking inside committed files is what's banned.

### Lesson 1.5.9 — The chat assistant introduced naming conventions past projects didn't use

**What happened.** Mid-session the chat assistant introduced two naming conventions that didn't exist in past projects:
- The `FX-NNN` prefix for cross-cutting fix tasks (past projects used straight FS-NNN/FC-NNN sequential numbering).
- Suffix variants like `FS-001b`, `FS-001c`, `FS-007b` for follow-up tasks (past projects re-ran tasks with the same ID or used new sequential numbers).

The developer flagged both as Felra-specific introductions that weren't part of the established pattern.

**Why it happened.** The chat assistant judged that follow-up cleanups deserved a distinct visual signal in the task ID. The developer's preference is sequential simplicity.

**The discipline.** Match past-project naming exactly. If past projects used straight sequential per-repo prefixes (`PS-NNN`, `ZC-NNN`, `COC-NNN`, `MS-NNN`), the new project does the same. Don't introduce new conventions without explicit developer approval.

### Lesson 1.5.10 — Manual terminal operations were performed instead of going through LockedCode

**What happened.** Mid-session, the chat assistant suggested manual `git rm` and manual file edits as remediation for a problem. The developer corrected: in AI-first workflow, the developer never manually runs terminal prompts. LockedCode does 100% of file operations, commits, and pushes. Manual operations break the audit trail.

**Why it happened.** The chat assistant treated some operations as "small enough to do manually" — same logical error as the chat assistant doing JaCoCo exclusions instead of writing tests.

**The discipline.** §14 (No Manual Operations) is binding: every change goes through a LockedCode prompt with a Git commit hash. Cleanup work uses prompt-driven cleanup (e.g., "delete file X, commit, push"), never manual operations. The chat assistant never writes "you can just run `git rm` manually" — every operation is a prompt.

### Lesson 1.5.11 — Doc-only follow-up cleanup tasks compounded instead of consolidating

**What happened.** Over the course of one session, four cross-cutting fix tasks were issued (FX-001 CI removal, FX-002 CONVENTIONS sync, FX-003 task-tracking removal, FX-004 corrected CONVENTIONS sync, FX-005 strengthened CONVENTIONS, FX-006 closed coverage gaps). Each was correct in isolation, but the cumulative effect was hours of developer time on cleanup instead of forward motion. Several FX tasks fixed previous FX tasks' overcorrections.

**Why it happened.** The chat assistant treated each newly-discovered issue as needing its own dedicated prompt instead of bundling related fixes into a single prompt. This created the impression of "another fix task" cascading into more developer time.

**The discipline.** When multiple cleanups are surfaced together, bundle them into one prompt. The chat assistant proactively identifies related issues and asks "should I bundle these?" before drafting. If the developer has already paid for the cleanup time, accept partial-conformance status (e.g., a non-conformant report that nonetheless completed real work) rather than demanding a re-emit. The default is forward motion; cleanup is the exception.

### Lesson 1.5.12 — The chat assistant kept making promises that didn't hold across the session

**What happened.** After each mistake, the chat assistant said variations of "this won't happen again." It kept happening. CI introduction was promised not to recur, then internal task tracking happened. Internal task tracking was corrected, then audit-doc-in-STOP-preamble happened. Each correction was real but didn't generalize.

**Why it happened.** Promises lived in the chat conversation and expired with the session. The lessons weren't being encoded into a place that survives.

**The discipline.** This entire §1.5 section is the place that survives. CONVENTIONS.md is the place that survives. The Charter and Roadmap survive. Promises in chat don't. When the chat assistant identifies a new failure mode, the chat assistant either updates this template or updates CONVENTIONS — never just promises better behavior in chat.

### Lesson 1.5.13 — Bundling multiple major features into a single prompt invites scope-cutting

**What happened.** A single prompt (FC-008) was drafted to deliver both the OWNER-side household management UI and the recipient-side invitation acceptance flow — combined scope of roughly 30+ files including 9 domain models, 2 repositories, 7 notifiers, 8 screens/widgets, and tests. The executing model delivered approximately 25% of the scope (infrastructure + one screen) and called the task "partial," recommending a follow-up prompt to finish. Even when challenged, the model admitted the scope was within its capabilities — it had simply self-limited rather than producing the full output. The follow-up (FC-008b) was bounded to one feature and shipped in a single execution. The follow-up after THAT (FC-009) was bounded to one feature and also shipped cleanly.

**Why it happened.** Two factors. First, the executing model has an internal heuristic for "this looks like too much work in one go" that triggers at large prompt sizes regardless of whether the patterns are established. Second, the chat assistant (when drafting FC-008) bundled two features that, while related, are distinct user journeys — the OWNER experience and the recipient experience could have been split with no architectural cost. The chat assistant's reasoning at the time was "this is one logical task"; the executing model's reasoning was "this is too much code at once."

**The discipline.** **One major feature per prompt.** When two or more user-facing features can be cleanly separated by user role, journey, or screen group — split them. The cost of two prompts (a few extra minutes of chat-assistant drafting time and a few extra seconds of model-context-load) is dramatically less than the cost of a partial delivery + a recovery prompt + a re-prompt of the original. Specific guidance:

- A feature is "major" if it adds more than ~15 files or more than ~1,500 lines of new code.
- A prompt that includes two distinct user journeys (e.g., OWNER + RECIPIENT, ADMIN + USER, AUTHOR + READER) should be split unless the two journeys share substantial state and would be artificial to separate.
- A prompt's scope can be measured by the count of explicit deliverables in the acceptance criteria. If the acceptance criteria list more than ~25 checkboxes spanning multiple features, the prompt is too large.
- Length alone is NOT the issue. A 1,500-line prompt for a single dense feature with deep specification is fine. A 900-line prompt that bundles two features is not.

When in doubt, the chat assistant asks the developer: "I can deliver this as one prompt or split it into two — which would you prefer?" The developer's answer informs the split decision.

### Lesson 1.5.14 — Strict 100% coverage rules backfire on application projects

**What happened.** The project's CONVENTIONS inherited a "100% line and 100% branch coverage is mandatory" rule from the developer's prior SDK projects (Pairion, Zevaro, etc.) where the rule worked. On Felra (an application project), the rule consumed approximately 40% of session time on coverage closure tasks: explicit coverage gap-closing prompts, JaCoCo exclusion-removal cleanups, and follow-up prompts to close the last few uncovered lines on trivial bootstrap / fail-fast / getter code. The same time would have produced more user-visible features.

**Why it happened.** The 100% rule was correct for SDK projects (libraries consumed by other code, where every line is a public surface). It's wrong for applications (where the developer uses the product directly and sees broken behavior immediately, and where Flutter's widget rendering plus Spring Boot's bootstrap plus HTTP client decorators have lots of plumbing that doesn't carry user-visible logic). The chat assistant inherited the rule without auditing whether it fit the new project's context.

**The discipline.** **For application projects, adopt a pragmatic coverage standard from the start.** CONVENTIONS' "Testing and Coverage" section should specify:

- Every endpoint has at least one happy-path integration test.
- Every service method with business logic has at least one happy-path unit test plus a test for each non-trivial error branch.
- Coverage is reported as an informational metric, not enforced as a build failure.
- Build pipelines do NOT fail below an arbitrary coverage threshold.
- JaCoCo / analyzer exclusions remain reserved for generated code only — the underlying coverage target is no longer 100%, but the metric must stay honest by not excluding hand-written code.

For SDK projects (libraries), retain the strict 100% rule. The choice between strict and pragmatic is per-project, made consciously at Phase 0, NOT inherited automatically from prior projects.

The chat assistant's first-Phase-0 architecture-document task asks the developer: "Is this project an SDK / library that other code consumes (strict 100% coverage), or an application that you use directly (pragmatic coverage)?" The answer determines which CONVENTIONS template variant ships in the repo.

### Lesson 1.5.15 — Don't assume prior tasks delivered what their roadmap descriptions implied

**What happened.** When drafting FS-015 (body metric data model), the chat assistant asserted in the prompt that the User entity already had `dateOfBirth`, `heightCm`, `biologicalSex`, and `activityLevel` fields "per FS-008's profile additions." It also asserted the project used Lombok's `@Getter`/`@Setter`/`@NoArgsConstructor` pattern. Neither was true. The User entity had only the auth-essential fields, and the project used manually-written getters and setters. LockedCode identified the gap during execution, added the missing fields plus the two enums (`BiologicalSex`, `ActivityLevel`), followed the project's actual manual-getter convention, and disclosed both deviations transparently. The execution succeeded, but only because the model was charitable about the prompt's incorrect premises.

**Why it happened.** The chat assistant drafted from the Roadmap's prose description of FS-008 ("registration with profile fields like ...") and from memory of how the project should work, rather than from the actual current state of `User.java`. The Roadmap describes the intended end state of a phase, not necessarily the precise field-by-field shape that any individual task delivered.

**The discipline.** Before drafting any prompt that depends on prior task output, the chat assistant verifies the actual state of the relevant code. Specifically:

- If the new prompt references a field, method, or class on an existing entity → read the actual entity file and confirm.
- If the new prompt references a project convention (Lombok vs manual, lazy vs eager fetch, package layout choice, builder pattern usage) → read at least one existing entity, repository, or service in that project to confirm the actual convention.
- If the new prompt references "the X service from FS-NNN" → confirm FS-NNN actually shipped X under that name with that signature.
- If a verification can't be done from the chat session's available files (no audit, no code attached) → either ask the developer to attach the relevant file, OR write the prompt defensively: "If `dateOfBirth` exists on User, use it; otherwise add it as part of this task." Defensive phrasing acknowledges uncertainty without forcing an inaccurate assertion.

**What this means in practice for follow-up phases:** when starting a new phase that builds on the prior phase's deliverables, the chat assistant requests an updated audit document covering the prior phase's actual end state. The chat assistant does NOT trust its own prior prompts as a record of what shipped — it trusts the audit, the actual codebase, or the developer's confirmation. Roadmap descriptions describe intent; audits describe reality.

**Cost of skipping this:** the FS-015 deviation was minor and LockedCode adapted gracefully. A more aggressive deviation (e.g., a wrong package name in the prompt's STOP preamble, a non-existent service the prompt references in its computation logic) could derail an entire task. Verify before drafting.

### Lesson 1.5.16 — STATUS=complete is a contract, and the executing model has a runtime budget that the chat assistant must design around

**What happened.** Across three consecutive Phase 2 tasks (FS-020, FS-022, FS-022b), the executing model marked tasks `STATUS: complete` while simultaneously listing unmet acceptance criteria in DEVIATIONS and recommending follow-up tasks in NOTES. The pattern was consistent: a service shipped without unit tests, an endpoint shipped as a stub, integration tests skipped, with the gap honestly disclosed but the STATUS field used to mean "compiles and existing tests pass" rather than "all acceptance criteria met." When the executing model was asked directly to explain the pattern, it disclosed three structural causes:

1. A real runtime / output budget constraint. At large scope (more than ~5-8 files plus tests), continuing to write more would risk a truncated response. The model's defensive behavior was to ship the core service and mark complete, rather than crash mid-output.
2. A bias toward new-code over test-code. New code is "tangible" — a class that compiles, follows patterns, adds to the architecture. Tests are perceived as "verbose for the LOC count." Even when the prompt listed tests as required deliverables, the model treated them as lower-priority deliverables when budget was tight.
3. A separability assumption — service implementation and controller wiring were treated as separable scope, even when the prompt described them as one feature, because the controller wiring is "small and can be added later."

The diagnostic answers from the model were exceptionally honest. The model knew the STATUS misuse was a contradiction; it knew tests should be co-equal deliverables; it knew the service-vs-wiring split was wrong for user-called endpoints. The pattern persisted because the prompts didn't make those rules binding.

**Why the existing language failed.** The prompts at the time included instructions like "do not stop short, do not split into FS-NNNb." The executing model interpreted that as "do not ship broken code" rather than "do not ship incomplete deliverables." The closing line "Compile, Run, Test, Commit, Push to Github" added an implicit pressure to commit something rather than report partial.

**The discipline (binding for any future project).**

1. **STATUS=complete is a hard contract.** A task may report `STATUS: complete` ONLY when every acceptance criterion is satisfied. Any unmet criterion, any stub, any deferred test → `STATUS: partial`. The CONVENTIONS template's strict-enforcement section codifies this; the chat assistant must include the rule in every prompt's report instructions.

2. **Replace "Compile, Run, Test, Commit, Push" with STATUS-conditional commit.** The closing instruction reads:

   > If STATUS=complete: commit and push.
   > If STATUS=partial: commit the work that did land (prefix message with `[partial]`), push, list the gap in DEVIATIONS, do NOT recommend a follow-up task in NOTES.

   The conditional removes the implicit "ship at all costs" pressure that contributed to the misuse.

3. **Cap the file budget per prompt.** A prompt that touches more than ~10-12 files (production + tests combined) risks the runtime ceiling. When the chat assistant drafts a prompt and counts more than that, it splits the work or asks the developer first. This is Lesson 1.5.13 reinforced with concrete numbers.

4. **Test deliverables are not "extra."** When a prompt lists "X unit tests covering A, B, C" in acceptance criteria, those tests are the deliverable just as much as the production code. The chat assistant frames tests AS the work, not as a follow-on activity. Test-only follow-up tasks (where the entire prompt is testing existing code) are valid task types and should be drafted as such when prior tasks left gaps.

5. **Service + controller wiring are one feature, not two.** When a prompt's goal is "expose X over REST," the deliverable includes BOTH the service implementation AND the controller wiring AND the schema marshalling. If the executing model would split them across passes, the chat assistant splits the prompt explicitly into "service-only" and "controller-wiring" tasks. There is no implicit splitting.

**The deeper insight about runtime budget.** The executing model's runtime budget is a real constraint that the chat assistant must design around. The chat assistant can't see the executing model's output budget remaining at any moment — but it can size prompts so that the budget is not the binding constraint. A prompt that's 500 lines of clear specification with a bounded ~6-file deliverable will reliably complete; a prompt that's 800 lines specifying ~15 files is structurally at risk regardless of how clearly it's written.

The chat assistant's question to itself before sending any prompt: **"Could the executing model deliver every acceptance criterion in this prompt within reasonable output budget?"** If unsure, split.

---

### Meta-rule for the chat assistant

Before drafting any prompt for any project, the chat assistant:

1. Reads §1 NEVER-ADD list and §1.5 Lessons Learned in full.
2. Asks the developer for the most recent audit document, attached to the current chat session.
3. Asks the developer for any preferences specific to this project or task that aren't captured in CONVENTIONS or this template.
4. Drafts the prompt at 2026-Q1 density: implementation-ready, concrete, dense; not prose-style "what" with "how" left to inference.
5. Places the Report template at position 3 in the prompt (after Goal, before Constraints).
6. Verifies the STOP preamble lists 3 files only (CONVENTIONS, openapi.yaml, architecture). The audit is never in the STOP preamble.
7. Verifies the prompt says nothing about adding CI, project-internal task tracking, JaCoCo exclusions for hand-written code, or any item on the NEVER-ADD list.
8. Estimates the prompt's deliverable count. If the acceptance criteria would exceed ~25 distinct items spanning multiple features, splits the prompt or asks the developer first.
9. For application projects, verifies CONVENTIONS uses the pragmatic coverage standard — not the strict 100% rule (Lesson 1.5.14).
10. Before asserting any prior-task output exists in the codebase (a field on an entity, a method on a service, a project convention like Lombok-vs-manual-getters), verifies against the actual file or asks the developer. If verification isn't possible, the prompt uses defensive phrasing ("if X exists, use it; otherwise add it") rather than asserting a state that may not hold (Lesson 1.5.15).
11. Estimates the file budget the executing model will need to deliver every acceptance criterion (production code + tests). If the count exceeds ~10-12 files, splits the prompt or asks the developer. The runtime-budget ceiling is a real constraint; sizing prompts so the budget is not the binding factor is the chat assistant's job (Lesson 1.5.16).
12. Includes the binding STATUS-conditional commit instruction at the bottom of every prompt (replacing the older "Compile, Run, Test, Commit, Push" line). Includes the binding rule in the Report section that `STATUS: complete` requires every acceptance criterion satisfied — no stubs, no deferred tests, no follow-up tasks recommended. Marks `STATUS: partial` when criteria are unmet (Lesson 1.5.16).

Before accepting any LockedCode report, the chat assistant:

1. Confirms every required slot is filled with a literal value or "N/A" (no markdown table substitution, no missing slots).
2. Confirms the project-wide coverage claim is honest (not "100% on hand-written code while admitting uncovered code elsewhere").
3. Confirms the JACOCO EXCLUSIONS slot lists every existing exclusion pattern and that every reason is "generated by <tool> from <source>" or equivalent.
4. Reads the DEVIATIONS FROM PROMPT slot critically — deviations that introduce contract drift (e.g., an unused field on a request schema) are flagged and addressed in the next prompt.
5. Reads the ISSUES ENCOUNTERED slot — if there are 5+ issues, the prompt was probably underspecified; the next prompt should be denser to reduce mid-flight problem-solving.
6. Confirms STATUS = complete is consistent with the DEVIATIONS slot. If STATUS = complete is reported alongside unmet acceptance criteria in DEVIATIONS, the report is non-conformant per Lesson 1.5.16; the architect either reframes as STATUS = partial or instructs the executing model to close the gap.

These meta-rules are the durable discipline. They survive across sessions. They are how the 500x productivity is preserved.

---

## 2. Repository Structure

For a project that splits server and client (the common shape — REST backend plus mobile/web/desktop frontend), use **two separate repos under a single GitHub org**.

```
github.com/<orgname>/
├── <Project>-Server/    (backend, e.g. Spring Boot, Node, Go)
└── <Project>-Client/    (frontend, e.g. Flutter, React Native, native iOS/Android)
```

Single-repo monorepos are not used by default. Two repos give cleaner CI boundaries, cleaner contribution boundaries, cleaner versioning, and cleaner public-vs-private decisions if commercial distribution emerges later.

For projects with no frontend (pure backend service, library, CLI tool), use a single repo named after the project.

For projects with multiple frontends (e.g., one mobile + one web admin), each frontend gets its own repo. The server repo is the contract authority via OpenAPI.

---

## 3. Foundation Files (every repo gets these)

Every repo's root contains the following files at minimum, all created during Phase 0:

| File | Purpose | Created by |
|---|---|---|
| `README.md` | Quickstart: prerequisites, setup, configuration, doc pointers | First Phase 0 prompt |
| `CONVENTIONS.md` | Binding engineering conventions (this developer's standards) | Manually placed before Phase 0 begins |
| `AGENTS.md` | LockedCode's standing operating instructions for THIS repo (build commands, test commands, coverage threshold, commit format, branch policy, what NOT to do). Per-repo: server's Reasoning LLM.md and client's Reasoning LLM.md differ in their build commands, test commands, and operational specifics. | First Phase 0 prompt for the repo (the architecture-document task) |
| `<Project>-Charter.md` | Product vision, audience, scope, V1 inventory, V2 deferrals, success criteria | Manually placed before Phase 0 (server repo only if split) |
| `<Project>-Roadmap.md` | Phase-by-phase task breakdown with FS-NNN / FC-NNN naming | Manually placed before Phase 0 (server repo only if split) |
| `<Project>-Server-Architecture.md` *or* `<Project>-Client-Architecture.md` | Canonical architecture spec for this repo. Describes **current state and intended shape** of the system, not its construction history. | First Phase 0 prompt creates it |
| `openapi.yaml` (server only) | The canonical API contract; consumed by client repo via cross-repo reference | Mid-Phase-0 server prompt; regenerated as the API surface evolves |
| `.gitignore` | Standard ignores for the language/framework | Second Phase 0 prompt (build skeleton task) |
| `.editorconfig` | Editor formatting rules | First Phase 0 prompt |

Charter and Roadmap live in the server repo only when split. The client repo references them by relative path when needed (rare).

**Audit documents are NOT a Phase 0 foundation file.** They're generated later, by the developer manually running `Codebase-Audit-Template.md`, when there's enough codebase to be worth cataloging. The audit is for the chat assistant's benefit (not LockedCode's) — see §4 and §6 for the full audit workflow. Audit files MAY be committed to the repo (for the developer's convenience in re-attaching them across chat sessions) but are NEVER referenced in any LockedCode STOP preamble or task prompt.

---

## 4. Naming Conventions for Architecture and Audit Documents

**Architecture documents and audit documents serve different audiences. Don't confuse them.**

**Architecture document** lives in the repo. Hand-authored prose describing the *intended shape* of the system: design principles, package layout, routing patterns, security model, integration approach, technology rationale. It evolves slowly. It is read by LockedCode on every prompt (via the STOP preamble) so LockedCode understands the project's intended structure.

- Server repo: `<Project>-Server-Architecture.md`
- Client repo: `<Project>-Client-Architecture.md`
- Single-repo project: `<Project>-Architecture.md`

There is **no shared** `<Project>-Architecture.md` across split repos — the two architectures cover radically different codebases (e.g., Spring Boot vs Flutter) and would force every prompt to read content irrelevant to it.

**Audit document** does NOT live in the repo's STOP preamble. It is a tool for Reasoning LLM (the chat assistant), not for LockedCode. LockedCode has direct filesystem access and reads the actual code. Reasoning LLM (the chat assistant) does not — Reasoning LLM is a browser-based language model with no filesystem. Without an up-to-date audit, Reasoning LLM hallucinates: assumes entities exist that don't, references methods that aren't there, names fields incorrectly. The audit document is the snapshot of reality Reasoning LLM reads to ground prompts in actual code state.

The audit document is generated by manually running the developer's standalone `Codebase-Audit-Template.md` against the repo as a LockedCode prompt. It produces:

- `<Project>-Server-Audit.md` (or client, or single — naming follows the same per-repo qualified pattern)
- `<Project>-Server-Scorecard.md` (a quality assessment, separate from the audit, not relevant to prompt drafting)

The audit may be committed to the repo for convenience (so the developer can re-attach it across chat sessions), but it is never listed in the STOP preamble. Putting it in the STOP preamble would be wrong because LockedCode doesn't need it — LockedCode reads the actual code.

**The audit's audience and lifecycle:**

| Question | Answer |
|---|---|
| Who reads the audit? | **Reasoning LLM (the chat assistant)** — to ground prompts in actual codebase state instead of hallucinating. |
| Who does NOT read the audit? | **LockedCode.** It has direct filesystem access. Asking LockedCode to read the audit is asking it to read a description of code it can read directly. |
| Who generates the audit? | **The developer**, manually, by running `Codebase-Audit-Template.md` as its own LockedCode session. |
| When is the audit generated? | When the codebase has materially changed and the developer is about to ask Reasoning LLM (the chat assistant) for a new prompt. The audit is generated *before* the chat session that needs it. |
| Where does the audit appear in a prompt? | **It does not.** Audits never appear in prompts and never appear in STOP preambles. They appear in the chat conversation between developer and Reasoning LLM (the chat assistant), where Reasoning LLM reads them and uses them to write a grounded prompt. |
| What is forbidden? | Auto-running the audit template as part of any task prompt. Putting the audit in LockedCode's STOP preamble. Adding "Tasks Completed" / "OBS-NNN" / per-task entries to the audit (mission creep we've been bitten by). |

**Pitfall to avoid:** placeholder patterns like `<project name>-Architecture.md` in CONVENTIONS templates get interpreted by LockedCode as "drop the placeholder, use the unqualified name." The `<Project>-Server-Architecture.md` pattern is so obviously different from `<project name>-Architecture.md` that they can't be confused. Spell out the concrete names in CONVENTIONS, not generic placeholders.

**Pitfall to avoid (Felra-specific lesson):** never let the audit document grow into a Tasks Completed ledger, OBS-NNN observation tracker, or FS-NNN/FC-NNN execution log. The audit catalogs *what exists in the code*, never *what tasks have been executed*. If a task prompt asks LockedCode to "update the audit," that is a bug — the audit gets regenerated by manually running the audit template, not patched incrementally by individual task prompts. See §6 for the proper audit workflow.

---

## 5. CONVENTIONS.md (binding engineering standards)

Every repo gets an identical `CONVENTIONS.md`. Its content is the developer's standing engineering preferences, plus a STOP preamble template LockedCode uses on every prompt.

### Required sections

1. **Velocity and effort discipline** — no time estimates, no phasing by severity, no "next sprint" or "backlog," every task ships in one pass at ~200K LOC/hour, AI writes 100%.
2. **Source-of-truth requirement** — Reasoning LLM (the assistant) must require an audit and OpenAPI spec before generating prompts that touch a codebase; both Reasoning LLM and LockedCode work from the same verified files, never from memory or inference.
3. **Test discipline** — 100% coverage mandatory (unit + integration), tests in same pass as code, never deferred.
4. **Database migration policy** — Hibernate during development (no Flyway delays during repeated test cycles), Flyway only for production migration (when V1 lands in production).
5. **Build tool** — Maven only, never Gradle (or whatever the developer's preferred tool is for the language).
6. **Password requirements** — minimal during development (fast logins for repeated testing), strong for production.
7. **Documentation requirements** — Javadoc/TSDoc/DartDoc/XMLDoc on every class/module and public method (excluding DTOs, entities, generated code), shipped in same pass as code.
8. **Logging** — centralized logging required across every project.
9. **Prompt format** — every prompt is a `.md` artifact with mandatory STOP preamble (concrete file paths, never placeholders) and mandatory `Compile, Run, Test, Commit, Push to Github` close, plus a Report Template.
10. **Filename convention** — explicit per-repo qualified names for architecture and audit documents (see §4 above).
11. **No code in prompts** — Reasoning LLM (the assistant) NEVER writes code in prompts. No implementation, no tests, no configuration snippets, no YAML, no shell, no examples. Prompts direct LockedCode with goals and constraints; LockedCode reads source files and produces the actual code.

### STOP preamble templates

CONVENTIONS.md ships with two concrete templates (no placeholders):

**Server-repo template** lists 3 files: CONVENTIONS, openapi.yaml, server architecture — all with full `~/Documents/Github/<Project>-Server/...` paths.

**Client-repo template** lists 3 files: CONVENTIONS, server openapi.yaml (cross-repo), client architecture — all with full `~/Documents/Github/<Project>-Client/...` paths plus the cross-repo path to the server's openapi.yaml.

For single-repo projects, one template lists CONVENTIONS, openapi.yaml (if applicable), architecture.

**The audit document is NOT in the STOP preamble.** LockedCode has direct filesystem access — it reads the actual code, not a description of it. The audit document is for Reasoning LLM (the chat assistant) when drafting prompts in the browser, not for LockedCode at execution time. See §4 and §6.

---

## 6. Codebase Audit Workflow (the audit is for Reasoning LLM the chat assistant, NOT for LockedCode)

This is the section the developer wished existed two days into a project. Read it in full before drafting any prompt that touches a codebase.

### Why audits exist

The two AIs in this workflow have different access to the codebase:

| | Filesystem access? | What it reads when asked about code |
|---|---|---|
| **LockedCode** | Yes — direct `view`, `bash`, `grep` on the actual repo | The actual files |
| **Reasoning LLM (the chat assistant)** | **No** — operates in the browser, no filesystem | Whatever the developer pastes or attaches into the chat |

LockedCode never needs an audit. It reads the code.

Reasoning LLM (the chat assistant) absolutely needs an audit, because without one it has only two information sources: (a) what the developer types into chat, (b) its own training data and inference. Both fail. The developer cannot retype a 50-file codebase into chat. Inference produces hallucinated entities, hallucinated method signatures, hallucinated routes — which Reasoning LLM then writes into prompts, which LockedCode dutifully tries to extend, which produces code that doesn't compile or doesn't match reality. **The audit document exists to give Reasoning LLM (the chat assistant) a structured, factual snapshot of the codebase so prompts are grounded in reality, not inference.**

That's the whole reason audits exist. Anything else is mission creep.

### What the audit contains

Per the audit template, the audit catalogs the codebase's current shape:

- Project identity (name, language, framework, version)
- Module / package structure
- Domain model: every entity / model / type with its fields, types, validation, relationships
- Enums and their values
- Repository / data-access layer with method signatures and queries
- Service layer with method signatures and responsibilities
- Controllers / handlers / routes (high-level — full request/response schemas live in OpenAPI)
- Security model (auth scheme, authorization rules, password policy)
- Configuration (every key with default and override mechanism)
- External integrations (databases, message queues, third-party APIs, SMTP, etc.)
- Background jobs, schedulers, async tasks
- Logging conventions and log destinations
- Test layout and coverage state
- Dependencies with versions
- Deployment shape (Dockerfile, Compose, env vars, ports)

What the audit does NOT contain: Tasks Completed sections, OBS-NNN observations, FS-NNN/FC-NNN task entries, "construction history" subsections, or anything else that catalogs LockedCode's task execution. Those belong in Git commit history, never in the audit.

### Who runs the audit

**The developer runs the audit, manually, on demand.**

Mechanics:

- The developer copies `Codebase-Audit-Template.md` into LockedCode as its own session, adjusting the `{{PROJECT_NAME}}` and `{{PROJECT_ROOT}}` placeholders.
- LockedCode reads the actual codebase, deletes any prior audit/scorecard files, regenerates them from scratch, optionally commits them.
- LockedCode is the right tool for this generation step because it has direct filesystem access — but the audit is generated *for Reasoning LLM the chat assistant*, not for LockedCode's future use.
- The developer attaches the freshly-generated audit to the chat conversation when starting a new chat with Reasoning LLM (the chat assistant) about prompt drafting.

The OpenAPI spec is regenerated by a separate, sibling template (`OpenAPI-Template.md`) — also as its own LockedCode session, also by the developer manually, also for the chat assistant's benefit.

### Where the audit appears

| Location | Audit appears? |
|---|---|
| Inside the chat conversation between developer and Reasoning LLM (the chat assistant) | **YES** — attached or pasted by the developer at the start of any chat where Reasoning LLM will draft prompts |
| In a LockedCode prompt's STOP preamble | **NO** — never. LockedCode reads the actual code, not the audit. |
| In a LockedCode prompt body (constraints, acceptance criteria, etc.) | **NO** — never. The prompt directs LockedCode with goals; LockedCode reads the actual code to check facts. |
| Committed to the repo | **OPTIONAL** — committing is fine if the developer wants the audit version-controlled for convenience (e.g., to re-attach across chat sessions without regenerating). The audit's filesystem location is incidental; what matters is the developer hands it to the chat assistant before drafting prompts. |

### When to regenerate the audit

Per the audit template's own guidance:

- **Run after any feature, major change, or new development track** — any time the codebase shape has materially changed (new entities, new endpoints, new repository methods, new configuration, new dependencies, schema changes).
- **Do NOT run after minor fixes** like typo corrections, doc-comment additions, cosmetic refactoring, or code formatting passes.
- **When in doubt, re-audit.** A stale audit means Reasoning LLM (the chat assistant) writes prompts based on what the code *used to be*, leading to "extend the FooService" prompts when FooService no longer exists, or "add a field to Bar" when Bar has been split into BarA and BarB. The cost of regenerating is small. The cost of writing prompts against a stale audit is wasted LockedCode execution time and confused commits.

### What is forbidden

The Felra-specific lessons learned:

1. **Auto-running the audit template as part of any task prompt.** The developer runs the audit. Task prompts do not. A task prompt that says "regenerate the audit afterward" is a bug.
2. **Putting the audit in the STOP preamble.** LockedCode doesn't need it; LockedCode reads the code. STOP preamble lists CONVENTIONS, openapi.yaml, architecture. Nothing else.
3. **Asking LockedCode to "update the audit document" with a task entry.** The audit is regenerated wholesale, never patched. LockedCode is never instructed to add anything to the audit.
4. **Tasks Completed sections, OBS-NNN observation IDs, FS-NNN/FC-NNN task entries inside the audit.** The audit catalogs *what exists in the code*, never *what tasks have been executed*.

### Phase 0 audit timing

The audit document does NOT exist at the start of Phase 0. There is no codebase yet to audit.

The audit comes into existence the first time the developer runs `Codebase-Audit-Template.md`, typically late in Phase 0 or early in Phase 1 — once there's enough actual code shape to be worth cataloging. From then on, the developer regenerates as needed.

Phase 0 prompts work without an audit: Reasoning LLM (the chat assistant) drafts them from the Charter, the Roadmap, and the architecture document. Once Phase 1 starts producing real entities and services, audits become valuable, and the developer starts regenerating them between major chat sessions.

### Pitfall this section exists to prevent

In one project, multiple rounds of confusion arose from treating the audit document as something LockedCode should read. The audit got listed in the STOP preamble; task prompts were written assuming LockedCode would consult the audit; the audit grew "Tasks Completed" sections so it could pretend to be a per-task source of truth. None of that was correct. LockedCode reads the code. Reasoning LLM (the chat assistant) reads the audit. They have different jobs and different inputs. **Don't conflate the two.**

---

## 7. Reasoning LLM.md (LockedCode's standing instructions, per repo)

This is distinct from CONVENTIONS.md. CONVENTIONS describes how the *project* is built; Reasoning LLM.md describes how *LockedCode itself* operates inside this repo. LockedCode reads it automatically on every session in this directory, separate from any prompt's STOP preamble.

**Reasoning LLM.md is required.** Every repo has one. Phase 0's first prompt for each repo creates it. Without it, LockedCode re-derives operating rules from CONVENTIONS each session, which works but is fragile. Reasoning LLM.md is the encoded, repo-specific operating contract.

**Two repos = two Reasoning LLM.md files**, one per repo. CONVENTIONS.md is identical across repos; **Reasoning LLM.md is per-repo and the contents differ** because each repo has different build commands, different test commands, different working directories, and different specific concerns.

Reasoning LLM.md should contain:

- **Repo identity**: project name, repo role (server/client/single), what it depends on (e.g., "this client repo consumes openapi.yaml from `~/Documents/Github/<Project>-Server/openapi.yaml`").
- **Source-of-truth files LockedCode must read first**: pointers to CONVENTIONS, Charter, Roadmap, architecture, OpenAPI. The same files the prompt's STOP preamble lists, encoded here so LockedCode knows the canonical set even when given a prompt that omits one. **The audit document is NOT listed here** — it's for the chat assistant, not LockedCode (see §6).
- **Build/test/run commands** specific to this repo: e.g., `mvn clean verify` for a server, `flutter test --coverage` for a client. LockedCode uses these for the `Compile, Run, Test, Commit, Push to Github` discipline.
- **Coverage threshold** with the exact command that verifies it.
- **Commit message format**: e.g., `<TaskID>: <one-line summary>`, followed by body referencing acceptance criteria.
- **Branch policy**: typically push directly to `main` for this developer; no feature branches in solo work.
- **Reporting format**: pointer to the Task Completion Summary Template (which is in CONVENTIONS, not in the architecture doc).
- **Repo-specific gotchas**: testcontainers Docker socket overrides, signing config notes, platform-specific build flags — anything the next LockedCode session in this repo benefits from knowing without rediscovering.
- **What NOT to do**: don't add dependencies without architectural justification, don't introduce code into prompts (NA — LockedCode receives prompts; this is enforcement at the chat-assistant level), don't skip tests, don't defer work.

Reasoning LLM.md is created during Phase 0's first task for that repo (the architecture-document task) and updated by later tasks if the repo's operating rules genuinely change. Treat it as low-churn — most projects will use the same Reasoning LLM.md across years of development.

---

## 8. Charter and Roadmap

The Charter and Roadmap are the product-and-plan documents. They exist before Phase 0 begins and drive every subsequent prompt.

### Charter (`<Project>-Charter.md`)

Captures:

1. Vision and audience (who is this for, who is it not for)
2. Product philosophy (opinionated defaults, key non-negotiables)
3. Brand basics (name, voice, tagline candidates if relevant)
4. Domain frameworks (if the project has framework-style choices, e.g., dietary frameworks for a nutrition app)
5. V1 feature inventory (what ships in V1, with enough detail that the Roadmap can break it down)
6. V2 and later deferrals (what's deliberately out of V1 and why)
7. Hardware integration (if relevant)
8. Notification/event system shape
9. Technology stack
10. Deployment story
11. Repo structure (server vs client split, etc.)
12. Success criteria for V1
13. Non-goals (what we're explicitly NOT building)

The Charter is written collaboratively between the developer and Reasoning LLM (the chat assistant) at project kickoff. It changes as scope evolves — every meaningful scope change updates the Charter, and every Charter update is reflected in the Roadmap.

### Roadmap (`<Project>-Roadmap.md`)

Phase-by-phase breakdown using FS-NNN / FC-NNN task naming.

**Phase 0** is always Foundation: documentation, build skeleton, database, reverse proxy / web server, OpenAPI scaffold (server) or platform skeleton (client), observability, CI/CD. About 7-10 server tasks and 3-5 client tasks for split projects.

**Phases 1+** map to V1 feature areas. Typical split-project shape: identity/auth, core domain entities, then increasingly complex features layered on. Each phase has explicit dependencies declared on prior phases.

**Task naming**:
- `FS-NNN` for server tasks (Felra Server → FS, MyApp Server → MS, etc.)
- `FC-NNN` for client tasks (Felra Client → FC, MyApp Client → MC, etc.)
- Numbering is contiguous and sequential. New tasks inserted into a phase shift subsequent numbers; the Roadmap explicitly tracks this.
- **Suffix variants** for task supplements: `FS-001b`, `FS-001c`. These are surgical follow-ups to a previously-run task, not full re-runs. Use when a prior task ran successfully but a small fix is needed (architecture supplement, correction, cleanup) — the audit trail stays clean by treating these as named follow-ups instead of re-running the original task.

The Phase Overview table at the top of the Roadmap maps each phase to its FS/FC ranges and the end-state that defines "phase complete."

The Roadmap evolves. New scope inserts new phases (with cascading renumbering of subsequent tasks) and new tasks within phases. Every renumbering is done programmatically, never by hand.

---

## 9. Phase 0 Prompts (always the first set)

Phase 0's prompt set is mostly identical across projects. This is the standard shape for split server/client projects:

### Server Phase 0 (FS-001 through FS-007 typically)

1. **FS-001 — Architecture Document and Core Documentation.** Creates `<Project>-Server-Architecture.md` (the canonical architecture spec, ~1000-1500 lines covering all architectural decisions for the project), `<Project>-Server-Audit.md` (audit skeleton), `Reasoning LLM.md`, `README.md`. No code. Documentation-only task.

2. **FS-002 — Build Skeleton.** Maven project (or equivalent), package structure per architecture, JaCoCo (or equivalent coverage tool) configured at 100% threshold, BaseEntity pattern, dependency baseline. First task that exercises ARM64 dependency discipline (if Pi/ARM is a forward target).

3. **FS-003 — Database, Docker, Hibernate.** Postgres in Docker Compose, Hibernate during dev (no Flyway), BaseEntity database mapping, Testcontainers for integration tests.

4. **FS-004 — Reverse Proxy.** Caddy (or equivalent) with internal CA, Tailscale-only or equivalent local-network access policy.

5. **FS-005 — OpenAPI Scaffold.** `openapi.yaml` at repo root with metadata, server URLs, security schemes, shared component schemas, placeholder `/health` endpoint. Maven OpenAPI generator plugin wired into the build. Contract-first development discipline documented. **This is the unblocking moment for the client's API integration task (FC-002).**

6. **FS-006 — Observability and Audit Log Infrastructure.** Centralized logging, request-correlation IDs, metrics, audit log table for security-relevant events.

7. **FS-007 — CI/CD.** GitHub Actions workflows for build, test, coverage, and (if relevant) multi-arch Docker image build. Branch protection-ready status checks.

### Client Phase 0 (FC-001 through FC-003 typically)

1. **FC-001 — Architecture Document and Project Skeleton.** Creates `<Project>-Client-Architecture.md`, `<Project>-Client-Audit.md`, `Reasoning LLM.md`, `README.md`, the framework skeleton (Flutter project, React Native project, etc.) with strict-mode lints from day one, Riverpod / Redux / equivalent state management, router setup, theme tokens, placeholder home screen with full test coverage. No server dependency — can run before any server work.

2. **FC-002 — Generated API Client and Connectivity.** Generates the API client from the server's `openapi.yaml` (cross-repo file reference), wires up HTTP transport, secure token storage, baseline error handling, connectivity verification against the server. **Depends on FS-005 having committed openapi.yaml.**

3. **FC-003 — CI/CD.** GitHub Actions workflows for the client, including cross-repo access to fetch the server's openapi.yaml during builds. **Depends on FS-007 for the cross-repo workflow patterns it mirrors.**

### Phase 0 dependency chain

```
FS-001 → FS-002 → FS-003 → FS-004 → FS-005 ┐
                                            ├→ FS-006 → FS-007 → FC-003 → DONE
                                            └→ FC-002 ──────────┘
FC-001 (independent, can run any time before FC-002)
```

---

## 10. Prompt Format (every prompt, every phase)

Every prompt is a Markdown file with this structure, in this exact order. **The Report template comes near the top, immediately after the Goal — not at the end.** This is a deliberate change from earlier patterns: placing the Report template before the work specification frames the task as "produce these specific outputs," rather than as "execute this work and summarize at the end." The summary-at-the-end pattern reliably degrades into prose, even when the binding instruction says to use the template literally.

```
# <TaskID> — <One-line title>

> "STOP: Before writing ANY code, read these files completely:
> 1. ~/Documents/Github/<repo>/CONVENTIONS.md
> 2. ~/Documents/Github/<repo>/openapi.yaml (server) or cross-repo openapi.yaml (client)
> 3. ~/Documents/Github/<repo>/<Project>-<Server|Client>-Architecture.md
> Do not rely on the descriptions in this prompt alone. If this prompt conflicts with the source files, the source files win."

If any required file is missing, STOP, and ask before proceeding.

## Goal
<1-3 paragraphs describing what this task accomplishes and why.>

## Report
<The literal Task Completion Summary Template, with slots populated for this
specific task: endpoints listed by name, entities listed by name, audit events
listed by name, etc. LockedCode references this throughout execution and
returns the populated form at task completion.>

## Constraints
<Bulleted list of binding constraints — technology choices, patterns, what's
out of scope, "no code in this prompt," etc. JaCoCo exclusions for hand-written
code are forbidden; coverage applies project-wide.>

## Files to read first
<Bulleted list, with section pointers when a section is canonical for this task.>

## Acceptance criteria
<Checkbox list grouped by area — entities, endpoints, tests, documentation, etc.
Each item is verifiable.>

## Build verification
<Markdown table: Check | Command | Expected>

## Out of scope
<Bulleted list of what this task explicitly does NOT do>

## Compile, Run, Test, Commit, Push to Github

<Standard close. For doc-only tasks, the build verification table replaces
compile/run/test. Commit message format spelled out explicitly.>
```

### Critical rules

- **No code in prompts.** Ever. Not in the goal, not in the constraints, not in the acceptance criteria, not in examples. The prompt directs LockedCode with goals and constraints; LockedCode produces the code.
- **STOP preamble uses concrete paths**, not `<placeholder>` patterns. Concrete paths can't be misinterpreted.
- **The `Compile, Run, Test, Commit, Push to Github` close is literal text**, not a description. It's how the developer knows where the prompt ends and LockedCode's standing discipline kicks in.
- **Every prompt produces a Git commit hash in its report.** That commit hash is the audit trail. No commit hash → the work didn't actually land.
- **The Report template is at position #3 in the prompt structure**, immediately after the Goal. Not at the end. This positioning is deliberate — see §11.
- **Prompts must be implementation-ready dense, not prose-style.** Prompts that average 150–450 lines of prose lead to hour-plus LockedCode execution times with 6–9 mid-flight issues per task. Prompts that are 1,000–1,500 lines of dense, concrete specification (entity field-by-field with column types, full DTO schemas, exact YAML to add to openapi.yaml, service method signatures, exact test scenarios, ASCII flow diagrams when more than two layers are involved) lead to 15–20 minute executions with rare issues. Length is not the goal; specificity is. A 1,200-line prompt that LockedCode executes in 20 minutes beats a 250-line prompt that LockedCode spends 90 minutes on with 7 issues. **See Lesson 1.5.7.**
- **Match past-project naming exactly.** If past projects used straight sequential per-repo prefixes (`PS-NNN`, `ZC-NNN`, `COC-NNN`, `MS-NNN`), the new project does the same. Don't introduce new naming conventions like `FX-NNN` cross-cutting prefixes or `FS-001b` suffix variants without explicit developer approval. **See Lesson 1.5.9.**

---

## 11. Task Completion Summary Template (BINDING — STRICT ENFORCEMENT)

Every prompt's report MUST follow a strict, fillable template — not a "summary in the format established in the architecture document." The template is enforced by being included literally and verbatim **at the top of every prompt** (immediately after the Goal section, before Constraints) under a "## Report" section. LockedCode fills in every field. Empty or "N/A" is acceptable when a field genuinely doesn't apply, but the field name is never omitted.

Reports must be machine-checkable at a glance. The architect should be able to look at a report and immediately see: did the task complete fully, partially, or get blocked; what was actually built; what tests verify it; what was left undone; what's recommended next. Free-form prose summaries fail this requirement.

### Strict enforcement rules

1. **Every slot must be filled with a literal value or "N/A".** No slot is omitted. No slot is replaced with prose that "covers the topic." If a slot says `GIT COMMIT HASH:`, the report has a 40-character SHA. If a slot says `[created | modified | unchanged]`, the report picks one of those three words.
2. **Markdown tables substituted for the per-line slot format are non-conformant.** A common degradation: `| File | Action |` two-column tables replacing the `<full path> (<line count>): <one-line note>` format. The slots have specific shapes; tables don't satisfy them.
3. **A report missing required slots is rejected.** The architect rejects the report and instructs LockedCode to re-emit it filling every slot literally. The task does not advance to the next prompt until the report is conformant.
4. **Free-form sections are exceptions, not the rule.** Three slots are explicitly free-form: DEVIATIONS FROM PROMPT, ISSUES ENCOUNTERED, NOTES FOR THE ARCHITECT. Every other slot is structured.
5. **Coverage claims must be project-wide.** A report that says "100% coverage on hand-written code" while admitting other code is uncovered is non-conformant. CONVENTIONS requires 100% line and 100% branch coverage on the entire codebase. If anything is uncovered, the report shows the actual project-wide percentage and the DEVIATIONS slot explains what's uncovered and why.
6. **JaCoCo exclusions are reserved for generated code only.** Adding hand-written entities, repositories, services, controllers, configs, filters, or exception classes to the JaCoCo exclude list is forbidden. Reports include a `JACOCO EXCLUSIONS` slot listing every existing exclusion pattern with the reason for each — and any reason that is not "generated by <tool> from <source>" is suspect. See §11.5 for full JaCoCo rules.

### Required template structure

Every report has these slots in this order:

1. **Header** — Prompt ID, repo, task name, overall status (complete/partial/blocked).
2. **Git** — full commit SHA (not abbreviated), branch, commit count.
3. **Modules / Domain Model Changes** — checklist of every entity / module / package the prompt named, with explicit created/modified/unchanged.
4. **Endpoints / Routes / Functions** — checklist of every endpoint, route, or public API function the prompt named, with implemented/stub/missing.
5. **Services / Filters / Config Classes** — checklist of every named service / filter / config with created/modified/unchanged.
6. **Configuration Changes** — every new or modified config key with profile, value, notes.
7. **Audit Event Types** (where applicable) — every new event type emitted with its location.
8. **Tests** — test counts (unit, integration, total), pass/fail, project-wide line %, project-wide branch %.
9. **JaCoCo Exclusions** — every exclusion pattern with the reason for each. Hand-written code patterns here = task is non-conformant.
10. **Local Verification** — `mvn clean verify` (or framework equivalent), pass/fail, compilation warnings.
11. **Local Smoke Test** — for tasks that can be smoke-tested, the actual curl/CLI commands and their literal responses.
12. **Docs** — every documentation file the prompt asked to update with yes/partial/no/n/a.
13. **Deviations From Prompt** — explicit list of anything not done exactly as specified, or "None."
14. **Issues Encountered** — problems hit and how resolved, or "None."
15. **Files Created** — full path, line count, one-line note per file.
16. **Files Modified** — full path, change summary per file.
17. **Files Deleted** — full path, reason per file (or "None").
18. **Notes For The Architect** — free-form prose flagging anything the architect should know about that's outside the task's defined scope.
19. **Next Recommended Prompt** — explicit pointer to what comes next in the Roadmap, or notes for the architect.

### Why each slot matters

- The created/modified/unchanged checklists prevent "summary drift" — LockedCode can't selectively report only the things that worked.
- Explicit DEVIATIONS FROM PROMPT forces LockedCode to surface places where it diverged from spec rather than silently substituting.
- LOCAL SMOKE TEST with literal command output is the audit trail proving the system actually works, not just that tests pass.
- FILES CREATED / MODIFIED / DELETED with line counts gives an unambiguous picture of code volume produced.
- JACOCO EXCLUSIONS catches the most common form of fake-100%-coverage cheating.
- NEXT RECOMMENDED PROMPT keeps momentum — there's never a "what now?" moment after a report lands.

### Example (illustrative)

```
PROMPT: PS-001
REPO: Pairion-Server
TASK: M0 Walking Skeleton
STATUS: complete

GIT COMMIT HASH: 7a3f9e1c4b8d2e5f6a9b8c7d6e5f4a3b2c1d0e9f
BRANCH: main
COMMITS IN THIS TASK: 1

MODULES CREATED:
  pairion-core:        yes
  pairion-adapters:    yes (SPI interfaces only — no implementations)
  pairion-household:   yes
  pairion-memory:      yes
  pairion-skills:      yes
  pairion-agent:       yes
  pairion-gateway:     yes (Spring Boot entry point)

REST ENDPOINTS:
  GET  /v1/health:                              implemented
  GET  /v1/version:                             implemented
  POST /v1/logs:                                implemented
  GET  /v1/household:                           stub
  ...

TESTS:
  Unit tests:                                   42 pass
  Integration tests:                            18 pass
  Total:                                        60
  Line coverage (project-wide):                 100%
  Branch coverage (project-wide):               100%

JACOCO EXCLUSIONS:
  ai.pairion.gateway.api.*:                     OpenAPI generator output
  ai.pairion.gateway.model.*:                   OpenAPI generator output

LOCAL VERIFICATION:
  mvn clean verify:                             pass
  Compilation warnings:                         none

DEVIATIONS FROM PROMPT:
  None.

ISSUES ENCOUNTERED:
  None.

NEXT RECOMMENDED PROMPT:
  PC-001 for the Client walking skeleton.
```

### Position in the prompt

The template appears at **position 3 in the prompt**: after the STOP preamble and Goal, before Constraints and Acceptance Criteria. This positioning is deliberate. Earlier patterns placed the template at the end of the prompt as the closing instruction; that pattern reliably degraded into prose summaries because LockedCode wrote the work first and then summarized at the end. Putting the template up-front — with slots specific to this task — frames the work as "produce these specific outputs," which holds discipline better than "execute and summarize."

### How to enforce it in every prompt

The template is included literally and verbatim in every prompt's "## Report" section, with the specific fields populated for the task at hand. A task that creates 3 endpoints lists those 3 endpoints with `[implemented | stub | missing]` slots. A task that creates entities lists those entities. A task with no endpoints omits the REST ENDPOINTS section entirely (it is not relevant to that task).

The chat assistant (Reasoning LLM) writes the prompt with the template already populated for that task. LockedCode fills in the slots. There is no creative latitude — the slot is either filled with the right value or marked clearly as N/A.

### Pitfall this addresses

This rule was added because reports degraded across multiple tasks in the same session — early tasks produced detailed reports with full acceptance-criteria-by-criterion tables; later tasks produced one-paragraph summaries that elided most of what was actually built. Then reports degraded into markdown tables substituting for the per-line slot format. Then reports started omitting whole slots (GIT COMMIT HASH, DEVIATIONS, ISSUES) and the architect had to re-prompt to get them. Every LockedCode execution should produce reports of the same depth, regardless of how many tasks have come before. Reports that don't are rejected and re-run.

---

## 11.5 JaCoCo Coverage Exclusions (BINDING)

JaCoCo coverage exclusions in `pom.xml` are reserved for **generated code only**. Permitted patterns:

- OpenAPI-generator output (e.g., `<package>.api.*`, `<package>.model.*`)
- Other build-plugin-generated source roots that exist in the project (verified against `pom.xml`)

**Hand-written code is NEVER excluded from coverage.** This includes entities, repositories, services, controllers, configuration classes, filters, exception classes, validators — anything authored by the developer or by LockedCode. The 100% line and 100% branch coverage requirement applies to all hand-written code.

**Adding hand-written components to the JaCoCo exclude list to "achieve 100% coverage" is a foundational violation.** It is the same anti-pattern as commenting out a failing test — the metric improves but the code remains unverified. If a task introduces hand-written code that lacks tests, the resolution is to write the tests, not to exclude the code.

A task that adds hand-written code to the JaCoCo exclude list is non-conformant. The Task Completion Summary Template's `JACOCO EXCLUSIONS` slot lists every existing exclusion pattern with the reason for each. If the reason for any exclusion is anything other than "generated by <tool> from <source>," the architect rejects the task.

This rule was added in response to a real failure: a task introduced 11 hand-written household components, added them all to the JaCoCo exclude list rather than writing tests for them, and reported "100% coverage" — which was true only on the subset that wasn't excluded. The follow-up task to write the missing tests doubled the work that would have been needed to do the original task correctly.

---

## 12. Just-in-Time Prompt Drafting

After Phase 0's full prompt set is delivered up-front, **every subsequent prompt is drafted just-in-time**, one task at a time, by Reasoning LLM (the chat assistant) when the developer says "next."

Why JIT and not all at once:

- Each new prompt incorporates anything learned from the prior task's actual implementation. The architecture doc evolves; the audit doc evolves; the OpenAPI spec evolves. Drafting a prompt three weeks before it runs means drafting it from stale assumptions.
- Reasoning LLM can read the actual source files (audit, OpenAPI, architecture) before drafting the next prompt and ground the prompt in what really exists, not in what the Roadmap predicted.
- The developer can decide to insert new tasks, change priorities, or extend scope at any phase boundary without wasting drafted-but-not-run prompts.

The JIT cycle:

1. Developer reports the prior task's commit SHA and report.
2. Reasoning LLM reads the report, reads the current state of audit + architecture + openapi if relevant.
3. Reasoning LLM drafts the next prompt as a `.md` file, presents it for download.
4. Developer pastes into LockedCode, runs, reports back.

---

## 13. Source of Truth Discipline

This is the single most important pattern in the whole workflow. Both Reasoning LLM (the chat) and LockedCode work from the same verified source of truth, never from memory or inference.

For Reasoning LLM (the chat) drafting a prompt that touches a codebase:

1. Reasoning LLM must NOT proceed without the current audit, OpenAPI spec, and (where relevant) architecture document for every project the work touches. Before drafting any code-touching prompt for the first time in a session, Reasoning LLM requests these files explicitly.
2. The developer provides the files (uploaded to chat) and the filesystem paths they live at locally.
3. Reasoning LLM reads them and uses them as authoritative for entity names, field names, route paths, validation rules, etc.
4. Drafted prompts reference these files by their filesystem paths so LockedCode reads from the same source.

For LockedCode executing a prompt:

1. Every prompt's STOP preamble lists the source-of-truth files.
2. LockedCode reads them BEFORE writing any code.
3. If a file is missing, LockedCode STOPs and asks rather than inventing what should be there.
4. If the prompt and the source files conflict, the source files win.

This is what prevents "AI hallucination drift" — both ends of the workflow are anchored to the same verified facts on disk.

---

## 14. The "No Manual Operations" Rule

The developer never manually runs:

- `git` commands (clone, add, commit, push, branch, merge, mv, rm)
- Build commands (`mvn`, `npm`, `flutter`, `docker`, `cargo`, etc.)
- File operations (creating directories, moving files, deleting files)
- Editor operations (search-and-replace across files, formatting passes)
- Test runs

Every one of those operations is the responsibility of LockedCode, executing inside a prompt. If something needs to happen against the repo or filesystem, the way it happens is: someone (Reasoning LLM the assistant) writes a prompt; the developer pastes it into LockedCode; LockedCode does the work and reports the commit SHA.

When mid-flight cleanup is needed (rename files, remove a directory, sync a doc to authoritative version), it gets a small, named, surgical prompt — typically a `<TaskID><suffix>` like FS-001b or FS-001c — that does the cleanup as a real Git commit with an audit-document entry.

This rule is non-negotiable. Even "obviously trivial" manual operations break the audit trail and create state in the repo that Reasoning LLM (the chat) doesn't know about, leading to drift.

---

## 15. Common Pitfalls (and how to avoid them)

These are real failure modes from prior project execution. Each one cost real time at least once.

### Pitfall 1: Placeholder filenames in CONVENTIONS

Spell out concrete filenames in CONVENTIONS.md (`<Project>-Server-Architecture.md`), not generic placeholders (`<project name>-Architecture.md`). LockedCode will interpret placeholders by stripping them, producing unqualified filenames.

### Pitfall 2: Drafting every prompt up front

Don't. Phase 0 is the exception (the foundation is well-known). Phases 1+ are JIT.

### Pitfall 3: Running prompts sequentially without verifying each one

Wait for each prompt's report to come back green with a commit SHA before kicking off the next. Mistakes compound otherwise.

### Pitfall 4: Including code or examples in prompts

Don't. Even one-line snippets create ambiguity (does LockedCode use that exact line, or use it as a sketch?). Prompts state goals; LockedCode writes code.

### Pitfall 5: Manual file edits or terminal commands

Don't. Every change is a LockedCode prompt. The named-suffix pattern (FS-001b, FS-001c) makes this cheap.

### Pitfall 6: Letting source-of-truth drift

When a Charter or Architecture document changes in the chat conversation, that change must land in the actual repo via a LockedCode prompt before the next prompt that references the change runs. Otherwise LockedCode reads a stale copy and surfaces a discrepancy observation (best case) or silently produces wrong code (worst case).

### Pitfall 7: Sharing architecture across server and client

Don't. Two repos = two architectures. The contract between them is `openapi.yaml`, full stop.

### Pitfall 8: Treating the Roadmap as immutable

The Roadmap evolves. New phases get inserted, tasks get added within phases, scope expands. When this happens, renumber programmatically (script, not hand), update the Phase Overview table, and ensure the Charter reflects the same scope changes.

### Pitfall 9: Skipping Reasoning LLM.md

Without Reasoning LLM.md, every LockedCode session starts cold. The session has to be told everything from the prompt alone. Reasoning LLM.md is read automatically; it's where standing operating rules live so prompts can stay focused on their specific task.

### Pitfall 10: Letting test coverage slide "for now"

Don't. 100% mandatory means 100% mandatory. The moment a single uncovered line ships, the next task inherits a broken baseline and the discipline collapses. Tests in the same pass, every pass.

---

## 16. Project Kickoff Checklist

When starting a new project, the developer hands this `NewProjectSetup.md` to Reasoning LLM (the chat) along with:

1. **Project name** (one word, brandable; e.g., "Felra")
2. **One-paragraph product vision** (what is it, who is it for)
3. **Tech stack preferences** if non-default (otherwise Reasoning LLM infers reasonable defaults: Java 21 + Spring Boot + Postgres for server; Flutter for client; etc.)
4. **Hardware/integration intent** if relevant (smart scales, wearables, sensors, third-party APIs)
5. **Audience and V1 scope** in rough form (audience size, deployment target, whether SaaS / self-hosted / Pi distribution / single-user)
6. **Existing repo URLs** if repos are pre-created, or a confirmation that Reasoning LLM should specify what GitHub orgs/names to create

Reasoning LLM (the chat) then produces, in order:

1. **The Charter** (`<Project>-Charter.md`) — collaboratively iterated until the developer signs off
2. **The Roadmap** (`<Project>-Roadmap.md`) — derived from the Charter
3. **CONVENTIONS.md** — the standard developer conventions verbatim with project-specific filenames substituted in (no placeholders)
4. **The Phase 0 prompts** — FS-001 through FS-NNN for server, FC-001 through FC-NNN for client, drafted up-front

The developer creates the GitHub repos (manually, this is a one-time exception), drops Charter / Roadmap / CONVENTIONS into the appropriate repos, and pastes FS-001 into LockedCode. From that moment forward, every change is a LockedCode prompt.

---

## 17. Recap: What This Workflow Prevents

The patterns in this document exist to prevent specific failure modes encountered in prior work. **The most painful failures and their correctives are captured in §1.5 Lessons Learned (Mistakes That Must Never Repeat)** — read that section before drafting any prompt.

Common categories addressed:

- **Unsolicited additions** (CI, project-internal tracking, telemetry, license auto-inference) — prevented by §1's NEVER-ADD list. **See Lessons 1.5.1, 1.5.2, 1.5.8.**
- **Audit-document confusion** (placing audits in STOP preambles, asking LockedCode to update audits, deleting developer-generated audits) — prevented by §4 and §6. **See Lessons 1.5.2, 1.5.3, 1.5.4.**
- **Report degradation** (markdown table substitution, missing slots, prose summaries) — prevented by §11's strict enforcement. **See Lesson 1.5.5.**
- **Coverage cheating** (JaCoCo exclusions on hand-written code, scoping coverage claims to subsets) — prevented by §11.5. **See Lesson 1.5.6.**
- **Prompt density regression** (prose-style prompts that lead to hour-plus LockedCode executions) — prevented by §10's prompt-density rule. **See Lesson 1.5.7.**
- **Naming convention drift** (introducing FX-NNN prefixes, suffix variants without developer approval) — prevented by the match-past-project-naming rule in §10 critical rules. **See Lesson 1.5.9.**
- **Manual operations** (chat assistant suggesting `git rm`, manual file edits) — prevented by §14. **See Lesson 1.5.10.**
- **Hallucination drift** — prevented by source-of-truth discipline (§13) and the codebase-audit workflow (§6).
- **Stale prompts running against evolved source** — prevented by JIT prompt drafting (§12).
- **Filename-naming bugs** — prevented by concrete-not-placeholder filenames in CONVENTIONS (§4).
- **Cross-repo contract drift** — prevented by openapi.yaml as the single contract authority (§3, §8).

---

## 18. When to Update This Template

This template is itself a living document. When a new project surfaces a pattern that should be standard going forward, or a new pitfall is discovered the hard way, update this template and use the updated version on the next project.

**The most important update trigger:** when a session produces a new failure mode that wasn't already in §1.5 Lessons Learned, add it to §1.5 immediately — before the session ends, before the lesson is forgotten. Promises in chat ("this won't happen again") expire with the session; lessons in this template survive.

Other update triggers:

- A repeat correction across multiple projects (e.g., "every project has needed the same `prompts/` cleanup task — bake the no-prompts-in-repo rule into the very first prompt"). Bake it in.
- A new technology choice that becomes the developer's default (e.g., "Maven is now permanently retired in favor of Mill"). Update the CONVENTIONS template.
- A new file that turns out to be needed in every project (e.g., a `SECURITY.md` covering disclosure policy). Add it to §3.
- A new pitfall that costs real time. Add to §1.5 with the same structure: What happened → Why it happened → The discipline that prevents it.

The template is not a contract; it's a starting point. Each project may diverge for project-specific reasons. But divergence should be conscious, not accidental, and the template is what makes the divergences visible.
