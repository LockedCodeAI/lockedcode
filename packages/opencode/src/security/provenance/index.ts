import { Context, Effect, Layer } from "effect"
import { eq, desc } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { Identifier } from "@/id/id"
import { Client } from "@/storage/db"
import { FileProvenanceTable } from "./schema"
import { hashContent } from "../audit/hash"

const ensureTable = (() => {
  let done = false
  return () => {
    if (done) return
    const db = Client()
    db.run(`
      CREATE TABLE IF NOT EXISTS file_provenance (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        model_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        line_range_start INTEGER,
        line_range_end INTEGER,
        tool_name TEXT,
        timestamp INTEGER NOT NULL,
        time_created INTEGER NOT NULL
      )
    `)
    db.run("CREATE INDEX IF NOT EXISTS prov_file_path_idx ON file_provenance(file_path)")
    db.run("CREATE INDEX IF NOT EXISTS prov_model_id_idx ON file_provenance(model_id)")
    db.run("CREATE INDEX IF NOT EXISTS prov_session_id_idx ON file_provenance(session_id)")
    db.run("CREATE INDEX IF NOT EXISTS prov_timestamp_idx ON file_provenance(timestamp)")
    done = true
  }
})()

export interface FileProvenanceRecord {
  readonly id: string
  readonly filePath: string
  readonly modelId: string
  readonly sessionId: string
  readonly operation: "write" | "edit" | "patch" | "rename" | "delete"
  readonly contentHash: string
  readonly lineRangeStart?: number
  readonly lineRangeEnd?: number
  readonly toolName?: string
  readonly timestamp: number
}

export interface ModelSummary {
  readonly modelId: string
  readonly totalFiles: number
  readonly filesCreated: number
  readonly totalOperations: number
  readonly uniqueSessions: number
  readonly firstActivity: number
  readonly lastActivity: number
}

export interface Interface {
  readonly recordFileOperation: (params: {
    filePath: string
    modelId: string
    sessionId: string
    operation: "write" | "edit" | "patch" | "rename" | "delete"
    content: string
    lineRangeStart?: number
    lineRangeEnd?: number
    toolName?: string
  }) => Effect.Effect<string>
  readonly getFileHistory: (filePath: string) => Effect.Effect<FileProvenanceRecord[]>
  readonly getModelFiles: (modelId: string) => Effect.Effect<FileProvenanceRecord[]>
  readonly getModelSummary: (modelId: string) => Effect.Effect<ModelSummary>
  readonly getFileCurrentModel: (filePath: string) => Effect.Effect<string | null>
  readonly getProjectProvenance: () => Effect.Effect<Array<{ modelId: string; fileCount: number; operationCount: number; lastActivity: number }>>
  readonly findFilesForReview: (modelId: string) => Effect.Effect<FileProvenanceRecord[]>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/Provenance") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    ensureTable()

    const db: SQLiteBunDatabase = yield* Effect.sync(() => Client())

    const recordFileOperation = Effect.fn("Provenance.recordFileOperation")(function* (params: {
      filePath: string
      modelId: string
      sessionId: string
      operation: "write" | "edit" | "patch" | "rename" | "delete"
      content: string
      lineRangeStart?: number
      lineRangeEnd?: number
      toolName?: string
    }) {
      const id = Identifier.create("prov", "ascending")
      const ch = hashContent(params.content)
      const timestamp = Date.now()

      // Canonicalize file path relative to cwd
      const cwd = process.cwd()
      const absPath = params.filePath.startsWith("/") ? params.filePath : `${cwd}/${params.filePath}`
      const relPath = absPath.startsWith(cwd) ? absPath.slice(cwd.length + 1) : params.filePath

      yield* Effect.sync(() =>
        db.insert(FileProvenanceTable).values({
          id,
          file_path: relPath,
          model_id: params.modelId,
          session_id: params.sessionId,
          operation: params.operation,
          content_hash: ch,
          line_range_start: params.lineRangeStart ?? null,
          line_range_end: params.lineRangeEnd ?? null,
          tool_name: params.toolName ?? null,
          timestamp,
        }).run(),
      )

      return id
    })

    const getFileHistory = Effect.fn("Provenance.getFileHistory")(function* (filePath: string) {
      const rows = yield* Effect.sync(() =>
        db.select()
          .from(FileProvenanceTable)
          .where(eq(FileProvenanceTable.file_path, filePath))
          .orderBy(desc(FileProvenanceTable.time_created))
          .all(),
      )
      return rows.map(toRecord)
    })

    const getModelFiles = Effect.fn("Provenance.getModelFiles")(function* (modelId: string) {
      const rows = yield* Effect.sync(() =>
        db.select()
          .from(FileProvenanceTable)
          .where(eq(FileProvenanceTable.model_id, modelId))
          .orderBy(desc(FileProvenanceTable.time_created))
          .all(),
      )
      return rows.map(toRecord)
    })

    const getModelSummary = Effect.fn("Provenance.getModelSummary")(function* (modelId: string) {
      const rows = yield* Effect.sync(() =>
        db.select()
          .from(FileProvenanceTable)
          .where(eq(FileProvenanceTable.model_id, modelId))
          .all(),
      )
      const records = rows.map(toRecord)
      const files = new Set(records.map((r) => r.filePath))
      const created = records.filter((r) => r.operation === "write")
      const sessions = new Set(records.map((r) => r.sessionId))
      const timestamps = records.map((r) => r.timestamp).sort((a, b) => a - b)

      return {
        modelId,
        totalFiles: files.size,
        filesCreated: created.length,
        totalOperations: records.length,
        uniqueSessions: sessions.size,
        firstActivity: timestamps[0] ?? 0,
        lastActivity: timestamps[timestamps.length - 1] ?? 0,
      } as ModelSummary
    })

    const getFileCurrentModel = Effect.fn("Provenance.getFileCurrentModel")(function* (filePath: string) {
      const row = yield* Effect.sync(() =>
        db.select()
          .from(FileProvenanceTable)
          .where(eq(FileProvenanceTable.file_path, filePath))
          .orderBy(desc(FileProvenanceTable.time_created))
          .limit(1)
          .get(),
      )
      return row?.model_id ?? null
    })

    const getProjectProvenance = Effect.fn("Provenance.getProjectProvenance")(function* () {
      const rows = yield* Effect.sync(() =>
        db.select().from(FileProvenanceTable).all(),
      )
      const records = rows.map(toRecord)

      const byModel = new Map<string, { files: Set<string>; count: number; lastActivity: number }>()
      for (const r of records) {
        const entry = byModel.get(r.modelId) ?? { files: new Set(), count: 0, lastActivity: 0 }
        entry.files.add(r.filePath)
        entry.count++
        if (r.timestamp > entry.lastActivity) entry.lastActivity = r.timestamp
        byModel.set(r.modelId, entry)
      }

      return Array.from(byModel.entries()).map(([modelId, data]) => ({
        modelId,
        fileCount: data.files.size,
        operationCount: data.count,
        lastActivity: data.lastActivity,
      }))
    })

    const findFilesForReview: Interface["findFilesForReview"] = Effect.fn("Provenance.findFilesForReview")(function* (modelId: string) {
      const rows = yield* Effect.sync(() =>
        db.select()
          .from(FileProvenanceTable)
          .where(eq(FileProvenanceTable.model_id, modelId))
          .orderBy(desc(FileProvenanceTable.time_created))
          .all(),
      )
      return rows.map(toRecord)
    })

    return Service.of({
      recordFileOperation,
      getFileHistory,
      getModelFiles,
      getModelSummary,
      getFileCurrentModel,
      getProjectProvenance,
      findFilesForReview,
    } as Interface)
  }),
)

export const defaultLayer = layer

function toRecord(row: any): FileProvenanceRecord {
  return {
    id: row.id,
    filePath: row.file_path,
    modelId: row.model_id,
    sessionId: row.session_id,
    operation: row.operation,
    contentHash: row.content_hash,
    lineRangeStart: row.line_range_start ?? undefined,
    lineRangeEnd: row.line_range_end ?? undefined,
    toolName: row.tool_name ?? undefined,
    timestamp: row.timestamp,
  }
}
