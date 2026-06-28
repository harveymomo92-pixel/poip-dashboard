import fs from "node:fs";
import path from "node:path";
import {
  buildBusinessCentralScopedBlockerPackage,
  type ScopedBlockerPackageCsvRow,
  type ScopedBlockerPackageInputRow
} from "../packages/domain/src/master-data/scoped-blocker-package.js";

const SOURCE_DIR = ".tmp/bc-resolution-package";
const OUTPUT_DIR = ".tmp/bc-scoped-blocker-package";
const SUMMARY_FILE = "summary.json";
const READ_ME_FILE = "README.md";
const TRUE_BLOCKERS_FILE = "true-p10-blockers.csv";
const UNKNOWN_SCOPE_FILE = "unknown-scope-blockers.csv";
const OK_OUTPUT_FILE = "ok-output-entity-blockers.csv";
const REJECT_SCOPE_FILE = "reject-scope-blockers.csv";
const TARGET_PROFILE_BLOCKERS_FILE = "target-profile-blockers.csv";
const ALIAS_TEMPLATE_FILE = "alias-cleanup-decision-template.csv";
const CANONICAL_TEMPLATE_FILE = "canonical-entity-decision-template.csv";
const TARGET_PROFILE_TEMPLATE_FILE = "target-profile-decision-template.csv";

const CSV_COLUMNS: readonly (keyof ScopedBlockerPackageCsvRow)[] = [
  "priority",
  "blocker_id",
  "blocker_type",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_entity_source_status",
  "source_value",
  "canonical_entity_code",
  "current_entity_codes",
  "target_bucket",
  "machine_center_no",
  "rows",
  "risk_level",
  "decision_needed",
  "recommended_action",
  "blocks_p10_before_scope",
  "blocks_p10_after_scope",
  "sample_documents",
  "sample_items",
  "approval_status",
  "reviewer",
  "reviewer_notes"
];

interface ResolutionPackageSummary {
  readonly generatedAt: string;
  readonly scopeSummary: {
    readonly outputKpiOkScopeRows: number;
    readonly outputKpiRejectScopeRows: number;
    readonly outOfCurrentKpiScopeRows: number;
    readonly unknownScopeReviewRows: number;
    readonly excludedFromP10ButRetainedRows: number;
  };
  readonly p10Readiness: {
    readonly status: "BLOCKED" | "PASS_WITH_WARNINGS" | "PASS";
    readonly reason: string;
  };
}

interface ScopedBlockerPackageReadmeSummary {
  readonly generatedAt: string;
  readonly p10Gate: {
    readonly status: string;
    readonly reason: string;
  };
}

function main() {
  const sourceSummary = readResolutionPackageSummary(path.join(SOURCE_DIR, SUMMARY_FILE));
  const rows = [
    ...readManualApprovalRows(path.join(SOURCE_DIR, "manual-approval-queue.csv")),
    ...readBlockedChecklistRows(path.join(SOURCE_DIR, "blocked-groups-checklist.csv")),
    ...readAliasPlanRows(path.join(SOURCE_DIR, "alias-cleanup-review-plan.csv")),
    ...readCanonicalPlanRows(path.join(SOURCE_DIR, "canonical-entity-creation-plan.csv")),
    ...readTargetProfilePlanRows(path.join(SOURCE_DIR, "target-profile-seed-draft-plan.csv"))
  ];

  const totalRows =
    sourceSummary.scopeSummary.outputKpiOkScopeRows
    + sourceSummary.scopeSummary.outputKpiRejectScopeRows
    + sourceSummary.scopeSummary.outOfCurrentKpiScopeRows
    + sourceSummary.scopeSummary.unknownScopeReviewRows;

  const packageResult = buildBusinessCentralScopedBlockerPackage({
    rows,
    totalRows,
    excludedFromP10ButRetainedRows: sourceSummary.scopeSummary.excludedFromP10ButRetainedRows,
    p10Gate: {
      status: sourceSummary.p10Readiness.status,
      reason: sourceSummary.p10Readiness.reason,
      blockers: [],
      canSwitchDashboard: sourceSummary.p10Readiness.status !== "BLOCKED",
      canEnableResolverV2: sourceSummary.p10Readiness.status !== "BLOCKED",
      canEnableTargetProfiles: sourceSummary.p10Readiness.status !== "BLOCKED"
    },
    generatedAt: new Date().toISOString()
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeCsv(path.join(OUTPUT_DIR, TRUE_BLOCKERS_FILE), packageResult.categories.trueP10Blockers);
  writeCsv(path.join(OUTPUT_DIR, UNKNOWN_SCOPE_FILE), packageResult.categories.unknownScopeBlockers);
  writeCsv(path.join(OUTPUT_DIR, OK_OUTPUT_FILE), packageResult.categories.okOutputEntityBlockers);
  writeCsv(path.join(OUTPUT_DIR, REJECT_SCOPE_FILE), packageResult.categories.rejectScopeBlockers);
  writeCsv(path.join(OUTPUT_DIR, TARGET_PROFILE_BLOCKERS_FILE), packageResult.categories.targetProfileBlockers);
  writeCsv(path.join(OUTPUT_DIR, ALIAS_TEMPLATE_FILE), packageResult.categories.aliasCleanupNeeded);
  writeCsv(path.join(OUTPUT_DIR, CANONICAL_TEMPLATE_FILE), packageResult.categories.canonicalEntityNeeded);
  writeCsv(path.join(OUTPUT_DIR, TARGET_PROFILE_TEMPLATE_FILE), packageResult.categories.targetProfileNeeded);
  fs.writeFileSync(path.join(OUTPUT_DIR, SUMMARY_FILE), `${JSON.stringify(packageResult.summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, READ_ME_FILE), buildReadme(packageResult.summary), "utf8");

  console.log("Business Central scoped blocker package written.");
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`P1.0 gate: ${packageResult.summary.p10Gate.status}`);
  console.log(packageResult.summary.p10Gate.reason);
  console.log(JSON.stringify({
    totalRows: packageResult.summary.totalRows,
    trueP10BlockerGroups: packageResult.summary.trueP10BlockerGroups,
    p10BlockingRowsAfterScope: packageResult.summary.p10BlockingRowsAfterScope,
    unknownScopeBlockerRows: packageResult.summary.unknownScopeBlockerRows,
    okOutputEntityBlockerRows: packageResult.summary.okOutputEntityBlockerRows,
    rejectScopeBlockerRows: packageResult.summary.rejectScopeBlockerRows,
    targetProfileBlockerRows: packageResult.summary.targetProfileBlockerRows,
    aliasCleanupNeededRows: packageResult.summary.aliasCleanupNeededRows,
    canonicalEntityNeededRows: packageResult.summary.canonicalEntityNeededRows,
    targetProfileNeededRows: packageResult.summary.targetProfileNeededRows,
    excludedFromP10ButRetainedRows: packageResult.summary.excludedFromP10ButRetainedRows
  }, null, 2));
}

function readResolutionPackageSummary(filePath: string): ResolutionPackageSummary {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing resolution package summary: ${filePath}. Run pnpm bc:resolution-package first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ResolutionPackageSummary;
}

function readManualApprovalRows(filePath: string): readonly ScopedBlockerPackageInputRow[] {
  return parseCsvFile(filePath).map((row) => ({
    sourceFile: "manual-approval-queue.csv",
    priority: stringValue(row.priority),
    blockerId: stringValue(row.blocker_id),
    blockerType: stringValue(row.review_group_type),
    bcCurrentKpiScope: stringValue(row.bc_current_kpi_scope) as ScopedBlockerPackageInputRow["bcCurrentKpiScope"],
    bcFutureUseDomain: stringValue(row.bc_future_use_domain) as ScopedBlockerPackageInputRow["bcFutureUseDomain"],
    bcScopeReason: stringValue(row.bc_scope_reason),
    bcEntitySourceStatus: stringValue(row.bc_entity_source_status) as ScopedBlockerPackageInputRow["bcEntitySourceStatus"],
    sourceValue: stringValue(row.source_value),
    canonicalEntityCode: stringValue(row.canonical_entity_code),
    currentEntityCodes: splitList(row.current_entity_codes),
    targetBucket: stringValue(row.target_bucket),
    machineCenterNo: stringValue(row.machine_center_no),
    rows: numberValue(row.rows),
    riskLevel: riskValue(row.risk_level),
    decisionNeeded: stringValue(row.decision_needed),
    recommendedAction: stringValue(row.recommended_action),
    blocksP10BeforeScope: boolValue(row.blocks_p10),
    blocksP10AfterScope: boolValue(row.blocks_p10_after_scope),
    sampleDocuments: splitList(row.sample_documents),
    sampleItems: splitList(row.sample_items),
    approvalStatus: stringValue(row.approval_status),
    reviewer: "",
    reviewerNotes: ""
  }));
}

function readBlockedChecklistRows(filePath: string): readonly ScopedBlockerPackageInputRow[] {
  return parseCsvFile(filePath).map((row) => ({
    sourceFile: "blocked-groups-checklist.csv",
    priority: priorityFromRisk(stringValue(row.risk_level)),
    blockerId: stringValue(row.blocker_id),
    blockerType: stringValue(row.blocker_type),
    bcCurrentKpiScope: stringValue(row.bc_current_kpi_scope) as ScopedBlockerPackageInputRow["bcCurrentKpiScope"],
    bcFutureUseDomain: stringValue(row.bc_future_use_domain) as ScopedBlockerPackageInputRow["bcFutureUseDomain"],
    bcScopeReason: stringValue(row.bc_scope_reason),
    bcEntitySourceStatus: stringValue(row.bc_entity_source_status) as ScopedBlockerPackageInputRow["bcEntitySourceStatus"],
    sourceValue: stringValue(row.source_value),
    canonicalEntityCode: stringValue(row.canonical_entity_code),
    currentEntityCodes: splitList(row.current_entity_codes),
    targetBucket: stringValue(row.target_bucket),
    machineCenterNo: stringValue(row.machine_center_no),
    rows: numberValue(row.rows),
    riskLevel: riskValue(row.risk_level),
    decisionNeeded: stringValue(row.decision_needed),
    recommendedAction: stringValue(row.recommended_action),
    blocksP10BeforeScope: boolValue(row.blocks_p10_before_scope),
    blocksP10AfterScope: boolValue(row.blocks_p10_after_scope),
    sampleDocuments: splitList(row.sample_documents),
    sampleItems: splitList(row.sample_items),
    approvalStatus: stringValue(row.approval_status),
    reviewer: stringValue(row.reviewer),
    reviewerNotes: stringValue(row.reviewer_notes)
  }));
}

function readAliasPlanRows(filePath: string): readonly ScopedBlockerPackageInputRow[] {
  return parseCsvFile(filePath).map((row) => ({
    sourceFile: "alias-cleanup-review-plan.csv",
    priority: priorityFromRisk(stringValue(row.risk_level)),
    blockerId: "",
    blockerType: "ALIAS_CLEANUP_REVIEW",
    bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
    bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
    bcScopeReason: stringValue(row.reason),
    bcEntitySourceStatus: "HAS_PRIMARY_ENTITY_SOURCE",
    sourceValue: stringValue(row.source_value),
    canonicalEntityCode: stringValue(row.proposed_canonical_entity_code),
    currentEntityCodes: splitList(row.current_entity_codes),
    targetBucket: "",
    machineCenterNo: "",
    rows: numberValue(row.rows),
    riskLevel: riskValue(row.risk_level),
    decisionNeeded: "ALIAS_CLEANUP_REVIEW",
    recommendedAction: stringValue(row.recommended_action),
    blocksP10BeforeScope: false,
    blocksP10AfterScope: false,
    sampleDocuments: splitList(row.sample_documents),
    sampleItems: splitList(row.sample_items),
    approvalStatus: stringValue(row.approval_status),
    reviewer: "",
    reviewerNotes: ""
  }));
}

function readCanonicalPlanRows(filePath: string): readonly ScopedBlockerPackageInputRow[] {
  return parseCsvFile(filePath).map((row) => ({
    sourceFile: "canonical-entity-creation-plan.csv",
    priority: priorityFromRisk(stringValue(row.risk_level)),
    blockerId: "",
    blockerType: "CANONICAL_ENTITY_CREATION",
    bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
    bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
    bcScopeReason: stringValue(row.reason),
    bcEntitySourceStatus: "HAS_PRIMARY_ENTITY_SOURCE",
    sourceValue: stringValue(row.canonical_entity_code),
    canonicalEntityCode: stringValue(row.canonical_entity_code),
    currentEntityCodes: splitList(row.current_entity_codes),
    targetBucket: "",
    machineCenterNo: "",
    rows: numberValue(row.rows),
    riskLevel: riskValue(row.risk_level),
    decisionNeeded: "CANONICAL_ENTITY_CREATION",
    recommendedAction: stringValue(row.recommended_action),
    blocksP10BeforeScope: false,
    blocksP10AfterScope: false,
    sampleDocuments: splitList(row.sample_documents),
    sampleItems: splitList(row.sample_items),
    approvalStatus: stringValue(row.approval_status),
    reviewer: "",
    reviewerNotes: ""
  }));
}

function readTargetProfilePlanRows(filePath: string): readonly ScopedBlockerPackageInputRow[] {
  return parseCsvFile(filePath).map((row) => ({
    sourceFile: "target-profile-seed-draft-plan.csv",
    priority: priorityFromRisk(stringValue(row.risk_level)),
    blockerId: "",
    blockerType: "TARGET_PROFILE_SEED_DRAFT",
    bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
    bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
    bcScopeReason: stringValue(row.reason),
    bcEntitySourceStatus: "HAS_PRIMARY_ENTITY_SOURCE",
    sourceValue: `${stringValue(row.canonical_entity_code)}|${stringValue(row.target_bucket)}|${stringValue(row.machine_center_no)}`,
    canonicalEntityCode: stringValue(row.canonical_entity_code),
    currentEntityCodes: [stringValue(row.source_current_entity_code)].filter(Boolean),
    targetBucket: stringValue(row.target_bucket),
    machineCenterNo: stringValue(row.machine_center_no),
    rows: numberValue(row.rows),
    riskLevel: riskValue(row.risk_level),
    decisionNeeded: "TARGET_PROFILE_DRAFT",
    recommendedAction: stringValue(row.recommended_action),
    blocksP10BeforeScope: false,
    blocksP10AfterScope: false,
    sampleDocuments: splitList(row.sample_documents),
    sampleItems: splitList(row.sample_items),
    approvalStatus: stringValue(row.approval_status),
    reviewer: "",
    reviewerNotes: ""
  }));
}

function parseCsvFile(filePath: string): readonly Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing scoped blocker source file: ${filePath}. Run pnpm bc:resolution-package first.`);
  }
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(text: string): readonly Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      i++;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((value) => value.trim());
  return rows.slice(1).map((current) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = current[index] ?? "";
    });
    return record;
  });
}

function writeCsv(filePath: string, rows: readonly ScopedBlockerPackageCsvRow[]): void {
  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvField(row[column])).join(","))
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function buildReadme(summary: ScopedBlockerPackageReadmeSummary): string {
  return [
    "# BC Scoped Blocker Package",
    "",
    `Generated at: ${summary.generatedAt}`,
    "",
    "This package is reporting/export only.",
    "",
    "## Files",
    "",
    `- ${SUMMARY_FILE}`,
    `- ${TRUE_BLOCKERS_FILE}`,
    `- ${UNKNOWN_SCOPE_FILE}`,
    `- ${OK_OUTPUT_FILE}`,
    `- ${REJECT_SCOPE_FILE}`,
    `- ${TARGET_PROFILE_BLOCKERS_FILE}`,
    `- ${ALIAS_TEMPLATE_FILE}`,
    `- ${CANONICAL_TEMPLATE_FILE}`,
    `- ${TARGET_PROFILE_TEMPLATE_FILE}`,
    "",
    "## Gate",
    "",
    `${summary.p10Gate.status}: ${summary.p10Gate.reason}`,
    "",
    "## Safety",
    "",
    "No DB rows, aliases, target profiles, conditional rules, production output entity links, or dashboard behavior were changed."
  ].join("\n");
}

function csvField(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolValue(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function splitList(value: unknown): readonly string[] {
  return String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function riskValue(value: unknown) {
  const text = stringValue(value).toUpperCase();
  if (text === "HIGH" || text === "MEDIUM" || text === "LOW") return text;
  return "LOW";
}

function priorityFromRisk(riskLevel: string): string {
  switch (riskLevel.toUpperCase()) {
    case "HIGH": return "P1";
    case "MEDIUM": return "P2";
    default: return "P3";
  }
}

main();
