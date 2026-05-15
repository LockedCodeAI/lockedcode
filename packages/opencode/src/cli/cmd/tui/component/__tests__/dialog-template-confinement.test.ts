import { describe, expect, test, beforeEach } from "bun:test"
import { isValidTemplateUrl, isValidEntryName } from "../dialog-template"
import { clearExternalPathWhitelist, checkPathSync } from "../../../../../security/confinement/whitelist"
import { canonicalize, isSubPath } from "../../../../../security/confinement/paths"
import path from "path"

describe("template URL validation", () => {
  test("accepts HTTPS URLs", () => {
    expect(isValidTemplateUrl("https://templates.lockedcode.ai/v1")).toBe(true)
  })

  test("rejects HTTP URLs", () => {
    expect(isValidTemplateUrl("http://templates.lockedcode.ai/v1")).toBe(false)
  })

  test("rejects file: URLs", () => {
    expect(isValidTemplateUrl("file:///etc/passwd")).toBe(false)
  })

  test("rejects data: URLs", () => {
    expect(isValidTemplateUrl("data:text/html,<h1>test</h1>")).toBe(false)
  })

  test("rejects URLs with credentials in userinfo", () => {
    expect(isValidTemplateUrl("https://user:pass@templates.lockedcode.ai/v1")).toBe(false)
  })

  test("rejects invalid URL strings", () => {
    expect(isValidTemplateUrl("not-a-url")).toBe(false)
  })
})

describe("template entry name validation", () => {
  test("accepts valid alphanumeric names", () => {
    expect(isValidEntryName("code-review")).toBe(true)
    expect(isValidEntryName("security_audit")).toBe(true)
    expect(isValidEntryName("template.v2")).toBe(true)
    expect(isValidEntryName("MyTemplate")).toBe(true)
  })

  test("rejects names containing ..", () => {
    expect(isValidEntryName("..")).toBe(false)
    expect(isValidEntryName("../etc/passwd")).toBe(false)
    expect(isValidEntryName("foo..bar")).toBe(false)
  })

  test("rejects names containing forward slash", () => {
    expect(isValidEntryName("path/traversal")).toBe(false)
    expect(isValidEntryName("../../escape")).toBe(false)
  })

  test("rejects names containing backslash", () => {
    expect(isValidEntryName("path\\traversal")).toBe(false)
  })

  test("rejects names containing null byte", () => {
    expect(isValidEntryName("name\0evil")).toBe(false)
  })

  test("rejects names with leading dot (hidden file)", () => {
    expect(isValidEntryName(".hidden")).toBe(false)
    expect(isValidEntryName(".git")).toBe(false)
  })

  test("rejects empty names", () => {
    expect(isValidEntryName("")).toBe(false)
  })

  test("rejects names exceeding 255 characters", () => {
    expect(isValidEntryName("a".repeat(256))).toBe(false)
  })

  test("accepts names at exactly 255 characters", () => {
    expect(isValidEntryName("a".repeat(255))).toBe(true)
  })

  test("rejects names not matching safe regex", () => {
    expect(isValidEntryName("name with spaces")).toBe(false)
    expect(isValidEntryName("name@special")).toBe(false)
    expect(isValidEntryName("name#hash")).toBe(false)
  })
})

describe("template path containment", () => {
  beforeEach(() => {
    clearExternalPathWhitelist()
  })

  test("post-join containment catches traversal after path.join", () => {
    const cacheDir = "/tmp/test-cache"
    const maliciousName = "legitimate"
    const dest = path.join(cacheDir, maliciousName, "../../etc/passwd")
    const canonDest = canonicalize(dest)
    const canonCache = canonicalize(cacheDir)
    expect(isSubPath(canonDest, canonCache)).toBe(false)
  })

  test("valid template path passes containment", () => {
    const cacheDir = "/tmp/test-cache"
    const dest = path.join(cacheDir, "my-template", "readme.md")
    const canonDest = canonicalize(dest)
    const canonCache = canonicalize(cacheDir)
    expect(isSubPath(canonDest, canonCache)).toBe(true)
  })

  test("templates dir resolves under project root", () => {
    const projectRoot = process.cwd()
    const templatesDir = path.join(projectRoot, ".lockedcode", "templates")
    const result = checkPathSync(templatesDir, "read", projectRoot)
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe("inside project root")
  })

  test("home directory templates dir is denied", () => {
    const homeTemplates = path.join(require("os").homedir(), ".lockedcode", "templates")
    const result = checkPathSync(homeTemplates, "read", process.cwd())
    expect(result.allowed).toBe(false)
  })
})
