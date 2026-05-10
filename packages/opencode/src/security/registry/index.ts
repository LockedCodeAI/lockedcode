import { Context, Effect, Layer } from "effect"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { Client } from "@/storage/db"
import { ModelRegistryTable } from "./schema"

const ensureTable = (() => {
  let done = false
  return () => {
    if (done) return
    const db = Client()
    db.run(`
      CREATE TABLE IF NOT EXISTS model_registry (
        model_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        added_by TEXT NOT NULL,
        reason TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        session_count INTEGER NOT NULL DEFAULT 0,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL
      )
    `)
    done = true
  }
})()

export interface ModelRegistryEntry {
  readonly modelId: string
  readonly status: "approved" | "blocked" | "pending" | "unknown"
  readonly addedBy: string
  readonly reason?: string
  readonly firstSeen: number
  readonly lastSeen: number
  readonly sessionCount: number
}

export interface Interface {
  readonly registerModel: (modelId: string, status: string, addedBy: string, reason?: string) => Effect.Effect<void>
  readonly getModel: (modelId: string) => Effect.Effect<ModelRegistryEntry | null>
  readonly getAllModels: () => Effect.Effect<ModelRegistryEntry[]>
  readonly approveModel: (modelId: string, reason?: string) => Effect.Effect<void>
  readonly blockModel: (modelId: string, reason?: string) => Effect.Effect<void>
  readonly removeModel: (modelId: string) => Effect.Effect<void>
  readonly recordModelUsage: (modelId: string) => Effect.Effect<void>
  readonly isModelAllowed: (modelId: string) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@lockedcode/ModelRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    ensureTable()
    const db: SQLiteBunDatabase = yield* Effect.sync(() => Client())

    const find = Effect.fn("Registry.find")(function* (modelId: string) {
      const row = yield* Effect.sync(() =>
        db.select().from(ModelRegistryTable).where(eq(ModelRegistryTable.model_id, modelId)).get(),
      )
      return row ?? null
    })

    const upsert = Effect.fn("Registry.upsert")(function* (modelId: string, status: string, addedBy: string, reason?: string) {
      const existing = yield* find(modelId)
      const now = Date.now()
      if (existing) {
        yield* Effect.sync(() =>
          db.update(ModelRegistryTable).set({ status, added_by: addedBy, reason: reason ?? null, time_updated: now }).where(eq(ModelRegistryTable.model_id, modelId)).run(),
        )
      } else {
        yield* Effect.sync(() =>
          db.insert(ModelRegistryTable).values({
            model_id: modelId, status, added_by: addedBy, reason: reason ?? null,
            first_seen: now, last_seen: now, session_count: 0,
          }).run(),
        )
      }
    })

    const registerModel = Effect.fn("Registry.registerModel")(function* (modelId: string, status: string, addedBy: string, reason?: string) {
      yield* upsert(modelId, status, addedBy, reason)
    })

    const getModel = Effect.fn("Registry.getModel")(function* (modelId: string) {
      const row = yield* find(modelId)
      return row ? toEntry(row) : null
    })

    const getAllModels = Effect.fn("Registry.getAllModels")(function* () {
      const rows = yield* Effect.sync(() => db.select().from(ModelRegistryTable).all())
      return rows.map(toEntry)
    })

    const approveModel = Effect.fn("Registry.approveModel")(function* (modelId: string, reason?: string) {
      yield* upsert(modelId, "approved", "cli", reason)
    })

    const blockModel = Effect.fn("Registry.blockModel")(function* (modelId: string, reason?: string) {
      yield* upsert(modelId, "blocked", "cli", reason)
    })

    const removeModel = Effect.fn("Registry.removeModel")(function* (modelId: string) {
      yield* Effect.sync(() => db.delete(ModelRegistryTable).where(eq(ModelRegistryTable.model_id, modelId)).run())
    })

    const recordModelUsage = Effect.fn("Registry.recordModelUsage")(function* (modelId: string) {
      const existing = yield* find(modelId)
      const now = Date.now()
      if (existing) {
        yield* Effect.sync(() =>
          db.update(ModelRegistryTable).set({
            last_seen: now,
            session_count: existing.session_count + 1,
            time_updated: now,
          }).where(eq(ModelRegistryTable.model_id, modelId)).run(),
        )
      } else {
        yield* Effect.sync(() =>
          db.insert(ModelRegistryTable).values({
            model_id: modelId, status: "unknown", added_by: "auto",
            first_seen: now, last_seen: now, session_count: 1,
          }).run(),
        )
      }
    })

    const isModelAllowed = Effect.fn("Registry.isModelAllowed")(function* (modelId: string) {
      const entry = yield* getModel(modelId)
      if (entry) {
        if (entry.status === "blocked") return false
        if (entry.status === "approved") return true
      }
      return true
    })

    return Service.of({
      registerModel, getModel, getAllModels,
      approveModel, blockModel, removeModel,
      recordModelUsage, isModelAllowed,
    })
  }),
)

export const defaultLayer = layer

function toEntry(row: any): ModelRegistryEntry {
  return {
    modelId: row.model_id,
    status: row.status,
    addedBy: row.added_by,
    reason: row.reason ?? undefined,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    sessionCount: row.session_count,
  }
}
