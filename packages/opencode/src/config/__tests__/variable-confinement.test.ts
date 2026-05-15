import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { substitute } from "../variable"
import { clearExternalPathWhitelist } from "../../security/confinement/whitelist"
import fs from "fs"
import path from "path"
import os from "os"

const tmpDir = path.join(os.tmpdir(), "lockedcode-variable-test-" + process.pid)

beforeEach(() => {
  clearExternalPathWhitelist()
  fs.mkdirSync(tmpDir, { recursive: true })
  // Ensure cwd is within tmpDir for confinement
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(path.resolve(__dirname, "../../.."))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("config variable confinement", () => {
  test("{file:./local-file} inside project root succeeds", async () => {
    fs.writeFileSync(path.join(tmpDir, "fragment.json"), "hello-world")
    const result = await substitute({
      type: "path",
      path: path.join(tmpDir, "config.json"),
      text: '{"key": "{file:./fragment.json}"}',
    })
    expect(result).toContain("hello-world")
  })

  test("{file:~/passwd} is rejected", async () => {
    await expect(
      substitute({
        type: "path",
        path: path.join(tmpDir, "config.json"),
        text: '{"key": "{file:~/passwd}"}',
      }),
    ).rejects.toThrow("ConfigInvalidError")
  })

  test("{file:/etc/passwd} is rejected", async () => {
    await expect(
      substitute({
        type: "path",
        path: path.join(tmpDir, "config.json"),
        text: '{"key": "{file:/etc/passwd}"}',
      }),
    ).rejects.toThrow("ConfigInvalidError")
  })

  test("{file:../../parent-escape.txt} is rejected after canonicalization", async () => {
    await expect(
      substitute({
        type: "path",
        path: path.join(tmpDir, "config.json"),
        text: '{"key": "{file:../../parent-escape.txt}"}',
      }),
    ).rejects.toThrow("ConfigInvalidError")
  })

  test("each rejection produces an error with confinement reason", async () => {
    try {
      await substitute({
        type: "path",
        path: path.join(tmpDir, "config.json"),
        text: '{"key": "{file:~/secret}"}',
      })
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err.name).toBe("ConfigInvalidError")
      expect(JSON.stringify(err)).toContain("confinement denied")
    }
  })

  test("{env:VAR} substitution still works", async () => {
    process.env.TEST_VAR_CONFINEMENT = "test-value"
    try {
      const result = await substitute({
        type: "path",
        path: path.join(tmpDir, "config.json"),
        text: '{"key": "{env:TEST_VAR_CONFINEMENT}"}',
      })
      expect(result).toContain("test-value")
    } finally {
      delete process.env.TEST_VAR_CONFINEMENT
    }
  })
})
