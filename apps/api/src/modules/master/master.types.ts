import type { MasterSourceField } from "@poip/domain";
import type { MappingConfidence } from "@poip/domain";

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
  readonly updatedRows: number;
  readonly resolvedIssues: number;
}

export interface TargetCoverageRowDto {
  readonly month: string;
  readonly entityId: string | null;
  readonly entityName: string;
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
