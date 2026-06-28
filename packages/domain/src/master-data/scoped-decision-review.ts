export type ScopedDecisionFamily =
  | "OMSO"
  | "POLYPRINT"
  | "VFINE"
  | "LONGSUN"
  | "THERMO HENGFENG"
  | "(blank)/UNMAPPED"
  | "MOCK"
  | "OTHER";

export type ScopedDecisionCategory =
  | "SOURCE_DATA_REVIEW"
  | "ALIAS_CANONICAL_REVIEW"
  | "CANONICAL_ENTITY_NEEDED"
  | "REJECT_ATTACHMENT_REVIEW"
  | "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"
  | "DEFER_NOT_P1_BLOCKING"
  | "MANUAL_REVIEW_REQUIRED";

export interface ScopedDecisionReviewInputRow {
  readonly blocker_group_id: string;
  readonly blocker_category: string;
  readonly review_group_type: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly proposed_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: string | number;
  readonly risk_level: string;
  readonly risk_reason: string;
  readonly review_decision: string;
  readonly recommended_action: string;
  readonly p10_blocker_before_scope: string;
  readonly blocks_p10_after_scope: string;
  readonly bc_current_kpi_scope: string;
  readonly bc_future_use_domain: string;
  readonly bc_scope_reason: string;
  readonly bc_scope_evidence_fields: string;
  readonly bc_entity_source_status: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface ScopedDecisionReviewRow {
  readonly decision_id: string;
  readonly decision_family: ScopedDecisionFamily;
  readonly decision_category: ScopedDecisionCategory;
  readonly source_values: string;
  readonly blocker_group_ids: string;
  readonly blocker_categories: string;
  readonly review_group_types: string;
  readonly rows: number;
  readonly risk_levels: string;
  readonly reason: string;
  readonly recommended_action: string;
  readonly required_decision: string;
  readonly safe_to_auto_apply: "false";
  readonly decision_status: "pending";
  readonly p10_gate_effect: "BLOCKS_P1_0";
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface ScopedDecisionFamilyRollupRow {
  readonly decision_family: ScopedDecisionFamily;
  readonly decision_rows: number;
  readonly blocker_groups: number;
  readonly grouped_rows: number;
  readonly categories: string;
  readonly top_source_values: string;
  readonly safe_to_auto_apply: "false";
  readonly p10_gate_effect: "BLOCKS_P1_0";
}

export interface ScopedDecisionNextActionRow {
  readonly action_id: string;
  readonly decision_family: ScopedDecisionFamily;
  readonly decision_category: ScopedDecisionCategory;
  readonly priority: "P1" | "P2" | "P3";
  readonly action: string;
  readonly owner: "";
  readonly status: "pending";
  readonly safe_to_auto_apply: "false";
}

export interface ScopedDecisionReviewSummary {
  readonly generatedAt: string;
  readonly sourcePackage: string;
  readonly outputFolder: string;
  readonly totalDecisionFamilies: number;
  readonly trueP10BlockerGroups: number;
  readonly trueP10BlockerGroupedRows: number;
  readonly unknownSourceReviewRows: number;
  readonly aliasCanonicalReviewRows: number;
  readonly rejectAttachmentReviewRows: number;
  readonly targetProfileDependencyRows: number;
  readonly familyRollup: readonly ScopedDecisionFamilyRollupRow[];
  readonly topDecisionFamilies: readonly ScopedDecisionFamilyRollupRow[];
  readonly recommendedNextActions: readonly string[];
  readonly p10Gate: {
    readonly status: "BLOCKED" | "PASS";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

export function buildScopedDecisionReview(input: {
  readonly rows: readonly ScopedDecisionReviewInputRow[];
  readonly generatedAt?: string;
  readonly sourcePackage: string;
  readonly outputFolder: string;
}): {
  readonly decisionRows: readonly ScopedDecisionReviewRow[];
  readonly aliasCanonicalRows: readonly ScopedDecisionReviewRow[];
  readonly unknownSourceRows: readonly ScopedDecisionReviewRow[];
  readonly rejectAttachmentRows: readonly ScopedDecisionReviewRow[];
  readonly targetProfileDependencyRows: readonly ScopedDecisionReviewRow[];
  readonly familyRollupRows: readonly ScopedDecisionFamilyRollupRow[];
  readonly nextActionRows: readonly ScopedDecisionNextActionRow[];
  readonly summary: ScopedDecisionReviewSummary;
} {
  const trueBlockers = input.rows.filter((row) => row.blocks_p10_after_scope === "true");
  const grouped = groupDecisionRows(trueBlockers);
  const decisionRows = [...grouped.values()]
    .map((group, index): ScopedDecisionReviewRow => ({
      decision_id: `D${String(index + 1).padStart(5, "0")}`,
      decision_family: group.family,
      decision_category: group.category,
      source_values: sortedValues(group.sourceValues).join("|"),
      blocker_group_ids: sortedValues(group.blockerIds).join("|"),
      blocker_categories: sortedValues(group.blockerCategories).join("|"),
      review_group_types: sortedValues(group.reviewGroupTypes).join("|"),
      rows: group.rows,
      risk_levels: sortedValues(group.riskLevels).join("|"),
      reason: group.reason,
      recommended_action: group.recommendedAction,
      required_decision: requiredDecision(group.category),
      safe_to_auto_apply: "false",
      decision_status: "pending",
      p10_gate_effect: "BLOCKS_P1_0",
      sample_documents: sortedValues(group.sampleDocuments).slice(0, 5).join("|"),
      sample_items: sortedValues(group.sampleItems).slice(0, 5).join("|")
    }))
    .sort((left, right) => right.rows - left.rows || left.decision_family.localeCompare(right.decision_family) || left.decision_category.localeCompare(right.decision_category))
    .map((row, index) => ({ ...row, decision_id: `D${String(index + 1).padStart(5, "0")}` }));
  const familyRollupRows = buildFamilyRollup(decisionRows);
  const nextActionRows = buildNextActions(decisionRows);
  const p10Blocked = decisionRows.some((row) => row.decision_status === "pending");
  const summary: ScopedDecisionReviewSummary = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourcePackage: input.sourcePackage,
    outputFolder: input.outputFolder,
    totalDecisionFamilies: familyRollupRows.length,
    trueP10BlockerGroups: trueBlockers.length,
    trueP10BlockerGroupedRows: sumRows(trueBlockers),
    unknownSourceReviewRows: sumDecisionRows(decisionRows, "SOURCE_DATA_REVIEW"),
    aliasCanonicalReviewRows: decisionRows
      .filter((row) => row.decision_category === "ALIAS_CANONICAL_REVIEW" || row.decision_category === "CANONICAL_ENTITY_NEEDED" || row.decision_category === "MANUAL_REVIEW_REQUIRED")
      .reduce((sum, row) => sum + row.rows, 0),
    rejectAttachmentReviewRows: sumDecisionRows(decisionRows, "REJECT_ATTACHMENT_REVIEW"),
    targetProfileDependencyRows: sumDecisionRows(decisionRows, "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"),
    familyRollup: familyRollupRows,
    topDecisionFamilies: familyRollupRows.slice(0, 10),
    recommendedNextActions: nextActionRows.slice(0, 10).map((row) => row.action),
    p10Gate: {
      status: p10Blocked ? "BLOCKED" : "PASS",
      reason: p10Blocked
        ? `P1.0 remains blocked: ${decisionRows.length} pending scoped decision rows across ${familyRollupRows.length} families.`
        : "No pending scoped decisions remain."
    },
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };
  return {
    decisionRows,
    aliasCanonicalRows: decisionRows.filter((row) => row.decision_category === "ALIAS_CANONICAL_REVIEW" || row.decision_category === "CANONICAL_ENTITY_NEEDED" || row.decision_category === "MANUAL_REVIEW_REQUIRED"),
    unknownSourceRows: decisionRows.filter((row) => row.decision_category === "SOURCE_DATA_REVIEW"),
    rejectAttachmentRows: decisionRows.filter((row) => row.decision_category === "REJECT_ATTACHMENT_REVIEW"),
    targetProfileDependencyRows: decisionRows.filter((row) => row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"),
    familyRollupRows,
    nextActionRows,
    summary
  };
}

function groupDecisionRows(rows: readonly ScopedDecisionReviewInputRow[]) {
  const groups = new Map<string, {
    family: ScopedDecisionFamily;
    category: ScopedDecisionCategory;
    sourceValues: Set<string>;
    blockerIds: Set<string>;
    blockerCategories: Set<string>;
    reviewGroupTypes: Set<string>;
    riskLevels: Set<string>;
    rows: number;
    reason: string;
    recommendedAction: string;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();
  for (const row of rows) {
    const family = decisionFamily(row);
    const category = decisionCategory(row, family);
    const key = `${family}:${category}:${normalized(row.source_value) || "(blank)"}`;
    const current = groups.get(key) ?? {
      family,
      category,
      sourceValues: new Set<string>(),
      blockerIds: new Set<string>(),
      blockerCategories: new Set<string>(),
      reviewGroupTypes: new Set<string>(),
      riskLevels: new Set<string>(),
      rows: 0,
      reason: decisionReason(row, family, category),
      recommendedAction: recommendedAction(row, family, category),
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    current.sourceValues.add(row.source_value || "(blank)");
    current.blockerIds.add(row.blocker_group_id);
    current.blockerCategories.add(row.blocker_category);
    current.reviewGroupTypes.add(row.review_group_type);
    current.riskLevels.add(row.risk_level);
    current.rows += numberValue(row.rows);
    for (const value of splitValues(row.sample_documents)) current.sampleDocuments.add(value);
    for (const value of splitValues(row.sample_items)) current.sampleItems.add(value);
    groups.set(key, current);
  }
  return groups;
}

export function decisionFamily(row: ScopedDecisionReviewInputRow): ScopedDecisionFamily {
  const text = normalized([row.source_value, row.canonical_entity_code, row.current_entity_codes, row.proposed_entity_code, row.machine_center_no].join(" "));
  if (row.source_field === "UNMAPPED" || row.source_value === "(blank)" || !normalized(row.source_value)) return "(blank)/UNMAPPED";
  if (text.includes("MOCK")) return "MOCK";
  if (text.includes("THERMO HENGFENG")) return "THERMO HENGFENG";
  if (text.includes("POLYPRINT")) return "POLYPRINT";
  if (text.includes("LONGSUN")) return "LONGSUN";
  if (text.includes("VFINE")) return "VFINE";
  if (text.includes("OMSO")) return "OMSO";
  return "OTHER";
}

export function decisionCategory(
  row: ScopedDecisionReviewInputRow,
  family = decisionFamily(row)
): ScopedDecisionCategory {
  if (row.review_group_type.startsWith("TARGET_PROFILE")) return "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION";
  if (row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE" || splitValues(row.sample_items).some((item) => normalized(item).startsWith("RJ"))) {
    return "REJECT_ATTACHMENT_REVIEW";
  }
  if (family === "(blank)/UNMAPPED") return "SOURCE_DATA_REVIEW";
  if (family === "THERMO HENGFENG") return "CANONICAL_ENTITY_NEEDED";
  if (family === "OTHER" || family === "MOCK") return "MANUAL_REVIEW_REQUIRED";
  return "ALIAS_CANONICAL_REVIEW";
}

function decisionReason(
  row: ScopedDecisionReviewInputRow,
  family: ScopedDecisionFamily,
  category: ScopedDecisionCategory
): string {
  if (category === "SOURCE_DATA_REVIEW") return "Blank or unmapped source evidence must be reviewed before any canonical entity decision.";
  if (category === "REJECT_ATTACHMENT_REVIEW") return "Reject scoped rows with RJ/reject evidence belong to reject attachment review before P1.0.";
  if (category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Target profile candidate depends on approved entity/canonical decision first.";
  if (family === "OMSO") return "OMSO source conflicts require manual alias/canonical review; do not auto apply broad aliases.";
  if (family === "VFINE") return "Potential wrong size/variant mapping, including VFINE BOTOL 600 ML versus 400 ML.";
  if (family === "LONGSUN") return "Potential wrong size/variant mapping, including 1500 ML versus 1000 ML or 600 ML.";
  if (family === "POLYPRINT") return "POLYPRINT naming and canonical normalization review is required.";
  if (family === "THERMO HENGFENG") return "THERMO HENGFENG legacy target-variant collapse needs reviewed canonical decision.";
  return row.risk_reason || "Manual scoped decision review is required.";
}

function recommendedAction(
  row: ScopedDecisionReviewInputRow,
  family: ScopedDecisionFamily,
  category: ScopedDecisionCategory
): string {
  if (category === "SOURCE_DATA_REVIEW") return "Review missing source fields; do not create canonical entities from blank source.";
  if (category === "REJECT_ATTACHMENT_REVIEW") return "Review reject attachment handling and RJ conversion evidence; do not update entity aliases.";
  if (category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Hold target profile decision until entity/canonical decision is approved.";
  if (family === "OMSO") return "Manually review OMSO alias/canonical conflict; never create broad/global aliases.";
  if (family === "VFINE" || family === "LONGSUN") return "Manually review size/variant mapping and correct canonical target before any later migration.";
  if (family === "POLYPRINT") return "Review POLYPRINT naming normalization and canonical code choice.";
  if (family === "THERMO HENGFENG") return "Review legacy target-variant collapse into canonical THERMO HENGFENG entity.";
  return row.recommended_action || "Manual review required; safe_to_auto_apply remains false.";
}

function requiredDecision(category: ScopedDecisionCategory): string {
  if (category === "SOURCE_DATA_REVIEW") return "Confirm source data fix or explicit non-entity handling.";
  if (category === "REJECT_ATTACHMENT_REVIEW") return "Confirm reject attachment path and exclude from entity alias decisions.";
  if (category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Wait for approved entity/canonical decision before target profile review.";
  return "Approve exact canonical/alias decision manually; broad/global aliases are forbidden.";
}

function buildFamilyRollup(rows: readonly ScopedDecisionReviewRow[]): readonly ScopedDecisionFamilyRollupRow[] {
  const groups = new Map<ScopedDecisionFamily, {
    decisionRows: number;
    blockerGroups: Set<string>;
    groupedRows: number;
    categories: Set<string>;
    sourceValues: Map<string, number>;
  }>();
  for (const row of rows) {
    const current = groups.get(row.decision_family) ?? {
      decisionRows: 0,
      blockerGroups: new Set<string>(),
      groupedRows: 0,
      categories: new Set<string>(),
      sourceValues: new Map<string, number>()
    };
    current.decisionRows += 1;
    for (const id of splitValues(row.blocker_group_ids)) current.blockerGroups.add(id);
    current.groupedRows += row.rows;
    current.categories.add(row.decision_category);
    for (const source of splitValues(row.source_values)) current.sourceValues.set(source, (current.sourceValues.get(source) ?? 0) + row.rows);
    groups.set(row.decision_family, current);
  }
  return [...groups.entries()]
    .map(([decision_family, group]) => ({
      decision_family,
      decision_rows: group.decisionRows,
      blocker_groups: group.blockerGroups.size,
      grouped_rows: group.groupedRows,
      categories: sortedValues(group.categories).join("|"),
      top_source_values: [...group.sourceValues.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 5).map(([source]) => source).join("|"),
      safe_to_auto_apply: "false" as const,
      p10_gate_effect: "BLOCKS_P1_0" as const
    }))
    .sort((left, right) => right.grouped_rows - left.grouped_rows || left.decision_family.localeCompare(right.decision_family));
}

function buildNextActions(rows: readonly ScopedDecisionReviewRow[]): readonly ScopedDecisionNextActionRow[] {
  return rows.slice(0, 50).map((row, index) => ({
    action_id: `A${String(index + 1).padStart(5, "0")}`,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    priority: index < 10 ? "P1" : index < 30 ? "P2" : "P3",
    action: row.recommended_action,
    owner: "",
    status: "pending",
    safe_to_auto_apply: "false"
  }));
}

function sumDecisionRows(rows: readonly ScopedDecisionReviewRow[], category: ScopedDecisionCategory): number {
  return rows.filter((row) => row.decision_category === category).reduce((sum, row) => sum + row.rows, 0);
}

function sumRows(rows: readonly ScopedDecisionReviewInputRow[]): number {
  return rows.reduce((sum, row) => sum + numberValue(row.rows), 0);
}

function numberValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: string): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function splitValues(value: string): readonly string[] {
  return String(value ?? "").split("|").map((item) => item.trim()).filter(Boolean);
}

function sortedValues(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
