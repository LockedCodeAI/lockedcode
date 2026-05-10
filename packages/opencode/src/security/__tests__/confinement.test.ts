import { describe, expect, test, afterEach } from "bun:test"
import path from "path"
import os from "os"
import fs from "fs"
import { canonicalize, isSubPath } from "../confinement/paths"
import { detectProjectRoot } from "../confinement/root"
import { registerNode, getNode, verifyInheritance, clearTree } from "../confinement/process"

// ============================================================
// Path Canonicalization Tests
// ============================================================

describe("path canonicalization", () => {
  test("resolves relative paths against cwd", () => {
    const cwd = "/home/user/project"
    const result = canonicalize("file.txt", cwd)
    expect(result).toBe("/home/user/project/file.txt")
  })

  test("resolves .. traversal", () => {
    const cwd = "/home/user/project"
    const result = canonicalize("../other/file.txt", cwd)
    expect(result).toBe("/home/user/other/file.txt")
  })

  test("collapses dot segments", () => {
    const cwd = "/home/user/project"
    const result = canonicalize("./foo/./bar", cwd)
    expect(result).toBe("/home/user/project/foo/bar")
  })

  test("expands tilde to home directory", () => {
    const home = os.homedir()
    const result = canonicalize("~/file.txt")
    expect(result).toBe(`${home}/file.txt`)
  })

  test("expands tilde with subdirectory", () => {
    const home = os.homedir()
    const result = canonicalize("~/sub/dir/file.txt")
    expect(result).toBe(`${home}/sub/dir/file.txt`)
  })

  test("rejects null bytes", () => {
    const result = canonicalize("/safe\0/evil")
    expect(result).toBe("")
  })

  test("handles empty string", () => {
    const cwd = "/home/user"
    const result = canonicalize("", cwd)
    expect(result).toBe(cwd)
  })

  test("handles absolute paths directly", () => {
    const result = canonicalize("/absolute/path/file.txt")
    expect(result).toBe("/absolute/path/file.txt")
  })

  test("normalizes multiple slashes", () => {
    const cwd = "/home/user/project"
    const result = canonicalize("foo//bar///baz", cwd)
    expect(result).toBe("/home/user/project/foo/bar/baz")
  })

  test("handles non-existent files (resolves parent)", () => {
    const cwd = "/tmp"
    const result = canonicalize("/tmp/nonexistent-dir/newfile.ts", cwd)
    expect(result).toBe("/tmp/nonexistent-dir/newfile.ts")
  })
})

// ============================================================
// isSubPath Tests
// ============================================================

describe("isSubPath", () => {
  test("child inside parent returns true", () => {
    expect(isSubPath("/project/src/file.ts", "/project")).toBe(true)
  })

  test("child outside parent returns false", () => {
    expect(isSubPath("/other/file.ts", "/project")).toBe(false)
  })

  test("handles /project vs /project-foo edge case", () => {
    expect(isSubPath("/project-foo/file.ts", "/project")).toBe(false)
  })

  test("parent itself is inside itself", () => {
    expect(isSubPath("/project", "/project")).toBe(true)
  })

  test("handles trailing slash variations", () => {
    expect(isSubPath("/project/src", "/project/")).toBe(true)
  })

  test("deeply nested child is inside parent", () => {
    expect(isSubPath("/project/a/b/c/d/e/f.ts", "/project")).toBe(true)
  })
})

// ============================================================
// Project Root Detection Tests
// ============================================================

describe("project root detection", () => {
  test("uses explicit root when provided", () => {
    const root = detectProjectRoot("/some/cwd", "/explicit/root")
    expect(root).toBe("/explicit/root")
  })

  test("falls back to cwd when no markers found", () => {
    const root = detectProjectRoot("/nonexistent-path-for-testing")
    expect(root).toBe("/nonexistent-path-for-testing")
  })
})

// ============================================================
// Process Tree Model Tests
// ============================================================

describe("process tree model", () => {
  afterEach(() => {
    clearTree()
  })

  test("registerNode creates a node", () => {
    registerNode("session-1", null, "/project")
    const node = getNode("session-1")
    expect(node).toBeDefined()
    expect(node!.sessionID).toBe("session-1")
    expect(node!.parentSessionID).toBeNull()
    expect(node!.projectRoot).toBe("/project")
  })

  test("registerNode creates child node", () => {
    registerNode("parent", null, "/project")
    registerNode("child", "parent", "/project")
    const node = getNode("child")
    expect(node).toBeDefined()
    expect(node!.parentSessionID).toBe("parent")
  })

  test("verifyInheritance returns true when boundaries match", () => {
    registerNode("parent", null, "/project")
    registerNode("child", "parent", "/project")
    expect(verifyInheritance("child", "parent")).toBe(true)
  })

  test("verifyInheritance returns true when child is in subdirectory", () => {
    registerNode("parent", null, "/project")
    registerNode("child", "parent", "/project/sub")
    expect(verifyInheritance("child", "parent")).toBe(true)
  })

  test("verifyInheritance returns false when no relationship exists", () => {
    expect(verifyInheritance("orphan", "nonexistent")).toBe(false)
  })

  test("clearTree removes all nodes", () => {
    registerNode("a", null, "/p")
    registerNode("b", null, "/p")
    clearTree()
    expect(getNode("a")).toBeUndefined()
    expect(getNode("b")).toBeUndefined()
  })
})
