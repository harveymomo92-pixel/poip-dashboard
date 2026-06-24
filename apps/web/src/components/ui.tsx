"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icons } from "./Icons";

export function PageHeader({ eyebrow, title, description, meta, actions }: Readonly<{ eyebrow: string; title: string; description: string; meta?: ReactNode; actions?: ReactNode }>) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p>{meta ? <div className="page-meta">{meta}</div> : null}</div>{actions ? <div className="page-actions">{actions}</div> : null}</header>;
}

export function PageToolbar({ children, actions }: Readonly<{ children: ReactNode; actions?: ReactNode }>) {
  return <section className="page-toolbar"><div className="toolbar-fields">{children}</div>{actions ? <div className="toolbar-actions">{actions}</div> : null}</section>;
}

export function FilterBar({ children, actions }: Readonly<{ children: ReactNode; actions?: ReactNode }>) {
  return <PageToolbar actions={actions}>{children}</PageToolbar>;
}

export function Field({ label, helper, required, error, children }: Readonly<{ label: string; helper?: string; required?: boolean; error?: string; children: ReactNode }>) {
  return <label className={`field${error ? " field-invalid" : ""}`}><span className="field-label">{label}{required ? <span aria-hidden="true"> *</span> : null}</span>{children}{error ? <span className="field-error">{error}</span> : helper ? <span className="field-helper">{helper}</span> : null}</label>;
}

export function MetricCard({ label, value, detail, tone = "neutral", icon }: Readonly<{ label: string; value: string; detail?: ReactNode; tone?: string; icon?: ReactNode }>) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-label"><span>{label}</span>{icon}</div><strong>{value}</strong>{detail ? <div className="metric-detail">{detail}</div> : null}</article>;
}

export function InsightCard({ title, value, description, tone = "neutral", children }: Readonly<{ title: string; value?: string; description: string; tone?: string; children?: ReactNode }>) {
  return <article className={`insight-card insight-${tone}`}><div><p className="eyebrow">{title}</p>{value ? <strong className="insight-value">{value}</strong> : null}<p>{description}</p></div>{children}</article>;
}

const statusTone: Record<string, string> = {
  HEALTHY: "success", FRESH: "success", SUCCESS: "success", VALID: "success", ACTIVE: "success", APPROVED: "success", CLOSED: "neutral", COMMITTED: "success",
  WARNING: "warning", STALE: "warning", MEDIUM: "warning", SUBMITTED: "warning", DRAFT: "neutral", OPEN: "warning", PARTIAL: "warning",
  CRITICAL: "danger", FAILED: "danger", INVALID: "danger", REJECTED: "danger", HIGH: "danger", NO_TARGET: "danger", INACTIVE: "neutral", SUPERSEDED: "neutral", LOW: "info"
};

export function StatusBadge({ status, label }: Readonly<{ status: string; label?: string }>) {
  const normalized = status.toUpperCase();
  return <span className={`status-badge status-${statusTone[normalized] ?? "neutral"}`}><span className="status-dot" />{label ?? normalized.replaceAll("_", " ")}</span>;
}

export function SectionHeader({ title, description, actions }: Readonly<{ title: string; description?: string; actions?: ReactNode }>) {
  return <div className="section-header"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{actions ? <div className="section-actions">{actions}</div> : null}</div>;
}

export function FormPanel({ title, description, children, actions }: Readonly<{ title: string; description?: string; children: ReactNode; actions?: ReactNode }>) {
  return <section className="form-panel"><SectionHeader title={title} {...(description ? { description } : {})} /><div className="form-grid">{children}</div>{actions ? <div className="form-actions">{actions}</div> : null}</section>;
}

export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return <div className="empty-state"><span className="empty-icon"><Icons.inbox /></span><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry?: () => void }>) {
  return <div className="error-state" role="alert"><Icons.alert /><div><strong>Terjadi kendala</strong><p>{message}</p></div>{onRetry ? <button className="secondary-button" onClick={onRetry}>Coba lagi</button> : null}</div>;
}

export function LoadingSkeleton({ rows = 4 }: Readonly<{ rows?: number }>) {
  return <div className="skeleton-stack" aria-label="Memuat data">{Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index}><i /><i /><i /></div>)}</div>;
}

export function DataTable({ headers, children, empty, loading = false, className = "" }: Readonly<{ headers: readonly ReactNode[]; children: ReactNode; empty?: ReactNode; loading?: boolean; className?: string }>) {
  if (loading) return <LoadingSkeleton />;
  if (!children) return <>{empty}</>;
  return <div className="data-table-wrap"><table className={`data-table ${className}`}><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function Pagination({ page, totalPages, onPrevious, onNext }: Readonly<{ page: number; totalPages: number; onPrevious: () => void; onNext: () => void }>) {
  return <nav className="pagination" aria-label="Pagination"><button className="secondary-button" disabled={page <= 1} onClick={onPrevious}>Sebelumnya</button><span>Halaman <strong>{page}</strong> dari {Math.max(totalPages, 1)}</span><button className="secondary-button" disabled={page >= totalPages} onClick={onNext}>Berikutnya</button></nav>;
}

export function WorkflowSteps({ steps, current }: Readonly<{ steps: readonly string[]; current: number }>) {
  return <ol className="workflow-steps">{steps.map((step, index) => <li className={index < current ? "complete" : index === current ? "current" : ""} key={step}><span>{index < current ? "✓" : index + 1}</span>{step}</li>)}</ol>;
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = "primary", busy = false, onConfirm, onCancel }: Readonly<{ open: boolean; title: string; description: string; confirmLabel: string; tone?: "primary" | "danger"; busy?: boolean; onConfirm: () => void; onCancel: () => void }>) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy, onCancel, open]);
  if (!open) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}><div aria-describedby="confirm-description" aria-labelledby="confirm-title" aria-modal="true" className="dialog" role="dialog"><span className={`dialog-icon dialog-${tone}`}><Icons.alert /></span><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div className="dialog-actions"><button className="secondary-button" disabled={busy} onClick={onCancel}>Batal</button><button className={tone === "danger" ? "danger-button" : ""} disabled={busy} onClick={onConfirm} ref={confirmRef}>{busy ? "Memproses…" : confirmLabel}</button></div></div></div>;
}

export function SourceBadge({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="source-badge">{children}</span>;
}

export function Tooltip({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <span className="tooltip" data-tooltip={label}>{children}</span>;
}

export function DropdownMenu({ trigger, children, className = "" }: Readonly<{ trigger: ReactNode; children: ReactNode; className?: string }>) {
  return <details className={`dropdown-menu ${className}`}><summary>{trigger}</summary><div className="dropdown-popover">{children}</div></details>;
}
