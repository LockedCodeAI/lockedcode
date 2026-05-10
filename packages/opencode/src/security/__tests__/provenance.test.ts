import { describe, expect, test, afterAll } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../../../test/lib/effect"
import { Service as ProvenanceService, defaultLayer as provenanceLayer } from "../provenance"
import { hashContent } from "../audit/hash"

const it = testEffect(provenanceLayer)

describe("ProvenanceService", () => {
  it.effect("records a file write operation", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const id = yield* svc.recordFileOperation({
        filePath: "/project/src/test.ts",
        modelId: "test-model",
        sessionId: "session-1",
        operation: "write",
        content: "const x = 1",
        toolName: "write",
      })
      expect(id).toBeTruthy()
    }),
  )

  it.effect("getFileHistory returns operations in order", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const filePath = "history-test.ts"

      yield* svc.recordFileOperation({
        filePath, modelId: "model-a", sessionId: "s1", operation: "write",
        content: "v1", toolName: "write",
      })
      yield* Effect.sleep("1 millis")
      yield* svc.recordFileOperation({
        filePath, modelId: "model-b", sessionId: "s2", operation: "edit",
        content: "v2", lineRangeStart: 1, lineRangeEnd: 5, toolName: "edit",
      })

      const history = yield* svc.getFileHistory(filePath)
      expect(history.length).toBe(2)
      expect(history[0].operation).toBe("edit") // most recent first
      expect(history[1].operation).toBe("write")
    }),
  )

  it.effect("getModelFiles returns all files for a model", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const modelId = "model-for-getModelFiles"

      yield* svc.recordFileOperation({
        filePath: "file-a.ts", modelId, sessionId: "s1", operation: "write",
        content: "a", toolName: "write",
      })
      yield* svc.recordFileOperation({
        filePath: "file-b.ts", modelId, sessionId: "s1", operation: "write",
        content: "b", toolName: "write",
      })

      const files = yield* svc.getModelFiles(modelId)
      expect(files.length).toBe(2)
    }),
  )

  it.effect("getModelSummary returns correct aggregates", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const modelId = "model-for-summary"

      yield* svc.recordFileOperation({
        filePath: "f1.ts", modelId, sessionId: "s1", operation: "write",
        content: "c", toolName: "write",
      })
      yield* svc.recordFileOperation({
        filePath: "f1.ts", modelId, sessionId: "s1", operation: "edit",
        content: "c2", toolName: "edit",
      })
      yield* svc.recordFileOperation({
        filePath: "f2.ts", modelId, sessionId: "s2", operation: "write",
        content: "d", toolName: "write",
      })

      const summary = yield* svc.getModelSummary(modelId)
      expect(summary.totalFiles).toBe(2)
      expect(summary.filesCreated).toBe(2)
      expect(summary.totalOperations).toBe(3)
      expect(summary.uniqueSessions).toBe(2)
    }),
  )

  it.effect("getFileCurrentModel returns latest model", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const filePath = "current-model-test.ts"

      yield* svc.recordFileOperation({
        filePath, modelId: "first-model", sessionId: "s1", operation: "write",
        content: "v1", toolName: "write",
      })
      yield* Effect.sleep("1 millis")
      yield* svc.recordFileOperation({
        filePath, modelId: "second-model", sessionId: "s2", operation: "edit",
        content: "v2", toolName: "edit",
      })

      const current = yield* svc.getFileCurrentModel(filePath)
      expect(current).toBe("second-model")
    }),
  )

  it.effect("getProjectProvenance returns per-model stats", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService

      yield* svc.recordFileOperation({
        filePath: "shared.ts", modelId: "m1", sessionId: "s1", operation: "write",
        content: "a", toolName: "write",
      })
      yield* svc.recordFileOperation({
        filePath: "other.ts", modelId: "m2", sessionId: "s2", operation: "write",
        content: "b", toolName: "write",
      })

      const stats = yield* svc.getProjectProvenance()
      expect(stats.length).toBeGreaterThanOrEqual(2)
    }),
  )

  it.effect("unknown file returns empty history", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const history = yield* svc.getFileHistory("nonexistent-file.ts")
      expect(history.length).toBe(0)
    }),
  )

  it.effect("unknown model returns empty files", () =>
    Effect.gen(function* () {
      const svc = yield* ProvenanceService
      const files = yield* svc.getModelFiles("nonexistent-model")
      expect(files.length).toBe(0)
    }),
  )
})

// ============================================================
// Content Hashing Tests
// ============================================================

describe("provenance hashing", () => {
  test("same content produces same hash", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"))
  })

  test("different content produces different hash", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"))
  })

  test("hash is SHA-256", () => {
    const h = hashContent("test")
    expect(h.length).toBe(64)
  })
})
