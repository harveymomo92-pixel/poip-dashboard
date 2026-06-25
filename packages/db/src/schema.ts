import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";

const id = uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id,
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider").notNull().default("local"),
  providerSubject: text("provider_subject"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt,
  updatedAt
});

export const roles = pgTable("roles", {
  id,
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt
});

export const permissions = pgTable("permissions", {
  id,
  code: text("code").notNull().unique(),
  description: text("description")
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id)
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id)
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

export const masterEntities = pgTable("master_entities", {
  id,
  entityCode: text("entity_code").notNull().unique(),
  displayName: text("display_name").notNull(),
  area: text("area"),
  lineCode: text("line_code"),
  productFamily: text("product_family"),
  reportGroup: text("report_group"),
  plannedRuntimeHours: numeric("planned_runtime_hours", { precision: 8, scale: 2 })
    .notNull()
    .default("24"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt,
  updatedAt
});

export const masterEntityAliases = pgTable("master_entity_aliases", {
  id,
  entityId: uuid("entity_id")
    .notNull()
    .references(() => masterEntities.id),
  alias: text("alias").notNull().unique(),
  sourceSystem: text("source_system").notNull().default("business-central"),
  sourceField: text("source_field").notNull().default("machine_center_no"),
  aliasNormalized: text("alias_normalized").notNull(),
  source: text("source").notNull().default("manual"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  matchConfidence: numeric("match_confidence", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt,
  createdAt
}, (table) => [
  index("idx_master_alias_lookup").on(table.sourceSystem, table.sourceField, table.aliasNormalized),
  index("idx_master_alias_entity").on(table.entityId, table.isActive)
]);

export const itemConversionMappings = pgTable(
  "item_conversion_mappings",
  {
    id,
    itemNo: text("item_no").notNull(),
    uom: text("uom").notNull().default(""),
    grossWeightPerPcs: numeric("gross_weight_per_pcs", { precision: 18, scale: 6 }).notNull(),
    source: text("source").notNull().default("manual"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_item_conversion_lookup").on(table.itemNo, table.uom, table.isActive)
  ]
);

export const productionTargets = pgTable(
  "production_targets",
  {
    id,
    entityId: uuid("entity_id")
      .notNull()
      .references(() => masterEntities.id),
    targetVersion: integer("target_version").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    dailyTargetQty: numeric("daily_target_qty", { precision: 18, scale: 4 }).notNull(),
    rejectTargetPct: numeric("reject_target_pct", { precision: 8, scale: 4 }),
    minAchievementPct: numeric("min_achievement_pct", { precision: 8, scale: 4 })
      .notNull()
      .default("95"),
    maxAchievementPct: numeric("max_achievement_pct", { precision: 8, scale: 4 })
      .notNull()
      .default("110"),
    status: text("status").notNull().default("DRAFT"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt
  },
  (table) => [
    unique("production_targets_entity_version_unique").on(table.entityId, table.targetVersion),
    index("idx_production_targets_effective").on(table.entityId, table.effectiveFrom, table.effectiveTo)
  ]
);

export const syncRuns = pgTable("sync_runs", {
  id,
  sourceSystem: text("source_system").notNull(),
  sourceUrl: text("source_url"),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  checkpointBefore: jsonb("checkpoint_before"),
  checkpointAfter: jsonb("checkpoint_after"),
  rowsFetched: integer("rows_fetched").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  triggeredBy: uuid("triggered_by").references(() => users.id)
});

export const syncCheckpoints = pgTable("sync_checkpoints", {
  id,
  sourceSystem: text("source_system").notNull().unique(),
  lastEntryNo: bigint("last_entry_no", { mode: "bigint" }),
  lastPostingDate: date("last_posting_date"),
  lastSuccessfulSyncRunId: uuid("last_successful_sync_run_id").references(() => syncRuns.id),
  updatedAt
});

export const productionOutputStaging = pgTable("production_output_staging", {
  id,
  syncRunId: uuid("sync_run_id")
    .notNull()
    .references(() => syncRuns.id),
  sourceSystem: text("source_system").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  rowHash: text("row_hash").notNull(),
  validationStatus: text("validation_status").notNull().default("PENDING"),
  validationErrors: jsonb("validation_errors").notNull().default(sql`'[]'::jsonb`),
  createdAt
});

export const productionOutputs = pgTable(
  "production_outputs",
  {
    id,
    sourceSystem: text("source_system").notNull(),
    entryNo: bigint("entry_no", { mode: "bigint" }),
    postingDate: date("posting_date").notNull(),
    documentDate: date("document_date"),
    documentNo: text("document_no"),
    externalDocumentNo: text("external_document_no"),
    entryType: text("entry_type"),
    normalizedOutputType: text("normalized_output_type").notNull(),
    itemNo: text("item_no").notNull(),
    itemDescription: text("item_description"),
    itemCategoryCode: text("item_category_code"),
    machineDescription: text("machine_description"),
    machineCenterNo: text("machine_center_no"),
    entityId: uuid("entity_id").references(() => masterEntities.id),
    prodLineNo: text("prod_line_no"),
    prodLineDescription: text("prod_line_description"),
    shiftCode: text("shift_code"),
    operatorName: text("operator_name"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("0"),
    uom: text("uom"),
    grossWeightPerPcs: numeric("gross_weight_per_pcs", { precision: 18, scale: 6 }),
    rejectKg: numeric("reject_kg", { precision: 18, scale: 4 }).notNull().default("0"),
    rejectPcsEq: numeric("reject_pcs_eq", { precision: 18, scale: 4 }),
    rowHash: text("row_hash").notNull(),
    rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
    syncRunId: uuid("sync_run_id").references(() => syncRuns.id),
    createdAt,
    updatedAt
  },
  (table) => [
    unique("production_outputs_source_entry_unique").on(table.sourceSystem, table.entryNo),
    index("idx_outputs_posting_date").on(table.postingDate),
    index("idx_outputs_entity_date").on(table.entityId, table.postingDate),
    index("idx_outputs_item_date").on(table.itemNo, table.postingDate),
    index("idx_outputs_document_no").on(table.documentNo),
    index("idx_outputs_machine_description_date").on(table.machineDescription, table.postingDate),
    index("idx_outputs_machine_date").on(table.machineCenterNo, table.postingDate),
    index("idx_outputs_raw_payload_gin").using("gin", table.rawPayload)
  ]
);

export const downtimeEvents = pgTable(
  "downtime_events",
  {
    id,
    eventDate: date("event_date").notNull(),
    shiftCode: text("shift_code"),
    area: text("area"),
    entityId: uuid("entity_id").references(() => masterEntities.id),
    machineCode: text("machine_code"),
    lineCode: text("line_code"),
    category: text("category").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    status: text("status").notNull().default("OPEN"),
    severity: text("severity").notNull().default("MEDIUM"),
    picUserId: uuid("pic_user_id").references(() => users.id),
    rootCause: text("root_cause"),
    actionTaken: text("action_taken"),
    estimatedLossOutput: numeric("estimated_loss_output", { precision: 18, scale: 4 }),
    linkedSignalType: text("linked_signal_type"),
    sourceType: text("source_type").notNull().default("MANUAL"),
    sourceLine: text("source_line"),
    parserRunId: uuid("parser_run_id"),
    naturalKey: text("natural_key").notNull().unique(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt,
    updatedAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    index("idx_downtime_event_date").on(table.eventDate),
    index("idx_downtime_entity_date").on(table.entityId, table.eventDate),
    index("idx_downtime_status").on(table.status)
  ]
);

export const waParserRuns = pgTable("wa_parser_runs", {
  id,
  sourceText: text("source_text").notNull(),
  parserMode: text("parser_mode").notNull(),
  parserVersion: text("parser_version").notNull(),
  status: text("status").notNull().default("PREVIEW"),
  createdBy: uuid("created_by").references(() => users.id),
  committedBy: uuid("committed_by").references(() => users.id),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt
});

export const waParserRows = pgTable("wa_parser_rows", {
  id,
  parserRunId: uuid("parser_run_id")
    .notNull()
    .references(() => waParserRuns.id),
  rowNumber: integer("row_number").notNull(),
  sourceLine: text("source_line").notNull(),
  parsedPayload: jsonb("parsed_payload").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull().default("0"),
  warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("PENDING_REVIEW"),
  downtimeEventId: uuid("downtime_event_id").references(() => downtimeEvents.id),
  createdAt
});

export const importRuns = pgTable("import_runs", {
  id,
  importType: text("import_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  storedFilePath: text("stored_file_path"),
  fileHash: text("file_hash").notNull(),
  status: text("status").notNull().default("PREVIEW"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsValid: integer("rows_valid").notNull().default(0),
  rowsInvalid: integer("rows_invalid").notNull().default(0),
  rowsDuplicate: integer("rows_duplicate").notNull().default(0),
  rowsConflict: integer("rows_conflict").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  validationReport: jsonb("validation_report").notNull().default(sql`'{}'::jsonb`),
  createdBy: uuid("created_by").references(() => users.id),
  committedBy: uuid("committed_by").references(() => users.id),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  createdAt
});

export const importRows = pgTable(
  "import_rows",
  {
    id,
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => importRuns.id),
    rowNumber: integer("row_number").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    normalizedPayload: jsonb("normalized_payload").notNull().default(sql`'{}'::jsonb`),
    naturalKey: text("natural_key"),
    rowHash: text("row_hash").notNull(),
    status: text("status").notNull().default("PENDING_REVIEW"),
    issues: jsonb("issues").notNull().default(sql`'[]'::jsonb`),
    committedEntityType: text("committed_entity_type"),
    committedEntityId: uuid("committed_entity_id"),
    createdAt
  },
  (table) => [
    unique("import_rows_run_row_unique").on(table.importRunId, table.rowNumber),
    index("idx_import_rows_run_status").on(table.importRunId, table.status),
    index("idx_import_rows_natural_key").on(table.naturalKey)
  ]
);

export const dataQualityIssues = pgTable(
  "data_quality_issues",
  {
    id,
    issueCode: text("issue_code").notNull(),
    severity: text("severity").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    sourceSystem: text("source_system"),
    sourceRef: text("source_ref"),
    description: text("description").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt
  },
  (table) => [
    index("idx_dq_status_severity").on(table.status, table.severity),
    index("idx_dq_issue_code").on(table.issueCode)
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id,
    requestId: text("request_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeValue: jsonb("before_value"),
    afterValue: jsonb("after_value"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt
  },
  (table) => [
    index("idx_audit_created_at").on(table.createdAt),
    index("idx_audit_actor").on(table.actorUserId),
    index("idx_audit_entity").on(table.entityType, table.entityId)
  ]
);

export const actionItems = pgTable("action_items", {
  id,
  title: text("title").notNull(),
  description: text("description"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  priority: text("priority").notNull().default("MEDIUM"),
  status: text("status").notNull().default("TODO"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  dueDate: date("due_date"),
  resolutionNote: text("resolution_note"),
  createdBy: uuid("created_by").references(() => users.id),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt,
  updatedAt
});

export const notifications = pgTable("notifications", {
  id,
  userId: uuid("user_id").references(() => users.id),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  linkUrl: text("link_url"),
  status: text("status").notNull().default("UNREAD"),
  createdAt,
  readAt: timestamp("read_at", { withTimezone: true })
});
