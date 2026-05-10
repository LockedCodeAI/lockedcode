import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const QuarantineTable = sqliteTable(
  "quarantine_record",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    file_path: text().notNull(),
    original_content: text(),
    quarantined_content: text().notNull(),
    content_hash: text().notNull(),
    scan_findings: text({ mode: "json" }),
    severity: text().notNull(),
    status: text().notNull(),
    quarantined_at: integer().notNull(),
    resolved_at: integer(),
    resolved_by: text(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    index("quarantine_status_idx").on(table.status),
    index("quarantine_session_idx").on(table.session_id),
    index("quarantine_severity_idx").on(table.severity),
  ],
)
