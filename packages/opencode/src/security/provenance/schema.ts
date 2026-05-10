import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

/**
 * File provenance tracking — records which model touched which file.
 */
export const FileProvenanceTable = sqliteTable(
  "file_provenance",
  {
    id: text().primaryKey(),
    file_path: text().notNull(),
    model_id: text().notNull(),
    session_id: text().notNull(),
    operation: text().notNull(),
    content_hash: text().notNull(),
    line_range_start: integer(),
    line_range_end: integer(),
    tool_name: text(),
    timestamp: integer().notNull(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    index("prov_file_path_idx").on(table.file_path),
    index("prov_model_id_idx").on(table.model_id),
    index("prov_session_id_idx").on(table.session_id),
    index("prov_timestamp_idx").on(table.timestamp),
  ],
)
