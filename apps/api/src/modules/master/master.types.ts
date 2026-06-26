import type { MasterSourceField } from "@poip/domain";
import type { MappingConfidence } from "@poip/domain";

export type BusinessCentralMappingResetSourceField = Extract<
  MasterSourceField,
  "prod_line_description" | "prod_line_no" | "machine_center_no" | "machine_description"
>;

export type ConditionalMappingConditionType =
  | "inferred_target_bucket"
  | "item_category_code"
  | "item_no_pattern"
  | "item_description_pattern"
  | "gross_weight_range";

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalRows: number;
  readonly totalPages: number;
}

export interface MasterEntityDto {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly area: string | null;
  readonly lineCode: string | null;
  readonly productFamily: string | null;
  readonly reportGroup: string | null;
  readonly plannedRuntimeHours: number;
  readonly isActive: boolean;
  readonly aliasCount: number;
  readonly targetCount: number;
  readonly outputRowCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MasterAliasDto {
  readonly id: string;
  readonly entityId: string;
  readonly alias: string;
  readonly sourceSystem: string;
  readonly sourceField: MasterSourceField;
  readonly aliasNormalized: string;
  readonly source: string;
  readonly matchConfidence: number | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface UnmappedSourceGroupDto {
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
  readonly rowCount: number;
  readonly outputOkQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly sampleDocumentNos: readonly string[];
  readonly itemNos: readonly string[];
  readonly uoms: readonly string[];
  readonly candidates: readonly MappingCandidateDto[];
}

export interface MappingCandidateDto {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly reason: string;
  readonly score: number;
  readonly confidence: MappingConfidence;
  readonly targetExists: boolean;
}

export interface MappingPreviewDto {
  readonly sourceSystem: string;
  readonly sourceField?: MasterSourceField | undefined;
  readonly sourceValue?: string | undefined;
  readonly entityId?: string | undefined;
  readonly affectedRows: number;
  readonly alreadyMappedRows: number;
  readonly unresolvedIssueCount: number;
  readonly sampleEntryNos: readonly string[];
  readonly commitRequired: boolean;
}

export interface MappingCommitDto extends MappingPreviewDto {
  readonly alias?: MasterAliasDto | undefined;
  readonly aliasCommitStatus?: "inserted" | "already_mapped" | "reactivated" | undefined;
  readonly updatedRows: number;
  readonly resolvedIssues: number;
}

export interface BusinessCentralMappingResetAffectedEntityDto {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly mappedOutputRows: number;
  readonly activeAliasRows: number;
}

export interface BusinessCentralMappingResetDto {
  readonly sourceSystem: "business-central";
  readonly sourceField: BusinessCentralMappingResetSourceField;
  readonly sourceValue: string;
  readonly mode: "preview" | "commit";
  readonly totalOutputRows: number;
  readonly mappedOutputRowsBefore: number;
  readonly mappedOutputRowsAfter: number;
  readonly aliasesMatched: number;
  readonly aliasesDeactivated: number;
  readonly aliasesActiveAfter: number;
  readonly affectedEntities: readonly BusinessCentralMappingResetAffectedEntityDto[];
  readonly warnings: readonly string[];
}

export interface ConditionalMappingTargetEntityDto {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
}

export interface ConditionalMappingSampleDto {
  readonly entryNo: string | null;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly documentNo: string | null;
}

export interface ConditionalMappingRuleDto {
  readonly id: string;
  readonly entityId: string;
  readonly sourceSystem: string;
  readonly sourceField: BusinessCentralMappingResetSourceField;
  readonly sourceValue: string;
  readonly sourceValueNormalized: string;
  readonly conditionType: ConditionalMappingConditionType;
  readonly conditionValue: string;
  readonly conditionValueNormalized: string;
  readonly source: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConditionalMappingRuleListDto extends ConditionalMappingRuleDto {
  readonly targetEntity: ConditionalMappingTargetEntityDto;
}

export interface ConditionalMappingPreviewDto {
  readonly sourceSystem: "business-central";
  readonly sourceField: BusinessCentralMappingResetSourceField;
  readonly sourceValue: string;
  readonly conditionType: ConditionalMappingConditionType;
  readonly conditionValue: string;
  readonly targetEntity: ConditionalMappingTargetEntityDto;
  readonly mode: "preview" | "commit";
  readonly totalMatchingRows: number;
  readonly conditionMatchingRows: number;
  readonly currentlyMappedRows: number;
  readonly alreadyMappedDifferentEntityRows: number;
  readonly eligibleRows: number;
  readonly estimatedTargetEligibilityChange: number;
  readonly conditionMatchingOkQty: number;
  readonly outputOkQtyBefore: number;
  readonly outputOkQtyAfter: number;
  readonly samples: readonly ConditionalMappingSampleDto[];
  readonly warnings: readonly string[];
  readonly rule?: ConditionalMappingRuleDto | undefined;
  readonly updatedRows?: number | undefined;
  readonly resolvedIssues?: number | undefined;
}

export interface TargetCoverageRowDto {
  readonly month: string;
  readonly entityId: string | null;
  readonly entityName: string;
  readonly sourceField: MasterSourceField;
  readonly sourceGroup: string;
  readonly reason: "COVERED" | "UNMAPPED_ENTITY" | "NO_ACTIVE_TARGET" | "TARGET_NOT_APPROVED" | "OUTSIDE_EFFECTIVE_DATE" | "TARGET_ZERO";
  readonly rows: number;
  readonly outputOkQty: number;
}

export interface ConversionGapDto {
  readonly itemNo: string;
  readonly uom: string;
  readonly rowCount: number;
  readonly rejectKg: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly mappedGrossWeightPerPcs: number | null;
}

export interface ConversionMappingDto {
  readonly id: string;
  readonly itemNo: string;
  readonly uom: string;
  readonly grossWeightPerPcs: number;
  readonly source: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
