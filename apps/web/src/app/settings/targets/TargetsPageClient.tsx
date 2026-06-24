"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, Field, FilterBar, FormPanel, LoadingSkeleton, PageHeader, Pagination, SectionHeader, StatusBadge, WorkflowSteps } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface TargetEntity {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
}

interface TargetRow {
  readonly id: string;
  readonly entityId: string;
  readonly entityCode: string;
  readonly entityName: string;
  readonly targetVersion: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly dailyTargetQty: number;
  readonly rejectTargetPct: number | null;
  readonly minAchievementPct: number;
  readonly maxAchievementPct: number;
  readonly status: string;
}

interface TargetList {
  readonly rows: readonly TargetRow[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

interface Filters {
  readonly from: string;
  readonly to: string;
  readonly entity: string;
  readonly status: string;
}

interface TargetForm {
  readonly id: string | null;
  readonly entityId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly dailyTargetQty: string;
  readonly rejectTargetPct: string;
  readonly minAchievementPct: string;
  readonly maxAchievementPct: string;
}

const emptyForm: TargetForm = {
  id: null,
  entityId: "",
  effectiveFrom: "",
  effectiveTo: "",
  dailyTargetQty: "",
  rejectTargetPct: "",
  minAchievementPct: "95",
  maxAchievementPct: "110"
};

function businessDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20"
  });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.entity.trim()) params.set("entity", filters.entity.trim());
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

export function TargetsPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [entities, setEntities] = useState<readonly TargetEntity[]>([]);
  const [targets, setTargets] = useState<TargetList | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: businessDate(-30),
    to: businessDate(30),
    entity: "",
    status: ""
  });
  const [form, setForm] = useState<TargetForm>(emptyForm);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: "approve" | "reject" | "deactivate"; entity: string } | null>(null);
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);

  const canCreate = currentUser?.permissions.includes("target.create") ?? false;
  const canApprove = currentUser?.permissions.includes("target.approve") ?? false;

  const load = useCallback(async () => {
    setError(null);
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
    const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
    if (!me.ok) {
      setLoaded(true);
      return;
    }
    setCurrentUser(me.data.user);
    if (!me.data.user.permissions.includes("target.view")) {
      setLoaded(true);
      return;
    }
    const [entitiesResponse, targetsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/targets/entities`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/targets?${query}`, { credentials: "include" })
    ]);
    const entityPayload = (await entitiesResponse.json()) as ApiResult<readonly TargetEntity[]>;
    const targetPayload = (await targetsResponse.json()) as ApiResult<TargetList>;
    if (entityPayload.ok) setEntities(entityPayload.data);
    if (targetPayload.ok) setTargets(targetPayload.data);
    else setError(targetPayload.error.message);
    setLoaded(true);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function updateForm(name: keyof TargetForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function editTarget(target: TargetRow) {
    setForm({
      id: target.id,
      entityId: target.entityId,
      effectiveFrom: target.effectiveFrom,
      effectiveTo: target.effectiveTo ?? "",
      dailyTargetQty: String(target.dailyTargetQty),
      rejectTargetPct: target.rejectTargetPct === null ? "" : String(target.rejectTargetPct),
      minAchievementPct: String(target.minAchievementPct),
      maxAchievementPct: String(target.maxAchievementPct)
    });
  }

  async function saveTarget() {
    if (!form.entityId || !form.effectiveFrom || !form.dailyTargetQty) {
      setError("Entity, effective from, and daily target are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        dailyTargetQty: Number(form.dailyTargetQty),
        rejectTargetPct: form.rejectTargetPct ? Number(form.rejectTargetPct) : null,
        minAchievementPct: Number(form.minAchievementPct || 95),
        maxAchievementPct: Number(form.maxAchievementPct || 110)
      };
      const response = await fetch(
        form.id ? `${API_BASE_URL}/targets/${form.id}` : `${API_BASE_URL}/targets`,
        {
          method: form.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form.id ? body : { ...body, entityId: form.entityId })
        }
      );
      const payload = (await response.json()) as ApiResult<TargetRow>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setForm(emptyForm);
      await load();
      toast(form.id ? "Revisi target berhasil disimpan sebagai draft." : "Draft target berhasil dibuat.");
    } finally {
      setSaving(false);
    }
  }

  async function targetAction(id: string, action: "submit" | "approve" | "reject" | "deactivate") {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/targets/${id}/${action}`, {
        method: "POST",
        credentials: "include"
      });
      const payload = (await response.json()) as ApiResult<TargetRow>;
      if (!payload.ok) setError(payload.error.message);
      else toast(`Status target ${payload.data.entityCode} diperbarui menjadi ${payload.data.status}.`);
      setPendingAction(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  return (
    <PermissionGate user={currentUser} permission="target.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Settings" title="Target Management" description="Kelola target berversi melalui alur draft, review, approval, dan status aktif yang dapat diaudit." meta={targets ? <StatusBadge status="ACTIVE" label={`${targets.pagination.totalRows} target ditemukan`} /> : null} />
        <WorkflowSteps steps={["Create draft", "Review", "Submit", "Approve / reject", "Active"]} current={form.id ? 1 : 0} />
        <FilterBar actions={<button className="secondary-button" onClick={() => { setFilters({ from: businessDate(-30), to: businessDate(30), entity: "", status: "" }); setPage(1); }}>Reset</button>}>
          <Field label="Berlaku dari"><input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></Field>
          <Field label="Berlaku sampai"><input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></Field>
          <Field label="Entity" helper="Kode atau nama mesin/entity."><input placeholder="Semua entity" value={filters.entity} onChange={(event) => updateFilter("entity", event.target.value)} /></Field>
          <Field label="Status">
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">Semua status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUPERSEDED">Superseded</option>
            </select>
          </Field>
        </FilterBar>

        {error ? <ErrorState message={`${error} Tinjau field dan status target lalu coba lagi.`} onRetry={() => void load()} /> : null}

        <PermissionGate user={currentUser} permission="target.create" fallback={null}>
          <FormPanel title={form.id ? "Buat revisi target" : "Buat draft target"} description="Target baru selalu dimulai sebagai draft dan belum memengaruhi KPI sampai melalui approval." actions={<><button type="button" onClick={saveTarget} disabled={saving}>{saving ? "Menyimpan…" : form.id ? "Simpan revisi" : "Buat draft"}</button>{form.id ? <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>Batal</button> : null}</>}>
              <Field label="Entity" helper="Entity tidak dapat diganti saat membuat revisi." required>
                <select
                  value={form.entityId}
                  onChange={(event) => updateForm("entityId", event.target.value)}
                  disabled={Boolean(form.id)}
                >
                  <option value="">Select entity</option>
                  {entities.map((entity) => (
                    <option value={entity.id} key={entity.id}>
                      {entity.entityCode} - {entity.displayName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Efektif dari" helper="Tanggal pertama target digunakan setelah approval." required><input type="date" value={form.effectiveFrom} onChange={(event) => updateForm("effectiveFrom", event.target.value)} /></Field>
              <Field label="Efektif sampai" helper="Kosongkan bila belum ada akhir periode."><input type="date" value={form.effectiveTo} onChange={(event) => updateForm("effectiveTo", event.target.value)} /></Field>
              <Field label="Target harian" helper="Kuantitas target per hari produksi." required><input type="number" min="0" step="0.01" value={form.dailyTargetQty} onChange={(event) => updateForm("dailyTargetQty", event.target.value)} /></Field>
              <Field label="Target reject %" helper="Batas reject yang diharapkan."><input type="number" min="0" max="100" step="0.01" value={form.rejectTargetPct} onChange={(event) => updateForm("rejectTargetPct", event.target.value)} /></Field>
              <Field label="Minimum achievement %" helper="Ambang peringatan performa."><input type="number" min="0" step="0.01" value={form.minAchievementPct} onChange={(event) => updateForm("minAchievementPct", event.target.value)} /></Field>
              <Field label="Maximum achievement %" helper="Ambang atas untuk peninjauan."><input type="number" min="0" step="0.01" value={form.maxAchievementPct} onChange={(event) => updateForm("maxAchievementPct", event.target.value)} /></Field>
          </FormPanel>
        </PermissionGate>

        <section><SectionHeader title="Daftar target" description="Status menunjukkan apakah target masih draft, menunggu approval, aktif, ditolak, atau tidak aktif." />
        {!targets || targets.rows.length === 0 ? (
          <EmptyState title="Tidak ada target" description="Tidak ada target yang cocok dengan filter. Buat draft baru atau ubah rentang pencarian." />
        ) : (
          <>
            <DataTable headers={["Entity", "Versi", "Periode", "Target harian", "Status", "Aksi"]}>
              {targets.rows.map((target) => (
                <tr key={target.id}>
                  <td><strong>{target.entityCode}</strong><small>{target.entityName}</small></td><td>v{target.targetVersion}</td><td>{target.effectiveFrom} — {target.effectiveTo ?? "terbuka"}</td><td>{formatNumber(target.dailyTargetQty)}</td><td><StatusBadge status={target.status} /></td>
                  <td><div className="table-actions">
                    {canCreate ? (
                      <>
                        <button type="button" className="secondary-button" onClick={() => editTarget(target)}>Edit</button>
                        {target.status === "DRAFT" || target.status === "REJECTED" ? (
                          <button type="button" onClick={() => void targetAction(target.id, "submit")}>Submit</button>
                        ) : null}
                        {target.status === "APPROVED" || target.status === "ACTIVE" ? (
                          <button type="button" className="secondary-button" onClick={() => setPendingAction({ id: target.id, action: "deactivate", entity: target.entityCode })}>Deactivate</button>
                        ) : null}
                      </>
                    ) : null}
                    {canApprove && (target.status === "DRAFT" || target.status === "SUBMITTED") ? (
                      <>
                        <button type="button" onClick={() => setPendingAction({ id: target.id, action: "approve", entity: target.entityCode })}>Approve</button>
                        <button type="button" className="secondary-button" onClick={() => setPendingAction({ id: target.id, action: "reject", entity: target.entityCode })}>Reject</button>
                      </>
                    ) : null}
                  </div></td>
                </tr>
              ))}
            </DataTable>
            <Pagination page={targets.pagination.page} totalPages={targets.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </>
        )}</section>
        <ConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.action === "approve" ? "Approve" : pendingAction?.action === "reject" ? "Reject" : "Deactivate"} target ${pendingAction?.entity ?? ""}?`} description={pendingAction?.action === "approve" ? "Target yang disetujui dapat digunakan dalam perhitungan achievement sesuai periode efektifnya." : pendingAction?.action === "reject" ? "Target akan dikembalikan dengan status REJECTED dan tidak digunakan untuk KPI." : "Target tidak lagi aktif untuk periode berjalan. Pastikan penggantinya sudah disiapkan agar dashboard tidak kehilangan target."} confirmLabel={pendingAction?.action === "approve" ? "Ya, approve target" : pendingAction?.action === "reject" ? "Ya, reject target" : "Ya, deactivate"} tone={pendingAction?.action === "approve" ? "primary" : "danger"} busy={saving} onCancel={() => setPendingAction(null)} onConfirm={() => { if (pendingAction) void targetAction(pendingAction.id, pendingAction.action); }} />
      </div>
    </PermissionGate>
  );
}
