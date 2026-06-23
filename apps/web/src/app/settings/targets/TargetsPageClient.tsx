"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
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
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <section className="panel">Loading targets...</section>;

  return (
    <PermissionGate user={currentUser} permission="target.view" fallback={<ForbiddenState />}>
      <section className="panel target-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Targets</h1>
          </div>
        </div>

        <div className="filters">
          <label>
            From
            <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label>
            Entity
            <input value={filters.entity} onChange={(event) => updateFilter("entity", event.target.value)} />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUPERSEDED">Superseded</option>
            </select>
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <PermissionGate user={currentUser} permission="target.create" fallback={null}>
          <section className="target-form">
            <h2>{form.id ? "Edit Target" : "Create Target"}</h2>
            <div className="filters">
              <label>
                Entity
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
              </label>
              <label>
                Effective From
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) => updateForm("effectiveFrom", event.target.value)}
                />
              </label>
              <label>
                Effective To
                <input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) => updateForm("effectiveTo", event.target.value)}
                />
              </label>
              <label>
                Daily Target
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dailyTargetQty}
                  onChange={(event) => updateForm("dailyTargetQty", event.target.value)}
                />
              </label>
              <label>
                Reject Target %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.rejectTargetPct}
                  onChange={(event) => updateForm("rejectTargetPct", event.target.value)}
                />
              </label>
              <label>
                Min %
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minAchievementPct}
                  onChange={(event) => updateForm("minAchievementPct", event.target.value)}
                />
              </label>
              <label>
                Max %
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxAchievementPct}
                  onChange={(event) => updateForm("maxAchievementPct", event.target.value)}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" onClick={saveTarget} disabled={saving}>
                {saving ? "Saving..." : form.id ? "Save revision" : "Create draft"}
              </button>
              {form.id ? (
                <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>
                  Cancel
                </button>
              ) : null}
            </div>
          </section>
        </PermissionGate>

        <h2>Target Table</h2>
        {!targets || targets.rows.length === 0 ? (
          <p>Belum ada target untuk filter ini.</p>
        ) : (
          <>
            <div className="table">
              {targets.rows.map((target) => (
                <div className="table-row target-row" key={target.id}>
                  <span>
                    <strong>{target.entityCode}</strong>
                    <small>{target.entityName}</small>
                  </span>
                  <span>v{target.targetVersion}</span>
                  <span>
                    {target.effectiveFrom} - {target.effectiveTo ?? "open"}
                  </span>
                  <span>{formatNumber(target.dailyTargetQty)}</span>
                  <span>{target.status}</span>
                  <span className="target-actions">
                    {canCreate ? (
                      <>
                        <button type="button" className="secondary-button" onClick={() => editTarget(target)}>
                          Edit
                        </button>
                        {target.status === "DRAFT" || target.status === "REJECTED" ? (
                          <button type="button" onClick={() => void targetAction(target.id, "submit")}>
                            Submit
                          </button>
                        ) : null}
                        {target.status === "APPROVED" || target.status === "ACTIVE" ? (
                          <button type="button" onClick={() => void targetAction(target.id, "deactivate")}>
                            Deactivate
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {canApprove && (target.status === "DRAFT" || target.status === "SUBMITTED") ? (
                      <>
                        <button type="button" onClick={() => void targetAction(target.id, "approve")}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void targetAction(target.id, "reject")}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </button>
              <span>
                Page {targets.pagination.page} / {Math.max(targets.pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= targets.pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </PermissionGate>
  );
}
