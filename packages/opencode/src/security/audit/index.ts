import { Context, Effect, Layer } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { Identifier } from "@/id/id"
import { Client, Path } from "@/storage/db"
import type { SecurityEvent, ScanFinding, ScanResult, Severity, PolicyDecision } from "../types"
import { SecurityEventTable, ScanResultTable, PolicyDecisionTable } from "./schema"
import { hashContent } from "./hash"

const log = Log.create({ service: "audit" })

export interface AuditFilter {
  readonly sessionId?: string
  readonly startTime?: number
  readonly endTime?: number
  readonly severity?: Severity
  readonly eventType?: string | string[]
  readonly modelId?: string
  readonly limit?: number
  readonly offset?: number
}

export interface SessionSummary {
  readonly totalEvents: number
  readonly byType: Record<string, number>
  readonly bySeverity: Record<string, number>
  readonly byAction: Record<string, number>
}

export interface Interface {
  readonly record: (event: SecurityEvent) => Effect.Effect<string>
  readonly recordScanResult: (scanResult: {
    securityEventId: string | null
    scannerName: string
    ruleId: string
    severity: Severity
    matchedContent: string
    lineNumber?: number
    remediation?: string
  }) => Effect.Effect<void>
  readonly recordPolicyDecision: (policyDecision: {
    securityEventId: string
    policyRuleId?: string
    evaluationResult: string
    overrideBy?: string
    overrideReason?: string
  }) => Effect.Effect<void>
  readonly query: (filters: AuditFilter) => Effect.Effect<SecurityEvent[]>
  readonly getSessionSummary: (sessionId: string) => Effect.Effect<SessionSummary>
  readonly prune: () => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Audit") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db: SQLiteBunDatabase = yield* Effect.sync(() => Client())

    // Auto-create audit tables if they don't exist (dev-friendly)
    yield* Effect.sync(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS security_event (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          tool_name TEXT,
          model_id TEXT,
          content_hash TEXT NOT NULL,
          action_taken TEXT NOT NULL,
          details TEXT,
          time_created INTEGER NOT NULL
        )
      `)
      db.run(`CREATE INDEX IF NOT EXISTS sec_evt_session_idx ON security_event(session_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS sec_evt_timestamp_idx ON security_event(timestamp)`)
      db.run(`CREATE INDEX IF NOT EXISTS sec_evt_type_idx ON security_event(event_type)`)
      db.run(`CREATE INDEX IF NOT EXISTS sec_evt_severity_idx ON security_event(severity)`)
      db.run(`CREATE INDEX IF NOT EXISTS sec_evt_session_type_idx ON security_event(session_id, event_type)`)

      db.run(`
        CREATE TABLE IF NOT EXISTS scan_result (
          id TEXT PRIMARY KEY,
          security_event_id TEXT REFERENCES security_event(id) ON DELETE CASCADE,
          scanner_name TEXT NOT NULL,
          rule_id TEXT NOT NULL,
          severity TEXT NOT NULL,
          matched_content_hash TEXT,
          line_number INTEGER,
          remediation TEXT,
          time_created INTEGER NOT NULL
        )
      `)
      db.run(`CREATE INDEX IF NOT EXISTS scan_res_event_idx ON scan_result(security_event_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS scan_res_scanner_idx ON scan_result(scanner_name)`)

      db.run(`
        CREATE TABLE IF NOT EXISTS policy_decision (
          id TEXT PRIMARY KEY,
          security_event_id TEXT NOT NULL REFERENCES security_event(id) ON DELETE CASCADE,
          policy_rule_id TEXT,
          evaluation_result TEXT NOT NULL,
          override_by TEXT,
          override_reason TEXT,
          time_created INTEGER NOT NULL
        )
      `)
      db.run(`CREATE INDEX IF NOT EXISTS pol_dec_event_idx ON policy_decision(security_event_id)`)
    })

    const record = Effect.fn("Audit.record")(function* (event: SecurityEvent) {
      const id = Identifier.create("sec", "ascending")
      const ch = hashContent(JSON.stringify(event.details ?? {}))
      const now = Date.now()

      db.insert(SecurityEventTable).values({
        id,
        session_id: event.sessionId,
        timestamp: event.timestamp,
        event_type: event.eventType,
        severity: event.severity ?? "info",
        tool_name: event.toolName ?? null,
        model_id: event.modelId ?? null,
        content_hash: ch,
        action_taken: event.actionTaken,
        details: event.details ?? null,
        time_created: now,
      }).run()

      log.debug("audit event recorded", { id, eventType: event.eventType, sessionId: event.sessionId })
      return id
    })

    const recordScanResult = Effect.fn("Audit.recordScanResult")(function* (sr: {
      securityEventId: string | null
      scannerName: string
      ruleId: string
      severity: Severity
      matchedContent: string
      lineNumber?: number
      remediation?: string
    }) {
      const id = Identifier.create("srs", "ascending")
      const ch = sr.matchedContent ? hashContent(sr.matchedContent) : null

      yield* Effect.sync(() =>
        db.insert(ScanResultTable).values({
          id,
          security_event_id: sr.securityEventId,
          scanner_name: sr.scannerName,
          rule_id: sr.ruleId,
          severity: sr.severity,
          matched_content_hash: ch,
          line_number: sr.lineNumber ?? null,
          remediation: sr.remediation ?? null,
          time_created: Date.now(),
        }).run(),
      )
    })

    const recordPolicyDecision = Effect.fn("Audit.recordPolicyDecision")(function* (pd: {
      securityEventId: string
      policyRuleId?: string
      evaluationResult: string
      overrideBy?: string
      overrideReason?: string
    }) {
      const id = Identifier.create("pdc", "ascending")

      yield* Effect.sync(() =>
        db.insert(PolicyDecisionTable).values({
          id,
          security_event_id: pd.securityEventId,
          policy_rule_id: pd.policyRuleId ?? null,
          evaluation_result: pd.evaluationResult,
          override_by: pd.overrideBy ?? null,
          override_reason: pd.overrideReason ?? null,
          time_created: Date.now(),
        }).run(),
      )
    })

    const query = Effect.fn("Audit.query")(function* (filters: AuditFilter) {
      const conditions: any[] = []

      if (filters.sessionId) {
        conditions.push(eq(SecurityEventTable.session_id, filters.sessionId))
      }
      if (filters.startTime !== undefined) {
        conditions.push(gte(SecurityEventTable.timestamp, filters.startTime))
      }
      if (filters.endTime !== undefined) {
        conditions.push(lte(SecurityEventTable.timestamp, filters.endTime))
      }
      if (filters.eventType) {
        if (Array.isArray(filters.eventType)) {
          conditions.push(inArray(SecurityEventTable.event_type, filters.eventType))
        } else {
          conditions.push(eq(SecurityEventTable.event_type, filters.eventType))
        }
      }
      if (filters.modelId) {
        conditions.push(eq(SecurityEventTable.model_id, filters.modelId))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const rows = yield* Effect.sync(() =>
        db
          .select()
          .from(SecurityEventTable)
          .where(whereClause)
          .orderBy(desc(SecurityEventTable.timestamp))
          .limit(filters.limit ?? 100)
          .offset(filters.offset ?? 0)
          .all(),
      )

      return rows.map((r) => ({
        eventType: r.event_type,
        sessionId: r.session_id,
        timestamp: r.timestamp,
        toolName: r.tool_name ?? "",
        modelId: r.model_id ?? "",
        contentHash: r.content_hash,
        actionTaken: r.action_taken,
        details: (r.details as Record<string, unknown>) ?? {},
        severity: r.severity as Severity,
      })) as SecurityEvent[]
    })

    const getSessionSummary = Effect.fn("Audit.getSessionSummary")(function* (sessionId: string) {
      const conditions = [eq(SecurityEventTable.session_id, sessionId)]

      const rows = yield* Effect.sync(() =>
        db
          .select({
            event_type: SecurityEventTable.event_type,
            severity: SecurityEventTable.severity,
            action_taken: SecurityEventTable.action_taken,
          })
          .from(SecurityEventTable)
          .where(and(...conditions))
          .all(),
      )

      const byType: Record<string, number> = {}
      const bySeverity: Record<string, number> = {}
      const byAction: Record<string, number> = {}

      for (const r of rows) {
        byType[r.event_type] = (byType[r.event_type] ?? 0) + 1
        bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1
        byAction[r.action_taken] = (byAction[r.action_taken] ?? 0) + 1
      }

      return {
        totalEvents: rows.length,
        byType,
        bySeverity,
        byAction,
      } as SessionSummary
    })

    const prune = Effect.fn("Audit.prune")(function* () {
      yield* Effect.sync(() => db.delete(ScanResultTable).run())
      yield* Effect.sync(() => db.delete(PolicyDecisionTable).run())
      const result: any = yield* Effect.sync(() =>
        db.delete(SecurityEventTable).run(),
      )
      const count = result?.changes ?? 0
      if (count > 0) log.info("pruned audit events", { count })
      return count
    })

    return Service.of({ record, recordScanResult, recordPolicyDecision, query, getSessionSummary, prune })
  }),
)

export const defaultLayer = layer
