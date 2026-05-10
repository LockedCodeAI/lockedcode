import { Context, Effect, Layer } from "effect"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import * as Log from "@opencode-ai/core/util/log"
import { Identifier } from "@/id/id"
import { Client } from "@/storage/db"
import { QuarantineTable } from "./schema"
import { captureFileState, rollbackFile, createDiff } from "./rollback"
import { hashContent } from "../audit/hash"
import type { Severity } from "../types"

const log = Log.create({ service: "quarantine" })

const ensureTable = (() => {
  let done = false
  return () => {
    if (done) return
    const db = Client()
    db.run(`
      CREATE TABLE IF NOT EXISTS quarantine_record (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        original_content TEXT,
        quarantined_content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        scan_findings TEXT,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        quarantined_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved_by TEXT,
        time_created INTEGER NOT NULL
      )
    `)
    db.run("CREATE INDEX IF NOT EXISTS quar_status_idx ON quarantine_record(status)")
    db.run("CREATE INDEX IF NOT EXISTS quar_session_idx ON quarantine_record(session_id)")
    db.run("CREATE INDEX IF NOT EXISTS quar_severity_idx ON quarantine_record(severity)")
    done = true
  }
})()

export interface QuarantineRecord {
  readonly id: string
  readonly sessionId: string
  readonly filePath: string
  readonly originalContent: string | null
  readonly quarantinedContent: string
  readonly contentHash: string
  readonly scanFindings: string
  readonly severity: Severity
  readonly status: "quarantined" | "restored" | "discarded"
  readonly quarantinedAt: number
  readonly resolvedAt: number | null
  readonly resolvedBy: string | null
}

export interface QuarantineFilter {
  readonly status?: string
  readonly severity?: string
  readonly sessionId?: string
}

export interface Interface {
  readonly quarantineFile: (params: {
    sessionId: string
    filePath: string
    quarantinedContent: string
    scanFindings: string
    severity: Severity
  }) => Effect.Effect<string>
  readonly listQuarantined: (filter?: QuarantineFilter) => Effect.Effect<QuarantineRecord[]>
  readonly restoreQuarantined: (id: string) => Effect.Effect<void>
  readonly discardQuarantined: (id: string) => Effect.Effect<void>
  readonly getQuarantineDetail: (id: string) => Effect.Effect<{ record: QuarantineRecord; diff: string } | null>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Quarantine") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    ensureTable()
    const db: SQLiteBunDatabase = yield* Effect.sync(() => Client())

    const quarantineFile = Effect.fn("Quarantine.quarantineFile")(function* (params: {
      sessionId: string
      filePath: string
      quarantinedContent: string
      scanFindings: string
      severity: Severity
    }) {
      const id = Identifier.create("qrn", "ascending")
      const state = captureFileState(params.filePath)
      const ch = hashContent(params.quarantinedContent)

      yield* Effect.sync(() =>
        db.insert(QuarantineTable).values({
          id,
          session_id: params.sessionId,
          file_path: params.filePath,
          original_content: state.content,
          quarantined_content: params.quarantinedContent,
          content_hash: ch,
          scan_findings: params.scanFindings,
          severity: params.severity,
          status: "quarantined",
          quarantined_at: Date.now(),
        }).run(),
      )

      // Rollback the file
      rollbackFile(params.filePath, state.content)
      log.info("file quarantined and reverted", { id, filePath: params.filePath, severity: params.severity })

      return id
    })

    const listQuarantined = Effect.fn("Quarantine.listQuarantined")(function* (filter?: QuarantineFilter) {
      let query = db.select().from(QuarantineTable) as any

      if (filter?.status) query = query.where(eq(QuarantineTable.status, filter.status))
      if (filter?.severity) query = query.where(eq(QuarantineTable.severity, filter.severity))
      if (filter?.sessionId) query = query.where(eq(QuarantineTable.session_id, filter.sessionId))

      const rows = yield* Effect.sync(() => query.all())
      return rows.map(toRecord)
    })

    const restoreQuarantined = Effect.fn("Quarantine.restoreQuarantined")(function* (id: string) {
      const row = yield* Effect.sync(() =>
        db.select().from(QuarantineTable).where(eq(QuarantineTable.id, id)).get(),
      )
      if (!row) {
        log.warn("quarantine record not found", { id })
        return
      }

      // Write the quarantined content back to the file
      fs.writeFileSync(row.file_path, row.quarantined_content, "utf-8")

      yield* Effect.sync(() =>
        db.update(QuarantineTable).set({ status: "restored", resolved_at: Date.now(), resolved_by: "user" })
          .where(eq(QuarantineTable.id, id)).run(),
      )
      log.info("quarantined file restored", { id, filePath: row.file_path })
    })

    const discardQuarantined = Effect.fn("Quarantine.discardQuarantined")(function* (id: string) {
      yield* Effect.sync(() =>
        db.update(QuarantineTable).set({ status: "discarded", resolved_at: Date.now(), resolved_by: "user" })
          .where(eq(QuarantineTable.id, id)).run(),
      )
    })

    const getQuarantineDetail = Effect.fn("Quarantine.getQuarantineDetail")(function* (id: string) {
      const row = yield* Effect.sync(() =>
        db.select().from(QuarantineTable).where(eq(QuarantineTable.id, id)).get(),
      )
      if (!row) return null
      const record = toRecord(row)
      const diff = createDiff(record.originalContent, record.quarantinedContent)
      return { record, diff }
    })

    return Service.of({ quarantineFile, listQuarantined, restoreQuarantined, discardQuarantined, getQuarantineDetail })
  }),
)

export const defaultLayer = layer

function toRecord(row: any): QuarantineRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    filePath: row.file_path,
    originalContent: row.original_content ?? null,
    quarantinedContent: row.quarantined_content,
    contentHash: row.content_hash,
    scanFindings: row.scan_findings ?? "[]",
    severity: row.severity,
    status: row.status,
    quarantinedAt: row.quarantined_at,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
  }
}

import fs from "fs"
