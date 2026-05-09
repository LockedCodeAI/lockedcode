# opencode — Quality Scorecard

**Generated:** 2026-05-09T20:20:52Z
**Branch:** dev
**Commit:** dcdbdb218fafc4ce2d0495f90bf022a08fc51d80 Move schema utilities into core (#26565)

---
## Security (10 checks, max 20)

### SEC-01 Password hashing
Uses external OAuth (GitHub, Google) — no local password hashing. Cloud console auth is delegated.

### SEC-02 Auth token validation
Present: JWT validation via `@openauthjs/openauth` in console, Basic auth in server mode.
Uses OAuth tokens stored in auth.json.

### SEC-03 SQL injection prevention  
All DB queries use Drizzle ORM parameterized queries — no raw SQL string concatenation. PASS.

### SEC-04 CSRF protection
Not configured. Web app uses API tokens, not cookie-based sessions for driving agent.

### SEC-05 Rate limiting
Present in cloud console via MySQL rate limit tables (IpRateLimitTable, KeyRateLimitTable, ModelTpmRateLimitTable). Local agent has no rate limiting.

### SEC-06 Sensitive data logging
No instances found of logging credentials/passwords/tokens. PASS.

### SEC-07 Input validation
Extensive: Zod 4 validation throughout config parsing, tool parameters, and API request bodies. Effect Schema for typed data.

### SEC-08 Authorization checks
Server mode: Basic auth middleware. Cloud console: OAuth2 session + API key auth. Agent: permission rulesets per session.

### SEC-09 Secrets externalized
Secrets managed via SST Secrets (not committed), env vars, or auth.json (0600 perms). PASS.

### SEC-10 HTTPS/TLS enforcement
Cloudflare handles TLS at edge. No explicit HTTPS enforcement in config — assumed from Cloudflare termination.

**Security Score: 16/20** (CSRF and explicit HTTPS enforcement not configured — acceptable for local-first CLI tool)

## Data Integrity (8 checks, max 16)

| Check | Result | Score |
|-------|--------|-------|
| DI-01 Audit/timestamp fields | All models have time_created/time_updated via mixin | 2/2 |
| DI-02 Optimistic locking | Not implemented (SQLite local, no concurrent write conflicts expected) | 0/2 |
| DI-03 Cascade delete | 9 cascade definitions — all child tables cascade, 1 set-null | 2/2 |
| DI-04 Unique constraints | 18 unique indexes across Local SQLite + Console MySQL schemas | 2/2 |
| DI-05 Foreign key definitions | 10 FK references defined in schema | 2/2 |
| DI-06 Not-null constraints | 81 not-null constraints across all models | 2/2 |
| DI-07 Soft delete pattern | Not implemented (hard deletes only) | 0/2 |
| DI-08 Transaction boundaries | 0 detected — Drizzle ORM doesn't require explicit transaction wrapping for single queries. Effect's structured concurrency handles rollback. | 1/2 |

**Data Integrity Score: 11/16**

## API Quality (8 checks, max 16)

| Check | Result | Score |
|-------|--------|-------|
| API-01 Consistent error response | Effect HttpRouter error middleware catches all defects + ApiNotFoundError Schema.ErrorClass | 2/2 |
| API-02 Pagination | Not implemented — local agent lists sessions in-memory | 0/2 |
| API-03 Request validation | Zod + Effect Schema validation on all endpoints | 2/2 |
| API-04 HTTP status codes | 84 references to httpApiStatus/HttpServerResponse/status codes | 2/2 |
| API-05 API versioning | /api/v2 endpoints for session messages + Hono route versioning | 2/2 |
| API-06 Request logging | Structured logging via Log framework in server middleware | 2/2 |
| API-07 HATEOAS | Not implemented — not relevant for agent API | 0/2 |
| API-08 OpenAPI/Swagger | 64 references — hono-openapi package, OpenAPI JSON endpoint | 2/2 |

**API Quality Score: 12/16**

## Code Quality (11 checks, max 22)

| Check | Result | Score |
|-------|--------|-------|
| CQ-01 Dependency injection | 131 Effect Service/Layer references — strong DI pattern | 2/2 |
| CQ-02 Boilerplate reduction | 63 Schema.Class references — Effect Schema reduces DTO boilerplate | 2/2 |
| CQ-03 Debug prints in prod | ~20 legit console.log/error calls (CLI output, GitHub action UX). ~184 LSP stream plumbing (stdout/stderr pipes). Not debug artifacts. | 1/2 |
| CQ-04 Structured logging | 150 references — @opencode-ai/core/util/Log framework throughout | 2/2 |
| CQ-05 Constants extracted | 1552 `export const`/`as const` declarations — strong constant extraction | 2/2 |
| CQ-06 DTOs separate from domain | Models = DTOs (Drizzle schema types are the API types). No separate DTO layer. | 1/2 |
| CQ-07 Service/business-logic layer | Effect Service pattern throughout (Context.Tag + Layer) — but not named *Service conventionally | 2/2 |
| CQ-08 Data access layer | Inline in services (Drizzle ORM queries), no Repository abstraction | 1/2 |
| CQ-09 Doc comments on classes/modules | BLOCKING — partial coverage. Effect services use `@opencode/Name` tag names but many lack TSDoc descriptions. See below. | 1/2 |
| CQ-10 No dead code | Not fully verified — some TODO markers indicate incomplete paths | 1/2 |
| CQ-11 Test coverage | Bun test suite exists but 100% coverage not verified | 1/2 |

**Doc coverage detail:** Effect Services use `Context.Service<Service, Interface>()("@opencode/Name")` pattern. Many have the tag string as doc, but few have TSDoc `/** */` blocks above class declarations or methods. Estimated coverage: ~40% of classes documented.

**Code Quality Score: 16/22**

---

## Overall Score

| Category | Score | Max | Percentage |
|----------|-------|-----|------------|
| Security | 16 | 20 | 80% |
| Data Integrity | 11 | 16 | 69% |
| API Quality | 12 | 16 | 75% |
| Code Quality | 16 | 22 | 73% |
| **Total** | **55** | **74** | **74%** |

### Key Strengths
- Strong Effect-ts dependency injection pattern (131 services)
- Comprehensive schema coverage with constraints, FKs, indexes
- Extensive LLM provider support (18+ providers)
- Structured logging throughout
- Zod/Effect Schema validation on all API boundaries
- Well-organized monorepo with Turborepo orchestration

### Key Weaknesses (BLOCKING)
- **TODO/FIXME markers in production code** (31 in core) — especially critical: Copilot SDK type safety gap (`MUST FIX`), v2 migration dual-write (12+ sites), and acknowledged inefficient transform
- **Snyk security scan not authenticated** — no vulnerability data available
- **No soft delete** on any model (irreversible data loss on cascade deletes)
- **Doc comment coverage < 100%** — BLOCKING per template requirements
- **No pagination** on session listing endpoints
- **No cache layer** — all reads hit SQLite directly
- **No dedicated health check endpoint** in server mode

### Recommended Actions (Priority Order)
1. Authenticate Snyk and resolve any dependency vulnerabilities
2. Address critical TODO markers (Copilot type safety, inefficient transform)
3. Complete v2 session migration and remove dual-write code
4. Add TSDoc comments to all Effect Service classes and public methods
5. Investigate soft delete for audit-critical models (Session, Message)
