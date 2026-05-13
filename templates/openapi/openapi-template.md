# OpenAPI Specification — Prompt Template

**Usage:** Copy this template, replace `{{PROJECT_NAME}}` and `{{PROJECT_ROOT}}` with actual values, and run as a OpenCode prompt. This produces ONLY the OpenAPI specification file. **Run Codebase-Audit-Template.md separately to generate the codebase audit and scorecard.**

**When to run this template:** Run after completing any feature that adds, modifies, or removes API endpoints, request/response DTOs, validation rules, or authentication requirements. Run whenever the Codebase-Audit-Template.md is run. The OpenAPI spec and the codebase audit together form the complete source of truth.

**This template produces one file:**
- `<ProjectName>-OpenAPI.yaml` — Complete API specification

**Why a separate template?** Large codebases can exceed OpenCode's context limits when generating the audit and OpenAPI spec together. Splitting them allows each to run independently within context budgets.

---

## Instructions

You are generating a complete OpenAPI 3.0 specification for the `{{PROJECT_NAME}}` codebase. This spec will be consumed by an AI (Reasoning LLM) in a separate session with ZERO prior context, alongside the codebase audit. The spec is the **sole source of truth** for:

- All endpoint paths and HTTP methods
- All request parameters (path, query, header)
- All request body schemas (DTOs)
- All response body schemas (DTOs)
- All validation constraints (@NotNull, @Size, @Pattern, @Email, etc.)
- All enum values used in request/response DTOs
- Authentication requirements per endpoint
- Error response formats

### CRITICAL — Delete Existing OpenAPI Files Before Starting

Previous specs may be stale, incomplete, or wrong. You MUST delete them and regenerate from scratch.

**Run this FIRST, before anything else:**

```bash
PROJECT_DIR=$(basename "$(pwd)")
OPENAPI_FILE="${PROJECT_DIR}-OpenAPI.yaml"

echo "=== CLEARING PREVIOUS OPENAPI ARTIFACTS ==="
[ -f "$OPENAPI_FILE" ] && rm -v "$OPENAPI_FILE" || echo "No existing OpenAPI file"
[ -f "openapi.yaml" ] && rm -v "openapi.yaml" || echo "No legacy openapi.yaml"
[ -f "openapi.yml" ] && rm -v "openapi.yml" || echo "No existing openapi.yml"
[ -f "openapi.json" ] && rm -v "openapi.json" || echo "No existing openapi.json"
[ -f "swagger.yaml" ] && rm -v "swagger.yaml" || echo "No existing swagger.yaml"
[ -f "swagger.json" ] && rm -v "swagger.json" || echo "No existing swagger.json"
echo "=== STARTING FRESH OPENAPI GENERATION ==="
```

**Do NOT skip this step. Do NOT read existing spec files for "reference." Build everything from source.**

**Rules:**
- `cat` every controller to extract endpoints, paths, methods, parameters
- `cat` every DTO to extract field names, types, validation annotations
- `cat` every enum used in request/response DTOs
- Cross-reference with actual service behavior for response codes
- Never describe from memory — read the actual source files

---

## ⚠️ OUTPUT STRATEGY — READ THIS BEFORE WRITING ANYTHING

**Large codebases will exceed OpenCode's maximum output token limit if the entire OpenAPI spec is written in a single response.** To prevent silent truncation or hard failures, you MUST write the spec file incrementally using shell append commands. **Never buffer the full YAML in memory and emit it all at once.**

### Required incremental write pattern

The spec is built in four stages, each written to disk immediately:

```
Stage 1 — File header  (openapi, info, servers, tags)  → cat > $OPENAPI_FILE
Stage 2 — paths        (one controller group at a time) → cat >> $OPENAPI_FILE
Stage 3 — components/schemas (one group at a time)      → cat >> $OPENAPI_FILE
Stage 4 — components/responses + securitySchemes        → cat >> $OPENAPI_FILE
```

**Rules for incremental YAML writing:**
- **Indentation is structural in YAML.** Every append block must use the exact same indentation as the surrounding context — 2 spaces per level throughout. Never mix tabs and spaces.
- **Initialize once** with `cat > "$OPENAPI_FILE"` (overwrite). All subsequent writes use `cat >> "$OPENAPI_FILE"` (append).
- After every write, echo the running line count as confirmation: `echo "✓ Written — $(wc -l < "$OPENAPI_FILE") lines so far"`
- Process **one controller at a time** when writing `paths:`. Do not batch all controllers into one write block.
- Process **one schema group at a time** when writing `components/schemas:`. Do not batch all DTOs into one write block.
- **Section boundary lines** (`paths:`, `components:`, `  schemas:`, `  responses:`, `  securitySchemes:`) must be written exactly once — include them only in their initialization write, never duplicated in append blocks.
- If a controller or DTO produces very large YAML, write each endpoint or schema individually.
- After completing the inventory steps (Steps 1–5 below), **do not proceed to writing the YAML** until all source reading is complete. Reading and writing are separate phases.
- Run the YAML syntax validator (Verification section) after writing the complete file.

### Stage boundary reference

```bash
# Stage 1 — initialize (run ONCE)
cat > "$OPENAPI_FILE" << 'YAML_HEADER'
openapi: 3.0.3
info:
  ...
servers:
  ...
tags:
  ...
paths:
YAML_HEADER
echo "✓ Header written — $(wc -l < "$OPENAPI_FILE") lines"

# Stage 2 — append each controller's paths (repeat per controller)
cat >> "$OPENAPI_FILE" << 'CONTROLLER_PATHS'
  /api/auth/login:
    post:
      ...
CONTROLLER_PATHS
echo "✓ Auth paths appended — $(wc -l < "$OPENAPI_FILE") lines"

# Stage 3 — open components block, then append schema groups
cat >> "$OPENAPI_FILE" << 'COMPONENTS_OPEN'
components:
  schemas:
COMPONENTS_OPEN

# Append request DTOs
cat >> "$OPENAPI_FILE" << 'REQUEST_SCHEMAS'
    RegisterRequest:
      ...
REQUEST_SCHEMAS
echo "✓ Request schemas appended — $(wc -l < "$OPENAPI_FILE") lines"

# Append response DTOs
cat >> "$OPENAPI_FILE" << 'RESPONSE_SCHEMAS'
    AuthResponse:
      ...
RESPONSE_SCHEMAS
echo "✓ Response schemas appended — $(wc -l < "$OPENAPI_FILE") lines"

# Stage 4 — responses and securitySchemes
cat >> "$OPENAPI_FILE" << 'COMPONENTS_CLOSE'
  responses:
    Unauthorized:
      ...
  securitySchemes:
    bearerAuth:
      ...
COMPONENTS_CLOSE
echo "✓ Spec complete — $(wc -l < "$OPENAPI_FILE") lines total"
```

---

## Generation Process

### Step 1: Inventory All Controllers

```bash
echo "=== CONTROLLER INVENTORY ==="
find src/main -name "*Controller.java" -o -name "*Resource.java" | sort
```

For each controller, `cat` the file and extract:
- Base path from `@RequestMapping`
- Each endpoint: HTTP method, path, path variables, query parameters
- Request body type (if any)
- Response type
- Security annotations (`@PreAuthorize`, etc.)

> **📋 RECORD NOW:** List every controller and its endpoints in a working scratch note before writing any YAML. You will write paths controller-by-controller in Stage 2 — knowing the full list now prevents missing any.

### Step 2: Inventory All DTOs

```bash
echo "=== DTO INVENTORY ==="
find src/main -name "*Dto.java" -o -name "*DTO.java" -o -name "*Request.java" -o -name "*Response.java" | sort
```

For each DTO, `cat` the file and extract:
- All fields with types
- Validation annotations on each field
- Nested object references
- Generic type parameters (e.g., `Page<EntityDto>`)

> **📋 RECORD NOW:** List every DTO and its fields in a working scratch note. You will write schemas group-by-group in Stage 3 — knowing the full list prevents missing any.

### Step 3: Inventory All API-Facing Enums

```bash
echo "=== ENUM INVENTORY ==="
# Find enums referenced in DTOs
grep -rhn "enum" src/main/ --include="*Dto.java" --include="*Request.java" --include="*Response.java" | sort -u
# Find enum definitions
find src/main -name "*.java" -path "*/enum/*" -o -name "*Status.java" -o -name "*Type.java" | xargs grep -l "^public enum" 2>/dev/null | sort
```

For each enum used in DTOs, `cat` the file and extract all values.

> **📋 RECORD NOW:** List every API-facing enum and its values. These become `components/schemas` entries in Stage 3.

### Step 4: Extract Security Configuration

```bash
echo "=== SECURITY CONFIG ==="
find src/main -name "*SecurityConfig*.java" -o -name "*WebSecurityConfig*.java" | head -1 | xargs cat 2>/dev/null
```

Extract:
- Which endpoints are public (permitAll)
- Which require authentication
- Role-based restrictions

> **📋 RECORD NOW:** Note the security matrix. This drives `security: []` vs `security: [{bearerAuth: []}]` on every path entry.

### Step 5: Extract Error Response Format

```bash
echo "=== ERROR HANDLER ==="
find src/main -name "*ExceptionHandler*.java" -o -name "*ControllerAdvice*.java" | head -1 | xargs cat 2>/dev/null
```

Extract the standard error response structure.

> **✅ INVENTORY COMPLETE — BEGIN WRITING PHASE**
>
> All five inventory steps are done. Do not go back to reading source files during the writing phase. Now execute the four stages in order:
> - **Stage 1:** Initialize the file with the YAML header (openapi, info, servers, tags, `paths:`)
> - **Stage 2:** Append paths one controller at a time
> - **Stage 3:** Append `components:\n  schemas:` then schema groups one at a time
> - **Stage 4:** Append `  responses:` and `  securitySchemes:` to close the file

---

## OpenAPI Specification Structure

Generate the spec as `<project-directory-name>-OpenAPI.yaml` in the project root, written **in four stages** using shell append commands (see OUTPUT STRATEGY above). Never emit the full YAML as a single block.

---

### Stage 1 — Initialize File (Header + `paths:` opener)

Run **once**, immediately after completing the five inventory steps. This creates the file and writes everything up to (and including) the `paths:` key.

```bash
PROJECT_DIR=$(basename "$(pwd)")
OPENAPI_FILE="${PROJECT_DIR}-OpenAPI.yaml"

cat > "$OPENAPI_FILE" << YAML_HEADER
openapi: 3.0.3
info:
  title: ${PROJECT_DIR} API
  version: 1.0.0
  description: |
    Auto-generated OpenAPI specification for ${PROJECT_DIR}.
    Generated by OpenCode from source file analysis.

    **Generation timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
    **Source commit:** $(git log -1 --format='%H')

servers:
  - url: http://localhost:8080
    description: Local development
  - url: https://api.example.com
    description: Production (update URL)

tags:
  - name: Authentication
    description: Login, registration, token management
  - name: Users
    description: User management endpoints
  # (add one tag per controller/resource group discovered in Step 1)

paths:
YAML_HEADER

echo "✓ Stage 1 complete — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Execute the Stage 1 block above before writing any paths.

---

### Stage 2 — Append `paths:` Entries (One Controller at a Time)

For **each controller** discovered in Step 1, append its paths immediately after processing it. Do not batch multiple controllers into one write.

Example pattern for one controller group:

```bash
cat >> "$OPENAPI_FILE" << 'CONTROLLER_BLOCK'
  /api/auth/register:
    post:
      summary: Register new user
      operationId: registerUser
      tags: [Authentication]
      security: []  # Public endpoint
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          $ref: '#/components/responses/ValidationError'
        '409':
          $ref: '#/components/responses/Conflict'

  /api/auth/login:
    post:
      summary: Authenticate user
      operationId: loginUser
      tags: [Authentication]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
CONTROLLER_BLOCK
echo "✓ Auth paths appended — $(wc -l < "$OPENAPI_FILE") lines"
```

Repeat this pattern for every controller. Document EVERY endpoint:

```
  /api/resources:
    get:   — List with pagination
    post:  — Create

  /api/resources/{id}:
    get:    — Get by ID
    put:    — Full update
    patch:  — Partial update (if present)
    delete: — Delete
```

All path entries use 2-space indentation under `paths:`. All `$ref` values use single-quoted strings. Pagination parameters follow this standard pattern:

```yaml
      parameters:
        - name: page
          in: query
          description: Page number (0-indexed)
          schema:
            type: integer
            default: 0
            minimum: 0
        - name: size
          in: query
          description: Page size
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
        - name: sort
          in: query
          description: Sort field and direction (e.g., "createdAt,desc")
          schema:
            type: string
```

> **✍️ WRITE NOW after each controller:** Append that controller's paths to `$OPENAPI_FILE` before moving to the next controller. Confirm with `echo "✓ [ControllerName] paths written — $(wc -l < "$OPENAPI_FILE") lines"`.

---

### Stage 3 — Append `components/schemas:` (One Group at a Time)

Open the components block first (run **once**, after all paths are written):

```bash
cat >> "$OPENAPI_FILE" << 'COMPONENTS_OPEN'
components:
  schemas:
COMPONENTS_OPEN
echo "✓ components/schemas opened — $(wc -l < "$OPENAPI_FILE") lines"
```

Then append each schema group immediately after completing it. Process in this order:

**Group A — Request DTOs** (one DTO at a time):

```bash
cat >> "$OPENAPI_FILE" << 'REQUEST_DTOS'
    # === REQUEST DTOs ===
    RegisterRequest:
      type: object
      required:
        - email
        - password
        - firstName
        - lastName
      properties:
        email:
          type: string
          format: email
          maxLength: 255
          description: User's email address
        password:
          type: string
          minLength: 8
          maxLength: 100
          description: Password (min 8 characters)
        firstName:
          type: string
          minLength: 1
          maxLength: 100
        lastName:
          type: string
          minLength: 1
          maxLength: 100

    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    CreateResourceRequest:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        description:
          type: string
          maxLength: 500
        status:
          $ref: '#/components/schemas/ResourceStatus'

    UpdateResourceRequest:
      type: object
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        description:
          type: string
          maxLength: 500
        status:
          $ref: '#/components/schemas/ResourceStatus'
REQUEST_DTOS
echo "✓ Request DTOs written — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Append request DTOs immediately. If there are many DTOs, write each one individually rather than batching.

**Group B — Response DTOs** (one DTO at a time):

```bash
cat >> "$OPENAPI_FILE" << 'RESPONSE_DTOS'
    # === RESPONSE DTOs ===
    AuthResponse:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT access token
        tokenType:
          type: string
          default: Bearer
        expiresIn:
          type: integer
          description: Token expiration in seconds
        user:
          $ref: '#/components/schemas/UserDto'

    UserDto:
      type: object
      properties:
        id:
          type: integer
          format: int64
          readOnly: true
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        roles:
          type: array
          items:
            type: string
        createdAt:
          type: string
          format: date-time
          readOnly: true

    ResourceDto:
      type: object
      properties:
        id:
          type: integer
          format: int64
          readOnly: true
        name:
          type: string
        description:
          type: string
        status:
          $ref: '#/components/schemas/ResourceStatus'
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true
RESPONSE_DTOS
echo "✓ Response DTOs written — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Append response DTOs immediately.

**Group C — Pagination Wrappers** (one per paginated entity):

```bash
cat >> "$OPENAPI_FILE" << 'PAGINATION_SCHEMAS'
    # === PAGINATION WRAPPER ===
    PagedResourceResponse:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: '#/components/schemas/ResourceDto'
        page:
          type: integer
          description: Current page number (0-indexed)
        size:
          type: integer
          description: Page size
        totalElements:
          type: integer
          format: int64
          description: Total number of elements
        totalPages:
          type: integer
          description: Total number of pages
        first:
          type: boolean
          description: Is this the first page?
        last:
          type: boolean
          description: Is this the last page?
PAGINATION_SCHEMAS
echo "✓ Pagination schemas written — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Append pagination wrappers immediately.

**Group D — Enums** (one enum at a time):

```bash
cat >> "$OPENAPI_FILE" << 'ENUM_SCHEMAS'
    # === ENUMS ===
    ResourceStatus:
      type: string
      enum:
        - DRAFT
        - ACTIVE
        - ARCHIVED
      description: |
        Resource lifecycle status:
        - DRAFT: Not yet published
        - ACTIVE: Currently active
        - ARCHIVED: No longer active
ENUM_SCHEMAS
echo "✓ Enum schemas written — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Append all enum schemas immediately.

**Group E — Error Schemas:**

```bash
cat >> "$OPENAPI_FILE" << 'ERROR_SCHEMAS'
    # === ERROR RESPONSES ===
    ErrorResponse:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
        status:
          type: integer
        error:
          type: string
        message:
          type: string
        path:
          type: string

    ValidationErrorResponse:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
        status:
          type: integer
          example: 400
        error:
          type: string
          example: Bad Request
        message:
          type: string
        path:
          type: string
        fieldErrors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
              rejectedValue:
                type: string
ERROR_SCHEMAS
echo "✓ Error schemas written — $(wc -l < "$OPENAPI_FILE") lines"
```

> **✍️ WRITE NOW:** Append error schemas immediately.

---

### Stage 4 — Append `responses:` and `securitySchemes:` (Close the File)

Run **once** after all schemas are written:

```bash
cat >> "$OPENAPI_FILE" << 'COMPONENTS_CLOSE'
  responses:
    Unauthorized:
      description: Missing or invalid authentication token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            timestamp: "2024-01-15T10:30:00Z"
            status: 401
            error: Unauthorized
            message: Full authentication is required
            path: /api/resources

    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            timestamp: "2024-01-15T10:30:00Z"
            status: 403
            error: Forbidden
            message: Access denied
            path: /api/admin/users

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            timestamp: "2024-01-15T10:30:00Z"
            status: 404
            error: Not Found
            message: Resource not found with id 123
            path: /api/resources/123

    ValidationError:
      description: Request validation failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ValidationErrorResponse'
          example:
            timestamp: "2024-01-15T10:30:00Z"
            status: 400
            error: Bad Request
            message: Validation failed
            path: /api/resources
            fieldErrors:
              - field: name
                message: must not be blank
                rejectedValue: ""

    Conflict:
      description: Resource conflict (e.g., duplicate email)
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            timestamp: "2024-01-15T10:30:00Z"
            status: 409
            error: Conflict
            message: Email already registered
            path: /api/auth/register

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /api/auth/login
COMPONENTS_CLOSE
echo "✓ Stage 4 complete — spec fully written — $(wc -l < "$OPENAPI_FILE") lines total"
```

> **✍️ WRITE NOW:** Execute Stage 4 to close the file. Then proceed immediately to Verification.

---

## Validation Annotation Mapping

When documenting DTO fields, map Java validation annotations to OpenAPI constraints:

| Java Annotation | OpenAPI Property |
|-----------------|------------------|
| `@NotNull` / `@NotBlank` | Add field to `required` array |
| `@Size(min=1, max=100)` | `minLength: 1, maxLength: 100` |
| `@Min(0)` | `minimum: 0` |
| `@Max(100)` | `maximum: 100` |
| `@Email` | `format: email` |
| `@Pattern(regexp="...")` | `pattern: "..."` |
| `@Positive` | `minimum: 1` (exclusive: false) |
| `@PositiveOrZero` | `minimum: 0` |
| `@Negative` | `maximum: -1` |
| `@Past` | `format: date-time` (note: past date in description) |
| `@Future` | `format: date-time` (note: future date in description) |
| `@DecimalMin("0.00")` | `minimum: 0.00` |
| `@DecimalMax("100.00")` | `maximum: 100.00` |
| `@Digits(integer=10, fraction=2)` | `type: number` (note format in description) |

---

## Output Format

**Naming convention:** The file is named after the project's root directory name.

```
ProjectName/
├── ProjectName-Audit.md       ← generated by Codebase-Audit-Template.md
├── ProjectName-Scorecard.md   ← generated by Codebase-Audit-Template.md
├── ProjectName-OpenAPI.yaml   ← THIS FILE (generated by this template)
├── src/
└── ...
```

Determine the name automatically:
```bash
PROJECT_DIR=$(basename "$(pwd)")
OPENAPI_FILE="${PROJECT_DIR}-OpenAPI.yaml"
echo "OpenAPI Spec: $OPENAPI_FILE"
```

The spec is written across four stages as described in the OUTPUT STRATEGY and OpenAPI Specification Structure sections above. At no point should the full YAML be buffered and emitted as a single block. After Stage 4 completes, run Verification.

---

## Verification

After generating the spec, verify completeness:

```bash
echo "=== OPENAPI COMPLETENESS CHECK ==="
PROJECT_DIR=$(basename "$(pwd)")
OPENAPI_FILE="${PROJECT_DIR}-OpenAPI.yaml"

echo "OpenAPI spec: $OPENAPI_FILE"
test -f "$OPENAPI_FILE" && echo "  EXISTS" || echo "  MISSING"

echo ""
echo "Endpoints in code:"
CODE_ENDPOINTS=$(grep -rn "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@PatchMapping" src/main/ --include="*Controller.java" 2>/dev/null | wc -l)
echo "  $CODE_ENDPOINTS"

echo "Paths in OpenAPI spec:"
SPEC_PATHS=$(grep -c "^  /api\|^  /" "$OPENAPI_FILE" 2>/dev/null || echo 0)
echo "  $SPEC_PATHS"

echo ""
echo "DTOs in code:"
CODE_DTOS=$(find src/main -name "*Dto.java" -o -name "*DTO.java" -o -name "*Request.java" -o -name "*Response.java" 2>/dev/null | wc -l)
echo "  $CODE_DTOS"

echo "Schemas in OpenAPI spec:"
SPEC_SCHEMAS=$(grep -c "^    [A-Z][a-zA-Z]*:" "$OPENAPI_FILE" 2>/dev/null || echo 0)
echo "  $SPEC_SCHEMAS"

echo ""
if [ "$SPEC_PATHS" -lt "$CODE_ENDPOINTS" ]; then
  echo "WARNING: OpenAPI spec may be missing endpoints. Review and fix before committing."
  echo "Missing endpoint check:"
  echo "Controllers:"
  find src/main -name "*Controller.java" | while read f; do
    echo "  $f"
    grep -n "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@PatchMapping" "$f" | head -5
  done
fi

echo ""
echo "Validating YAML syntax..."
if command -v python3 &> /dev/null; then
  python3 -c "import yaml; yaml.safe_load(open('$OPENAPI_FILE'))" && echo "  YAML VALID" || echo "  YAML INVALID"
elif command -v node &> /dev/null; then
  node -e "require('fs').readFileSync('$OPENAPI_FILE', 'utf8')" && echo "  File readable" || echo "  File error"
else
  echo "  (No YAML validator available)"
fi
```

---

## Endpoint Checklist

Before committing, manually verify these are documented:

```
[ ] All GET endpoints (list, get by ID, search)
[ ] All POST endpoints (create, custom actions)
[ ] All PUT endpoints (full update)
[ ] All PATCH endpoints (partial update)
[ ] All DELETE endpoints
[ ] All path parameters with correct types
[ ] All query parameters with defaults and constraints
[ ] All request body schemas
[ ] All response schemas for success cases
[ ] All error responses (400, 401, 403, 404, 409, 500)
[ ] Authentication requirements per endpoint
[ ] Pagination parameters and response wrapper
[ ] All enums with complete value lists
```

---

## Completion

```bash
PROJECT_DIR=$(basename "$(pwd)")
OPENAPI_FILE="${PROJECT_DIR}-OpenAPI.yaml"
git add "$OPENAPI_FILE"
git commit -m "OpenAPI spec — $(date +%Y-%m-%d)"
git push
```

**REMINDER:** Also run `Codebase-Audit-Template.md` if you haven't already to generate the codebase audit and scorecard.
