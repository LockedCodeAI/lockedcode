# Code Review — Prompt Template

**Usage:** Copy this template, replace `{{PROJECT_NAME}}` and `{{PROJECT_ROOT}}` with actual values, and run as a Claude Code prompt. This produces a structured code review report with categorized findings and a remediation queue. **This template requires a current Codebase Audit and OpenAPI spec to already exist.**

**How this relates to the Codebase Audit:**
- The **Codebase Audit** answers: *"What exists in this codebase?"* — it's a structural inventory.
- The **Code Review** answers: *"What's wrong with this codebase?"* — it's a correctness and quality critique.
- The **OpenAPI spec** answers: *"What does the API contract look like?"* — it's the endpoint truth.

These three documents together give a complete picture. The audit is the map, the OpenAPI spec is the contract, and the code review is the inspection report.

**When to run this review:** Run after completing a feature, before a release, after a major refactor, or on any codebase you're inheriting or onboarding. Unlike the audit (which is re-run when the codebase shape changes), the code review is run when you want to assess quality and identify problems. You can run both in the same session — audit first, then review.

**This template produces one file:**
1. `<ProjectName>-CodeReview.md` — Categorized findings with severity, location, and remediation guidance

**Prerequisites (MUST exist before running):**
1. `<ProjectName>-Audit.md` — Current codebase audit
2. `<ProjectName>-OpenAPI.yaml` — Current API specification
3. `CONVENTIONS.md` — Project conventions (if applicable)

---

## Language / Ecosystem Neutrality

This template is **language-agnostic**. It covers Java/Kotlin, TypeScript/JavaScript, Dart/Flutter, Python, Go, Rust, C/C++, C#/.NET, Swift, and any other language. Where a section references "service," "controller," or "entity," adapt terminology to the ecosystem. The review's job is to find problems in the actual code, using whatever vocabulary the codebase itself uses.

---

## ⚠️ OUTPUT STRATEGY — READ THIS BEFORE WRITING ANYTHING

**Large codebases will exceed the maximum output token limit if the entire review is written in a single response.** To prevent silent truncation or hard failures, you MUST write the review file section by section using shell append commands. **Never buffer the full review in memory and emit it all at once.**

### Required section-by-section write pattern

After completing each numbered section (1 through 16), immediately write it to disk before moving to the next section:

```bash
# Initialize the file (run ONCE at start, after deleting old files)
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"
cat > "$REVIEW_FILE" << 'HEADER'
# ProjectName — Code Review
... (header block)
HEADER

# Then for EVERY section, append immediately after completing it:
cat >> "$REVIEW_FILE" << 'SECTION'
### 1. Section Name
... (section content)
SECTION

# Confirm the write succeeded before continuing:
echo "✓ Section N written — $(wc -l < "$REVIEW_FILE") lines so far"
```

**Rules for section-by-section writing:**
- Write each section to disk immediately after completing its analysis — do not wait until the end.
- Use `cat >> "$REVIEW_FILE"` (append, not overwrite) for every section after the first.
- After every write, echo the running line count as confirmation.
- If a section produces very large output (e.g., full grep results), pipe it directly into the file.
- **Never attempt to write more than one section at a time in a single output block.**

---

## Instructions

You are producing a comprehensive code review of the `{{PROJECT_NAME}}` codebase. This review will be consumed by an AI architect or a human engineer. Unlike the codebase audit (which inventories what exists), this review identifies **what's wrong, what's risky, and what needs to change.**

**This review handles:** correctness, logic errors, dead code, performance anti-patterns, security vulnerabilities, convention violations, test quality, exception handling, concurrency issues, and API contract fidelity.

**The codebase audit handles:** structural inventory of models, services, controllers, configuration, and infrastructure.

**The OpenAPI spec handles:** endpoint contracts, DTOs, request/response schemas.

### CRITICAL — Prerequisites Check

The audit and OpenAPI spec are your source of truth for what the codebase contains. You compare actual code against those references to find drift, inconsistencies, and problems.

**Run this FIRST, before anything else:**

```bash
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"
AUDIT_FILE="${PROJECT_DIR}-Audit.md"

echo "=== PREREQUISITES CHECK ==="
echo "=== CLEARING PREVIOUS CODE REVIEW ==="
[ -f "$REVIEW_FILE" ] && rm -v "$REVIEW_FILE" || echo "No existing review file"

echo ""
echo "Checking required files..."
test -f "$AUDIT_FILE" && echo "  AUDIT: EXISTS — $AUDIT_FILE" || echo "  AUDIT: MISSING — Run Codebase-Audit-Template.md first"
ls ${PROJECT_DIR}*OpenAPI*.yaml ${PROJECT_DIR}*openapi*.yaml openapi.yaml 2>/dev/null | head -1 && echo "  OPENAPI: EXISTS" || echo "  OPENAPI: MISSING — Run OpenAPI-Template.md first"
test -f "CONVENTIONS.md" && echo "  CONVENTIONS: EXISTS" || echo "  CONVENTIONS: Not found (will skip convention checks)"
echo "=== END PREREQUISITES CHECK ==="
```

**If the audit or OpenAPI spec is missing, STOP. Do not proceed. Run those templates first.**

### CRITICAL — Delete Existing Review Files Before Starting

```bash
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"
[ -f "$REVIEW_FILE" ] && rm -v "$REVIEW_FILE" || echo "No existing review file"
echo "=== STARTING FRESH CODE REVIEW ==="
```

**Rules:**
- `cat` every file before reviewing it. Never critique a file from memory.
- Never read or reference a previous code review file. Build everything from source.
- Every finding must include the exact file path, line number(s), and a concrete description of the problem.
- Every finding must have a severity: **CRITICAL**, **HIGH**, **MEDIUM**, or **LOW**.
- **CRITICAL** = blocks deployment, data loss risk, security vulnerability, or broken functionality.
- **HIGH** = significant correctness or performance issue that will cause problems in production.
- **MEDIUM** = code quality issue, maintenance burden, or minor risk.
- **LOW** = style, convention, or improvement opportunity.
- If you find nothing wrong in a section, document "No findings" — never skip a section.

### Finding Format

Every finding in every section uses this consistent format:

```
| ID | Severity | File:Line | Finding | Remediation |
|----|----------|-----------|---------|-------------|
| CR-XX-NN | CRITICAL/HIGH/MEDIUM/LOW | path/to/file.ext:42 | What's wrong | What to do about it |
```

Where `XX` is the section number and `NN` is the finding number within that section (e.g., CR-03-01 is the first finding in Section 3).

---

## Review Sections

Produce the review as a Markdown file named `<project-directory-name>-CodeReview.md` in the project root, written **section by section** using shell append commands (see OUTPUT STRATEGY above).

**After completing each section below, immediately append it to the review file. Do not proceed to the next section until the current one is written to disk.**

---

### 1. Review Identity

```
Project Name:
Repository URL:
Primary Language / Framework:
Current Branch:
Latest Commit Hash:
Review Timestamp:
Audit File Referenced:
OpenAPI Spec Referenced:
```

Run:
```bash
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git log -1 --format='%H %s')"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

> **✍️ WRITE NOW:** Initialize `$REVIEW_FILE` with header and Section 1 before continuing to Section 2.

---

### 2. Dead Code Detection

Identify code that exists but is never called, never reached, or serves no purpose. Dead code is maintenance burden, cognitive overhead, and a hiding place for bugs.

**2a. Unused Imports / Includes**

```bash
echo "=== UNUSED IMPORTS ==="

# Java/Kotlin — look for imports not referenced in the file
for f in $(find . -name "*.java" -o -name "*.kt" 2>/dev/null | grep -v target | grep -v build | grep -v test | grep -v node_modules); do
  UNUSED=$(awk '/^import /{split($2,a,"."); gsub(/;/,"",a[length(a)]); name=a[length(a)]; imports[NR]=name; lines[NR]=$0} !/^import /{content=content $0 " "} END{for(i in imports){if(index(content,imports[i])==0) print lines[i]}}' "$f" 2>/dev/null)
  if [ -n "$UNUSED" ]; then echo "  $f:"; echo "$UNUSED" | head -10; fi
done

# TypeScript/JavaScript — look for imports not referenced
for f in $(find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | grep -v node_modules | grep -v dist | grep -v build | grep -v ".spec." | grep -v ".test."); do
  grep -n "^import " "$f" 2>/dev/null | while read line; do
    IMPORTED=$(echo "$line" | sed 's/.*import.*{\(.*\)}.*/\1/' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v "^$" | head -5)
    for name in $IMPORTED; do
      CLEAN=$(echo "$name" | sed 's/ as .*//')
      COUNT=$(grep -c "$CLEAN" "$f" 2>/dev/null)
      if [ "$COUNT" -le 1 ]; then echo "  $f: possibly unused import '$CLEAN'"; fi
    done
  done
done

# Dart
for f in $(find . -name "*.dart" 2>/dev/null | grep -v ".g.dart" | grep -v ".freezed.dart" | grep -v .dart_tool | grep -v build | grep -v test); do
  grep -n "^import " "$f" 2>/dev/null | while read line; do
    SHOW_NAME=$(echo "$line" | grep "show " | sed 's/.*show \(.*\);/\1/' | tr ',' '\n' | sed 's/^ *//;s/ *$//')
    if [ -n "$SHOW_NAME" ]; then
      for name in $SHOW_NAME; do
        COUNT=$(grep -c "$name" "$f" 2>/dev/null)
        if [ "$COUNT" -le 1 ]; then echo "  $f: possibly unused import '$name'"; fi
      done
    fi
  done
done

# Python
for f in $(find . -name "*.py" 2>/dev/null | grep -v __pycache__ | grep -v .venv | grep -v test | grep -v migrations); do
  grep -n "^from .* import \|^import " "$f" 2>/dev/null | while read line; do
    NAMES=$(echo "$line" | sed 's/.*import //;s/ as [a-zA-Z_]*//' | tr ',' '\n' | sed 's/^ *//;s/ *$//')
    for name in $NAMES; do
      COUNT=$(grep -c "$name" "$f" 2>/dev/null)
      if [ "$COUNT" -le 1 ] && [ -n "$name" ]; then echo "  $f: possibly unused import '$name'"; fi
    done
  done
done

echo "=== END UNUSED IMPORTS ==="
```

**2b. Orphaned Files**

Files that exist but are never imported, included, or referenced by any other file in the project:

```bash
echo "=== ORPHANED FILE SCAN ==="

# Get all source files
SRC_FILES=$(find . -type f \( \
  -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
  -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.dart" \
  -o -name "*.cs" -o -name "*.swift" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" -not -path "*/vendor/*" -not -path "*/__pycache__/*" -not -path "*/.dart_tool/*" -not -path "*/test*" -not -path "*/spec*" 2>/dev/null)

for f in $SRC_FILES; do
  BASENAME=$(basename "$f" | sed 's/\.[^.]*$//')
  # Skip common entry points
  case "$BASENAME" in
    main|Main|index|App|app|Application|Program|mod|lib) continue ;;
  esac
  # Check if any other file references this filename
  REFS=$(grep -rl "$BASENAME" --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" --include="*.dart" --include="*.cs" --include="*.swift" --include="*.xml" --include="*.yaml" --include="*.yml" --include="*.json" . 2>/dev/null | grep -v "$f" | grep -v node_modules | grep -v target | grep -v build | head -1)
  if [ -z "$REFS" ]; then
    echo "  ORPHAN CANDIDATE: $f (no references found)"
  fi
done

echo "=== END ORPHANED FILE SCAN ==="
```

**2c. Unreachable Code Patterns**

```bash
echo "=== UNREACHABLE CODE PATTERNS ==="

# Code after return/throw/break/continue
grep -rn "return .*;\|throw .*;\|break;\|continue;" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  NEXT_LINE=$((LINE_NUM + 1))
  NEXT_CONTENT=$(sed -n "${NEXT_LINE}p" "$FILE" 2>/dev/null | sed 's/^ *//')
  # Check if next line is actual code (not closing brace, comment, or empty)
  if echo "$NEXT_CONTENT" | grep -qv "^$\|^}\|^//\|^\*\|^#\|^case \|^default:" 2>/dev/null; then
    if [ -n "$NEXT_CONTENT" ]; then
      echo "  $FILE:$LINE_NUM — code after return/throw/break may be unreachable"
    fi
  fi
done | head -30

# Commented-out code blocks (more than 3 consecutive commented lines)
echo ""
echo "--- Commented-out code blocks ---"
for f in $(find . -type f \( \
  -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" -o -name "*.dart" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/build/*" -not -path "*/test*" 2>/dev/null); do
  awk '
    /^[[:space:]]*(\/\/|#).*[=;(){}\[\]]/ { count++; start=(count==1)?NR:start; next }
    { if(count>=3) print "  '"$f"':" start "-" NR-1 " (" count " lines of commented-out code)"; count=0 }
    END { if(count>=3) print "  '"$f"':" start "-" NR " (" count " lines of commented-out code)" }
  ' "$f" 2>/dev/null
done | head -20

echo "=== END UNREACHABLE CODE PATTERNS ==="
```

Review the output. For each confirmed finding, document it in the findings table. False positives from the scans should be excluded — verify each candidate by reading the actual file before reporting.

> **✍️ WRITE NOW:** Append Section 2 to `$REVIEW_FILE` before continuing to Section 3.

---

### 3. API Contract Fidelity

Compare the actual implementation against the OpenAPI spec. Every deviation is a finding. The OpenAPI spec is the contract — the implementation must match exactly.

**For every endpoint defined in the OpenAPI spec**, `cat` both the controller/handler and the spec entry, then verify:

```
Endpoint: METHOD /path
Spec Says:
  - Request body fields: (list from spec)
  - Response body fields: (list from spec)
  - Status codes: (list from spec)
  - Required fields: (list from spec)
  - Validation rules: (list from spec)

Implementation Does:
  - Request body fields: (list from actual DTO/handler)
  - Response body fields: (list from actual DTO/handler)
  - Status codes: (list from actual handler)
  - Required fields: (list from actual validation)
  - Validation rules: (list from actual validation)

Drift: (list every discrepancy — missing fields, wrong types, extra fields not in spec, missing validation, wrong status codes)
```

Common drift patterns to check:
- Fields in the DTO that aren't in the spec (or vice versa)
- Enum values in code that don't match the spec
- Status codes returned by the handler that aren't documented in the spec
- Required/optional mismatch between spec and validation annotations
- Response wrapper differences (e.g., spec says `{ "data": {...} }` but handler returns `{...}` directly)
- Path parameter names don't match
- Query parameter names or types don't match

> **✍️ WRITE NOW:** Append Section 3 to `$REVIEW_FILE` before continuing to Section 4.

---

### 4. Logic & Correctness Analysis

**For every service/business-logic method**, read the actual implementation and assess correctness. This is the most important section of the review. Do not skim — `cat` every service file and analyze each public method.

Check for:

- **Off-by-one errors** in loops, pagination, slicing, or boundary conditions
- **Null/nil/None handling** — are null checks present where needed? Are there paths that dereference potentially null values?
- **Empty collection handling** — what happens when a list, set, or map is empty? Does the code handle the zero-element case?
- **State machine violations** — if the code enforces status transitions, are all transitions validated? Can invalid transitions occur?
- **Race conditions in business logic** — are there check-then-act patterns without proper synchronization?
- **Partial failure handling** — if a method does A then B then C, what happens if B fails? Is A rolled back? Is C skipped?
- **Integer overflow / precision loss** — are there calculations where integer overflow or floating-point precision could matter?
- **String comparison issues** — case sensitivity, locale-dependent comparisons, trimming
- **Date/time handling** — timezone awareness, daylight saving transitions, date arithmetic edge cases
- **Incorrect boolean logic** — negation errors, short-circuit evaluation assumptions, De Morgan's law violations

For each finding, include:
- The exact method and file
- What the code does wrong
- What the correct behavior should be
- A specific scenario that triggers the bug

> **✍️ WRITE NOW:** Append Section 4 to `$REVIEW_FILE` before continuing to Section 5. If services are numerous, write each service's findings individually.

---

### 5. Exception & Error Handling Completeness

Analyze every try/catch, error return, exception handler, and error boundary. Incomplete error handling is a top source of production incidents.

**5a. Swallowed Exceptions**

```bash
echo "=== SWALLOWED EXCEPTIONS ==="

# Java/Kotlin — empty catch blocks
grep -rn "catch.*{" --include="*.java" --include="*.kt" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  NEXT_LINE=$((LINE_NUM + 1))
  NEXT_CONTENT=$(sed -n "${NEXT_LINE}p" "$FILE" 2>/dev/null | sed 's/^ *//')
  if echo "$NEXT_CONTENT" | grep -q "^}" 2>/dev/null; then
    echo "  EMPTY CATCH: $FILE:$LINE_NUM"
  fi
done

# TypeScript/JavaScript
grep -rn "catch.*{" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  NEXT_LINE=$((LINE_NUM + 1))
  NEXT_CONTENT=$(sed -n "${NEXT_LINE}p" "$FILE" 2>/dev/null | sed 's/^ *//')
  if echo "$NEXT_CONTENT" | grep -q "^}" 2>/dev/null; then
    echo "  EMPTY CATCH: $FILE:$LINE_NUM"
  fi
done

# Python — bare except or pass-only except
grep -rn "except.*:" --include="*.py" . 2>/dev/null | grep -v __pycache__ | grep -v .venv | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  NEXT_LINE=$((LINE_NUM + 1))
  NEXT_CONTENT=$(sed -n "${NEXT_LINE}p" "$FILE" 2>/dev/null | sed 's/^ *//')
  if echo "$NEXT_CONTENT" | grep -q "^pass$" 2>/dev/null; then
    echo "  SWALLOWED (pass): $FILE:$LINE_NUM"
  fi
  # Bare except (no exception type)
  echo "$line" | grep -q "except:" && echo "  BARE EXCEPT: $FILE:$LINE_NUM"
done

echo "=== END SWALLOWED EXCEPTIONS ==="
```

**5b. Inconsistent Error Responses**

Read the global error handler (documented in the audit, Section 13). Then check every controller/handler to verify that errors are routed through the global handler and not returned in ad-hoc formats.

```bash
echo "=== AD-HOC ERROR RESPONSES ==="

# Look for controllers/handlers that construct their own error responses instead of throwing to the global handler
grep -rn "ResponseEntity.*HttpStatus\.\(BAD_REQUEST\|NOT_FOUND\|INTERNAL_SERVER_ERROR\|FORBIDDEN\|UNAUTHORIZED\)" \
  --include="*.java" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | grep -v "GlobalException\|ErrorHandler\|ExceptionHandler\|ControllerAdvice"

grep -rn "res\.status(4\|res\.status(5\|ctx\.status(4\|ctx\.status(5" \
  --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v test | grep -v "error\|middleware\|filter\|handler"

grep -rn "Response(status_code=4\|Response(status_code=5\|JSONResponse(status_code=4\|JSONResponse(status_code=5" \
  --include="*.py" . 2>/dev/null | grep -v __pycache__ | grep -v .venv | grep -v test | grep -v "exception\|error\|handler\|middleware"

echo "=== END AD-HOC ERROR RESPONSES ==="
```

**5c. Unhandled Edge Cases**

For each service method that queries data, verify:
- What happens when the query returns zero results?
- What happens when the query returns null/None?
- What happens when optional parameters are missing?
- What happens when the input contains boundary values (empty string, zero, negative, max int)?

Document each gap as a finding.

> **✍️ WRITE NOW:** Append Section 5 to `$REVIEW_FILE` before continuing to Section 6.

---

### 6. Concurrency & Thread Safety

Identify patterns that are unsafe under concurrent access. This matters for any web server handling multiple requests, any async runtime, or any multi-threaded application.

```bash
echo "=== CONCURRENCY PATTERNS ==="

# Shared mutable state without synchronization
grep -rn "static \(final \)\?[A-Z].*=.*new \(HashMap\|ArrayList\|HashSet\|LinkedList\|TreeMap\)" \
  --include="*.java" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test
grep -rn "static.*mut\|lazy_static!\|once_cell" \
  --include="*.rs" . 2>/dev/null | grep -v target | grep -v test

# Check-then-act patterns (TOCTOU)
echo ""
echo "--- Check-then-act patterns ---"
grep -rn "\.exists()\|\.isPresent()\|\.isEmpty()\|!= null\|!= None\|!== undefined\|\.is_some()\|\.is_ok()" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor | head -30

# Non-atomic read-modify-write
echo ""
echo "--- Non-atomic counter/state patterns ---"
grep -rn "count++\|count--\|counter++\|counter--\|\.incrementAndGet\|\.getAndIncrement\|+= 1\|-= 1" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.go" --include="*.rs" --include="*.cs" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor

echo "=== END CONCURRENCY PATTERNS ==="
```

**Manual review items:**
- Are database transactions used where multiple writes must be atomic?
- Are optimistic locking / version fields checked on updates?
- For async code: are there fire-and-forget patterns that lose errors?
- For connection pools: is the pool sized appropriately for expected concurrency?
- Are there singleton services holding mutable instance state?

> **✍️ WRITE NOW:** Append Section 6 to `$REVIEW_FILE` before continuing to Section 7.

---

### 7. Performance Anti-Patterns

Identify patterns that will cause performance problems under load.

**7a. N+1 Query Detection**

```bash
echo "=== N+1 QUERY PATTERNS ==="

# Loops containing repository/database calls
# Java/Spring
grep -rn "for.*{" --include="*.java" . 2>/dev/null | grep -v target | grep -v test | grep -v node_modules | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  # Look for repository calls within 10 lines after the for loop
  sed -n "$((LINE_NUM)),$((LINE_NUM+10))p" "$FILE" 2>/dev/null | grep -q "repository\.\|Repository\.\|findBy\|getBy\|dao\.\|Dao\." && echo "  POSSIBLE N+1: $FILE:$LINE_NUM — repository call inside loop"
done | head -20

# TypeScript/JavaScript
grep -rn "for.*{\|\.forEach\|\.map(" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  sed -n "$((LINE_NUM)),$((LINE_NUM+10))p" "$FILE" 2>/dev/null | grep -q "await.*find\|await.*get\|await.*query\|\.findOne\|\.findById" && echo "  POSSIBLE N+1: $FILE:$LINE_NUM — await in loop"
done | head -20

# Python
grep -rn "for .* in .*:" --include="*.py" . 2>/dev/null | grep -v __pycache__ | grep -v .venv | grep -v test | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  sed -n "$((LINE_NUM)),$((LINE_NUM+10))p" "$FILE" 2>/dev/null | grep -q "\.get(\|\.filter(\|\.objects\.\|session\.query\|await.*fetch" && echo "  POSSIBLE N+1: $FILE:$LINE_NUM — query inside loop"
done | head -20

echo "=== END N+1 QUERY PATTERNS ==="
```

**7b. Unbounded Collections**

```bash
echo "=== UNBOUNDED COLLECTION PATTERNS ==="

# findAll / getAll without pagination
grep -rn "\.findAll()\|\.getAll()\|\.list()\|\.objects\.all()\|SELECT \*.*FROM\|find({})\|\.find()\s*$" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor

# Missing LIMIT in raw queries
grep -rn "SELECT\|FROM " --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" . 2>/dev/null \
  | grep -v node_modules | grep -v target | grep -v test \
  | grep -iv "LIMIT\|TOP \|FETCH FIRST\|ROWNUM\|OFFSET" \
  | grep -iv "count(\|COUNT(\|max(\|MAX(\|min(\|MIN(\|sum(\|SUM(" \
  | head -20

echo "=== END UNBOUNDED COLLECTION PATTERNS ==="
```

**7c. Missing Pagination**

Check every list/search endpoint (from the OpenAPI spec). Verify that:
- The endpoint accepts pagination parameters (page/size or offset/limit)
- The service method passes those parameters to the data access layer
- The data access query actually applies pagination (not fetching all then slicing in memory)

**7d. Expensive Operations in Request Path**

```bash
echo "=== EXPENSIVE IN-REQUEST OPERATIONS ==="

# File I/O in controllers/handlers
grep -rn "File\|FileInputStream\|FileOutputStream\|readFile\|writeFile\|open(\|Path\.\|fs\.\|os\.path" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" \
  . 2>/dev/null | grep -iv "test\|spec\|mock" | grep -i "controller\|handler\|route\|endpoint\|resource\|view" | grep -v node_modules | grep -v target | head -10

# Sleep/delay in production code
grep -rn "Thread\.sleep\|time\.sleep\|setTimeout\|setInterval\|sleep(\|thread::sleep\|Task\.Delay\|await Future\.delayed" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor

echo "=== END EXPENSIVE IN-REQUEST OPERATIONS ==="
```

> **✍️ WRITE NOW:** Append Section 7 to `$REVIEW_FILE` before continuing to Section 8.

---

### 8. Security Deep Dive

Go beyond the scorecard's automated checks. Read the actual security implementation and evaluate it.

**8a. Authentication Bypass Paths**

Map every endpoint from the OpenAPI spec. Cross-reference against the security configuration (from the audit, Section 11). Identify:
- Endpoints that should require auth but are in the public path list
- Endpoints with role-based restrictions that don't check roles in the handler
- API versioning that might expose older, less-secured endpoints

**8b. Authorization Depth**

For every endpoint with role/permission requirements:
- Does the handler verify the authenticated user has access to the *specific resource* (not just the right role)?
- Example: `DELETE /api/users/{id}` — does it check that the caller is authorized to delete *that specific user*, or just that they have the "admin" role?
- This is the difference between role-based access and resource-level authorization.

**8c. Input Sanitization**

```bash
echo "=== INPUT SANITIZATION ==="

# HTML/script injection vectors — user input rendered without escaping
grep -rn "innerHTML\|dangerouslySetInnerHTML\|v-html\|{!!.*!!}\|\|safe\|mark_safe\|@Html\.Raw\|Html\.fromHtml" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.html" --include="*.vue" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test

# SQL injection — string concatenation in queries
grep -rn '"SELECT.*" +\|"INSERT.*" +\|"UPDATE.*" +\|"DELETE.*" +\|f"SELECT\|f"INSERT\|f"UPDATE\|f"DELETE' \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test

# Command injection
grep -rn "Runtime\.getRuntime().exec\|ProcessBuilder\|child_process\|subprocess\.\(call\|run\|Popen\)\|os\.system\|exec\.Command\|std::process::Command" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test

# Path traversal
grep -rn "\.\./\|\.\.\\\\\\\\\\|Path\.combine\|path\.join\|os\.path\.join\|Paths\.get" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.cs" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | head -15

echo "=== END INPUT SANITIZATION ==="
```

**8d. Sensitive Data Exposure**

```bash
echo "=== SENSITIVE DATA EXPOSURE ==="

# Passwords/secrets in log statements
grep -rn "log\.\|logger\.\|console\.log\|print(\|println\|fmt\.Print\|log\.Print" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -iv test | grep -iv spec | grep -i "password\|secret\|token\|api.key\|apiKey\|credential\|ssn\|credit.card\|cvv" | grep -v node_modules | grep -v target

# Passwords/tokens in response DTOs
grep -rn "password\|secret\|token\|apiKey\|api_key" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -i "dto\|response\|Resource\|ViewModel\|Serializer" | grep -v node_modules | grep -v target | grep -v test

# Hardcoded credentials
grep -rn "password.*=.*['\"].\{3,\}['\"]" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  --include="*.yml" --include="*.yaml" --include="*.json" --include="*.properties" --include="*.toml" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor | grep -v '\${' | grep -v "process\.env" | grep -v "os\.environ"

echo "=== END SENSITIVE DATA EXPOSURE ==="
```

> **✍️ WRITE NOW:** Append Section 8 to `$REVIEW_FILE` before continuing to Section 9.

---

### 9. Dependency Health

Assess the health and risk of every dependency.

```bash
echo "=== DEPENDENCY HEALTH ==="

# Check for outdated dependencies
# Java/Maven
if [ -f "pom.xml" ]; then
  echo "--- Maven dependency versions ---"
  mvn versions:display-dependency-updates -DprocessDependencyManagement=false 2>/dev/null | grep "\->" | head -30
  echo ""
  echo "--- Maven plugin updates ---"
  mvn versions:display-plugin-updates 2>/dev/null | grep "\->" | head -10
fi

# Node/npm
if [ -f "package.json" ]; then
  echo "--- npm outdated ---"
  npm outdated 2>/dev/null || echo "npm outdated failed"
fi

# Python
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  echo "--- pip outdated ---"
  pip list --outdated 2>/dev/null | head -20 || echo "pip list --outdated failed"
fi

# Dart/Flutter
if [ -f "pubspec.yaml" ]; then
  echo "--- dart pub outdated ---"
  dart pub outdated 2>/dev/null | head -30 || flutter pub outdated 2>/dev/null | head -30 || echo "pub outdated failed"
fi

# Go
if [ -f "go.mod" ]; then
  echo "--- Go module updates ---"
  go list -u -m all 2>/dev/null | grep '\[' | head -20 || echo "go list failed"
fi

# Rust
if [ -f "Cargo.toml" ]; then
  echo "--- cargo outdated ---"
  cargo outdated 2>/dev/null | head -20 || echo "cargo outdated not installed"
fi

# .NET
if ls *.csproj >/dev/null 2>&1; then
  echo "--- dotnet outdated ---"
  dotnet list package --outdated 2>/dev/null | head -20 || echo "dotnet list package failed"
fi

echo "=== END DEPENDENCY HEALTH ==="
```

**Manual review items:**
- Are there dependencies with known security advisories? (Cross-reference with Snyk results from the audit.)
- Are there dependencies that are abandoned/unmaintained (no commits in 12+ months)?
- Are there unnecessary dependencies (functionality that could be done with the standard library)?
- Are there multiple dependencies solving the same problem (e.g., two JSON libraries, two HTTP clients)?

> **✍️ WRITE NOW:** Append Section 9 to `$REVIEW_FILE` before continuing to Section 10.

---

### 10. Convention Compliance

If `CONVENTIONS.md` exists, read it and verify every convention is followed. If no conventions file exists, skip this section with "No CONVENTIONS.md found — skipping convention compliance check."

```bash
if [ -f "CONVENTIONS.md" ]; then
  echo "=== CONVENTIONS.md CONTENT ==="
  cat CONVENTIONS.md
  echo "=== END CONVENTIONS.md ==="
else
  echo "No CONVENTIONS.md found"
fi
```

**For each convention defined in the file**, verify compliance by reading actual source files. Common convention violations to check:
- Build tool violations (e.g., Gradle used when Maven is required)
- Wrong Java/language version
- Missing documentation comments
- Config values hardcoded instead of in constants files
- Missing role checks on controllers
- Wrong authentication patterns
- Test coverage below required threshold
- Naming convention violations

Every violation is a finding.

> **✍️ WRITE NOW:** Append Section 10 to `$REVIEW_FILE` before continuing to Section 11.

---

### 11. Test Quality Assessment

Coverage quantity is checked by the audit scorecard. This section assesses test **quality** — whether the tests actually verify correct behavior or just satisfy a coverage tool.

**11a. Test Anti-Patterns**

```bash
echo "=== TEST ANTI-PATTERNS ==="

# Tests that assert nothing
echo "--- Empty assertions ---"
grep -rn "@Test\|def test_\|it(\|describe(\|test(\|func Test" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | while read line; do
  FILE=$(echo "$line" | cut -d: -f1)
  LINE_NUM=$(echo "$line" | cut -d: -f2)
  # Check next 20 lines for any assertion
  BLOCK=$(sed -n "$((LINE_NUM)),$((LINE_NUM+20))p" "$FILE" 2>/dev/null)
  HAS_ASSERT=$(echo "$BLOCK" | grep -c "assert\|Assert\|expect\|should\|verify\|mock\|when\|given\|EXPECT_\|ASSERT_" 2>/dev/null)
  if [ "$HAS_ASSERT" -eq 0 ]; then
    echo "  NO ASSERTION: $FILE:$LINE_NUM"
  fi
done | head -20

# Tests that only assert not-null (weak assertions)
echo ""
echo "--- Weak assertions (only assertNotNull/toBeDefined) ---"
grep -rn "assertNotNull\|\.toBeDefined\|\.not\.toBeNull\|\.isNotNull\|assert .* is not None\|!= nil" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -i "test\|spec" | grep -v node_modules | grep -v target | head -20

# Tests with excessive mocking (more mocks than assertions)
echo ""
echo "--- Heavily mocked tests ---"
for f in $(find . -type f \( -name "*Test*" -o -name "*test*" -o -name "*spec*" -o -name "*Spec*" \) \( \
  -name "*.java" -o -name "*.kt" -o -name "*.ts" -o -name "*.js" -o -name "*.py" \
\) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/build/*" 2>/dev/null); do
  MOCK_COUNT=$(grep -c "mock\|Mock\|when(\|given(\|stub\|spy\|jest\.fn\|patch\|MagicMock" "$f" 2>/dev/null || echo 0)
  ASSERT_COUNT=$(grep -c "assert\|Assert\|expect\|verify\|should" "$f" 2>/dev/null || echo 0)
  if [ "$MOCK_COUNT" -gt 0 ] && [ "$ASSERT_COUNT" -gt 0 ]; then
    RATIO=$(echo "scale=1; $MOCK_COUNT / $ASSERT_COUNT" | bc 2>/dev/null || echo "0")
    if [ "$(echo "$RATIO > 3" | bc 2>/dev/null)" = "1" ]; then
      echo "  HIGH MOCK RATIO ($MOCK_COUNT mocks / $ASSERT_COUNT asserts = ${RATIO}x): $f"
    fi
  fi
done | head -10

echo "=== END TEST ANTI-PATTERNS ==="
```

**11b. Missing Test Scenarios**

For each service method, verify that tests exist for:
- Happy path (valid input → expected output)
- Invalid input (each validation rule has a test)
- Boundary conditions (empty list, max values, zero)
- Error cases (service dependency throws → correct error handling)
- Edge cases (null input, duplicate entries, concurrent access)

Document missing test scenarios as findings.

**11c. Integration Test Coverage**

Verify that integration tests exist for:
- Every REST endpoint (from the OpenAPI spec)
- Database operations (actual DB, not mocked)
- External service integrations (at minimum, the contract is tested)

> **✍️ WRITE NOW:** Append Section 11 to `$REVIEW_FILE` before continuing to Section 12.

---

### 12. Logging & Observability

Verify that the codebase has sufficient logging for production debugging and monitoring.

```bash
echo "=== LOGGING ANALYSIS ==="

# Check for centralized logging configuration
echo "--- Logging framework detection ---"
grep -rn "logback\|log4j\|winston\|pino\|bunyan\|structlog\|logrus\|slog\|tracing\|serilog\|NLog\|logger" \
  --include="*.xml" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.toml" --include="*.properties" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | head -10

# Check log levels used
echo ""
echo "--- Log level distribution ---"
echo -n "  ERROR/FATAL: "
grep -rn "\.error(\|\.fatal(\|log\.Error\|log\.Fatal\|logging\.error\|logging\.critical\|error!\|tracing::error" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | wc -l
echo -n "  WARN: "
grep -rn "\.warn(\|log\.Warn\|logging\.warning\|warn!\|tracing::warn" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | wc -l
echo -n "  INFO: "
grep -rn "\.info(\|log\.Info\|logging\.info\|info!\|tracing::info" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | wc -l
echo -n "  DEBUG/TRACE: "
grep -rn "\.debug(\|\.trace(\|log\.Debug\|log\.Trace\|logging\.debug\|debug!\|trace!\|tracing::debug\|tracing::trace" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" --include="*.dart" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | wc -l

# console.log / System.out.println / print() in production code (should be zero)
echo ""
echo "--- Non-framework logging (should be 0) ---"
echo -n "  console.log: "
grep -rn "console\.log\|console\.error\|console\.warn" \
  --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" \
  . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v test | grep -v spec | wc -l
echo -n "  System.out/err: "
grep -rn "System\.out\.print\|System\.err\.print" \
  --include="*.java" . 2>/dev/null | grep -v target | grep -v test | wc -l
echo -n "  print(): "
grep -rn "^[^#]*\bprint(" \
  --include="*.py" . 2>/dev/null | grep -v __pycache__ | grep -v .venv | grep -v test | grep -v migrations | wc -l

echo "=== END LOGGING ANALYSIS ==="
```

**Manual review items:**
- Does every catch/error handler log the error with sufficient context (request ID, user ID, operation name)?
- Are there service methods with no logging at all? (Silent operations are impossible to debug in production.)
- Is structured logging used (JSON format) or unstructured strings?
- Is there correlation ID / request ID propagation across service calls?
- Are there performance-sensitive log statements that should be guarded by level checks?

> **✍️ WRITE NOW:** Append Section 12 to `$REVIEW_FILE` before continuing to Section 13.

---

### 13. Configuration Safety

Verify that configuration is safe for all environments.

```bash
echo "=== CONFIGURATION SAFETY ==="

# Debug mode flags that might leak to production
echo "--- Debug/dev flags in production-accessible config ---"
grep -rn "debug.*=.*true\|DEBUG.*=.*true\|devMode\|dev_mode\|SPRING_PROFILES_ACTIVE.*dev\|NODE_ENV.*development" \
  --include="*.yml" --include="*.yaml" --include="*.json" --include="*.toml" --include="*.properties" --include="*.env" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v ".env.example" | grep -v ".env.development"

# Verbose error details exposed (stack traces in responses)
echo ""
echo "--- Stack trace exposure ---"
grep -rn "stackTrace\|stack_trace\|\.stack\|traceback\|getStackTrace\|printStackTrace\|include_stacktrace\|server\.error\.include-stacktrace" \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.cs" --include="*.dart" \
  --include="*.yml" --include="*.yaml" --include="*.json" --include="*.properties" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test | grep -v vendor

# CORS wildcard
echo ""
echo "--- CORS wildcard origins ---"
grep -rn 'allowedOrigins.*"\*"\|Access-Control-Allow-Origin.*\*\|cors.*origin.*\*\|allow_origins.*\["\*"\]' \
  --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" --include="*.cs" \
  --include="*.yml" --include="*.yaml" --include="*.json" --include="*.properties" \
  . 2>/dev/null | grep -v node_modules | grep -v target | grep -v build | grep -v test

# .env files committed to git
echo ""
echo "--- .env files in git ---"
git ls-files | grep "\.env$\|\.env\.local$\|\.env\.production$" 2>/dev/null

echo "=== END CONFIGURATION SAFETY ==="
```

> **✍️ WRITE NOW:** Append Section 13 to `$REVIEW_FILE` before continuing to Section 14.

---

### 14. Cross-Cutting Consistency

Identify inconsistencies that span multiple modules. Inconsistency creates confusion for future development and hides bugs.

**14a. Naming Consistency**

```bash
echo "=== NAMING CONSISTENCY ==="

# Mixed naming conventions in same codebase
echo "--- Potential naming style conflicts ---"

# camelCase vs snake_case in same ecosystem
echo -n "  camelCase methods: "
grep -rn "public.*[a-z][A-Z].*(" --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l
echo -n "  snake_case methods: "
grep -rn "public.*[a-z]_[a-z].*(" --include="*.java" --include="*.kt" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v test | wc -l

# Inconsistent DTO naming (e.g., some use "Response" suffix, others use "Dto")
echo ""
echo "--- DTO naming patterns ---"
find . -type f \( -name "*Dto*" -o -name "*DTO*" -o -name "*Response*" -o -name "*Request*" -o -name "*Resource*" -o -name "*ViewModel*" -o -name "*Model*" \) \
  -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/build/*" -not -path "*/.git/*" -not -path "*/test*" 2>/dev/null | sort

echo "=== END NAMING CONSISTENCY ==="
```

**14b. Pattern Consistency**

Read through the codebase and verify:
- Is the same pattern used for the same problem everywhere? (e.g., do all controllers handle validation the same way?)
- Are there places where one module uses Pattern A and another uses Pattern B for the same thing?
- Is pagination implemented the same way across all list endpoints?
- Is error handling consistent across all controllers/handlers?
- Is authentication/authorization applied consistently?

**14c. Response Format Consistency**

Verify that all API responses follow the same wrapper format. Check for:
- Some endpoints returning `{ "data": {...} }` and others returning raw objects
- Inconsistent error response formats
- Different date/time serialization formats across endpoints
- Inconsistent null handling (some return null, others omit the field, others return empty string)

> **✍️ WRITE NOW:** Append Section 14 to `$REVIEW_FILE` before continuing to Section 15.

---

### 15. Compilation & Runtime Verification

Actually build and test the project. Static analysis finds many issues, but compilation and test execution are the definitive checks.

```bash
echo "=== BUILD & TEST EXECUTION ==="

PROJECT_DIR=$(basename "$(pwd)")

# Detect build system and run
if [ -f "pom.xml" ]; then
  echo "--- Maven Build ---"
  mvn clean compile 2>&1 | tail -20
  echo ""
  echo "--- Maven Test ---"
  mvn test 2>&1 | tail -30
  echo ""
  echo "--- Maven Test Summary ---"
  mvn test 2>&1 | grep -E "Tests run:|BUILD SUCCESS|BUILD FAILURE" | tail -5

elif [ -f "package.json" ]; then
  echo "--- npm Build ---"
  npm run build 2>&1 | tail -20 || echo "No build script"
  echo ""
  echo "--- npm Test ---"
  npm test 2>&1 | tail -30 || echo "No test script"

elif [ -f "pubspec.yaml" ]; then
  echo "--- Dart/Flutter Analyze ---"
  dart analyze 2>&1 | tail -20 || flutter analyze 2>&1 | tail -20
  echo ""
  echo "--- Dart/Flutter Test ---"
  dart test 2>&1 | tail -30 || flutter test 2>&1 | tail -30

elif [ -f "go.mod" ]; then
  echo "--- Go Build ---"
  go build ./... 2>&1 | tail -20
  echo ""
  echo "--- Go Test ---"
  go test ./... 2>&1 | tail -30

elif [ -f "Cargo.toml" ]; then
  echo "--- Cargo Build ---"
  cargo build 2>&1 | tail -20
  echo ""
  echo "--- Cargo Test ---"
  cargo test 2>&1 | tail -30

elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
  echo "--- Python Test ---"
  python -m pytest 2>&1 | tail -30 || python -m unittest discover 2>&1 | tail -30

elif ls *.csproj >/dev/null 2>&1 || ls *.sln >/dev/null 2>&1; then
  echo "--- .NET Build ---"
  dotnet build 2>&1 | tail -20
  echo ""
  echo "--- .NET Test ---"
  dotnet test 2>&1 | tail -30
fi

echo "=== END BUILD & TEST EXECUTION ==="
```

Document:
- Compilation warnings (each is a finding, severity MEDIUM minimum)
- Compilation errors (each is CRITICAL)
- Test failures (each is CRITICAL — describe what failed and why)
- Deprecation warnings (each is LOW or MEDIUM depending on removal timeline)

> **✍️ WRITE NOW:** Append Section 15 to `$REVIEW_FILE` before continuing to Section 16.

---

### 16. Findings Summary & Remediation Queue

After all sections are complete, generate a consolidated summary.

**16a. Findings by Severity**

Count all findings from Sections 2-15:

```
CRITICAL: (count) — blocks deployment
HIGH:     (count) — significant risk
MEDIUM:   (count) — should fix soon
LOW:      (count) — improvement opportunity
TOTAL:    (count)
```

**16b. Consolidated Remediation Queue**

List **every finding** from all sections in a single table, sorted by severity (CRITICAL first), then by section order:

```
| ID | Severity | Section | File:Line | Finding | Remediation |
|----|----------|---------|-----------|---------|-------------|
| CR-04-01 | CRITICAL | Logic | UserService.java:142 | Null dereference on optional user lookup | Add .orElseThrow() or null check |
| CR-08-02 | CRITICAL | Security | SecurityConfig.java:34 | /api/admin/** is in public path list | Move to protected endpoints |
| CR-03-01 | HIGH | API Contract | OrderController.java:67 | Returns 200 on create, spec says 201 | Change to HttpStatus.CREATED |
| ... | ... | ... | ... | ... | ... |
```

**16c. Review Verdict**

```
VERDICT: PASS / FAIL / CONDITIONAL PASS

Rationale: (1-3 sentences explaining the verdict)

Blocking issues that must be resolved before deployment:
  1. (list each CRITICAL finding by ID)
  2. ...
```

Verdicts:
- **PASS** = Zero CRITICAL findings, two or fewer HIGH findings, all tests pass
- **CONDITIONAL PASS** = Zero CRITICAL findings, HIGH findings present but manageable
- **FAIL** = Any CRITICAL finding, or test failures, or build failures

> **✍️ WRITE NOW:** Append Section 16 to `$REVIEW_FILE`. The review is now complete. Proceed to Verification.

---

## Output Format

**Naming convention:** Files are named after the project's root directory name.

```
ProjectName/
├── ProjectName-Audit.md           ← codebase inventory (from Codebase-Audit-Template)
├── ProjectName-Scorecard.md       ← quality metrics (from Codebase-Audit-Template)
├── ProjectName-OpenAPI.yaml       ← API spec (from OpenAPI-Template)
├── ProjectName-CodeReview.md      ← THIS FILE — findings and remediation queue
├── CONVENTIONS.md                 ← project conventions
├── src/
└── ...
```

Determine names automatically:
```bash
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"
echo "Review: $REVIEW_FILE"
```

**Initialize the review file first** (run after deleting old files, before any sections):

```bash
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"

cat > "$REVIEW_FILE" << HEADER
# ${PROJECT_DIR} — Code Review

**Review Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Branch:** $(git branch --show-current)
**Commit:** $(git log -1 --format='%H %s')
**Reviewer:** Claude Code (Automated)
**Purpose:** Identify correctness, quality, performance, and security issues

**Referenced Artifacts:**
- Audit: ${PROJECT_DIR}-Audit.md
- OpenAPI: $(ls ${PROJECT_DIR}*OpenAPI*.yaml ${PROJECT_DIR}*openapi*.yaml openapi.yaml 2>/dev/null | head -1 || echo "NOT FOUND")
- Conventions: $(test -f CONVENTIONS.md && echo "CONVENTIONS.md" || echo "NOT FOUND")

> This review identifies problems in the codebase. The Codebase Audit describes what exists.
> The OpenAPI spec describes the API contract. This review finds where reality diverges from intent.

---
HEADER

echo "✓ Review file initialized — $(wc -l < "$REVIEW_FILE") lines"
```

Then write **each section immediately after completing it** using `cat >> "$REVIEW_FILE"`. Never defer writes to the end.

## Verification

After writing the review file, verify completeness:

```bash
echo "=== COMPLETENESS CHECK ==="
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"

echo "Review file: $REVIEW_FILE"
test -f "$REVIEW_FILE" && echo "  EXISTS — $(wc -l < "$REVIEW_FILE") lines" || echo "  MISSING"

echo ""
echo "Sections present:"
for i in $(seq 1 16); do
  case $i in
    1) NAME="Review Identity" ;;
    2) NAME="Dead Code Detection" ;;
    3) NAME="API Contract Fidelity" ;;
    4) NAME="Logic & Correctness" ;;
    5) NAME="Exception Handling" ;;
    6) NAME="Concurrency & Thread Safety" ;;
    7) NAME="Performance Anti-Patterns" ;;
    8) NAME="Security Deep Dive" ;;
    9) NAME="Dependency Health" ;;
    10) NAME="Convention Compliance" ;;
    11) NAME="Test Quality" ;;
    12) NAME="Logging & Observability" ;;
    13) NAME="Configuration Safety" ;;
    14) NAME="Cross-Cutting Consistency" ;;
    15) NAME="Compilation & Runtime" ;;
    16) NAME="Findings Summary" ;;
  esac
  grep -q "### $i\.\|## $i\." "$REVIEW_FILE" 2>/dev/null && echo "  ✓ Section $i: $NAME" || echo "  ✗ Section $i: $NAME — MISSING"
done

echo ""
echo "Finding counts:"
echo -n "  CRITICAL: " && grep -c "CRITICAL" "$REVIEW_FILE" 2>/dev/null || echo "0"
echo -n "  HIGH: " && grep -c "| HIGH |" "$REVIEW_FILE" 2>/dev/null || echo "0"
echo -n "  MEDIUM: " && grep -c "| MEDIUM |" "$REVIEW_FILE" 2>/dev/null || echo "0"
echo -n "  LOW: " && grep -c "| LOW |" "$REVIEW_FILE" 2>/dev/null || echo "0"

echo ""
echo "Verdict present:"
grep -q "VERDICT:" "$REVIEW_FILE" && echo "  YES" || echo "  MISSING — Section 16 incomplete"

echo "=== END COMPLETENESS CHECK ==="
```

Fix any gaps before committing.

## Completion

```bash
PROJECT_DIR=$(basename "$(pwd)")
REVIEW_FILE="${PROJECT_DIR}-CodeReview.md"
git add "$REVIEW_FILE"
git commit -m "Code review — $(date +%Y-%m-%d)"
git push
```

## Completion Report

```
============================================================
PROJECT: {{PROJECT_NAME}}
TASK: Code Review
============================================================
GIT COMMIT: (hash from git log -1)
BRANCH: (branch name)
TIMESTAMP: (ISO 8601)

REVIEW FILE: {{PROJECT_NAME}}-CodeReview.md

FINDINGS SUMMARY:
  CRITICAL: (count)
  HIGH:     (count)
  MEDIUM:   (count)
  LOW:      (count)
  TOTAL:    (count)

VERDICT: (PASS / FAIL / CONDITIONAL PASS)

BLOCKING ISSUES:
  (list each CRITICAL finding ID and one-line description, or "None")

STATUS: complete
============================================================
```
