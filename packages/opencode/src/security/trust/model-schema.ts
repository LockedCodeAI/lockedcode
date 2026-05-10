import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"

/**
 * Model trust history — per-model trust metrics persisted in SQLite.
 */
export const ModelTrustTable = sqliteTable("model_trust", {
  model_id: text().primaryKey(),
  total_actions: integer().notNull().default(0),
  flagged_actions: integer().notNull().default(0),
  blocked_actions: integer().notNull().default(0),
  average_score: real().notNull().default(0),
  last_flagged_at: integer(),
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
  time_updated: integer()
    .notNull()
    .$onUpdate(() => Date.now()),
})
