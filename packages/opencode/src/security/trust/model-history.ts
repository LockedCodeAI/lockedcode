import { Effect } from "effect"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { Client } from "@/storage/db"
import { ModelTrustTable } from "./model-schema"

export interface ModelTrustProfile {
  readonly modelId: string
  readonly totalActions: number
  readonly flaggedActions: number
  readonly blockedActions: number
  readonly averageScore: number
  readonly flagRate: number
  readonly riskLevel: "trusted" | "moderate" | "elevated" | "high_risk"
  readonly lastFlaggedAt: number | null
}

/**
 * Ensure the model_trust table exists (auto-create in dev).
 */
function ensureTable(db: SQLiteBunDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS model_trust (
      model_id TEXT PRIMARY KEY,
      total_actions INTEGER NOT NULL DEFAULT 0,
      flagged_actions INTEGER NOT NULL DEFAULT 0,
      blocked_actions INTEGER NOT NULL DEFAULT 0,
      average_score REAL NOT NULL DEFAULT 0,
      last_flagged_at INTEGER,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL
    )
  `)
}

/**
 * Update model trust metrics after each scored action.
 */
export function updateModelHistory(
  modelId: string,
  score: number,
  wasFlagged: boolean,
  wasBlocked: boolean,
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const db: SQLiteBunDatabase = yield* Effect.sync(() => {
      ensureTable(Client())
      return Client()
    })

    const existing = yield* Effect.sync(() =>
      db.select().from(ModelTrustTable).where(eq(ModelTrustTable.model_id, modelId)).get(),
    )

    const totalActions = (existing?.total_actions ?? 0) + 1
    const prevTotal = existing?.total_actions ?? 0
    const prevAvg = existing?.average_score ?? 0
    const averageScore = prevTotal > 0
      ? (prevAvg * prevTotal + score) / totalActions
      : score

    const flaggedActions = (existing?.flagged_actions ?? 0) + (wasFlagged ? 1 : 0)
    const blockedActions = (existing?.blocked_actions ?? 0) + (wasBlocked ? 1 : 0)

    yield* Effect.sync(() =>
      db.insert(ModelTrustTable).values({
        model_id: modelId,
        total_actions: totalActions,
        flagged_actions: flaggedActions,
        blocked_actions: blockedActions,
        average_score: averageScore,
        last_flagged_at: wasFlagged ? Date.now() : (existing?.last_flagged_at ?? null),
      }).onConflictDoUpdate({
        target: ModelTrustTable.model_id,
        set: {
          total_actions: totalActions,
          flagged_actions: flaggedActions,
          blocked_actions: blockedActions,
          average_score: averageScore,
          last_flagged_at: wasFlagged ? Date.now() : undefined,
        },
      }).run(),
    )
  })
}

/**
 * Get the trust profile for a model.
 */
export function getModelHistory(modelId: string): Effect.Effect<ModelTrustProfile | null> {
  return Effect.gen(function* () {
    const db: SQLiteBunDatabase = yield* Effect.sync(() => {
      ensureTable(Client())
      return Client()
    })

    const row = yield* Effect.sync(() =>
      db.select().from(ModelTrustTable).where(eq(ModelTrustTable.model_id, modelId)).get(),
    )

    if (!row) return null

    const totalActions = row.total_actions
    const flaggedActions = row.flagged_actions
    const blockedActions = row.blocked_actions
    const flagRate = totalActions > 0 ? flaggedActions / totalActions : 0

    let riskLevel: ModelTrustProfile["riskLevel"] = "trusted"
    if (flagRate > 0.30) riskLevel = "high_risk"
    else if (flagRate > 0.15) riskLevel = "elevated"
    else if (flagRate > 0.05) riskLevel = "moderate"

    return {
      modelId: row.model_id,
      totalActions,
      flaggedActions,
      blockedActions,
      averageScore: row.average_score,
      flagRate,
      riskLevel,
      lastFlaggedAt: row.last_flagged_at ?? null,
    }
  })
}
