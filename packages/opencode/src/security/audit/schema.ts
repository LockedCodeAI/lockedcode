import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * Audit trail: every security-relevant event across the entire pipeline.
 */
export const SecurityEventTable = sqliteTable(
  "security_event",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    timestamp: integer().notNull(),
    event_type: text().notNull(),
    severity: text().notNull(),
    tool_name: text(),
    model_id: text(),
    content_hash: text().notNull(),
    action_taken: text().notNull(),
    details: text({ mode: "json" }),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    index("sec_evt_session_idx").on(table.session_id),
    index("sec_evt_timestamp_idx").on(table.timestamp),
    index("sec_evt_type_idx").on(table.event_type),
    index("sec_evt_severity_idx").on(table.severity),
    index("sec_evt_session_type_idx").on(table.session_id, table.event_type),
  ],
)

/**
 * Scan results linked to security events.
 */
export const ScanResultTable = sqliteTable(
  "scan_result",
  {
    id: text().primaryKey(),
    security_event_id: text()
      .references(() => SecurityEventTable.id, { onDelete: "cascade" }),
    scanner_name: text().notNull(),
    rule_id: text().notNull(),
    severity: text().notNull(),
    matched_content_hash: text(),
    line_number: integer(),
    remediation: text(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    index("scan_res_event_idx").on(table.security_event_id),
    index("scan_res_scanner_idx").on(table.scanner_name),
  ],
)

/**
 * Policy decisions linked to security events.
 */
export const PolicyDecisionTable = sqliteTable(
  "policy_decision",
  {
    id: text().primaryKey(),
    security_event_id: text()
      .notNull()
      .references(() => SecurityEventTable.id, { onDelete: "cascade" }),
    policy_rule_id: text(),
    evaluation_result: text().notNull(),
    override_by: text(),
    override_reason: text(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    index("pol_dec_event_idx").on(table.security_event_id),
  ],
)
