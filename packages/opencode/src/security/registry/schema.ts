import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const ModelRegistryTable = sqliteTable("model_registry", {
  model_id: text().primaryKey(),
  status: text().notNull(),
  added_by: text().notNull(),
  reason: text(),
  first_seen: integer().notNull(),
  last_seen: integer().notNull(),
  session_count: integer().notNull().default(0),
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
  time_updated: integer()
    .notNull()
    .$onUpdate(() => Date.now()),
})
