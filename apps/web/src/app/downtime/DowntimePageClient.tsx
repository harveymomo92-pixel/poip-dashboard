"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, Field, FilterBar, FormPanel, LoadingSkeleton, PageHeader, Pagination, SectionHeader, SourceBadge, StatusBadge } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

interface DowntimeEntity {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
}

interface DowntimeEvent {
  readonly id: string;
  readonly eventDate: string;
  readonly shiftCode: string | null;
  readonly area: string | null;
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly entityName: string | null;
  readonly machineCode: string | null;
  readonly category: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly durationMinutes: number;
  readonly status: string;
  readonly severity: string;
  readonly rootCause: string | null;
  readonly actionTaken: string | null;
}

interface DowntimeList {
  readonly rows: readonly DowntimeEvent[];
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
  readonly machine: string;
  readonly category: string;
  readonly shiftCode: string;
  readonly status: string;
}

interface DowntimeForm {
  readonly id: string | null;
  readonly eventDate: string;
  readonly shiftCode: string;
  readonly area: string;
  readonly entityId: string;
  readonly machineCode: string;
  readonly category: string;
  readonly startTime: string;
  readonly severity: string;
  readonly rootCause: string;
  readonly actionTaken: string;
}

interface CloseForm {
  readonly id: string;
  readonly endTime: string;
  readonly rootCause: string;
  readonly actionTaken: string;
}

const emptyForm: DowntimeForm = {
  id: null,
  eventDate: "",
  shiftCode: "",
  area: "",
  entityId: "",
  machineCode: "",
  category: "",
  startTime: "",
  severity: "MEDIUM",
  rootCause: "",
  actionTaken: ""
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

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowLocal(): string {
  return toDatetimeLocal(new Date().toISOString());
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.machine.trim()) params.set("machine", filters.machine.trim());
  if (filters.category.trim()) params.set("category", filters.category.trim());
  if (filters.shiftCode.trim()) params.set("shiftCode", filters.shiftCode.trim());
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

export function DowntimePageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [entities, setEntities] = useState<readonly DowntimeEntity[]>([]);
  const [events, setEvents] = useState<DowntimeList | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: businessDate(-7),
    to: businessDate(0),
    machine: "",
    category: "",
    shiftCode: "",
    status: ""
  });
  const [form, setForm] = useState<DowntimeForm>(emptyForm);
  const [closeForm, setCloseForm] = useState<CloseForm | null>(null);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);
  const canCreate = currentUser?.permissions.includes("downtime.create") ?? false;
  const canUpdate = currentUser?.permissions.includes("downtime.update") ?? false;
  const canClose = currentUser?.permissions.includes("downtime.close") ?? false;

  const load = useCallback(async () => {
    setError(null);
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
    const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
    if (!me.ok) {
      setLoaded(true);
      return;
    }
    setCurrentUser(me.data.user);
    if (!me.data.user.permissions.includes("downtime.view")) {
      setLoaded(true);
      return;
    }
    const [entitiesResponse, eventsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/downtime/entities`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/downtime?${query}`, { credentials: "include" })
    ]);
    const entitiesPayload = (await entitiesResponse.json()) as ApiResult<readonly DowntimeEntity[]>;
    const eventsPayload = (await eventsResponse.json()) as ApiResult<DowntimeList>;
    if (entitiesPayload.ok) setEntities(entitiesPayload.data);
    if (eventsPayload.ok) setEvents(eventsPayload.data);
    else setError(eventsPayload.error.message);
    setLoaded(true);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function updateForm(name: keyof DowntimeForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function editEvent(event: DowntimeEvent) {
    setForm({
      id: event.id,
      eventDate: event.eventDate,
      shiftCode: event.shiftCode ?? "",
      area: event.area ?? "",
      entityId: event.entityId ?? "",
      machineCode: event.machineCode ?? "",
      category: event.category,
      startTime: toDatetimeLocal(event.startTime),
      severity: event.severity,
      rootCause: event.rootCause ?? "",
      actionTaken: event.actionTaken ?? ""
    });
  }

  async function saveEvent() {
    if (!form.eventDate || !form.category || !form.startTime) {
      setError("Event date, category, and start time are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        eventDate: form.eventDate,
        shiftCode: form.shiftCode || null,
        area: form.area || null,
        entityId: form.entityId || null,
        machineCode: form.machineCode || null,
        category: form.category,
        startTime: form.startTime,
        severity: form.severity,
        rootCause: form.rootCause || null,
        actionTaken: form.actionTaken || null
      };
      const response = await fetch(
        form.id ? `${API_BASE_URL}/downtime/${form.id}` : `${API_BASE_URL}/downtime`,
        {
          method: form.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const payload = (await response.json()) as ApiResult<DowntimeEvent>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setForm(emptyForm);
      await load();
      toast(form.id ? "Detail downtime berhasil diperbarui." : "Downtime terbuka berhasil dibuat.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function closeEvent() {
    if (!closeForm?.rootCause.trim() || !closeForm.actionTaken.trim()) {
      setError("Root cause and action taken are required to close downtime.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/downtime/${closeForm.id}/close`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endTime: closeForm.endTime || undefined,
          rootCause: closeForm.rootCause,
          actionTaken: closeForm.actionTaken
        })
      });
      const payload = (await response.json()) as ApiResult<DowntimeEvent>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setCloseForm(null);
      setConfirmClose(false);
      await load();
      toast(`Downtime berhasil ditutup dengan durasi ${formatMinutes(payload.data.durationMinutes)}.`, "success");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  return (
    <PermissionGate user={currentUser} permission="downtime.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Operations" title="Downtime Command Center" description="Catat gangguan, lengkapi penyebab dan tindakan, lalu tutup event dengan durasi yang dapat dipercaya." meta={<><SourceBadge>Manual / Import / WA Parser</SourceBadge><span className="page-description">{events?.pagination.totalRows ?? 0} event pada filter ini</span></>} />
        <FilterBar actions={<button className="secondary-button" onClick={() => { setFilters({ from: businessDate(-7), to: businessDate(0), machine: "", category: "", shiftCode: "", status: "" }); setPage(1); }}>Reset</button>}>
          <Field label="Dari tanggal" helper="Tanggal event downtime."><input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></Field>
          <Field label="Sampai tanggal" helper="Termasuk tanggal ini."><input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></Field>
          <Field label="Mesin" helper="Kode mesin atau entity."><input placeholder="Semua mesin" value={filters.machine} onChange={(event) => updateFilter("machine", event.target.value)} /></Field>
          <Field label="Kategori"><input placeholder="Contoh: breakdown" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} /></Field>
          <Field label="Shift" helper="Kode shift operasional."><input placeholder="A / B / N" value={filters.shiftCode} onChange={(event) => updateFilter("shiftCode", event.target.value)} /></Field>
          <Field label="Status">
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">Semua status</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option>
            </select>
          </Field>
        </FilterBar>
        {error ? <ErrorState message={`${error} Periksa isian atau coba lagi.`} onRetry={() => void load()} /> : null}

        <PermissionGate user={currentUser} permission="downtime.create" fallback={null}>
          <FormPanel title={form.id ? "Perbarui detail downtime" : "Buat downtime terbuka"} description="Alur: buat event terbuka → lengkapi detail → tutup event untuk menghitung durasi." actions={<><button type="button" onClick={saveEvent} disabled={saving || (!canCreate && !canUpdate)}>{saving ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Buat event terbuka"}</button>{form.id ? <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>Batal edit</button> : null}</>}>
              <Field label="Tanggal event" required><input type="date" value={form.eventDate} onChange={(event) => updateForm("eventDate", event.target.value)} /></Field>
              <Field label="Waktu mulai" helper="Gunakan waktu lokal pabrik (Asia/Jakarta)." required><input type="datetime-local" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} /></Field>
              <Field label="Entity" helper="Pilih entity terdaftar bila tersedia.">
                <select value={form.entityId} onChange={(event) => updateForm("entityId", event.target.value)}>
                  <option value="">Tidak dipetakan ke entity</option>
                  {entities.map((entity) => (
                    <option value={entity.id} key={entity.id}>{entity.entityCode} - {entity.displayName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Mesin" helper="Kode mesin bila berbeda dari entity."><input value={form.machineCode} onChange={(event) => updateForm("machineCode", event.target.value)} /></Field>
              <Field label="Area"><input value={form.area} onChange={(event) => updateForm("area", event.target.value)} /></Field>
              <Field label="Shift" helper="Shift saat gangguan dimulai."><input value={form.shiftCode} onChange={(event) => updateForm("shiftCode", event.target.value)} /></Field>
              <Field label="Kategori" required><input placeholder="Breakdown, setup, material…" value={form.category} onChange={(event) => updateForm("category", event.target.value)} /></Field>
              <Field label="Severity">
                <select value={form.severity} onChange={(event) => updateForm("severity", event.target.value)}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                </select>
              </Field>
              <Field label="Root cause" helper="Boleh dilengkapi saat event ditutup."><input value={form.rootCause} onChange={(event) => updateForm("rootCause", event.target.value)} /></Field>
              <Field label="Tindakan" helper="Boleh dilengkapi saat event ditutup."><input value={form.actionTaken} onChange={(event) => updateForm("actionTaken", event.target.value)} /></Field>
          </FormPanel>
        </PermissionGate>

        {closeForm ? (
          <FormPanel title="Lengkapi dan tutup downtime" description="Waktu selesai menentukan durasi final. Root cause dan tindakan wajib diisi agar event dapat ditutup." actions={<><button type="button" onClick={() => setConfirmClose(true)} disabled={saving}>Tinjau & tutup event</button><button type="button" className="secondary-button" onClick={() => setCloseForm(null)}>Batal</button></>}>
            <Field label="Waktu selesai" helper="Pastikan tidak lebih awal dari waktu mulai." required><input type="datetime-local" value={closeForm.endTime} onChange={(event) => setCloseForm((current) => current && { ...current, endTime: event.target.value })} /></Field>
            <Field label="Root cause" required><input value={closeForm.rootCause} onChange={(event) => setCloseForm((current) => current && { ...current, rootCause: event.target.value })} /></Field>
            <Field label="Tindakan yang dilakukan" required><input value={closeForm.actionTaken} onChange={(event) => setCloseForm((current) => current && { ...current, actionTaken: event.target.value })} /></Field>
          </FormPanel>
        ) : null}

        <section><SectionHeader title="Downtime events" description="Event terbuka membutuhkan penyelesaian; event tertutup menampilkan durasi final." />
        {!events || events.rows.length === 0 ? (
          <EmptyState title="Tidak ada downtime" description="Tidak ada event pada rentang dan filter ini. Buat event baru bila gangguan belum tercatat." />
        ) : (
          <>
            <DataTable headers={["Status", "Mesin / entity", "Kategori", "Shift", "Durasi", "Severity", "Aksi"]}>
              {events.rows.map((event) => (
                <tr key={event.id}>
                  <td><StatusBadge status={event.status} /><small>{event.eventDate}</small></td>
                  <td><strong>{event.machineCode ?? event.entityCode ?? "—"}</strong><small>{event.entityName ?? event.area ?? "Manual record"}</small></td>
                  <td>{event.category}</td><td>{event.shiftCode ?? "—"}</td><td>{formatMinutes(event.durationMinutes)}</td><td><StatusBadge status={event.severity} /></td>
                  <td><div className="table-actions">
                    {canUpdate && event.status === "OPEN" ? (
                      <button type="button" className="secondary-button" onClick={() => editEvent(event)}>Edit</button>
                    ) : null}
                    {canClose && event.status === "OPEN" ? (
                      <button type="button" onClick={() => setCloseForm({ id: event.id, endTime: nowLocal(), rootCause: event.rootCause ?? "", actionTaken: event.actionTaken ?? "" })}>Tutup</button>
                    ) : null}
                  </div></td>
                </tr>
              ))}
            </DataTable>
            <Pagination page={events.pagination.page} totalPages={events.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </>
        )}</section>
        <ConfirmDialog open={confirmClose} title="Tutup downtime ini?" description="Event akan berstatus CLOSED dan durasi dihitung dari waktu mulai hingga waktu selesai. Data tetap dapat ditelusuri melalui audit trail." confirmLabel="Ya, tutup downtime" busy={saving} onCancel={() => setConfirmClose(false)} onConfirm={() => void closeEvent()} />
      </div>
    </PermissionGate>
  );
}
