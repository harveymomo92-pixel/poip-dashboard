"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "../../components/Icons";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
import { useToast } from "../../components/Toast";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  Pagination,
  SectionHeader,
  SourceBadge,
  StatusBadge
} from "../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

type SourceField = "machine_description" | "machine_center_no" | "prod_line_description" | "prod_line_no" | "item_no" | "uom";
type ResetSourceField = Extract<SourceField, "machine_description" | "machine_center_no" | "prod_line_description" | "prod_line_no">;
type MappingConfidence = "HIGH" | "MEDIUM" | "LOW";
type ConditionalMappingConditionType = "inferred_target_bucket" | "item_category_code" | "item_no_pattern" | "item_description_pattern" | "gross_weight_range";

interface Overview {
  readonly totalEntities: number;
  readonly activeEntities: number;
  readonly activeAliases: number;
  readonly totalOutputRows: number;
  readonly mappedRows: number;
  readonly unmappedSourceGroups: number;
  readonly unmappedRows: number;
  readonly mappingCoveragePct: number | null;
  readonly targetCoverageGapRows: number;
  readonly conversionGaps: number;
}

interface Entity {
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
}

interface UnmappedGroup {
  readonly sourceField: SourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
  readonly rowCount: number;
  readonly outputOkQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly sampleDocumentNos: readonly string[];
  readonly candidates: readonly {
    readonly entityId: string;
    readonly entityCode: string;
    readonly displayName: string;
    readonly reason: string;
    readonly score: number;
    readonly confidence: MappingConfidence;
    readonly targetExists: boolean;
  }[];
}

interface PageResult<T> {
  readonly rows: readonly T[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly totalRows: number; readonly totalPages: number };
}

interface MappingPreview {
  readonly sourceField?: SourceField;
  readonly sourceValue?: string;
  readonly entityId?: string;
  readonly affectedRows: number;
  readonly alreadyMappedRows: number;
  readonly unresolvedIssueCount: number;
  readonly sampleEntryNos: readonly string[];
  readonly updatedRows?: number;
  readonly resolvedIssues?: number;
}

interface MappingResetPreview {
  readonly sourceSystem: "business-central";
  readonly sourceField: ResetSourceField;
  readonly sourceValue: string;
  readonly mode: "preview" | "commit";
  readonly totalOutputRows: number;
  readonly mappedOutputRowsBefore: number;
  readonly mappedOutputRowsAfter: number;
  readonly aliasesMatched: number;
  readonly aliasesDeactivated: number;
  readonly aliasesActiveAfter: number;
  readonly affectedEntities: readonly {
    readonly entityId: string;
    readonly entityCode: string;
    readonly displayName: string;
    readonly mappedOutputRows: number;
    readonly activeAliasRows: number;
  }[];
  readonly warnings: readonly string[];
}

interface EntityOption {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
}

interface ConditionalMappingTargetEntity {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
}

interface ConditionalMappingPreview {
  readonly sourceSystem: "business-central";
  readonly sourceField: ResetSourceField;
  readonly sourceValue: string;
  readonly conditionType: ConditionalMappingConditionType;
  readonly conditionValue: string;
  readonly targetEntity: ConditionalMappingTargetEntity;
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
  readonly samples: readonly {
    readonly entryNo: string | null;
    readonly itemNo: string;
    readonly itemDescription: string | null;
    readonly documentNo: string | null;
  }[];
  readonly warnings: readonly string[];
  readonly rule?: ConditionalMappingRule;
  readonly updatedRows?: number;
  readonly resolvedIssues?: number;
}

interface ConditionalMappingRule {
  readonly id: string;
  readonly entityId: string;
  readonly sourceSystem: string;
  readonly sourceField: ResetSourceField;
  readonly sourceValue: string;
  readonly sourceValueNormalized: string;
  readonly conditionType: ConditionalMappingConditionType;
  readonly conditionValue: string;
  readonly conditionValueNormalized: string;
  readonly source: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly targetEntity: ConditionalMappingTargetEntity;
}

interface CoverageRow {
  readonly month: string;
  readonly entityName: string;
  readonly sourceField: SourceField;
  readonly sourceGroup: string;
  readonly reason: string;
  readonly rows: number;
  readonly outputOkQty: number;
}

interface ConversionGap {
  readonly itemNo: string;
  readonly uom: string;
  readonly rowCount: number;
  readonly rejectKg: number;
  readonly mappedGrossWeightPerPcs: number | null;
}

const sourceFieldOptions: readonly { readonly value: SourceField; readonly label: string }[] = [
  { value: "machine_description", label: "Machine description" },
  { value: "machine_center_no", label: "Machine center no" },
  { value: "prod_line_description", label: "Prod line description" },
  { value: "prod_line_no", label: "Prod line no" }
];

const resetSourceFieldOptions = sourceFieldOptions as readonly { readonly value: ResetSourceField; readonly label: string }[];

const conditionalConditionOptions: readonly { readonly value: ConditionalMappingConditionType; readonly label: string }[] = [
  { value: "item_description_pattern", label: "Item description pattern" },
  { value: "item_no_pattern", label: "Item no pattern" },
  { value: "item_category_code", label: "Item category code" },
  { value: "inferred_target_bucket", label: "Inferred target bucket" },
  { value: "gross_weight_range", label: "Gross weight range" }
];

const confidenceOptions: readonly { readonly value: MappingConfidence; readonly label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" }
];

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatPct(value: number | null | undefined) {
  return value === null || value === undefined ? "N/A" : `${formatNumber(value, 2)}%`;
}

function sourceFieldLabel(value: SourceField) {
  return sourceFieldOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

function conditionalConditionLabel(value: ConditionalMappingConditionType) {
  return conditionalConditionOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

function isResetSourceField(value: SourceField): value is ResetSourceField {
  return resetSourceFieldOptions.some((option) => option.value === value);
}

function query(params: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim()) next.set(key, String(value));
  }
  return next.toString();
}

function friendlyApiError(code: string, message: string) {
  if (code === "ALIAS_ALREADY_MAPPED") return message;
  if (/failed query:|params:|insert into|update\s+"/i.test(message)) {
    return "Commit mapping gagal karena kendala database. Coba ulangi atau hubungi admin.";
  }
  return message;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    ...(init?.body
      ? { headers: { ...(init.headers ?? {}), "content-type": "application/json" } }
      : init?.headers
        ? { headers: init.headers }
        : {})
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!payload.ok) throw new Error(friendlyApiError(payload.error.code, payload.error.message));
  return payload.data;
}

export function MasterDataPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [entities, setEntities] = useState<PageResult<Entity> | null>(null);
  const [unmapped, setUnmapped] = useState<PageResult<UnmappedGroup> | null>(null);
  const [coverage, setCoverage] = useState<PageResult<CoverageRow> | null>(null);
  const [gaps, setGaps] = useState<PageResult<ConversionGap> | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UnmappedGroup | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [preview, setPreview] = useState<MappingPreview | null>(null);
  const [resetForm, setResetForm] = useState<{ readonly sourceField: ResetSourceField; readonly sourceValue: string }>({ sourceField: "prod_line_description", sourceValue: "" });
  const [resetPreview, setResetPreview] = useState<MappingResetPreview | null>(null);
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [conditionalForm, setConditionalForm] = useState<{
    readonly sourceField: ResetSourceField;
    readonly sourceValue: string;
    readonly conditionType: ConditionalMappingConditionType;
    readonly conditionValue: string;
    readonly entityId: string;
  }>({
    sourceField: "machine_center_no",
    sourceValue: "",
    conditionType: "item_description_pattern",
    conditionValue: "",
    entityId: ""
  });
  const [conditionalEntitySearch, setConditionalEntitySearch] = useState("");
  const [conditionalEntityOptions, setConditionalEntityOptions] = useState<readonly EntityOption[]>([]);
  const [conditionalPreview, setConditionalPreview] = useState<ConditionalMappingPreview | null>(null);
  const [conditionalConfirmText, setConditionalConfirmText] = useState("");
  const [conditionalRules, setConditionalRules] = useState<readonly ConditionalMappingRule[]>([]);
  const [conditionalRulesLoaded, setConditionalRulesLoaded] = useState(false);
  const [conditionalResult, setConditionalResult] = useState<ConditionalMappingPreview | null>(null);
  const [entityForm, setEntityForm] = useState({ entityCode: "", displayName: "", area: "", lineCode: "" });
  const [conversionForm, setConversionForm] = useState({ itemNo: "", uom: "", grossWeightPerPcs: "" });
  const [sourceField, setSourceField] = useState<SourceField | "">("");
  const [confidenceFilter, setConfidenceFilter] = useState<MappingConfidence | "">("");
  const [search, setSearch] = useState("");
  const [unmappedPage, setUnmappedPage] = useState(1);
  const [entityPage, setEntityPage] = useState(1);
  const [gapPage, setGapPage] = useState(1);
  const [confirmMapping, setConfirmMapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = currentUser?.permissions.includes("master_data.manage") ?? false;

  const unmappedQuery = useMemo(() => query({ page: unmappedPage, pageSize: 15, sourceField: sourceField || undefined, search }), [search, sourceField, unmappedPage]);
  const conditionalRulesQuery = useMemo(
    () => query({ sourceField: conditionalForm.sourceField, sourceValue: conditionalForm.sourceValue }),
    [conditionalForm.sourceField, conditionalForm.sourceValue]
  );
  const visibleUnmapped = useMemo(() => {
    if (!unmapped || !confidenceFilter) return unmapped?.rows ?? [];
    return unmapped.rows.filter((group) => (group.candidates[0]?.confidence ?? "LOW") === confidenceFilter);
  }, [confidenceFilter, unmapped]);

  const loadConditionalRules = useCallback(async () => {
    if (!conditionalForm.sourceValue.trim()) {
      setConditionalRules([]);
      setConditionalRulesLoaded(false);
      return;
    }
    try {
      const result = await api<readonly ConditionalMappingRule[]>(`/master/business-central/conditional-mapping/rules?${conditionalRulesQuery}`);
      setConditionalRules(result);
      setConditionalRulesLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conditional mapping rules tidak dapat dimuat.");
    }
  }, [conditionalForm.sourceValue, conditionalRulesQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api<{ user: CurrentUser }>("/auth/me");
      setCurrentUser(me.user);
      if (!me.user.permissions.includes("master_data.view")) return;
      const [overviewResult, entitiesResult, unmappedResult, coverageResult, gapsResult] = await Promise.all([
        api<Overview>("/master/overview"),
        api<PageResult<Entity>>(`/master/entities?${query({ page: entityPage, pageSize: 12 })}`),
        api<PageResult<UnmappedGroup>>(`/master/mapping/unmapped-sources?${unmappedQuery}`),
        api<PageResult<CoverageRow>>("/master/mapping/target-coverage?page=1&pageSize=20"),
        api<PageResult<ConversionGap>>(`/master/mapping/conversion-gaps?${query({ page: gapPage, pageSize: 10 })}`)
      ]);
      setOverview(overviewResult);
      setEntities(entitiesResult);
      setConditionalEntityOptions((current) => current.length > 0 ? current : entitiesResult.rows.map((entity) => ({
        id: entity.id,
        entityCode: entity.entityCode,
        displayName: entity.displayName
      })));
      setUnmapped(unmappedResult);
      setCoverage(coverageResult);
      setGaps(gapsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Master Data Center tidak dapat dimuat.");
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [entityPage, gapPage, unmappedQuery]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loaded || !currentUser?.permissions.includes("master_data.view")) return;
    void loadConditionalRules();
  }, [currentUser, loadConditionalRules, loaded]);

  async function createEntity() {
    if (!entityForm.entityCode.trim() || !entityForm.displayName.trim()) {
      setError("Entity code dan display name wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const entity = await api<Entity>("/master/entities", {
        method: "POST",
        body: JSON.stringify({
          entityCode: entityForm.entityCode,
          displayName: entityForm.displayName,
          area: entityForm.area || null,
          lineCode: entityForm.lineCode || null
        })
      });
      setEntityForm({ entityCode: "", displayName: "", area: "", lineCode: "" });
      setSelectedEntityId(entity.id);
      toast(`Master entity ${entity.entityCode} dibuat.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entity tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function previewMapping(group = selectedGroup, entityId = selectedEntityId) {
    if (!group || !entityId) {
      setError("Pilih source group dan entity tujuan dulu.");
      return;
    }
    if (!group.normalizedValue) {
      setError("Blank source group tidak bisa dipetakan otomatis. Gunakan konteks prod line, item, atau document untuk review manual.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<MappingPreview>("/master/mapping/apply/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceField: group.sourceField,
          sourceValue: group.sourceValue,
          entityId
        })
      });
      setPreview(result);
      setSelectedGroup(group);
      setSelectedEntityId(entityId);
      toast(`Preview siap: ${formatNumber(result.affectedRows)} row akan dipetakan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview mapping gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function commitMapping() {
    if (!selectedGroup || !selectedEntityId) return;
    setBusy(true);
    try {
      const result = await api<MappingPreview>("/master/mapping/apply/commit", {
        method: "POST",
        body: JSON.stringify({
          sourceField: selectedGroup.sourceField,
          sourceValue: selectedGroup.sourceValue,
          entityId: selectedEntityId,
          note: "Mapped from Master Data Center"
        })
      });
      setPreview(result);
      setConfirmMapping(false);
      toast(`Mapping diterapkan: ${formatNumber(result.updatedRows ?? result.affectedRows)} row diperbarui.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit mapping gagal.");
    } finally {
      setBusy(false);
    }
  }

  function prefillReset(group: UnmappedGroup) {
    if (!isResetSourceField(group.sourceField)) return;
    setResetForm({ sourceField: group.sourceField, sourceValue: group.sourceValue });
    setResetPreview(null);
    setResetAcknowledged(false);
    setResetConfirmText("");
    toast(`Reset / Remap source diisi dari ${sourceFieldLabel(group.sourceField)}. Jalankan preview sebelum commit.`, "info");
  }

  function prefillConditional(group: UnmappedGroup) {
    if (!isResetSourceField(group.sourceField)) return;
    const sourceField = group.sourceField;
    const candidates = group.candidates.map((candidate) => ({
      id: candidate.entityId,
      entityCode: candidate.entityCode,
      displayName: candidate.displayName
    }));
    const byId = new Map<string, EntityOption>();
    for (const option of [...candidates, ...conditionalEntityOptions]) byId.set(option.id, option);
    setConditionalEntityOptions([...byId.values()]);
    setConditionalForm((value) => ({
      ...value,
      sourceField,
      sourceValue: group.sourceValue,
      entityId: group.candidates[0]?.entityId ?? value.entityId
    }));
    setConditionalPreview(null);
    setConditionalConfirmText("");
    setConditionalResult(null);
    toast(`Conditional mapping diisi dari ${sourceFieldLabel(group.sourceField)}. Tambahkan kondisi item lalu preview.`, "info");
  }

  async function searchConditionalEntities() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<PageResult<Entity>>(`/master/entities?${query({ page: 1, pageSize: 25, search: conditionalEntitySearch || undefined, isActive: "true" })}`);
      const byId = new Map<string, EntityOption>();
      for (const entity of result.rows) byId.set(entity.id, { id: entity.id, entityCode: entity.entityCode, displayName: entity.displayName });
      const selected = conditionalEntityOptions.find((entity) => entity.id === conditionalForm.entityId);
      if (selected) byId.set(selected.id, selected);
      setConditionalEntityOptions([...byId.values()]);
      toast(`Entity search loaded ${formatNumber(result.rows.length)} option(s).`, "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entity search gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function previewConditionalMapping() {
    if (!conditionalForm.sourceValue.trim() || !conditionalForm.conditionValue.trim() || !conditionalForm.entityId) {
      setError("Source value, condition, dan target entity wajib diisi sebelum preview conditional mapping.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<ConditionalMappingPreview>("/master/business-central/conditional-mapping/preview", {
        method: "POST",
        body: JSON.stringify(conditionalForm)
      });
      setConditionalPreview(result);
      setConditionalResult(null);
      setConditionalConfirmText("");
      await loadConditionalRules();
      toast(`Conditional preview siap: ${formatNumber(result.conditionMatchingRows)} row match, ${formatNumber(result.eligibleRows)} eligible.`, "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview conditional mapping gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function commitConditionalMapping() {
    if (!conditionalPreview || conditionalConfirmText !== "COMMIT") {
      setError("Preview sukses dan konfirmasi COMMIT wajib lengkap sebelum commit conditional mapping.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<ConditionalMappingPreview>("/master/business-central/conditional-mapping/commit", {
        method: "POST",
        body: JSON.stringify({
          sourceField: conditionalPreview.sourceField,
          sourceValue: conditionalPreview.sourceValue,
          conditionType: conditionalPreview.conditionType,
          conditionValue: conditionalPreview.conditionValue,
          entityId: conditionalPreview.targetEntity.entityId,
          confirmation: "COMMIT",
          note: "Conditional mapping rule committed from Master Data Center"
        })
      });
      setConditionalPreview(result);
      setConditionalResult(result);
      setConditionalConfirmText("");
      toast(`Conditional mapping committed: ${formatNumber(result.updatedRows ?? 0)} row diperbarui.`, "success");
      await load();
      await loadConditionalRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit conditional mapping gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function previewMappingReset() {
    if (!resetForm.sourceValue.trim()) {
      setError("Source value untuk reset wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<MappingResetPreview>("/master/business-central/mapping-reset/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceField: resetForm.sourceField,
          sourceValue: resetForm.sourceValue
        })
      });
      setResetPreview(result);
      setResetAcknowledged(false);
      setResetConfirmText("");
      toast(`Preview reset siap: ${formatNumber(result.mappedOutputRowsBefore)} mapped row dan ${formatNumber(result.aliasesMatched)} alias aktif terdampak.`, "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview reset/remap gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function commitMappingReset() {
    if (!resetPreview || resetConfirmText !== "RESET" || !resetAcknowledged) {
      setError("Preview, checkbox, dan konfirmasi RESET wajib lengkap sebelum commit reset.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<MappingResetPreview>("/master/business-central/mapping-reset/commit", {
        method: "POST",
        body: JSON.stringify({
          sourceField: resetPreview.sourceField,
          sourceValue: resetPreview.sourceValue,
          confirmation: "RESET"
        })
      });
      setResetPreview(result);
      setResetAcknowledged(false);
      setResetConfirmText("");
      toast(`Reset selesai: ${formatNumber(result.mappedOutputRowsBefore - result.mappedOutputRowsAfter)} row dilepas dan ${formatNumber(result.aliasesDeactivated)} alias dinonaktifkan. Lanjutkan mapping review atau jalankan mapping plan.`, "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit reset/remap gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function createConversion() {
    if (!conversionForm.itemNo || !conversionForm.grossWeightPerPcs) {
      setError("Item dan gross weight wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await api("/master/mapping/conversions", {
        method: "POST",
        body: JSON.stringify({
          itemNo: conversionForm.itemNo,
          uom: conversionForm.uom,
          grossWeightPerPcs: Number(conversionForm.grossWeightPerPcs)
        })
      });
      const result = await api<{ updatedRows: number; resolvedIssues: number }>("/master/mapping/conversions/apply/commit", {
        method: "POST",
        body: JSON.stringify({
          itemNo: conversionForm.itemNo,
          uom: conversionForm.uom,
          note: "Gross weight conversion mapped from Master Data Center"
        })
      });
      toast(`Conversion applied: ${formatNumber(result.updatedRows)} reject row diperbarui.`);
      setConversionForm({ itemNo: "", uom: "", grossWeightPerPcs: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion mapping gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={8} /></div>;

  return (
    <PermissionGate user={currentUser} permission="master_data.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader
          eyebrow="Operations / Master data"
          title="Master Data & Mapping Center"
          description="Map raw Business Central machine, production-line, item, and UOM values into canonical master data before target achievement is trusted."
          meta={<><SourceBadge>business-central</SourceBadge><StatusBadge status={overview?.unmappedRows ? "WARNING" : "HEALTHY"} label={overview?.unmappedRows ? "Mapping gaps" : "Mapped"} /></>}
          actions={<button className="secondary-button" disabled={loading} onClick={() => void load()}><Icons.refresh />{loading ? "Refreshing…" : "Refresh"}</button>}
        />

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {overview ? (
          <section className="metric-grid metric-grid-five">
            <MetricCard icon={<Icons.database />} label="Entities" value={formatNumber(overview.activeEntities)} detail={`${formatNumber(overview.totalEntities)} total`} tone="info" />
            <MetricCard icon={<Icons.filter />} label="Active aliases" value={formatNumber(overview.activeAliases)} detail="Reviewed mapping rules" tone="success" />
            <MetricCard icon={<Icons.percent />} label="Mapping coverage" value={formatPct(overview.mappingCoveragePct)} detail={`${formatNumber(overview.mappedRows)} / ${formatNumber(overview.totalOutputRows)} rows`} tone={overview.unmappedRows ? "warning" : "success"} />
            <MetricCard icon={<Icons.alert />} label="Unmapped rows" value={formatNumber(overview.unmappedRows)} detail={`${formatNumber(overview.unmappedSourceGroups)} source groups`} tone={overview.unmappedRows ? "warning" : "success"} />
            <MetricCard icon={<Icons.target />} label="Target gaps" value={formatNumber(overview.targetCoverageGapRows)} detail="Rows not eligible for achievement" tone={overview.targetCoverageGapRows ? "warning" : "success"} />
            <MetricCard icon={<Icons.scale />} label="Conversion gaps" value={formatNumber(overview.conversionGaps)} detail="Reject rows missing gross weight" tone={overview.conversionGaps ? "danger" : "success"} />
          </section>
        ) : null}

        <section className="master-detail-layout has-detail">
          <div>
            <SectionHeader title="Alias Mapping Center" description="Review top unmapped BC source groups, preview affected rows, then commit an explicit alias mapping." actions={canManage ? <button className="secondary-button" disabled={busy || !selectedGroup || !selectedGroup.normalizedValue || !selectedEntityId} onClick={() => void previewMapping()}>Preview selected</button> : null} />
            <FilterBar compact actions={<><button className="secondary-button" onClick={() => { setSearch(""); setSourceField(""); setConfidenceFilter(""); setUnmappedPage(1); }}>Reset</button><button onClick={() => setUnmappedPage(1)}>Apply</button></>}>
              <Field label="Source field"><select value={sourceField} onChange={(event) => setSourceField(event.target.value as SourceField | "")}><option value="">All</option>{sourceFieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              <Field label="Confidence"><select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as MappingConfidence | "")}><option value="">All</option>{confidenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              <Field label="Search source"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ILLIG, HENGFENG, NEWDO…" /></Field>
            </FilterBar>
            {!unmapped || visibleUnmapped.length === 0 ? <EmptyState title="No unmapped groups" description="Current filters do not show unmapped Business Central source groups." /> : (
              <>
                <DataTable headers={["Source", "Rows", "OK qty", "Range", "Candidate", "Action"]}>
                  {visibleUnmapped.map((group) => (
                    <tr className={selectedGroup?.sourceField === group.sourceField && selectedGroup.sourceValue === group.sourceValue ? "selected-row" : ""} key={`${group.sourceField}:${group.sourceValue}`}>
                      <td><strong>{group.sourceValue || "(blank)"}</strong><small>{sourceFieldLabel(group.sourceField)} · {group.normalizedValue || "needs context"}</small></td>
                      <td>{formatNumber(group.rowCount)}</td>
                      <td>{formatNumber(group.outputOkQty, 1)}</td>
                      <td>{group.firstPostingDate ?? "—"} → {group.lastPostingDate ?? "—"}<small>{group.sampleDocumentNos.slice(0, 2).join(", ")}</small></td>
                      <td>{group.candidates[0] ? <>{group.candidates[0].entityCode}<small>{group.candidates[0].confidence} · score {group.candidates[0].score} · {group.candidates[0].targetExists ? "target exists" : "target missing"}</small><small>{group.candidates[0].reason}</small></> : "No candidate"}</td>
                      <td><div className="table-actions"><button className="secondary-button" onClick={() => { setSelectedGroup(group); if (group.candidates[0]) setSelectedEntityId(group.candidates[0].entityId); }}>Select</button><button className="secondary-button" disabled={!isResetSourceField(group.sourceField)} onClick={() => prefillConditional(group)}>Conditional</button><button className="secondary-button" disabled={!isResetSourceField(group.sourceField)} onClick={() => prefillReset(group)}>Reset / Remap</button></div></td>
                    </tr>
                  ))}
                </DataTable>
                <Pagination page={unmapped.pagination.page} totalPages={unmapped.pagination.totalPages} onPrevious={() => setUnmappedPage((value) => value - 1)} onNext={() => setUnmappedPage((value) => value + 1)} />
              </>
            )}
          </div>

          <aside className="detail-panel">
            <div className="detail-panel-header"><div><p className="eyebrow">Mapping preview</p><h2>{selectedGroup?.sourceValue ?? "Select a source group"}</h2></div></div>
            {selectedGroup ? (
              <>
                <dl className="detail-facts">
                  <div><dt>Source field</dt><dd>{sourceFieldLabel(selectedGroup.sourceField)}</dd></div>
                  <div><dt>Rows</dt><dd>{formatNumber(selectedGroup.rowCount)}</dd></div>
                  <div><dt>OK quantity</dt><dd>{formatNumber(selectedGroup.outputOkQty, 1)}</dd></div>
                  <div><dt>Confidence</dt><dd>{selectedGroup.candidates[0]?.confidence ?? "LOW"}</dd></div>
                  <div><dt>Target impact</dt><dd>{selectedGroup.candidates[0]?.targetExists ? `${formatNumber(selectedGroup.rowCount)} rows may become target-eligible` : "Target missing or no candidate"}</dd></div>
                </dl>
                <Field label="Map to existing entity" helper="No automatic low-confidence mapping is applied.">
                  <select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)}>
                    <option value="">Choose entity</option>
                    {selectedGroup.candidates.map((candidate) => <option key={`candidate:${candidate.entityId}`} value={candidate.entityId}>{candidate.entityCode} · {candidate.displayName} · {candidate.confidence}</option>)}
                    {selectedGroup.candidates.length > 0 ? <option disabled>----------</option> : null}
                    {entities?.rows
                      .filter((entity) => !selectedGroup.candidates.some((candidate) => candidate.entityId === entity.id))
                      .map((entity) => <option key={entity.id} value={entity.id}>{entity.entityCode} · {entity.displayName}</option>)}
                  </select>
                </Field>
                {preview ? <div className="detail-section"><h3>Preview result</h3><p>{formatNumber(preview.affectedRows)} rows will be mapped. {formatNumber(preview.alreadyMappedRows)} rows are already mapped. {formatNumber(preview.unresolvedIssueCount)} related issues may be resolved.</p><small>Samples: {preview.sampleEntryNos.join(", ") || "—"}</small></div> : null}
                {canManage ? <div className="detail-actions"><button disabled={busy || !selectedGroup.normalizedValue || !selectedEntityId} onClick={() => void previewMapping()}>Preview</button><button className="secondary-button" disabled={busy || !selectedGroup.normalizedValue || !preview || !selectedEntityId} onClick={() => setConfirmMapping(true)}>Commit mapping</button></div> : <p className="permission-note">Mapping commits require master data management permission.</p>}
              </>
            ) : <EmptyState title="No source selected" description="Select an unmapped Business Central source group from the table." />}
          </aside>
        </section>

        <section className="master-detail-layout">
          <div>
            <SectionHeader title="Reset / Remap Source" description="Preview then reset one exact Business Central source value. This removes existing entity mapping for the selected source and deactivates the matching active alias so the value can return to mapping review." />
            <div className="form-panel">
              <div className="form-grid">
                <Field label="Source field" helper="Only BC entity source fields are eligible.">
                  <select
                    value={resetForm.sourceField}
                    onChange={(event) => {
                      setResetForm((value) => ({ ...value, sourceField: event.target.value as ResetSourceField }));
                      setResetPreview(null);
                      setResetAcknowledged(false);
                      setResetConfirmText("");
                    }}
                  >
                    {resetSourceFieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Source value" helper="Exact selected source value only.">
                  <input
                    value={resetForm.sourceValue}
                    onChange={(event) => {
                      setResetForm((value) => ({ ...value, sourceValue: event.target.value }));
                      setResetPreview(null);
                      setResetAcknowledged(false);
                      setResetConfirmText("");
                    }}
                    placeholder="THERMO 2 ILLIG"
                  />
                </Field>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => void previewMappingReset()} disabled={busy || !resetForm.sourceValue.trim()}>{busy ? "Previewing..." : "Preview reset"}</button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={!canManage || busy || !resetPreview || resetPreview.mode !== "preview" || !resetAcknowledged || resetConfirmText !== "RESET"}
                  onClick={() => void commitMappingReset()}
                >
                  Commit reset
                </button>
              </div>
              {!canManage ? <p className="permission-note">Reset commits require master data management permission.</p> : null}
            </div>
          </div>
          <aside className="detail-panel">
            <div className="detail-panel-header"><div><p className="eyebrow">Reset preview</p><h2>{resetPreview?.sourceValue || resetForm.sourceValue || "Select a source value"}</h2></div>{resetPreview ? <StatusBadge status={resetPreview.mode === "commit" ? "COMMITTED" : "PREVIEW"} /> : null}</div>
            {resetPreview ? (
              <>
                <dl className="detail-facts">
                  <div><dt>Source field</dt><dd>{sourceFieldLabel(resetPreview.sourceField)}</dd></div>
                  <div><dt>Total matching rows</dt><dd>{formatNumber(resetPreview.totalOutputRows)}</dd></div>
                  <div><dt>Mapped before</dt><dd>{formatNumber(resetPreview.mappedOutputRowsBefore)}</dd></div>
                  <div><dt>Mapped after</dt><dd>{formatNumber(resetPreview.mappedOutputRowsAfter)}</dd></div>
                  <div><dt>Active aliases</dt><dd>{formatNumber(resetPreview.aliasesMatched)}</dd></div>
                  <div><dt>Aliases deactivated</dt><dd>{formatNumber(resetPreview.aliasesDeactivated)}</dd></div>
                </dl>
                {resetPreview.affectedEntities.length > 0 ? (
                  <div className="detail-section">
                    <h3>Affected master entity</h3>
                    {resetPreview.affectedEntities.map((entity) => (
                      <p key={entity.entityId}><strong>{entity.entityCode}</strong> · {entity.displayName}<small>{formatNumber(entity.mappedOutputRows)} mapped rows · {formatNumber(entity.activeAliasRows)} active aliases</small></p>
                    ))}
                  </div>
                ) : <div className="detail-section"><h3>Affected master entity</h3><p>No mapped entity or active alias currently matches this source value.</p></div>}
                <div className="detail-section">
                  <h3>Safety</h3>
                  {resetPreview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
                {resetPreview.mode === "preview" ? (
                  <div className="detail-section">
                    <Field label="Confirmation" helper="Type RESET and tick the checkbox to enable commit.">
                      <input value={resetConfirmText} onChange={(event) => setResetConfirmText(event.target.value)} placeholder="RESET" />
                    </Field>
                    <label className="field">
                      <span className="field-label">Acknowledgement</span>
                      <span className="button-row"><input className="checkbox" type="checkbox" checked={resetAcknowledged} onChange={(event) => setResetAcknowledged(event.target.checked)} /> KPI quantities and raw BC source fields are unchanged.</span>
                    </label>
                  </div>
                ) : <div className="detail-section"><h3>Next step</h3><p>Refresh is complete. Continue mapping review or run the Business Central mapping plan before validating dashboard KPIs.</p></div>}
              </>
            ) : <EmptyState title="No reset preview" description="Enter a Business Central source field/value or prefill from a candidate row, then run Preview reset." />}
          </aside>
        </section>

        <section className="master-detail-layout">
          <div>
            <SectionHeader title="Conditional Mapping Rule" description="Map one ambiguous BC source value only when item evidence matches the reviewed condition." actions={<button className="secondary-button" disabled={busy || !conditionalForm.sourceValue.trim()} onClick={() => void loadConditionalRules()}>Load active rules</button>} />
            <div className="form-panel">
              <div className="detail-section">
                <h3>Safety</h3>
                <p>Conditional mapping does not change quantities.</p>
                <p>Conditional mapping does not replace broad aliases.</p>
                <p>Do not use this to create global aliases for ambiguous source values.</p>
              </div>
              <div className="form-grid">
                <Field label="Source field">
                  <select
                    value={conditionalForm.sourceField}
                    onChange={(event) => {
                      setConditionalForm((value) => ({ ...value, sourceField: event.target.value as ResetSourceField }));
                      setConditionalPreview(null);
                      setConditionalConfirmText("");
                      setConditionalResult(null);
                      setConditionalRulesLoaded(false);
                    }}
                  >
                    {resetSourceFieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Source value">
                  <input
                    value={conditionalForm.sourceValue}
                    onChange={(event) => {
                      setConditionalForm((value) => ({ ...value, sourceValue: event.target.value }));
                      setConditionalPreview(null);
                      setConditionalConfirmText("");
                      setConditionalResult(null);
                      setConditionalRulesLoaded(false);
                    }}
                    placeholder="OMSO1 OZ"
                  />
                </Field>
                <Field label="Condition type">
                  <select
                    value={conditionalForm.conditionType}
                    onChange={(event) => {
                      setConditionalForm((value) => ({ ...value, conditionType: event.target.value as ConditionalMappingConditionType }));
                      setConditionalPreview(null);
                      setConditionalConfirmText("");
                      setConditionalResult(null);
                    }}
                  >
                    {conditionalConditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Condition value">
                  <input
                    value={conditionalForm.conditionValue}
                    onChange={(event) => {
                      setConditionalForm((value) => ({ ...value, conditionValue: event.target.value }));
                      setConditionalPreview(null);
                      setConditionalConfirmText("");
                      setConditionalResult(null);
                    }}
                    placeholder="22 OZ"
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Target entity search">
                  <input value={conditionalEntitySearch} onChange={(event) => setConditionalEntitySearch(event.target.value)} placeholder="OMSO 1-OZ" />
                </Field>
                <Field label="Target entity">
                  <select
                    value={conditionalForm.entityId}
                    onChange={(event) => {
                      setConditionalForm((value) => ({ ...value, entityId: event.target.value }));
                      setConditionalPreview(null);
                      setConditionalConfirmText("");
                      setConditionalResult(null);
                    }}
                  >
                    <option value="">Choose target entity</option>
                    {conditionalEntityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.entityCode} · {entity.displayName}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void searchConditionalEntities()}>Search entities</button>
                <button type="button" disabled={busy || !conditionalForm.sourceValue.trim() || !conditionalForm.conditionValue.trim() || !conditionalForm.entityId} onClick={() => void previewConditionalMapping()}>{busy ? "Previewing..." : "Preview condition"}</button>
              </div>
            </div>

            <div className="detail-section">
              <h3>Existing active rules</h3>
              {!conditionalRulesLoaded ? <p>Enter a source value or use quick fill, then load active rules.</p> : conditionalRules.length === 0 ? <p>No active conditional rules for this source value.</p> : (
                <DataTable headers={["Condition", "Target entity", "Source"]}>
                  {conditionalRules.map((rule) => (
                    <tr key={rule.id}>
                      <td><strong>{conditionalConditionLabel(rule.conditionType)}</strong><small>{rule.conditionValue}</small></td>
                      <td>{rule.targetEntity.entityCode}<small>{rule.targetEntity.displayName}</small></td>
                      <td>{rule.sourceValue}<small>{sourceFieldLabel(rule.sourceField)} · {rule.source}</small></td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          </div>

          <aside className="detail-panel">
            <div className="detail-panel-header"><div><p className="eyebrow">Conditional preview</p><h2>{conditionalPreview?.sourceValue || conditionalForm.sourceValue || "Select a source value"}</h2></div>{conditionalPreview ? <StatusBadge status={conditionalPreview.mode === "commit" ? "COMMITTED" : "PREVIEW"} /> : null}</div>
            {conditionalPreview ? (
              <>
                <dl className="detail-facts">
                  <div><dt>Target entity</dt><dd>{conditionalPreview.targetEntity.entityCode}<small>{conditionalPreview.targetEntity.displayName}</small></dd></div>
                  <div><dt>Total matching rows</dt><dd>{formatNumber(conditionalPreview.totalMatchingRows)}</dd></div>
                  <div><dt>Condition matching rows</dt><dd>{formatNumber(conditionalPreview.conditionMatchingRows)}</dd></div>
                  <div><dt>Currently mapped rows</dt><dd>{formatNumber(conditionalPreview.currentlyMappedRows)}</dd></div>
                  <div><dt>Mapped elsewhere</dt><dd>{formatNumber(conditionalPreview.alreadyMappedDifferentEntityRows)}</dd></div>
                  <div><dt>Eligible rows</dt><dd>{formatNumber(conditionalPreview.eligibleRows)}</dd></div>
                  <div><dt>Target eligibility change</dt><dd>{formatNumber(conditionalPreview.estimatedTargetEligibilityChange)}</dd></div>
                  <div><dt>Condition OK qty</dt><dd>{formatNumber(conditionalPreview.conditionMatchingOkQty, 1)}</dd></div>
                </dl>
                <div className="detail-section">
                  <h3>Warnings</h3>
                  {conditionalPreview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
                <div className="detail-section">
                  <h3>Samples</h3>
                  {conditionalPreview.samples.length === 0 ? <p>No matching sample rows.</p> : (
                    <DataTable headers={["Entry", "Item", "Description", "Document"]}>
                      {conditionalPreview.samples.map((sample, index) => (
                        <tr key={`${sample.entryNo ?? "entry"}:${sample.itemNo}:${index}`}>
                          <td>{sample.entryNo ?? "—"}</td>
                          <td>{sample.itemNo || "—"}</td>
                          <td>{sample.itemDescription ?? "—"}</td>
                          <td>{sample.documentNo ?? "—"}</td>
                        </tr>
                      ))}
                    </DataTable>
                  )}
                </div>
                {conditionalPreview.mode === "preview" ? (
                  <div className="detail-section">
                    <Field label="Confirmation" helper="Type COMMIT to enable conditional mapping commit.">
                      <input value={conditionalConfirmText} onChange={(event) => setConditionalConfirmText(event.target.value)} placeholder="COMMIT" />
                    </Field>
                    <div className="detail-actions">
                      <button
                        className="danger-button"
                        disabled={!canManage || busy || !conditionalPreview || conditionalPreview.mode !== "preview" || conditionalConfirmText !== "COMMIT"}
                        onClick={() => void commitConditionalMapping()}
                      >
                        Commit conditional rule
                      </button>
                    </div>
                    {!canManage ? <p className="permission-note">Conditional mapping commits require master data management permission.</p> : null}
                  </div>
                ) : null}
                {conditionalResult ? (
                  <div className="detail-section">
                    <h3>Commit result</h3>
                    <p>{formatNumber(conditionalResult.updatedRows ?? 0)} rows updated.</p>
                    {conditionalResult.rule ? <p><strong>{conditionalConditionLabel(conditionalResult.rule.conditionType)}</strong> · {conditionalResult.rule.conditionValue}<small>{conditionalResult.rule.sourceValue} → {conditionalResult.targetEntity.displayName}</small></p> : null}
                  </div>
                ) : null}
              </>
            ) : <EmptyState title="No conditional preview" description="Use source, condition, and target entity fields, then run Preview condition." />}
          </aside>
        </section>

        <section className="master-detail-layout">
          <div>
            <SectionHeader title="Entity Management" description="Canonical machines, lines, or reporting entities used by targets and dashboard achievement." />
            {entities && entities.rows.length > 0 ? (
              <>
                <DataTable headers={["Entity", "Area / line", "Aliases", "Targets", "Mapped rows", "Status"]}>
                  {entities.rows.map((entity) => (
                    <tr key={entity.id}>
                      <td><strong>{entity.entityCode}</strong><small>{entity.displayName}</small></td>
                      <td>{entity.area ?? "—"}<small>{entity.lineCode ?? "No line"}</small></td>
                      <td>{entity.aliasCount}</td>
                      <td>{entity.targetCount}</td>
                      <td>{formatNumber(entity.outputRowCount)}</td>
                      <td><StatusBadge status={entity.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    </tr>
                  ))}
                </DataTable>
                <Pagination page={entities.pagination.page} totalPages={entities.pagination.totalPages} onPrevious={() => setEntityPage((value) => value - 1)} onNext={() => setEntityPage((value) => value + 1)} />
              </>
            ) : <EmptyState title="No entities yet" description="Create canonical entities before mapping Business Central sources." />}
          </div>
          <aside className="detail-panel">
            <SectionHeader title="Create entity" description="Use real machine/line names only; aliases are added separately." />
            <Field label="Entity code"><input value={entityForm.entityCode} onChange={(event) => setEntityForm((value) => ({ ...value, entityCode: event.target.value }))} placeholder="ILLIG2" /></Field>
            <Field label="Display name"><input value={entityForm.displayName} onChange={(event) => setEntityForm((value) => ({ ...value, displayName: event.target.value }))} placeholder="Illig 2" /></Field>
            <Field label="Area"><input value={entityForm.area} onChange={(event) => setEntityForm((value) => ({ ...value, area: event.target.value }))} placeholder="Thermoforming" /></Field>
            <Field label="Line code"><input value={entityForm.lineCode} onChange={(event) => setEntityForm((value) => ({ ...value, lineCode: event.target.value }))} /></Field>
            <button disabled={!canManage || busy} onClick={() => void createEntity()}>{busy ? "Saving…" : "Create entity"}</button>
          </aside>
        </section>

        <section>
          <SectionHeader title="Target Coverage" description="Positive OK output grouped by month and reason. Mapping changes should move rows from UNMAPPED_ENTITY to target-specific reasons or COVERED." />
          {coverage && coverage.rows.length > 0 ? <DataTable headers={["Month", "Entity/source", "Reason", "Rows", "OK qty"]}>
            {coverage.rows.map((row, index) => <tr key={`${row.month}:${row.sourceGroup}:${row.reason}:${index}`}><td>{row.month}</td><td><strong>{row.entityName}</strong><small>{sourceFieldLabel(row.sourceField)} · {row.sourceGroup}</small></td><td><StatusBadge status={row.reason} /></td><td>{formatNumber(row.rows)}</td><td>{formatNumber(row.outputOkQty, 1)}</td></tr>)}
          </DataTable> : <EmptyState title="No coverage rows" description="No OK output exists for the selected coverage scope." />}
        </section>

        <section className="master-detail-layout">
          <div>
            <SectionHeader title="Conversion Gap View" description="Reject rows that need item/UOM gross weight mapping before reject PCS equivalent can be trusted." />
            {gaps && gaps.rows.length > 0 ? (
              <>
                <DataTable headers={["Item", "UOM", "Rows", "Reject KG", "Mapped weight", "Action"]}>
                  {gaps.rows.map((gap) => <tr key={`${gap.itemNo}:${gap.uom}`}><td><strong>{gap.itemNo}</strong></td><td>{gap.uom || "—"}</td><td>{formatNumber(gap.rowCount)}</td><td>{formatNumber(gap.rejectKg, 2)}</td><td>{gap.mappedGrossWeightPerPcs ?? "—"}</td><td><button className="secondary-button" onClick={() => setConversionForm({ itemNo: gap.itemNo, uom: gap.uom, grossWeightPerPcs: String(gap.mappedGrossWeightPerPcs ?? "") })}>Select</button></td></tr>)}
                </DataTable>
                <Pagination page={gaps.pagination.page} totalPages={gaps.pagination.totalPages} onPrevious={() => setGapPage((value) => value - 1)} onNext={() => setGapPage((value) => value + 1)} />
              </>
            ) : <EmptyState title="No conversion gaps" description="Reject PCS equivalent has the gross-weight data it needs." />}
          </div>
          <aside className="detail-panel">
            <SectionHeader title="Add conversion" description="Commit updates only reject rows for this item/UOM where conversion is currently missing." />
            <Field label="Item no"><input value={conversionForm.itemNo} onChange={(event) => setConversionForm((value) => ({ ...value, itemNo: event.target.value }))} /></Field>
            <Field label="UOM"><input value={conversionForm.uom} onChange={(event) => setConversionForm((value) => ({ ...value, uom: event.target.value }))} /></Field>
            <Field label="Gross weight per PCS"><input type="number" step="0.000001" value={conversionForm.grossWeightPerPcs} onChange={(event) => setConversionForm((value) => ({ ...value, grossWeightPerPcs: event.target.value }))} /></Field>
            <button disabled={!canManage || busy} onClick={() => void createConversion()}>{busy ? "Applying…" : "Save and apply conversion"}</button>
          </aside>
        </section>

        <ConfirmDialog
          open={confirmMapping}
          title="Commit this source mapping?"
          description={`This will map current unmapped Business Central rows where ${selectedGroup?.sourceField ?? "source"} equals ${selectedGroup?.sourceValue ?? "the selected value"} to the selected entity. Existing mapped rows are not overwritten.`}
          confirmLabel="Commit mapping"
          busy={busy}
          onCancel={() => setConfirmMapping(false)}
          onConfirm={() => void commitMapping()}
        />
      </div>
    </PermissionGate>
  );
}
