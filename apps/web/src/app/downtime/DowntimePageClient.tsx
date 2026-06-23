"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
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
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <section className="panel">Loading downtime...</section>;

  return (
    <PermissionGate user={currentUser} permission="downtime.view" fallback={<ForbiddenState />}>
      <section className="panel downtime-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Downtime</h1>
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
            Machine
            <input value={filters.machine} onChange={(event) => updateFilter("machine", event.target.value)} />
          </label>
          <label>
            Category
            <input value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} />
          </label>
          <label>
            Shift
            <input value={filters.shiftCode} onChange={(event) => updateFilter("shiftCode", event.target.value)} />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <PermissionGate user={currentUser} permission="downtime.create" fallback={null}>
          <section className="target-form">
            <h2>{form.id ? "Edit Downtime" : "Create Downtime"}</h2>
            <div className="filters">
              <label>
                Event Date
                <input type="date" value={form.eventDate} onChange={(event) => updateForm("eventDate", event.target.value)} />
              </label>
              <label>
                Start Time
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(event) => updateForm("startTime", event.target.value)}
                />
              </label>
              <label>
                Entity
                <select value={form.entityId} onChange={(event) => updateForm("entityId", event.target.value)}>
                  <option value="">No mapped entity</option>
                  {entities.map((entity) => (
                    <option value={entity.id} key={entity.id}>
                      {entity.entityCode} - {entity.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Machine
                <input value={form.machineCode} onChange={(event) => updateForm("machineCode", event.target.value)} />
              </label>
              <label>
                Area
                <input value={form.area} onChange={(event) => updateForm("area", event.target.value)} />
              </label>
              <label>
                Shift
                <input value={form.shiftCode} onChange={(event) => updateForm("shiftCode", event.target.value)} />
              </label>
              <label>
                Category
                <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
              </label>
              <label>
                Severity
                <select value={form.severity} onChange={(event) => updateForm("severity", event.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </label>
              <label>
                Root Cause
                <input value={form.rootCause} onChange={(event) => updateForm("rootCause", event.target.value)} />
              </label>
              <label>
                Action Taken
                <input value={form.actionTaken} onChange={(event) => updateForm("actionTaken", event.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button type="button" onClick={saveEvent} disabled={saving || (!canCreate && !canUpdate)}>
                {saving ? "Saving..." : form.id ? "Save event" : "Create open event"}
              </button>
              {form.id ? (
                <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>
                  Cancel
                </button>
              ) : null}
            </div>
          </section>
        </PermissionGate>

        {closeForm ? (
          <section className="target-form">
            <h2>Close Downtime</h2>
            <div className="filters">
              <label>
                End Time
                <input
                  type="datetime-local"
                  value={closeForm.endTime}
                  onChange={(event) => setCloseForm((current) => current && { ...current, endTime: event.target.value })}
                />
              </label>
              <label>
                Root Cause
                <input
                  value={closeForm.rootCause}
                  onChange={(event) => setCloseForm((current) => current && { ...current, rootCause: event.target.value })}
                />
              </label>
              <label>
                Action Taken
                <input
                  value={closeForm.actionTaken}
                  onChange={(event) => setCloseForm((current) => current && { ...current, actionTaken: event.target.value })}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" onClick={closeEvent} disabled={saving}>
                Close event
              </button>
              <button type="button" className="secondary-button" onClick={() => setCloseForm(null)}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <h2>Downtime Events</h2>
        {!events || events.rows.length === 0 ? (
          <p>Belum ada downtime untuk filter ini.</p>
        ) : (
          <>
            <div className="table">
              {events.rows.map((event) => (
                <div className="table-row downtime-row" key={event.id}>
                  <span>
                    <strong>{event.status}</strong>
                    <small>{event.eventDate}</small>
                  </span>
                  <span>{event.machineCode ?? event.entityCode ?? "-"}</span>
                  <span>{event.category}</span>
                  <span>{event.shiftCode ?? "-"}</span>
                  <span>{formatMinutes(event.durationMinutes)}</span>
                  <span>{event.severity}</span>
                  <span className="target-actions">
                    {canUpdate && event.status === "OPEN" ? (
                      <button type="button" className="secondary-button" onClick={() => editEvent(event)}>
                        Edit
                      </button>
                    ) : null}
                    {canClose && event.status === "OPEN" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCloseForm({
                            id: event.id,
                            endTime: nowLocal(),
                            rootCause: event.rootCause ?? "",
                            actionTaken: event.actionTaken ?? ""
                          })
                        }
                      >
                        Close
                      </button>
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
                Page {events.pagination.page} / {Math.max(events.pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= events.pagination.totalPages}
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
