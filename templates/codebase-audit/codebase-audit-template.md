# Codebase Audit — Prompt Template

**Usage:** Copy this template, replace `{{PROJECT_NAME}}` and `{{PROJECT_ROOT}}` with actual values, and run as a OpenCode prompt. This produces the codebase audit and quality scorecard. **Run the separate OpenAPI-Template.md to generate the API specification.**

**When to run this audit:** Run after completing any feature, major change, or new development track — any time the codebase's shape has changed (new types, endpoints, method signatures, configuration, dependencies, or schema changes). Do not run after minor fixes like typo corrections, doc-comment additions, or cosmetic refactoring. When in doubt, re-audit.

**This template produces two files:**
1. `<ProjectName>-Audit.md` — The codebase reference (loaded into coding sessions)
2. `<ProjectName>-Scorecard.md` — Quality assessment (NOT loaded into coding sessions)

**The OpenAPI spec is generated separately** using `OpenAPI-Template.md` to avoid context limit issues on large codebases.

---

## Language / Ecosystem Neutrality

This template is **language-agnostic**. It covers Java/Kotlin, TypeScript/JavaScript, Dart/Flutter, Python, Go, Rust, C/C++, C#/.NET, Swift, and any other language. Where a section says "entity," "service," or "controller," adapt the terminology to your ecosystem (e.g., "model" in Django, "handler" in Go, "resource" in Rust/Actix). The audit's job is to describe what exists in the codebase, using whatever vocabulary the codebase itself uses.

**Documentation comment standards by language:**

| Language | Format | Example |
|---|---|---|
| Java/Kotlin | Javadoc `/** */` | `/** Handles user registration. */` |
| TypeScript/JavaScript | TSDoc/JSDoc `/** */` | `/** Handles user registration. */` |
| Dart | DartDoc `///` | `/// Handles user registration.` |
| Python | Docstrings `"""` | `"""Handles user registration."""` |
| Rust | Doc comments `///` or `//!` | `/// Handles user registration.` |
| Go | Godoc `//` (before declaration) | `// RegisterUser handles user registration.` |
| C/C++ | Doxygen `/** */` or `///` | `/** Handles user registration. */` |
| C#/.NET | XML Doc `/// <summary>` | `/// <summary>Handles user registration.</summary>` |
| Swift | DocC `///` or `/** */` | `/// Handles user registration.` |

---

## ⚠️ OUTPUT STRATEGY — READ THIS BEFORE WRITING ANYTHING

**Large codebases will exceed OpenCode's maximum output token limit if the entire audit is written in a single response.** To prevent silent truncation or hard failures, you MUST write the audit file section by section using shell append commands. **Never buffer the full audit in memory and emit it all at once.**

### Required section-by-section write pattern

After completing each numbered section (1 through 22), immediately write it to disk before moving to the next section:

```bash
# Initialize the file (run ONCE at start, after deleting old files)
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"
cat > "$AUDIT_FILE" << 'HEADER'
# ProjectName — Codebase Audit
... (header block)
HEADER

# Then for EVERY section, append immediately after completing it:
cat >> "$AUDIT_FILE" << 'SECTION'
### 1. Project Identity
... (section content)
SECTION

# Confirm the write succeeded before continuing:
echo "✓ Section N written — $(wc -l < "$AUDIT_FILE") lines so far"
```

**Rules for section-by-section writing:**
- Write each section to disk immediately after gathering its data — do not wait until the end.
- Use `cat >> "$AUDIT_FILE"` (append, not overwrite) for every section after the first.
- After every write, echo the running line count as confirmation.
- If a section produces very large bash output (e.g., full file trees, Snyk JSON), pipe it directly into the file: `some-command >> "$AUDIT_FILE"`.
- The scorecard file (`*-Scorecard.md`) follows the same pattern — write each category block immediately after running its checks.
- **Never attempt to write more than one section at a time in a single output block.**

---

**Context budget awareness:** This audit will be loaded into OpenCode sessions alongside the OpenAPI spec, architecture doc, and CONVENTIONS.md. Every token matters. Follow these rules:
- **Never reproduce full configuration file contents.** Summarize key values and note the filesystem path.
- **Never reproduce full source file contents** unless the section specifically requires field-level detail (entities/models, enums, repositories/data-access, services, security).
- **Keep narratives to 1-2 sentences per section.** Avoid preamble, rationale, or explanations.
- **Do NOT document API request/response schemas here.** Those belong in the OpenAPI spec.

---

## Instructions

You are producing a comprehensive audit of the `{{PROJECT_NAME}}` codebase. This audit will be consumed by an AI (Reasoning LLM) in a separate session with ZERO prior context. That AI will use this audit alongside the separately-generated OpenAPI spec as its source of truth.

**This audit handles:** data models, relationships, data-access layer, business logic, security, patterns, configuration, and infrastructure.

**The OpenAPI spec handles:** endpoints, DTOs/request-response types, and API contracts.

### CRITICAL — Delete Existing Audit Files Before Starting

Previous audit files may be stale, incomplete, or wrong. You MUST delete them and regenerate from scratch by reading the actual codebase.

**Run this FIRST, before anything else:**

```bash
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"
SCORECARD_FILE="${PROJECT_DIR}-Scorecard.md"

echo "=== CLEARING PREVIOUS AUDIT ARTIFACTS ==="
[ -f "$AUDIT_FILE" ] && rm -v "$AUDIT_FILE" || echo "No existing audit file"
[ -f "$SCORECARD_FILE" ] && rm -v "$SCORECARD_FILE" || echo "No existing scorecard file"
echo "=== STARTING FRESH AUDIT ==="
```

**Do NOT skip this step. Do NOT read existing audit files for "reference." Every section must be generated by reading actual source files on disk.**

**Rules:**
- `cat` every file before documenting it. Never describe a file from memory.
- Never read or reference a previous audit file. Build everything from source.
- Include actual method/function signatures, field names, types, and annotations/attributes/decorators — not paraphrases.
- If a pattern is used inconsistently, document both the pattern and the inconsistencies.
- Run the application and verify what you document where possible.
- **Flag any TODO/FIXME/placeholder/stub patterns as CRITICAL technical debt.** These indicate incomplete code. A TODO is a lie that says "done" when it isn't.
- **Snyk CLI is required** for the security vulnerability scan (Section 22). Install via `npm install -g snyk` and authenticate via `snyk auth` or `SNYK_TOKEN` env var. If Snyk is unavailable, document the skip but flag it as a gap.
- **100% test coverage is mandatory** for both unit and integration tests. Coverage below 100% is a BLOCKING issue.
- **100% documentation coverage is mandatory** on all classes/modules and all public methods/functions. Every language uses its standard doc format (see table above). DTOs, entities/models, and generated code are excluded. Missing docs are a BLOCKING issue.

---

## Audit Sections

Produce the audit as a Markdown file named `<project-directory-name>-Audit.md` in the project root, written **section by section** using shell append commands (see OUTPUT STRATEGY above). The quality scorecard goes alongside it as `<project-directory-name>-Scorecard.md`, also written category by category.

**After completing each section below, immediately append it to the audit file. Do not proceed to the next section until the current one is written to disk.**

---

### 1. Project Identity

```
Project Name:
Repository URL:
Primary Language / Framework:
Language/Runtime Version:
Build Tool + Version:
Package Manager:
Current Branch:
Latest Commit Hash:
Latest Commit Message:
Audit Timestamp:
```

Run:
```bash
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git log -1 --format='%H %s')"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Detect the language/runtime version from whichever applies:
```bash
# Detect what's present and report versions
java --version 2>/dev/null | head -1 || true
node --version 2>/dev/null || true
python3 --version 2>/dev/null || true
go version 2>/dev/null || true
rustc --version 2>/dev/null || true
dart --version 2>/dev/null || true
flutter --version 2>/dev/null | head -1 || true
dotnet --version 2>/dev/null || true
swift --version 2>/dev/null | head -1 || true
gcc --version 2>/dev/null | head -1 || true
g++ --version 2>/dev/null | head -1 || true
```

---

### 2. Directory Structure

Run:
```bash
find . -type f \( \
  -name "*.java" -o -name "*.kt" -o -name "*.scala" \
  -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
  -o -name "*.py" \
  -o -name "*.go" \
  -o -name "*.rs" \
  -o -name "*.dart" \
  -o -name "*.c" -o -name "*.cpp" -o -name "*.cc" -o -name "*.h" -o -name "*.hpp" \
  -o -name "*.cs" \
  -o -name "*.swift" \
  -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.toml" -o -name "*.xml" \
  -o -name "*.md" \
  -o -name "*.proto" \
  -o -name "Makefile" -o -name "CMakeLists.txt" -o -name "meson.build" \
  -o -name "Dockerfile" -o -name "docker-compose*.yml" \
\) | grep -v node_modules | grep -v target | grep -v build | grep -v .git | grep -v __pycache__ | grep -v .dart_tool | grep -v obj | grep -v bin | grep -v .venv | grep -v vendor | sort
```

Present the full file tree. Then provide a 1-2 sentence narrative summary of the project layout (source location, single module vs multi-module, key directories).

> **✍️ WRITE NOW:** Append Section 2 to `$AUDIT_FILE` before continuing to Section 3.

---

### 3. Build & Dependency Manifest

**`cat` the build/dependency file(s).** Identify which applies:

| Ecosystem | Build/Dependency Files |
|---|---|
| Java/Kotlin (Maven) | `pom.xml` |
| Java/Kotlin (Gradle) | `build.gradle`, `build.gradle.kts`, `settings.gradle` |
| TypeScript/JavaScript | `package.json`, `tsconfig.json` |
| Python | `pyproject.toml`, `setup.py`, `requirements.txt`, `Pipfile` |
| Go | `go.mod`, `go.sum` |
| Rust | `Cargo.toml`, `Cargo.lock` |
| Dart/Flutter | `pubspec.yaml` |
| C/C++ (CMake) | `CMakeLists.txt`, `conanfile.txt`, `vcpkg.json` |
| C/C++ (Meson) | `meson.build` |
| C/C++ (Make) | `Makefile` |
| C#/.NET | `*.csproj`, `*.sln`, `Directory.Build.props` |
| Swift | `Package.swift` |

Document every dependency:

| Dependency | Version | Purpose |
|---|---|---|
| (actual name) | (actual version) | (what it's used for) |

Document every build plugin/tool and its configuration.

Document build commands:
```
Build: (actual command)
Test: (actual command)
Run: (actual command)
Package: (actual command)
```

> **✍️ WRITE NOW:** Append Section 3 to `$AUDIT_FILE` before continuing to Section 4.

---

### 4. Configuration & Infrastructure Summary

**Do NOT reproduce full configuration file contents.** OpenCode reads files from disk. Instead, for each config file, provide:

1. **File path** (so OpenCode can `cat` it when needed)
2. **Key facts** — ports, profiles/environments, external service connections, feature flags
3. **What varies by environment** — hardcoded vs environment variable

**Required annotations (1-3 sentences each):**

Identify and annotate all configuration files present in the project. Common examples by ecosystem:

| Ecosystem | Typical Config Files |
|---|---|
| Java/Spring | `application.yml`, `application-*.yml`, `logback-spring.xml` |
| Node/TS | `.env`, `.env.*`, `config/*.ts`, `nest-cli.json` |
| Python/Django | `settings.py`, `settings/*.py`, `.env` |
| Python/FastAPI | `.env`, `config.py` |
| Go | `.env`, `config.yaml`, `config/*.go` |
| Rust | `.env`, `config.toml`, `Rocket.toml`, `Settings.toml` |
| Dart/Flutter | `.env`, `firebase_options.dart`, `build.yaml` |
| C/C++ | `.env`, config headers, CMake cache files |
| C#/.NET | `appsettings.json`, `appsettings.*.json`, `launchSettings.json` |

Also annotate if present: `docker-compose.yml`, `Dockerfile`, `.env` / `.env.example` (note if `.env` is in `.gitignore`).

**Connection map:**
```
Database: (type, host, port, database name) or "None"
Cache: (type, host, port) or "None"
Message Broker: (type, host, port) or "None"
External APIs: (list all outbound HTTP calls)
Cloud Services: (S3, SES, KMS, etc.) or "None"
```

**CI/CD:** Note whether pipeline config exists (.github/workflows, Jenkinsfile, .gitlab-ci.yml, etc.) or state "None detected."

> **✍️ WRITE NOW:** Append Section 4 to `$AUDIT_FILE` before continuing to Section 5.

---

### 5. Startup & Runtime Behavior

Document the application startup sequence:
- Entry point (main function, main class, app factory, root module)
- What initializes on startup (migrations, seed data, health checks, connection pools, dependency injection container setup)
- Scheduled tasks, background jobs, workers, or cron-like processes
- Health check endpoint and expected response

Run the application if possible and capture startup behavior.

> **✍️ WRITE NOW:** Append Section 5 to `$AUDIT_FILE` before continuing to Section 6.

---

### 6. Data Model / Entity Layer

**For every data model, entity, or domain struct**, `cat` the file and document:

```
=== ModelName (file: path/to/file.ext) ===
Table/Collection: (actual storage name — from annotation, attribute, or convention)
Primary Key: (field name, type, generation strategy)

Fields:
  - fieldName: Type [decorators/annotations/attributes] (nullable? indexed? unique?)
  ...

Relationships:
  - hasMany → TargetModel (via field, cascade behavior, lazy/eager)
  - belongsTo → TargetModel (via foreign key column/field)
  ...

Audit Fields: (createdAt, updatedAt, createdBy, version — note if missing)

Validation: (list validation rules — annotations, decorators, validators, constraints)

Custom Methods: (any business logic methods beyond simple accessors)
```

Adapt the relationship notation to the framework's vocabulary. Examples:
- JPA: `@OneToMany`, `@ManyToOne`, `@JoinColumn`, `cascade`, `fetch`
- Django: `ForeignKey`, `ManyToManyField`, `on_delete`
- SQLAlchemy: `relationship()`, `ForeignKey`, `backref`
- TypeORM: `@OneToMany`, `@ManyToOne`, `@JoinColumn`
- Prisma: model relations in schema
- ActiveRecord: `has_many`, `belongs_to`
- GORM (Go): `gorm:"foreignKey:..."`, `has many`, `belongs to`
- Diesel (Rust): `#[belongs_to]`, `Associations`
- Dart/Drift: `@ReferenceName`, table definitions

> **✍️ WRITE NOW:** Append Section 6 to `$AUDIT_FILE` before continuing to Section 7. Section 6 is often the largest — if the model count is high, write each model's block to disk as you complete it rather than batching them all.

---

### 7. Enum / Constant Inventory

**For every enum, enum-like type, or constants module**, `cat` the file and document:

```
=== EnumName (file: path/to/file.ext) ===
Values: VALUE_1, VALUE_2, VALUE_3
Used in: (list models/DTOs that reference this enum)
Has display label: YES/NO (note if it has a human-readable label field)
Serialization: (string name, ordinal, custom value — how it serializes to/from JSON/DB)
```

> **✍️ WRITE NOW:** Append Section 7 to `$AUDIT_FILE` before continuing to Section 8.

---

### 8. Data Access / Repository Layer

**For every repository, DAO, query module, or data-access component**, `cat` the file and document:

```
=== ModelNameRepository (file: path/to/file.ext) ===
Model: ModelName
Extends/Implements: (base class or interface — JpaRepository, CrudRepository, BaseManager, custom trait, etc.)

Custom Queries/Methods:
  - findByField(field: Type): ReturnType
  - customQuery(...): ReturnType  [raw SQL / query builder / ORM query]
  ...

Eager Loading Hints: (entity graphs, select_related, includes, preloads, etc.)
Projections/Partial Selects: YES/NO (list if yes)
```

If the ecosystem doesn't use a separate repository layer (e.g., inline ORM queries in service/handler code), note "Data access is inline in service layer — see Section 9" and skip this section.

> **✍️ WRITE NOW:** Append Section 8 to `$AUDIT_FILE` before continuing to Section 9.

---

### 9. Service / Business Logic Layer — Full Method Signatures

**For every service, use-case, interactor, or business logic module**, `cat` the file and document:

```
=== ServiceName (file: path/to/file.ext) ===
Dependencies: (list all injected/imported dependencies — repositories, other services, clients)

Public Methods/Functions:
  - methodName(param: ParamType, param2: ParamType2): ReturnType
    Purpose: (one sentence)
    Calls: (list data-access methods / other services called)
    Throws/Returns errors: (list error types or error returns)
    Transactional: YES / NO (note transaction boundary mechanism)

Private/Internal Methods: (list signatures only, no detail needed)
```

**Document the actual implementation, not what you think it should do.**

> **✍️ WRITE NOW:** Append Section 9 to `$AUDIT_FILE` before continuing to Section 10. If service modules are numerous, write each service block individually to avoid buffering too much output.

---

### 10. Controller / Handler / Route Layer — Method Signatures Only

**Do NOT document request/response bodies, paths, or parameters here.** That's in the OpenAPI spec.

**For every controller, handler, route module, or API resource**, document only:

```
=== ControllerName (file: path/to/file.ext) ===
Base Path: /api/... (from route prefix, decorator, attribute, or router config)
Dependencies: (list injected services)

Endpoints: (handler name → service method called)
  - createEntity() → entityService.create()
  - getEntity() → entityService.findById()
  ...
```

> **✍️ WRITE NOW:** Append Section 10 to `$AUDIT_FILE` before continuing to Section 11.

---

### 11. Security Configuration

`cat` the security config file(s) and document:

```
Authentication: (JWT / Session / OAuth2 / Basic / API Key / mTLS / None)
Token issuer/validator: (internal / external identity provider / auth library)
Password hashing: (BCrypt rounds / Argon2 / scrypt / PBKDF2 / etc.) or "N/A — external auth"

Public endpoints (no auth required):
  - /api/auth/**
  - /api/public/**
  - /health
  ...

Protected endpoints (patterns):
  - /api/admin/** → ADMIN role
  - /api/** → authenticated
  ...

CORS: (origins, methods, headers allowed) or "N/A"

CSRF: (enabled / disabled, mechanism)

Rate limiting: (config or "None")
```

Adapt to the framework's security model. Examples of security mechanisms by ecosystem:
- Spring Security filter chain, `@PreAuthorize`
- Express/Nest middleware, guards, passport strategies
- Django `@login_required`, DRF permissions, middleware
- Go middleware (chi, gin, echo)
- Rust middleware (actix-web, axum extractors)
- ASP.NET `[Authorize]`, policies, Identity
- Dart shelf middleware, Firebase Auth

> **✍️ WRITE NOW:** Append Section 11 to `$AUDIT_FILE` before continuing to Section 12.

---

### 12. Custom Security Components

Document any custom authentication/authorization components:

```
=== AuthMiddleware / AuthFilter / AuthGuard (file: path/to/file.ext) ===
Type: (middleware, filter, guard, interceptor, extractor)
Purpose: (one sentence)
Extracts credentials from: (Header / Cookie / Query param / Bearer token)
Validates via: (service method / library call / external service)
Sets user context: YES/NO (how — request context, thread-local, async-local, etc.)
```

```
=== UserLookupService (file: path/to/file.ext) ===
Loads user by: (username / email / ID / external ID)
Returns: (user type or interface)
```

If no custom security components exist, document "No custom security components — uses framework defaults / external auth provider."

> **✍️ WRITE NOW:** Append Section 12 to `$AUDIT_FILE` before continuing to Section 13.

---

### 13. Exception / Error Handling

`cat` the global error handler and document:

```
=== GlobalErrorHandler (file: path/to/file.ext) ===
Mechanism: (middleware, exception filter, controller advice, error boundary, panic handler, Result-based)

Error Mappings:
  - NotFoundError → 404 (body structure: {...})
  - ValidationError → 400 (body structure: {...})
  - AuthorizationError → 403 (body structure: {...})
  - UnhandledError → 500 (body structure: {...})

Standard error response format:
{
  "timestamp": "...",
  "status": 400,
  "error": "Bad Request",
  "message": "...",
  "path": "/api/..."
}
```

Identify the mechanism used:
- Java/Spring: `@ControllerAdvice` + `@ExceptionHandler`
- Express/Nest: error middleware / exception filters
- Django: middleware / `handler400/403/404/500`
- Go: error returns + middleware
- Rust: `From<Error>` impls, error middleware, `ResponseError` trait
- C#/.NET: `UseExceptionHandler`, exception filters
- Dart/Shelf: middleware

> **✍️ WRITE NOW:** Append Section 13 to `$AUDIT_FILE` before continuing to Section 14.

---

### 14. Mappers / Data Transformation

**List data transformation components only.** DTO/request-response structures are documented in the OpenAPI spec.

```
=== ModelMapper (file: path/to/file.ext) ===
Framework/Approach: (MapStruct / AutoMapper / manual / serialization library / class-transformer / freezed)
Methods:
  - toDto(model): ModelDto
  - fromCreateRequest(dto): Model
  - updateModel(dto, existingModel): Model

Custom mappings: (list any non-trivial field transformations)
```

If the codebase uses direct serialization (e.g., Rust serde, Go json tags, Python Pydantic) without a separate mapper layer, note "No dedicated mapper layer — serialization handled by [library/framework] annotations/attributes on model/DTO types."

> **✍️ WRITE NOW:** Append Section 14 to `$AUDIT_FILE` before continuing to Section 15.

---

### 15. Utility Modules & Shared Components

Document any utilities, helpers, or shared libraries used across the codebase:

```
=== DateUtils (file: path/to/file.ext) ===
Functions:
  - formatIso(datetime): String
  - parseIso(input): DateTime
Used by: (list services/handlers)

=== SlugGenerator (file: path/to/file.ext) ===
Functions:
  - generate(title: String): String (algorithm: lowercase, replace spaces with hyphens, etc.)
```

> **✍️ WRITE NOW:** Append Section 15 to `$AUDIT_FILE` before continuing to Section 16.

---

### 16. Database Schema (Live)

If the application uses a database, connect and dump the actual schema:

```bash
# PostgreSQL
docker exec -i $(docker ps -qf "name=postgres") psql -U postgres -d dbname -c "\dt" 2>/dev/null || echo "PostgreSQL not available"
docker exec -i $(docker ps -qf "name=postgres") psql -U postgres -d dbname -c "\d+ tablename" 2>/dev/null

# MySQL / MariaDB
docker exec -i $(docker ps -qf "name=mysql") mysql -u root -p -e "SHOW TABLES; DESCRIBE tablename;" dbname 2>/dev/null || echo "MySQL not available"

# SQLite
sqlite3 path/to/db.sqlite ".tables" 2>/dev/null || echo "SQLite not available"
sqlite3 path/to/db.sqlite ".schema tablename" 2>/dev/null

# MongoDB (collections and indexes)
docker exec -i $(docker ps -qf "name=mongo") mongosh dbname --eval "db.getCollectionNames(); db.collectionname.getIndexes()" 2>/dev/null || echo "MongoDB not available"
```

Document:
- Actual table/collection names (may differ from model names)
- Actual column types and constraints
- Indexes
- Foreign key constraints
- Any schema drift from model definitions

If no database or database is not running: Document "Database not available for live schema check."

> **✍️ WRITE NOW:** Append Section 16 to `$AUDIT_FILE` before continuing to Section 17. Pipe large schema dumps directly: `docker exec ... >> "$AUDIT_FILE"`

---

### 17. Message Broker Configuration (if applicable)

```bash
# Search for message broker usage across common ecosystems
grep -rn "amqp\|rabbitmq\|kafka\|@RabbitListener\|@KafkaListener\|bull\|BullModule\|celery\|nats\|pulsar\|zmq\|lapin\|rdkafka\|AMQP\|SQS\|SNS\|EventBridge\|Pub/Sub\|pubsub" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  --include="*.yml" --include="*.yaml" --include="*.toml" --include="*.json" --include="*.properties" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | head -40
```

If message broker is used:
```
Broker: RabbitMQ / Kafka / NATS / Redis Streams / SQS / Pub/Sub / ZeroMQ / None
Connection: (host, port, vhost/topic)

Exchanges/Topics:
  - exchange.name (type: direct/fanout/topic)
    Bindings: queue.name → routing.key

Queues/Consumers:
  - queue.name
    Consumer: ConsumerModule.handlerMethod()
    Message type: MessageSchema
    Ack mode: AUTO / MANUAL

Publishers:
  - ProducerService.publishMethod()
    Publishes to: exchange.name / routing.key
    Message type: MessageSchema
```

If no message broker: Document "No message broker detected."

> **✍️ WRITE NOW:** Append Section 17 to `$AUDIT_FILE` before continuing to Section 18.

---

### 18. Cache Layer (if applicable)

```bash
# Search for cache usage across common ecosystems
grep -rn "redis\|memcache\|@Cacheable\|@CacheEvict\|CacheManager\|cache_page\|lru_cache\|memoize\|caffeine\|ehcache\|node-cache\|ioredis\|cache-manager\|cached\|Cached\|CACHE" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  --include="*.yml" --include="*.yaml" --include="*.toml" --include="*.json" --include="*.properties" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | head -30
```

If cache is used:
```
Cache Provider: Redis / Memcached / Caffeine / EhCache / In-Memory / None
Connection: (host, port, database) or "In-memory / in-process"

Cache Regions/Keys:
  - cacheName
    TTL: (duration)
    Used by: Module.method()
    Key pattern: (how keys are generated)

Cache Operations:
  - Write-through/behind on method() — caches result
  - Invalidation on updateMethod() — evicts keys
```

If no caching: Document "No caching layer detected."

> **✍️ WRITE NOW:** Append Section 18 to `$AUDIT_FILE` before continuing to Section 19.

---

### 19. Environment Variable Inventory

```bash
# Extract environment variable references — adapt patterns per ecosystem
# Config files
grep -rhn '\${[A-Z_]*}\|process\.env\.\|os\.environ\|os\.Getenv\|env::var\|env!\|Environment\.GetEnvironmentVariable\|Platform\.environment\|dotenv' \
  --include="*.yml" --include="*.yaml" --include="*.properties" --include="*.toml" --include="*.json" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | sort -u | head -50
```

Document:
```
Variable | Used In | Default | Required in Prod
---------|---------|---------|------------------
DB_HOST | config file | localhost | YES
JWT_SECRET | auth module | (none) | YES
SMTP_HOST | notification config | (none) | NO (optional feature)
```

> **✍️ WRITE NOW:** Append Section 19 to `$AUDIT_FILE` before continuing to Section 20.

---

### 20. Service Dependency Map

Document all external service dependencies:

```
This Service → Depends On
--------------------------
API Gateway: (URL, auth method)
Identity Service: (URL, endpoints called)
Notification Service: (URL, endpoints called)
External APIs: (list with URLs and purposes)

Downstream Consumers (services that call this one):
- ServiceName (endpoints they call)
```

If standalone: Document "Standalone service — no inter-service dependencies."

> **✍️ WRITE NOW:** Append Section 20 to `$AUDIT_FILE` before continuing to Section 21.

---

### 21. Known Technical Debt & Issues

**CRITICAL — TODO/Placeholder/Stub Scan**

Run this scan FIRST. Any hits are **BLOCKING ISSUES** that must be documented:

```bash
echo "=== TODO/PLACEHOLDER/STUB SCAN ==="
echo "Scanning for incomplete implementations..."

# Universal markers
grep -rn "TODO\|FIXME\|XXX\|HACK\|TEMP\|TEMPORARY" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.py" --include="*.go" --include="*.rs" --include="*.c" --include="*.cpp" --include="*.h" --include="*.hpp" \
  --include="*.cs" --include="*.dart" --include="*.swift" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -iv test | grep -iv spec

# Placeholder / not-implemented patterns
grep -rn "placeholder\|not yet implemented\|not implemented\|stub\|stubbed" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.py" --include="*.go" --include="*.rs" --include="*.c" --include="*.cpp" --include="*.h" --include="*.hpp" \
  --include="*.cs" --include="*.dart" --include="*.swift" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | grep -iv test | grep -iv spec

# Language-specific "not implemented" throws/panics
grep -rn "throw.*UnsupportedOperationException\|throw.*NotImplementedError\|raise NotImplementedError\|todo!()\|unimplemented!()\|panic(\"not implemented\")\|throw new NotImplementedException\|pass  #.*todo\|fatalError(\"not implemented\")" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" --include="*.swift" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -iv test | grep -iv spec

echo "=== END SCAN ==="
```

**If ANY results are found:** Document each one in the table below with severity **CRITICAL**. These represent code that claims to be complete but isn't. A TODO is a lie that says "done" when it isn't.

Document all issues discovered during the audit:

```
Issue | Location | Severity | Notes
------|----------|----------|------
TODO: Queue async generation | service.ext:133 | CRITICAL | Function creates placeholder instead of real implementation
Missing index on frequently queried column | User.email | Medium | Add index
Inconsistent error response format | AdminHandler | Low | Doesn't use global error handler
N+1 query in listing endpoint | OrderService.findAll() | High | Add eager loading
Hardcoded secret in config | config.yml jwt.secret | Critical | Move to env var
```

> **✍️ WRITE NOW:** Append Section 21 to `$AUDIT_FILE` before continuing to Section 22.

---

### 22. Security Vulnerability Scan (Snyk CLI)

Run a Snyk security scan against the project. Snyk CLI must be installed (`npm install -g snyk`). If Snyk is not authenticated, run `snyk auth` first or set the `SNYK_TOKEN` environment variable.

**Run the scan:**

```bash
echo "=== SNYK SECURITY VULNERABILITY SCAN ==="

# Check Snyk is available
if ! command -v snyk &> /dev/null; then
  echo "Snyk CLI not installed. Install with: npm install -g snyk"
  echo "Then authenticate with: snyk auth"
  echo "SNYK SCAN: SKIPPED — CLI not available"
else
  echo "Snyk CLI version: $(snyk version)"

  # --- Open Source Dependency Scan ---
  echo ""
  echo "=== SNYK OPEN SOURCE (Dependency Vulnerabilities) ==="
  snyk test --json > /tmp/snyk-oss-results.json 2>/dev/null
  SNYK_OSS_EXIT=$?

  if [ $SNYK_OSS_EXIT -eq 0 ]; then
    echo "PASS — No known vulnerabilities in dependencies"
  elif [ $SNYK_OSS_EXIT -eq 1 ]; then
    echo "VULNERABILITIES FOUND in dependencies:"
    cat /tmp/snyk-oss-results.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
vulns = data.get('vulnerabilities', [])
summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
seen = set()
for v in vulns:
    vid = v.get('id', '')
    if vid not in seen:
        seen.add(vid)
        sev = v.get('severity', 'unknown')
        summary[sev] = summary.get(sev, 0) + 1
print(f\"  Critical: {summary['critical']}\")
print(f\"  High: {summary['high']}\")
print(f\"  Medium: {summary['medium']}\")
print(f\"  Low: {summary['low']}\")
print(f\"  Total unique: {len(seen)}\")
print()
for v in vulns:
    vid = v.get('id', '')
    if vid in seen:
        seen.discard(vid)
        sev = v.get('severity', 'unknown').upper()
        pkg = v.get('packageName', 'unknown')
        ver = v.get('version', '?')
        title = v.get('title', 'No title')
        fix = v.get('fixedIn', ['No fix available'])
        print(f\"  [{sev}] {pkg}@{ver} — {title}\")
        if fix and fix[0]:
            print(f\"    Fix: upgrade to {fix[0]}\")
" 2>/dev/null || echo "  (could not parse JSON — run 'snyk test' manually for details)"
  else
    echo "Snyk scan error (exit code $SNYK_OSS_EXIT) — check authentication or network"
    snyk test 2>&1 | tail -5
  fi

  # --- Code (SAST) Scan ---
  echo ""
  echo "=== SNYK CODE (Static Analysis / SAST) ==="
  snyk code test --json > /tmp/snyk-code-results.json 2>/dev/null
  SNYK_CODE_EXIT=$?

  if [ $SNYK_CODE_EXIT -eq 0 ]; then
    echo "PASS — No code vulnerabilities detected"
  elif [ $SNYK_CODE_EXIT -eq 1 ]; then
    echo "CODE VULNERABILITIES FOUND:"
    cat /tmp/snyk-code-results.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
runs = data.get('runs', [{}])
results = runs[0].get('results', []) if runs else []
summary = {'error': 0, 'warning': 0, 'note': 0}
for r in results:
    level = r.get('level', 'note')
    summary[level] = summary.get(level, 0) + 1
print(f\"  Errors (high severity): {summary.get('error', 0)}\")
print(f\"  Warnings (medium): {summary.get('warning', 0)}\")
print(f\"  Notes (low): {summary.get('note', 0)}\")
print()
for r in results:
    level = r.get('level', 'note').upper()
    msg = r.get('message', {}).get('text', 'No description')
    locs = r.get('locations', [{}])
    filepath = locs[0].get('physicalLocation', {}).get('artifactLocation', {}).get('uri', '?') if locs else '?'
    line = locs[0].get('physicalLocation', {}).get('region', {}).get('startLine', '?') if locs else '?'
    print(f\"  [{level}] {filepath}:{line} — {msg[:120]}\")
" 2>/dev/null || echo "  (could not parse JSON — run 'snyk code test' manually for details)"
  else
    echo "Snyk Code scan not available or error (exit code $SNYK_CODE_EXIT)"
    snyk code test 2>&1 | tail -3
  fi

  # --- IaC Scan (if Dockerfile/docker-compose/k8s present) ---
  if ls Dockerfile docker-compose*.yml k8s/ *.tf 2>/dev/null | head -1 > /dev/null 2>&1; then
    echo ""
    echo "=== SNYK IaC (Infrastructure as Code) ==="
    snyk iac test --json > /tmp/snyk-iac-results.json 2>/dev/null
    SNYK_IAC_EXIT=$?
    if [ $SNYK_IAC_EXIT -eq 0 ]; then
      echo "PASS — No IaC misconfigurations detected"
    elif [ $SNYK_IAC_EXIT -eq 1 ]; then
      echo "IaC ISSUES FOUND:"
      cat /tmp/snyk-iac-results.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for result in data if isinstance(data, list) else [data]:
    for infra in result.get('infrastructureAsCodeIssues', []):
        sev = infra.get('severity', 'unknown').upper()
        title = infra.get('title', 'No title')
        path = infra.get('cloudConfigPath', '?')
        print(f\"  [{sev}] {title} — {path}\")
" 2>/dev/null || echo "  (could not parse JSON — run 'snyk iac test' manually)"
    else
      echo "Snyk IaC scan not available (exit code $SNYK_IAC_EXIT)"
    fi
  fi

  # Cleanup
  rm -f /tmp/snyk-oss-results.json /tmp/snyk-code-results.json /tmp/snyk-iac-results.json

  echo ""
  echo "=== END SNYK SCAN ==="
fi
```

**Document findings in the audit file:**

```
## Security Vulnerability Scan (Snyk)

Scan Date: (timestamp)
Snyk CLI Version: (version)

### Dependency Vulnerabilities (Open Source)
Critical: (count)
High: (count)
Medium: (count)
Low: (count)

| Severity | Package | Version | Vulnerability | Fix Available |
|----------|---------|---------|---------------|---------------|
| CRITICAL | (name) | (ver) | (title) | (fix version or "No") |
| HIGH | (name) | (ver) | (title) | (fix version or "No") |

### Code Vulnerabilities (SAST)
Errors: (count)
Warnings: (count)

| Severity | File:Line | Description |
|----------|-----------|-------------|
| ERROR | (path:line) | (description) |
| WARNING | (path:line) | (description) |

### IaC Findings (if applicable)
| Severity | Issue | Config Path |
|----------|-------|-------------|
| (sev) | (title) | (path) |
```

**Any CRITICAL or HIGH Snyk findings are BLOCKING ISSUES** and must also be added to Section 21 (Known Technical Debt & Issues) with severity CRITICAL.

> **✍️ WRITE NOW:** Append Section 22 to `$AUDIT_FILE`. This completes the audit body. The next steps are the Quality Scorecard (written to `$SCORECARD_FILE`) and Verification.

---

### Application Flows Visualization

Using the data and your current understanding of the project from this audit, now document and describe the main flows in this app and output in a single page html + json data file.  

PROJECT_DIR=$(basename "$(pwd)")
HTML_VISUALIZATION="${PROJECT_DIR}-Flows-Visualization.html"




---


## Quality Scorecard

After completing the audit and the application flows visualization, generate a separate `<project-directory-name>-Scorecard.md` file with quantified quality metrics. **This file is NOT loaded into coding sessions** — it's for project health tracking only.

**Initialize the scorecard file first:**
```bash
PROJECT_DIR=$(basename "$(pwd)")
SCORECARD_FILE="${PROJECT_DIR}-Scorecard.md"
cat > "$SCORECARD_FILE" << HEADER
# ${PROJECT_DIR} — Quality Scorecard

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Branch:** $(git branch --show-current)
**Commit:** $(git log -1 --format='%H %s')

---
HEADER
echo "✓ Scorecard file initialized"
```

**Write each category to `$SCORECARD_FILE` immediately after running its checks** using `cat >> "$SCORECARD_FILE"`. Do not buffer all categories and write at the end.

Run these automated checks:

### Security (10 checks, max 20)

The scorecard checks below must be adapted to the codebase's language and framework. The check descriptions are universal; the grep patterns are examples. **For each check, use patterns appropriate to the detected ecosystem.**

```bash
echo "=== SECURITY CHECKS ==="

# Detect primary source directories
SRC_DIRS=$(find . -type d \( -name "src" -o -name "lib" -o -name "app" -o -name "cmd" -o -name "internal" -o -name "pkg" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" 2>/dev/null | head -5 | tr '\n' ' ')
SRC_GLOB="--include=*.java --include=*.kt --include=*.ts --include=*.js --include=*.py --include=*.go --include=*.rs --include=*.cs --include=*.dart --include=*.swift --include=*.c --include=*.cpp --include=*.h --include=*.hpp"
CONF_GLOB="--include=*.yml --include=*.yaml --include=*.toml --include=*.json --include=*.properties --include=*.xml"

echo -n "SEC-01 Password hashing (BCrypt/Argon2/scrypt/PBKDF2): "
grep -rn "BCrypt\|Argon2\|scrypt\|PBKDF2\|PasswordEncoder\|password_hash\|bcrypt\|argon2\|pbkdf2\|hash_password\|HashPassword\|generate_password_hash" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-02 Auth token validation: "
grep -rn "signWith\|parseClaimsJws\|validateToken\|verify_token\|jwt\.verify\|jwt\.decode\|jsonwebtoken\|decode_token\|ValidateToken\|Claims\|token_verify\|verify_jwt" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-03 SQL injection prevention (no string concat in queries): "
grep -rn '"SELECT.*" +\|"INSERT.*" +\|"UPDATE.*" +\|"DELETE.*" +\|f"SELECT\|f"INSERT\|f"UPDATE\|f"DELETE\|format!(.*SELECT\|String\.format.*SELECT' $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "SEC-04 CSRF protection: "
grep -rn "csrf\|CSRF\|antiforgery\|AntiForgery\|CSRFProtect\|@csrf_exempt\|csurf" $SRC_GLOB $CONF_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-05 Rate limiting configured: "
grep -rn "RateLimiter\|@RateLimit\|rate.limit\|throttle\|Throttle\|rate_limit\|ratelimit\|bucket4j\|express-rate-limit\|slowapi\|governor" $SRC_GLOB $CONF_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-06 Sensitive data logging prevented (should be 0): "
grep -rn "password\|secret\|token\|api_key\|apiKey" $SRC_GLOB . 2>/dev/null | grep -iv "test\|spec\|mock" | grep -i "log\.\|logger\.\|console\.log\|println\|print(" | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-07 Input validation on endpoints: "
grep -rn "@Valid\|@Validated\|class-validator\|ValidationPipe\|validate\|validator\|pydantic\|Validate\|DataAnnotations\|validate_params" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "SEC-08 Authorization checks on protected endpoints: "
grep -rn "@PreAuthorize\|@Secured\|hasRole\|hasAuthority\|@Authorize\|@UseGuards\|@login_required\|permission_required\|Roles\|authorize\|RequireAuth\|requires_auth\|middleware.*auth" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "SEC-09 Secrets externalized (hardcoded passwords in config — should be 0): "
grep -rn "password.*=.*['\"].*[a-zA-Z0-9]\|secret.*=.*['\"].*[a-zA-Z0-9]" $CONF_GLOB . 2>/dev/null | grep -v '\${' | grep -v "process\.env" | grep -v "os\.environ" | grep -v "env::var" | grep -v node_modules | grep -v target | wc -l

echo -n "SEC-10 HTTPS/TLS enforcement: "
grep -rn "require-ssl\|https\|TLS\|ssl\|force_ssl\|SECURE_SSL_REDIRECT\|UseHttpsRedirection" $CONF_GLOB $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v "http://" | wc -l
```

> **✍️ WRITE NOW:** Run the above checks, then append the Security category results to `$SCORECARD_FILE` before running Data Integrity checks.

### Data Integrity (8 checks, max 16)

```bash
echo "=== DATA INTEGRITY CHECKS ==="

echo -n "DI-01 Models have audit/timestamp fields: "
grep -rln "createdAt\|created_at\|updatedAt\|updated_at\|@CreatedDate\|@LastModifiedDate\|auto_now_add\|auto_now\|timestamps()\|CreatedAt\|UpdatedAt\|inserted_at\|DEFAULT CURRENT_TIMESTAMP" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-02 Optimistic locking / versioning: "
grep -rn "@Version\|version.*column\|lock_version\|optimistic_lock\|OptimisticLock\|RowVersion\|ConcurrencyCheck" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-03 Cascade delete protection (review these): "
grep -rn "CascadeType.ALL\|CascadeType.REMOVE\|cascade.*delete\|on_delete.*CASCADE\|onDelete.*CASCADE\|ON DELETE CASCADE" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-04 Unique constraints defined: "
grep -rn "unique.*=.*true\|@UniqueConstraint\|unique_together\|UniqueIndex\|addUniqueIndex\|unique:\|UNIQUE\|#\[unique\]" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-05 Foreign key / relationship definitions: "
grep -rn "@ManyToOne\|@OneToMany\|@OneToOne\|@ManyToMany\|ForeignKey\|references\|belongsTo\|hasMany\|has_many\|belongs_to\|REFERENCES\|foreign_key\|@Relation" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-06 Not-null constraints: "
grep -rn "nullable.*=.*false\|@NotNull\|@NonNull\|NOT NULL\|required.*true\|blank=False\|null=False\|not_null\|#\[validate(required)\]" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-07 Soft delete pattern: "
grep -rn "deletedAt\|deleted_at\|isDeleted\|is_deleted\|@Where.*deleted\|@SoftDelete\|paranoid\|acts_as_paranoid\|soft_delete\|SoftDeleteModel" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "DI-08 Transaction boundaries defined: "
grep -rn "@Transactional\|transaction\|BEGIN\|COMMIT\|atomic\|@atomic\|with_transaction\|TransactionScope\|RunInTransaction\|db\.Transaction\|conn\.transaction" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l
```

> **✍️ WRITE NOW:** Append Data Integrity category results to `$SCORECARD_FILE` before running API Quality checks.

### API Quality (8 checks, max 16)

```bash
echo "=== API QUALITY CHECKS ==="

echo -n "API-01 Consistent error response format (global handler): "
grep -rn "@ControllerAdvice\|@ExceptionHandler\|ExceptionFilter\|exception_handler\|ErrorHandler\|error_handler\|UseExceptionHandler\|middleware.*error\|ErrorBoundary\|recover\|catch_unwind" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-02 Pagination on list endpoints: "
grep -rn "Pageable\|Page<\|PageRequest\|paginate\|limit.*offset\|skip.*take\|cursor\|pagination\|per_page\|page_size\|PageSize\|Paginator" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-03 Validation on request bodies: "
grep -rn "@Valid.*@RequestBody\|ValidationPipe\|class-validator\|pydantic\|validate\|Validate\|DataAnnotations\|validator\|serde.*Deserialize.*validate\|binding:\"required\"" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-04 Proper HTTP status codes: "
grep -rn "ResponseEntity\|@ResponseStatus\|HttpStatus\|status(2\|res\.status\|StatusCode\|status_code\|http\.StatusOK\|StatusCodes\|HttpStatusCode" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-05 API versioning: "
grep -rn "/api/v[0-9]\|/v[0-9]/\|ApiVersion\|api-version\|versioning" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-06 Request/response logging: "
grep -rn "RequestLogging\|LoggingFilter\|morgan\|access.log\|middleware.*log\|request_log\|AccessLog\|tracing.*http\|actix_web::middleware::Logger\|RequestLogger" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-07 HATEOAS/hypermedia (optional): "
grep -rn "HATEOAS\|RepresentationModel\|EntityModel\|Link\|_links\|hypermedia\|hal\+json" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "API-08 OpenAPI/Swagger annotations or spec: "
grep -rn "@Operation\|@ApiResponse\|@Schema\|@Api\|swagger\|openapi\|@ApiProperty\|@ApiTags\|FastAPI\|#\[utoipa\]\|swag\|Swashbuckle" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l
```

> **✍️ WRITE NOW:** Append API Quality category results to `$SCORECARD_FILE` before running Code Quality checks.

### Code Quality (11 checks, max 22)

```bash
echo "=== CODE QUALITY CHECKS ==="

echo -n "CQ-01 Dependency injection (constructor/provider, not field/global): "
echo "Review manually — check that dependencies are injected through constructors, providers, or module systems rather than global/static access or field injection."

echo -n "CQ-02 Consistent code generation / boilerplate reduction: "
grep -rn "@Data\|@Getter\|@Builder\|@dataclass\|@auto\|#\[derive\|codegen\|freezed\|json_serializable\|AutoMapper\|record " $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "CQ-03 No debug print statements in production code (should be 0): "
grep -rn "System.out\|System.err\|printStackTrace()\|console\.log\|console\.error\|print(\|println!\|fmt\.Print\|Debug\.Log\|NSLog" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v test | grep -v spec | grep -v __pycache__ | wc -l

echo -n "CQ-04 Structured logging framework used: "
grep -rn "@Slf4j\|LoggerFactory\|private.*Logger\|winston\|pino\|bunyan\|import logging\|log\.New\|tracing::\|serilog\|NLog\|ILogger\|logger\|log4j\|log4rs\|spdlog" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "CQ-05 Constants extracted (no magic numbers/strings): "
grep -rn "static final\|const \|#define \|pub const\|CONSTANT\|enum.*{\|readonly " $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

echo -n "CQ-06 DTOs/view-models separate from domain models: "
echo "Review manually — verify that API request/response types are not the same classes as persistence models."

echo -n "CQ-07 Service/business-logic layer exists: "
find . -type f \( -name "*Service*" -o -name "*service*" -o -name "*UseCase*" -o -name "*usecase*" -o -name "*Interactor*" -o -name "*handler*" -o -name "*Handler*" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/build/*" -not -path "*/.git/*" -not -path "*/test*" 2>/dev/null | wc -l

echo -n "CQ-08 Data access layer exists: "
find . -type f \( -name "*Repository*" -o -name "*repository*" -o -name "*Repo*" -o -name "*repo*" -o -name "*DAO*" -o -name "*dao*" -o -name "*Store*" -o -name "*store*" -o -name "*queries*" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/build/*" -not -path "*/.git/*" -not -path "*/test*" 2>/dev/null | wc -l

echo ""
echo "=== DOCUMENTATION COVERAGE (BLOCKING) ==="
echo ""
echo -n "CQ-09 Doc comments on classes/modules = 100% (BLOCKING): "
TOTAL_CLASSES=0; DOCUMENTED_CLASSES=0

# --- Java/Kotlin ---
for f in $(find . -name "*.java" -o -name "*.kt" 2>/dev/null | grep -v "/dto/" | grep -v "/entity/" | grep -v "/model/" | grep -v "generated" | grep -v "/test" | grep -v "/build/" | grep -v "/target/" | grep -v node_modules); do
  if grep -q "^\(public\|protected\|internal\|open\|abstract\|data\) \(class\|interface\|enum\|object\|record\)" "$f" 2>/dev/null; then
    TOTAL_CLASSES=$((TOTAL_CLASSES + 1))
    if grep -q "^/\*\*" "$f" 2>/dev/null; then DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + 1)); fi
  fi
done

# --- TypeScript/JavaScript ---
for f in $(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | grep -v node_modules | grep -v ".spec." | grep -v ".test." | grep -v ".d.ts" | grep -v "generated" | grep -v dist | grep -v build); do
  FILE_EXPORTS=$(grep -c "^export \(class\|function\|const\|interface\|type\|enum\|abstract\)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^export \(class\|function\|const\|interface\|type\|enum\|abstract\)" "$f" 2>/dev/null | grep -c "\*/" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_EXPORTS))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- Dart ---
for f in $(find . -name "*.dart" 2>/dev/null | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -v "generated" | grep -v ".dart_tool" | grep -v build | grep -v test); do
  FILE_CLASSES=$(grep -c "^\(class\|abstract class\|mixin\|enum\|extension\)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\(class\|abstract class\|mixin\|enum\|extension\)" "$f" 2>/dev/null | grep -c "^///" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_CLASSES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- Python ---
for f in $(find . -name "*.py" 2>/dev/null | grep -v __pycache__ | grep -v ".venv" | grep -v "test_" | grep -v "_test.py" | grep -v migrations | grep -v build); do
  FILE_CLASSES=$(grep -c "^class " "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(awk '/^class /{getline; if(/"""/ || /'\'''\'''\''/) c++} END{print c+0}' "$f" 2>/dev/null)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_CLASSES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- Go ---
for f in $(find . -name "*.go" 2>/dev/null | grep -v vendor | grep -v "_test.go" | grep -v build); do
  FILE_TYPES=$(grep -c "^type .* struct\|^type .* interface" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^type .* struct\|^type .* interface" "$f" 2>/dev/null | grep -c "^//" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_TYPES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- Rust ---
for f in $(find . -name "*.rs" 2>/dev/null | grep -v target | grep -v test | grep -v build); do
  FILE_TYPES=$(grep -c "^pub struct\|^pub enum\|^pub trait\|^pub type" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^pub struct\|^pub enum\|^pub trait\|^pub type" "$f" 2>/dev/null | grep -c "^///" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_TYPES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- C#/.NET ---
for f in $(find . -name "*.cs" 2>/dev/null | grep -v "obj/" | grep -v "bin/" | grep -v "generated" | grep -v ".Designer.cs" | grep -v test | grep -v Test); do
  FILE_CLASSES=$(grep -c "^\s*public \(class\|interface\|enum\|struct\|record\|abstract class\)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*public \(class\|interface\|enum\|struct\|record\|abstract class\)" "$f" 2>/dev/null | grep -c "/// <summary>" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_CLASSES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- C/C++ ---
for f in $(find . -name "*.h" -o -name "*.hpp" 2>/dev/null | grep -v build | grep -v vendor | grep -v test | grep -v third_party); do
  FILE_CLASSES=$(grep -c "^class \|^struct \|^enum \|^typedef " "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^class \|^struct \|^enum \|^typedef " "$f" 2>/dev/null | grep -c "\*/\|^///" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_CLASSES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

# --- Swift ---
for f in $(find . -name "*.swift" 2>/dev/null | grep -v build | grep -v .build | grep -v test | grep -v Test); do
  FILE_CLASSES=$(grep -c "^\(public\|open\|internal\)\? *\(class\|struct\|enum\|protocol\|actor\)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\(public\|open\|internal\)\? *\(class\|struct\|enum\|protocol\|actor\)" "$f" 2>/dev/null | grep -c "^///\|\*/" || echo 0)
  TOTAL_CLASSES=$((TOTAL_CLASSES + FILE_CLASSES))
  DOCUMENTED_CLASSES=$((DOCUMENTED_CLASSES + FILE_DOCS))
done

if [ "$TOTAL_CLASSES" -eq 0 ]; then echo "N/A (no classes/types found)"
elif [ "$DOCUMENTED_CLASSES" -eq "$TOTAL_CLASSES" ]; then echo "PASS ($DOCUMENTED_CLASSES / $TOTAL_CLASSES = 100%)"
else echo "FAIL ($DOCUMENTED_CLASSES / $TOTAL_CLASSES) — BLOCKING — every class/module must have doc comments"; fi

echo -n "CQ-10 Doc comments on public methods/functions = 100% (BLOCKING): "
TOTAL_METHODS=0; DOC_METHODS=0

# --- Java/Kotlin ---
for f in $(find . -name "*.java" -o -name "*.kt" 2>/dev/null | grep -v "/dto/" | grep -v "/entity/" | grep -v "/model/" | grep -v "generated" | grep -v "/test" | grep -v "/build/" | grep -v "/target/" | grep -v node_modules); do
  FILE_METHODS=$(grep -c "^\s*public.*(.*).*{" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*public.*(.*).*{" "$f" 2>/dev/null | grep -c "\*/" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_METHODS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- TypeScript/JavaScript ---
for f in $(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | grep -v node_modules | grep -v ".spec." | grep -v ".test." | grep -v ".d.ts" | grep -v "generated" | grep -v dist | grep -v build); do
  FILE_FUNCS=$(grep -c "^\(export \(function\|async function\|const\)\|  public \|  async \)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\(export \(function\|async function\|const\)\|  public \|  async \)" "$f" 2>/dev/null | grep -c "\*/" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- Dart ---
for f in $(find . -name "*.dart" 2>/dev/null | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -v "generated" | grep -v ".dart_tool" | grep -v build | grep -v test); do
  FILE_FUNCS=$(grep -c "^\s*\(Future\|void\|String\|int\|double\|bool\|List\|Map\|Set\|dynamic\|Widget\|State\).*(.*).*{" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*\(Future\|void\|String\|int\|double\|bool\|List\|Map\|Set\|dynamic\|Widget\|State\).*(.*).*{" "$f" 2>/dev/null | grep -c "^  ///" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- Python ---
for f in $(find . -name "*.py" 2>/dev/null | grep -v __pycache__ | grep -v ".venv" | grep -v "test_" | grep -v "_test.py" | grep -v migrations | grep -v build); do
  FILE_FUNCS=$(grep -c "^\s*def [^_]" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(awk '/^\s*def [^_]/{getline; if(/"""/ || /'\'''\'''\''/) c++} END{print c+0}' "$f" 2>/dev/null)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- Go ---
for f in $(find . -name "*.go" 2>/dev/null | grep -v vendor | grep -v "_test.go" | grep -v build); do
  FILE_FUNCS=$(grep -c "^func [A-Z]\|^func (.*) [A-Z]" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^func [A-Z]\|^func (.*) [A-Z]" "$f" 2>/dev/null | grep -c "^//" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- Rust ---
for f in $(find . -name "*.rs" 2>/dev/null | grep -v target | grep -v test | grep -v build); do
  FILE_FUNCS=$(grep -c "^\s*pub fn\|^\s*pub async fn" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*pub fn\|^\s*pub async fn" "$f" 2>/dev/null | grep -c "^.*///" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- C#/.NET ---
for f in $(find . -name "*.cs" 2>/dev/null | grep -v "obj/" | grep -v "bin/" | grep -v "generated" | grep -v ".Designer.cs" | grep -v test | grep -v Test); do
  FILE_FUNCS=$(grep -c "^\s*public.*(.*)$" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*public.*(.*)$" "$f" 2>/dev/null | grep -c "/// <summary>" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- C/C++ ---
for f in $(find . -name "*.h" -o -name "*.hpp" 2>/dev/null | grep -v build | grep -v vendor | grep -v test | grep -v third_party); do
  FILE_FUNCS=$(grep -c "^\s*\(virtual \)\?\(static \)\?\(inline \)\?\w.*(.*)" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*\(virtual \)\?\(static \)\?\(inline \)\?\w.*(.*)" "$f" 2>/dev/null | grep -c "\*/\|^.*///" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

# --- Swift ---
for f in $(find . -name "*.swift" 2>/dev/null | grep -v build | grep -v .build | grep -v test | grep -v Test); do
  FILE_FUNCS=$(grep -c "^\s*\(public\|open\) func" "$f" 2>/dev/null || echo 0)
  FILE_DOCS=$(grep -B1 "^\s*\(public\|open\) func" "$f" 2>/dev/null | grep -c "^.*///\|\*/" || echo 0)
  TOTAL_METHODS=$((TOTAL_METHODS + FILE_FUNCS))
  DOC_METHODS=$((DOC_METHODS + FILE_DOCS))
done

if [ "$TOTAL_METHODS" -eq 0 ]; then echo "N/A (no public methods found)"
elif [ "$DOC_METHODS" -eq "$TOTAL_METHODS" ]; then echo "PASS ($DOC_METHODS / $TOTAL_METHODS = 100%)"
else echo "FAIL ($DOC_METHODS / $TOTAL_METHODS) — BLOCKING — every public method/function must have doc comments"; fi

echo -n "CQ-11 No TODO/FIXME/placeholder/stub (CRITICAL - 0 if any found): "
TODO_COUNT=$(grep -rn "TODO\|FIXME\|XXX\|HACK\|placeholder\|not yet implemented\|not implemented" \
  $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -iv "test\|spec\|Test" | wc -l)
STUB_COUNT=$(grep -rn "throw.*UnsupportedOperationException\|throw.*NotImplementedError\|raise NotImplementedError\|todo!()\|unimplemented!()\|panic(\"not implemented\")\|throw new NotImplementedException\|fatalError(\"not implemented\")" \
  $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -iv test | wc -l)
TOTAL_INCOMPLETE=$((TODO_COUNT + STUB_COUNT))
if [ "$TOTAL_INCOMPLETE" -eq 0 ]; then echo "PASS (0 found)"; else echo "FAIL ($TOTAL_INCOMPLETE found) — BLOCKING"; fi
```

> **✍️ WRITE NOW:** Append Code Quality category results to `$SCORECARD_FILE` before running Test Quality checks.

### Test Quality (12 checks, max 24)

```bash
echo "=== TEST QUALITY CHECKS ==="

# Detect test directories and frameworks
echo "Detecting test framework and directories..."
TEST_DIRS=$(find . -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "spec" -o -name "test_*" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" 2>/dev/null | head -5 | tr '\n' ' ')
echo "Test directories: $TEST_DIRS"

echo -n "TST-01 Unit test files: "
find . -type f \( \
  -name "*Test.java" -not -name "*IT.java" -not -name "*IntegrationTest.java" \
  -o -name "*_test.go" \
  -o -name "*.spec.ts" -o -name "*.spec.js" -o -name "*.test.ts" -o -name "*.test.js" \
  -o -name "test_*.py" -o -name "*_test.py" \
  -o -name "*_test.rs" \
  -o -name "*_test.dart" -o -name "*_test.dart" \
  -o -name "*Tests.cs" -o -name "*Test.cs" \
  -o -name "*Tests.swift" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" 2>/dev/null | wc -l

echo -n "TST-02 Integration test files: "
find . -type f \( \
  -name "*IT.java" -o -name "*IntegrationTest.java" \
  -o -name "*.e2e-spec.ts" -o -name "*.integration.test.*" \
  -o -name "*_integration_test.*" \
  -o -name "*IntegrationTest*" -o -name "*integration_test*" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" 2>/dev/null | wc -l

echo -n "TST-03 Test containers / real DB in tests: "
grep -rn "@Testcontainers\|@Container\|PostgreSQLContainer\|testcontainers\|docker.*test\|ory/dockertest\|sqlx::test\|test.*database\|TestDatabase\|factory_boy\|FactoryBot" $SRC_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l

echo -n "TST-04 Source-to-test ratio: "
TOTAL_SRC=$(find . -type f \( -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" -o -name "*.dart" -o -name "*.swift" -o -name "*.c" -o -name "*.cpp" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" -not -path "*/vendor/*" -not -path "*test*" -not -path "*spec*" -not -path "*Test*" 2>/dev/null | wc -l)
TOTAL_TESTS=$(find . -type f \( -name "*Test*" -o -name "*test*" -o -name "*spec*" -o -name "*_test*" \) \( -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" -o -name "*.dart" -o -name "*.swift" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" 2>/dev/null | wc -l)
echo "$TOTAL_TESTS tests / $TOTAL_SRC source"

echo ""
echo "=== TEST COVERAGE (BLOCKING — must be 100%) ==="
echo ""

# --- Java (Maven + JaCoCo) ---
if [ -f pom.xml ]; then
  echo -n "TST-05 (Java/Maven) Test coverage = 100%: "
  mvn test jacoco:report -q 2>/dev/null
  if [ -f target/site/jacoco/jacoco.csv ]; then
    COV=$(tail -n +2 target/site/jacoco/jacoco.csv | awk -F',' '{m+=$4; c+=$5} END {if(m+c>0) printf "%.1f", c*100/(m+c); else print "N/A"}')
    echo "${COV}%"
    if [ "$COV" != "N/A" ] && [ "$(echo "$COV < 100.0" | bc -l 2>/dev/null || echo 1)" = "1" ]; then echo "  ⚠ BLOCKING — Test coverage must be 100%"; fi
  else echo "No JaCoCo report — BLOCKING"; fi
fi

# --- Dart/Flutter ---
if [ -f pubspec.yaml ]; then
  echo -n "TST-05 (Flutter/Dart) Test coverage = 100%: "
  flutter test --coverage 2>/dev/null
  if [ -f coverage/lcov.info ]; then
    FLUTTER_COV=$(lcov --summary coverage/lcov.info 2>/dev/null | grep "lines" | awk '{print $2}' | tr -d '%')
    echo "${FLUTTER_COV}%"
    if [ "$(echo "$FLUTTER_COV < 100.0" | bc -l 2>/dev/null || echo 1)" = "1" ]; then echo "  ⚠ BLOCKING — Test coverage must be 100%"; fi
  else echo "No coverage report generated"; fi
fi

# --- Node.js/TypeScript ---
if [ -f package.json ] && [ ! -f pom.xml ] && [ ! -f pubspec.yaml ]; then
  echo -n "TST-05 (Node/TS) Test coverage = 100%: "
  npx jest --coverage --coverageReporters=text-summary 2>/dev/null | grep "Statements" || \
  npx vitest run --coverage 2>/dev/null | grep "All files" || \
  echo "Run coverage manually"
fi

# --- Python ---
if [ -f pyproject.toml ] || [ -f setup.py ] || [ -f requirements.txt ]; then
  if [ ! -f pom.xml ] && [ ! -f package.json ] && [ ! -f pubspec.yaml ]; then
    echo -n "TST-05 (Python) Test coverage = 100%: "
    python3 -m pytest --cov=. --cov-report=term-summary 2>/dev/null | grep "TOTAL" || echo "Run coverage manually (pytest-cov)"
  fi
fi

# --- Go ---
if [ -f go.mod ]; then
  echo -n "TST-05 (Go) Test coverage = 100%: "
  go test ./... -coverprofile=coverage.out 2>/dev/null
  if [ -f coverage.out ]; then
    GO_COV=$(go tool cover -func=coverage.out 2>/dev/null | grep total | awk '{print $3}' | tr -d '%')
    echo "${GO_COV}%"
    if [ "$(echo "$GO_COV < 100.0" | bc -l 2>/dev/null || echo 1)" = "1" ]; then echo "  ⚠ BLOCKING — Test coverage must be 100%"; fi
    rm -f coverage.out
  else echo "No coverage report"; fi
fi

# --- Rust ---
if [ -f Cargo.toml ]; then
  echo -n "TST-05 (Rust) Test coverage = 100%: "
  if command -v cargo-tarpaulin &> /dev/null; then
    cargo tarpaulin --out Stdout 2>/dev/null | tail -1 || echo "Run coverage manually (cargo-tarpaulin)"
  else
    echo "Install cargo-tarpaulin for coverage: cargo install cargo-tarpaulin"
  fi
fi

# --- C#/.NET ---
if ls *.sln *.csproj 2>/dev/null | head -1 > /dev/null 2>&1; then
  echo -n "TST-05 (.NET) Test coverage = 100%: "
  dotnet test --collect:"XPlat Code Coverage" 2>/dev/null | grep "Line coverage" || echo "Run coverage manually (coverlet)"
fi

echo ""
echo -n "TST-06 Test config exists: "
find . \( -name "application-test.yml" -o -name "application-integration.yml" -o -name "jest.config.*" -o -name "vitest.config.*" -o -name "pytest.ini" -o -name "pyproject.toml" -o -name "conftest.py" -o -name "testcontainers*.yml" -o -name "test.settings.*" \) -not -path "*/node_modules/*" 2>/dev/null | wc -l

echo -n "TST-07 Security/auth tests: "
grep -rn "@WithMockUser\|@WithAnonymousUser\|Authorization.*Bearer\|mock.*auth\|fake.*token\|test.*login\|test.*auth\|auth.*test\|unauthorized\|forbidden\|401\|403" \
  $SRC_GLOB . 2>/dev/null | grep -i "test\|spec" | grep -v node_modules | grep -v target | wc -l

echo -n "TST-08 Auth flow end-to-end: "
grep -rn "register\|signup\|sign_up\|login\|sign_in\|/auth/" \
  $SRC_GLOB . 2>/dev/null | grep -i "test\|spec\|IT\|integration\|e2e" | grep -v node_modules | grep -v target | wc -l

echo -n "TST-09 DB state verification in integration tests: "
grep -rn "Repository\|findBy\|count()\|assert.*database\|assert.*db\|query.*test\|select.*from\|find_one\|find_all" \
  $SRC_GLOB . 2>/dev/null | grep -i "test\|spec\|IT\|integration" | grep -v node_modules | grep -v target | wc -l

echo -n "TST-10 Total test methods/functions: "
grep -rn "@Test\|#\[test\]\|#\[tokio::test\]\|func Test\|def test_\|it(\|describe(\|test(\|it '\|test '" \
  $SRC_GLOB . 2>/dev/null | grep -i "test\|spec" | grep -v node_modules | grep -v target | wc -l
```

> **✍️ WRITE NOW:** Append Test Quality category results to `$SCORECARD_FILE` before running Infrastructure checks.

### Infrastructure (6 checks, max 12)

```bash
echo "=== INFRASTRUCTURE CHECKS ==="
echo -n "INF-01 Non-root Dockerfile: "; grep -q "^USER\|adduser\|addgroup\|useradd\|groupadd" Dockerfile 2>/dev/null && echo "YES" || echo "NO or no Dockerfile"
echo -n "INF-02 DB ports localhost only: "; grep "5432\|3306\|27017\|6379\|5672" docker-compose.yml 2>/dev/null || echo "No docker-compose or no DB ports"
echo -n "INF-03 Env vars for prod secrets: "; grep -c '\${' $(find . -name "*prod*" -name "*.yml" -o -name "*prod*" -name "*.yaml" -o -name "*prod*" -name "*.json" -o -name "*prod*" -name "*.toml" 2>/dev/null | head -3) 2>/dev/null || echo "0 or no prod config"
echo -n "INF-04 Health check endpoint: "; grep -rn "health\|healthz\|readyz\|livez\|actuator\|ping" $SRC_GLOB $CONF_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l
echo -n "INF-05 Structured logging: "; grep -rn "logback\|log4j2\|JsonLayout\|LogstashEncoder\|winston.*json\|pino\|structlog\|zap\.New\|tracing_subscriber\|serilog.*json\|spdlog" $SRC_GLOB $CONF_GLOB . 2>/dev/null | grep -v node_modules | grep -v target | wc -l
echo -n "INF-06 CI/CD config: "; find . -name "*.yml" -path "*/.github/*" -o -name "Jenkinsfile" -o -name ".gitlab-ci.yml" -o -name "azure-pipelines.yml" -o -name "Taskfile.yml" -o -name "bitbucket-pipelines.yml" 2>/dev/null | wc -l
```

> **✍️ WRITE NOW:** Append Infrastructure category results to `$SCORECARD_FILE` before running Snyk checks.

### Security Vulnerabilities — Snyk (5 checks, max 10)

```bash
echo "=== SNYK VULNERABILITY CHECKS ==="

if ! command -v snyk &> /dev/null; then
  echo "SNYK-01 through SNYK-05: SKIPPED — Snyk CLI not installed"
else
  # Run scans
  snyk test --json > /tmp/snyk-score-oss.json 2>/dev/null
  OSS_EXIT=$?
  snyk code test --json > /tmp/snyk-score-code.json 2>/dev/null
  CODE_EXIT=$?

  echo -n "SNYK-01 Zero critical dependency vulnerabilities: "
  if [ $OSS_EXIT -eq 0 ]; then echo "PASS"; else
    CRIT=$(cat /tmp/snyk-score-oss.json | python3 -c "import json,sys; d=json.load(sys.stdin); seen=set(); [seen.add(v['id']) for v in d.get('vulnerabilities',[]) if v.get('severity')=='critical' and v['id'] not in seen]; print(len(seen))" 2>/dev/null || echo "?")
    if [ "$CRIT" = "0" ]; then echo "PASS"; else echo "FAIL ($CRIT critical) — BLOCKING"; fi
  fi

  echo -n "SNYK-02 Zero high dependency vulnerabilities: "
  if [ $OSS_EXIT -eq 0 ]; then echo "PASS"; else
    HIGH=$(cat /tmp/snyk-score-oss.json | python3 -c "import json,sys; d=json.load(sys.stdin); seen=set(); [seen.add(v['id']) for v in d.get('vulnerabilities',[]) if v.get('severity')=='high' and v['id'] not in seen]; print(len(seen))" 2>/dev/null || echo "?")
    if [ "$HIGH" = "0" ]; then echo "PASS"; else echo "FAIL ($HIGH high) — BLOCKING"; fi
  fi

  echo -n "SNYK-03 Medium/low dependency vulnerabilities: "
  if [ $OSS_EXIT -eq 0 ]; then echo "PASS (0 total)"; else
    MEDLOW=$(cat /tmp/snyk-score-oss.json | python3 -c "import json,sys; d=json.load(sys.stdin); seen=set(); [seen.add(v['id']) for v in d.get('vulnerabilities',[]) if v.get('severity') in ('medium','low') and v['id'] not in seen]; print(len(seen))" 2>/dev/null || echo "?")
    echo "$MEDLOW found"
  fi

  echo -n "SNYK-04 Zero code (SAST) errors: "
  if [ $CODE_EXIT -eq 0 ]; then echo "PASS"; else
    ERRS=$(cat /tmp/snyk-score-code.json | python3 -c "import json,sys; d=json.load(sys.stdin); runs=d.get('runs',[{}]); results=runs[0].get('results',[]) if runs else []; print(sum(1 for r in results if r.get('level')=='error'))" 2>/dev/null || echo "?")
    if [ "$ERRS" = "0" ]; then echo "PASS"; else echo "FAIL ($ERRS errors) — BLOCKING"; fi
  fi

  echo -n "SNYK-05 Zero code (SAST) warnings: "
  if [ $CODE_EXIT -eq 0 ]; then echo "PASS"; else
    WARNS=$(cat /tmp/snyk-score-code.json | python3 -c "import json,sys; d=json.load(sys.stdin); runs=d.get('runs',[{}]); results=runs[0].get('results',[]) if runs else []; print(sum(1 for r in results if r.get('level')=='warning'))" 2>/dev/null || echo "?")
    if [ "$WARNS" = "0" ]; then echo "PASS"; else echo "FAIL ($WARNS warnings)"; fi
  fi

  rm -f /tmp/snyk-score-oss.json /tmp/snyk-score-code.json
fi
```

> **✍️ WRITE NOW:** Append Snyk Vulnerabilities category results to `$SCORECARD_FILE` before writing the Scorecard Summary.

### Scorecard Summary

Compile all scores into the scorecard file:

```
Category             | Score | Max | %
Security             |   __  |  20 | __%
Data Integrity       |   __  |  16 | __%
API Quality          |   __  |  16 | __%
Code Quality         |   __  |  22 | __%
Test Quality         |   __  |  24 | __%
Infrastructure       |   __  |  12 | __%
Snyk Vulnerabilities |   __  |  10 | __%
OVERALL              |   __  | 120 | __%

Grade: A (85-100%) | B (70-84%) | C (55-69%) | D (40-54%) | F (<40%)
```

**CQ-09 and CQ-10 are BLOCKING CHECKS:** 100% documentation coverage is mandatory on all classes/modules and all public methods/functions (excluding DTOs, entities, and generated code). If either check is below 100%, the entire Code Quality category scores 0.

**CQ-11 is a BLOCKING CHECK:** If any TODO/FIXME/placeholder/stub patterns are found, the entire Code Quality category scores 0 regardless of other checks. These patterns indicate incomplete code masquerading as complete.

**TST-05 is a BLOCKING CHECK:** 100% test coverage is mandatory. If any coverage metric is below 100%, the entire Test Quality category scores 0.

**SNYK-01, SNYK-02, and SNYK-04 are BLOCKING CHECKS:** Any critical/high dependency vulnerabilities or SAST errors cause the entire Snyk Vulnerabilities category to score 0.

For each category below 60%, list failing checks. Flag any check scored 0 as a **BLOCKING ISSUE**.

> **✍️ WRITE NOW:** Append the Scorecard Summary table to `$SCORECARD_FILE`. The scorecard is now complete — proceed to Verification.

---

## Output Format

**Naming convention:** Files are named after the project's root directory name.

```
ProjectName/
├── ProjectName-Audit.md       ← this audit (coding reference)
├── ProjectName-Scorecard.md   ← quality assessment (separate)
├── ProjectName-OpenAPI.yaml   ← API spec (generated by OpenAPI-Template.md)
├── src/
└── ...
```

Determine names automatically:
```bash
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"
SCORECARD_FILE="${PROJECT_DIR}-Scorecard.md"
echo "Audit: $AUDIT_FILE"
echo "Scorecard: $SCORECARD_FILE"
```

**Initialize the audit file first** (run after deleting old files, before any sections):

```bash
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"

cat > "$AUDIT_FILE" << HEADER
# ${PROJECT_DIR} — Codebase Audit

**Audit Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Branch:** $(git branch --show-current)
**Commit:** $(git log -1 --format='%H %s')
**Auditor:** OpenCode (Automated)
**Purpose:** Zero-context reference for AI-assisted development
**Audit File:** ${PROJECT_DIR}-Audit.md
**Scorecard:** ${PROJECT_DIR}-Scorecard.md
**OpenAPI Spec:** ${PROJECT_DIR}-OpenAPI.yaml (generated separately)

> This audit is the source of truth for the ${PROJECT_DIR} codebase structure, models, services, and configuration.
> The OpenAPI spec (${PROJECT_DIR}-OpenAPI.yaml) is the source of truth for all endpoints, DTOs, and API contracts.
> An AI reading this audit + the OpenAPI spec should be able to generate accurate code
> changes, new features, tests, and fixes without filesystem access.

---
HEADER

echo "✓ Audit file initialized — $(wc -l < "$AUDIT_FILE") lines"
```

Then write **each section immediately after completing it** using `cat >> "$AUDIT_FILE"`. Never defer writes to the end. After all 22 sections are written, proceed to the Scorecard and Verification steps.

The audit file must begin with the header block above. The content written by this initialization step counts as the file header; do not re-emit the header as part of Section 1.

## Verification

After writing both files, verify completeness:

```bash
echo "=== COMPLETENESS CHECK ==="
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"
SCORECARD_FILE="${PROJECT_DIR}-Scorecard.md"

echo "Audit file: $AUDIT_FILE"
test -f "$AUDIT_FILE" && echo "  EXISTS — $(wc -l < "$AUDIT_FILE") lines" || echo "  MISSING"

echo "Scorecard file: $SCORECARD_FILE"
test -f "$SCORECARD_FILE" && echo "  EXISTS — $(wc -l < "$SCORECARD_FILE") lines" || echo "  MISSING"

echo "Database audit present:"
grep -q "DATABASE SCHEMA\|Database not available\|database not available\|No database" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 16"

echo "Message broker audit present:"
grep -q "MESSAGE BROKER\|No message broker\|message broker" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 17"

echo "Cache layer audit present:"
grep -q "CACHE\|No.*cach\|caching" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 18"

echo "Environment variable inventory present:"
grep -q "ENVIRONMENT VARIABLE INVENTORY\|Variable.*Used In\|env" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 19"

echo "Service dependency map present:"
grep -q "SERVICE DEPENDENCY MAP\|Standalone service\|standalone service\|Depends On" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 20"

echo "Snyk vulnerability scan present:"
grep -q "Security Vulnerability Scan\|SNYK SCAN: SKIPPED\|Snyk" "$AUDIT_FILE" && echo "  YES" || echo "  MISSING — run Section 22"

echo "Test coverage checked:"
grep -q "TST-05\|coverage" "$SCORECARD_FILE" && echo "  CHECKED" || echo "  MISSING — verify in Scorecard"

echo "Documentation coverage checked:"
grep -q "CQ-09\|CQ-10\|Doc comments" "$SCORECARD_FILE" && echo "  CHECKED" || echo "  MISSING — verify in Scorecard"

echo "Source files:"
TOTAL_SRC=$(find . -type f \( \
  -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
  -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.dart" \
  -o -name "*.c" -o -name "*.cpp" -o -name "*.h" -o -name "*.hpp" \
  -o -name "*.cs" -o -name "*.swift" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" -not -path "*/vendor/*" -not -path "*/__pycache__/*" -not -path "*/.dart_tool/*" 2>/dev/null | wc -l)
echo "  Total: $TOTAL_SRC"

echo ""
echo "=== BLOCKING ISSUE CHECK ==="
TODO_HITS=$(grep -rn "TODO\|FIXME\|XXX\|placeholder\|not yet implemented" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.py" --include="*.go" --include="*.rs" --include="*.dart" \
  --include="*.c" --include="*.cpp" --include="*.h" --include="*.hpp" \
  --include="*.cs" --include="*.swift" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -iv test | grep -iv spec | wc -l)
if [ "$TODO_HITS" -gt 0 ]; then
  echo "  BLOCKING: $TODO_HITS TODO/placeholder patterns found!"
  echo "  These MUST be documented in Section 21 as CRITICAL issues."
  grep -rn "TODO\|FIXME\|XXX\|placeholder\|not yet implemented" \
    --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --include="*.py" --include="*.go" --include="*.rs" --include="*.dart" \
    --include="*.c" --include="*.cpp" --include="*.h" --include="*.hpp" \
    --include="*.cs" --include="*.swift" \
    . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v vendor | grep -v __pycache__ | grep -iv test | grep -iv spec | head -10
  echo "  (showing first 10)"
else
  echo "  PASS: No TODO/placeholder patterns found"
fi

echo ""
echo "=== DOC COVERAGE CHECK ==="
echo "Checking for undocumented types and public methods..."
echo "(Full results in Scorecard CQ-09 and CQ-10)"

echo ""
echo "NOTE: Run OpenAPI-Template.md separately to generate the API specification."
```

Fix any gaps before committing.

## Completion

```bash
PROJECT_DIR=$(basename "$(pwd)")
AUDIT_FILE="${PROJECT_DIR}-Audit.md"
SCORECARD_FILE="${PROJECT_DIR}-Scorecard.md"
git add "$AUDIT_FILE" "$SCORECARD_FILE"
git commit -m "Codebase audit — $(date +%Y-%m-%d)"
git push
```

**REMINDER:** After running this template, run `OpenAPI-Template.md` separately to generate the API specification.
