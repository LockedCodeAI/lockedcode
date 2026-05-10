import { describe, expect, test } from "bun:test"
import { captureFileState, rollbackFile, createDiff } from "../quarantine/rollback"
import { hashContent } from "../audit/hash"
import fs from "fs"
import path from "path"
import os from "os"

describe("file state capture", () => {
  test("captures existing file", () => {
    const tmpFile = path.join(os.tmpdir(), `quar-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, "original content", "utf-8")
    const state = captureFileState(tmpFile)
    expect(state.exists).toBe(true)
    expect(state.content).toBe("original content")
    fs.unlinkSync(tmpFile)
  })

  test("captures non-existent file", () => {
    const state = captureFileState("/nonexistent-path-for-testing")
    expect(state.exists).toBe(false)
    expect(state.content).toBeNull()
  })
})

describe("file rollback", () => {
  test("restores original content", () => {
    const tmpFile = path.join(os.tmpdir(), `quar-rollback-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, "original", "utf-8")
    fs.writeFileSync(tmpFile, "quarantined", "utf-8") // simulate quarantine
    rollbackFile(tmpFile, "original")
    expect(fs.readFileSync(tmpFile, "utf-8")).toBe("original")
    fs.unlinkSync(tmpFile)
  })

  test("deletes new file when original is null", () => {
    const tmpFile = path.join(os.tmpdir(), `quar-new-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, "quarantined", "utf-8") // new file written
    rollbackFile(tmpFile, null)
    expect(fs.existsSync(tmpFile)).toBe(false)
  })
})

describe("diff generation", () => {
  test("produces diff between original and quarantined", () => {
    const original = "line1\nline2\nline3"
    const quarantined = "line1\nmodified\nline3"
    const diff = createDiff(original, quarantined)
    expect(diff).toContain("line2")
    expect(diff).toContain("modified")
    expect(diff).toContain("--- original")
    expect(diff).toContain("+++ quarantined")
  })

  test("handles null original (new file)", () => {
    const quarantined = "new content"
    const diff = createDiff(null, quarantined)
    expect(diff).toContain("new content")
    expect(diff).toContain("--- original")
  })

  test("produces diff for empty content", () => {
    const diff = createDiff("", "")
    expect(diff).toBeDefined()
  })
})

describe("content hashing", () => {
  test("same content produces same hash", () => {
    expect(hashContent("test content")).toBe(hashContent("test content"))
  })

  test("different content produces different hash", () => {
    expect(hashContent("good")).not.toBe(hashContent("bad"))
  })

  test("hash is SHA-256 length", () => {
    expect(hashContent("x").length).toBe(64)
  })
})
