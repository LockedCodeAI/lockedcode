import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../../../test/lib/effect"
import { Service as AuditService, defaultLayer as auditLayer } from "../audit"
import { hashContent, hashObject } from "../audit/hash"
import type { Severity } from "../types"

const it = testEffect(auditLayer)

describe("AuditService", () => {
  it.effect("records a security event", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const id = yield* audit.record({
        eventType: "security.scan_completed",
        sessionId: "test-session",
        timestamp: Date.now(),
        toolName: "test-tool",
        modelId: "test-model",
        actionTaken: "allowed",
        details: { file: "test.ts" },
      })
      expect(id).toBeTruthy()
    }),
  )

  it.effect("records and queries an event", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const sessionId = "query-session-" + Date.now()
      yield* audit.record({
        eventType: "security.scan_completed",
        sessionId,
        timestamp: Date.now(),
        toolName: "tool",
        modelId: "model",
        actionTaken: "allowed",
        details: {},
      })
      const results = yield* audit.query({ sessionId })
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].sessionId).toBe(sessionId)
    }),
  )

  it.effect("records and queries scan results", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const eventId = yield* audit.record({
        eventType: "security.scan_completed",
        sessionId: "scan-test",
        timestamp: Date.now(),
        toolName: "write",
        modelId: "gpt-4",
        actionTaken: "allowed",
        details: {},
      })
      yield* audit.recordScanResult({
        securityEventId: eventId,
        scannerName: "semgrep",
        ruleId: "test.rule",
        severity: "high" as Severity,
        matchedContent: "eval(user_input)",
      })
    }),
  )

  it.effect("records and queries policy decisions", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const eventId = yield* audit.record({
        eventType: "security.action_blocked",
        sessionId: "policy-test",
        timestamp: Date.now(),
        toolName: "shell",
        modelId: "test",
        actionTaken: "blocked",
        details: {},
      })
      yield* audit.recordPolicyDecision({
        securityEventId: eventId,
        policyRuleId: "shell.hardblocked.remote-exec-pipe",
        evaluationResult: "deny",
      })
    }),
  )

  it.effect("query by time range", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const sessionId = "time-range-" + Date.now()
      const now = Date.now()
      yield* audit.record({
        eventType: "security.scan_completed",
        sessionId,
        timestamp: now - 1000,
        toolName: "t",
        modelId: "m",
        actionTaken: "allowed",
        details: {},
      })
      yield* audit.record({
        eventType: "security.action_blocked",
        sessionId,
        timestamp: now,
        toolName: "t",
        modelId: "m",
        actionTaken: "blocked",
        details: {},
      })
      const results = yield* audit.query({ sessionId, startTime: now - 500 })
      expect(results.length).toBe(1)
      expect(results[0].eventType).toBe("security.action_blocked")
    }),
  )

  it.effect("getSessionSummary returns correct counts", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const sessionId = "summary-" + Date.now()
      yield* audit.record({
        eventType: "security.scan_completed",
        sessionId,
        timestamp: Date.now(),
        toolName: "t",
        modelId: "m",
        actionTaken: "allowed",
        details: {},
      })
      yield* audit.record({
        eventType: "security.action_blocked",
        sessionId,
        timestamp: Date.now(),
        toolName: "t",
        modelId: "m",
        actionTaken: "blocked",
        details: {},
      })
      const summary = yield* audit.getSessionSummary(sessionId)
      expect(summary.totalEvents).toBe(2)
      expect(summary.byType["security.scan_completed"]).toBe(1)
      expect(summary.byType["security.action_blocked"]).toBe(1)
    }),
  )

  it.effect("query with pagination", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const sessionId = "paging-" + Date.now()
      for (let i = 0; i < 5; i++) {
        yield* audit.record({
          eventType: "security.scan_completed",
          sessionId,
          timestamp: Date.now() + i,
          toolName: "t",
          modelId: "m",
          actionTaken: "allowed",
          details: { idx: i },
        })
      }
      const page1 = yield* audit.query({ sessionId, limit: 2 })
      expect(page1.length).toBe(2)
      const page2 = yield* audit.query({ sessionId, limit: 2, offset: 2 })
      expect(page2.length).toBe(2)
    }),
  )

  it.effect("query by event type", () =>
    Effect.gen(function* () {
      const audit = yield* AuditService
      const sessionId = "by-type-" + Date.now()
      yield* audit.record({
        eventType: "security.scan_completed",
        sessionId,
        timestamp: Date.now(),
        toolName: "t",
        modelId: "m",
        actionTaken: "allowed",
        details: {},
      })
      yield* audit.record({
        eventType: "security.action_blocked",
        sessionId,
        timestamp: Date.now(),
        toolName: "t",
        modelId: "m",
        actionTaken: "blocked",
        details: {},
      })
      const blocked = yield* audit.query({ sessionId, eventType: "security.action_blocked" })
      expect(blocked.length).toBe(1)
    }),
  )
})

// ============================================================
// Content Hashing Tests
// ============================================================

describe("content hashing", () => {
  test("same content produces same hash", () => {
    const h1 = hashContent("hello world")
    const h2 = hashContent("hello world")
    expect(h1).toBe(h2)
  })

  test("different content produces different hash", () => {
    const h1 = hashContent("hello world")
    const h2 = hashContent("hello universe")
    expect(h1).not.toBe(h2)
  })

  test("hash is SHA-256 (64 hex chars)", () => {
    const h = hashContent("test")
    expect(h.length).toBe(64)
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true)
  })

  test("object hashing is deterministic", () => {
    const o1 = hashObject({ a: 1, b: 2 })
    const o2 = hashObject({ b: 2, a: 1 })
    expect(o1).toBe(o2)
  })

  test("empty string hashing", () => {
    const h = hashContent("")
    expect(h.length).toBe(64)
  })
})
