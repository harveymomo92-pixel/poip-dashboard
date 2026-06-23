# PRD v2.1 Production-Grade — PPIC Output Intelligence Platform

**Nama Produk:** PPIC Output Intelligence Platform  
**Kode Produk:** POIP  
**Versi Dokumen:** 2.1 Production-Grade  
**Tanggal:** 22 Juni 2026  
**Status:** Ready for Execution via Vibecoding / AI-Assisted Development  
**Basis Rebuild:** `ppic-output-dashboard` existing repo  
**Owner Bisnis:** PPIC / Produksi / Maintenance / QC / Manajemen Operasi  
**Owner Teknis:** Engineering / IT / Product Owner  
**Timezone Resmi:** Asia/Jakarta  
**Bahasa UI Default:** Indonesia  
**Target Deployment Awal:** Internal production server / VPS / VM / private cloud

---

## 0. Cara Menggunakan Dokumen Ini untuk Vibecoding

Dokumen ini dirancang agar bisa dipakai langsung oleh AI coding agent seperti Cursor, Windsurf, Claude Code, Copilot Workspace, atau tool vibecoding lain.

### 0.1 Prinsip Eksekusi

Gunakan dokumen ini sebagai **single source of truth** untuk membangun ulang aplikasi. Jangan hanya membuat UI mockup. Bangun sistem full-stack production-grade dengan:

1. Monorepo.
2. Frontend modular.
3. Backend API terpisah.
4. Worker untuk job berat.
5. PostgreSQL sebagai database utama.
6. Redis queue untuk background jobs.
7. Auth/RBAC.
8. Audit log.
9. OData sync.
10. Dashboard output.
11. Target achievement.
12. Downtime command center.
13. WA parser preview/commit.
14. Import center.
15. Data quality cockpit.
16. Observability, testing, dan deployment artifact.

### 0.2 Cara Memberi Prompt ke Coding Agent

Untuk setiap fase, gunakan pola prompt berikut:

```text
You are building the PPIC Output Intelligence Platform based on docs/PRD.md.
Follow the architecture, folder structure, schema, API contract, acceptance criteria, and Definition of Done.
Do not skip tests, validation, error handling, auth, audit log, and production hardening.
Implement only the selected milestone. Keep code modular and documented.
After implementation, run typecheck, lint, unit tests, and give a concise summary of changed files.
```

### 0.3 Aturan Vibecoding

AI coding agent wajib mengikuti aturan berikut:

- Jangan membuat satu file raksasa seperti repo lama.
- Jangan menyimpan secret di repo.
- Jangan menggunakan dependency `"latest"`.
- Jangan membuat endpoint tanpa validasi input.
- Jangan membuat write action tanpa audit log.
- Jangan melakukan import data langsung tanpa dry-run/preview.
- Jangan membuat parser WA yang langsung commit tanpa review.
- Jangan memuat tabel besar langsung di frontend tanpa pagination.
- Jangan membuat dashboard yang angkanya tidak bisa di-drilldown.
- Jangan menggunakan SQLite untuk production database.
- Jangan menghapus data production secara hard delete tanpa audit dan soft-delete policy.
- Jangan membuat fitur tanpa loading, empty, dan error state.
- Jangan mengabaikan timezone Asia/Jakarta.

---

## 1. Executive Summary

PPIC Output Intelligence Platform adalah rebuild production-grade dari dashboard PPIC existing. Tujuannya bukan hanya menampilkan data output produksi, tetapi menjadi **command center operasi produksi** yang menggabungkan data Business Central OData V4, target produksi, downtime, reject, parser WhatsApp, import Excel/CSV, action item, alert, dan laporan meeting.

Versi existing sudah membuktikan kebutuhan dasar: dashboard output, OData sync, SQLite cache, master entity target, downtime import, parser WA, dan sync timer. Versi 2.1 harus memperbaiki kelemahan production readiness dengan menambahkan:

- PostgreSQL.
- Backend service layer.
- Worker queue.
- Auth/RBAC.
- Audit log.
- Data quality validation.
- API contract.
- Modular frontend.
- Deployment artifact.
- Test coverage.
- UAT checklist.
- Cutover plan.

Target akhirnya adalah aplikasi internal yang dapat dipercaya untuk daily production meeting, monitoring real-time near-batch, dan pengambilan keputusan PPIC/Produksi/Maintenance/QC.

---

## 2. Product Vision

Menjadi **single operational intelligence platform** untuk menjawab:

1. **Apa yang terjadi di produksi?**  
   Output, reject, target, downtime, mesin bermasalah, SPK berjalan, tren harian.

2. **Kenapa performa berubah?**  
   Root cause downtime, under-target line, reject spike, speed loss, missing target, data stale.

3. **Apa tindakan berikutnya?**  
   Follow-up PIC, SLA, action item, alert, shift handover, daily meeting pack.

---

## 3. Product Goals

### 3.1 Business Goals

- Mengurangi waktu rekap laporan produksi harian minimal 50%.
- Membuat output vs target terlihat oleh PPIC dan Produksi secara konsisten.
- Meningkatkan visibility downtime dan follow-up maintenance.
- Mengurangi perdebatan angka dengan definisi KPI yang baku.
- Mengurangi ketergantungan pada Excel manual.
- Menyediakan audit trail untuk data target, downtime, import, dan sync.
- Mempercepat daily production meeting.

### 3.2 User Goals

- PPIC dapat melihat output vs target harian/mingguan/bulanan.
- Produksi dapat melihat performa per shift, mesin, line, item, dan SPK.
- Maintenance dapat melihat downtime prioritas dan action item overdue.
- QC dapat melihat reject rate dan pola reject.
- Manajemen dapat melihat executive summary tanpa membuka data mentah.
- Admin dapat mengelola user, role, sync, parser, master data, backup, dan health system.

### 3.3 Technical Goals

- Monorepo yang rapi dan scalable.
- Backend modular dengan API contract.
- Background worker untuk sync/import/parser/export.
- PostgreSQL sebagai database production.
- Redis untuk queue.
- RBAC dan audit log.
- Observability: logs, metrics, traces, health check.
- Test coverage untuk formula KPI, parser, API, dan flow kritikal.
- CI/CD otomatis.
- Deployment via Docker Compose untuk fase awal.

---

## 4. Non-Goals

Fase v2.1 tidak bertujuan untuk:

- Menggantikan Business Central sebagai ERP utama.
- Mengubah master data resmi di Business Central.
- Membuat MES penuh dengan koneksi PLC real-time.
- Membuat production scheduling otomatis penuh.
- Membuat approval financial/costing.
- Membuat mobile native app.
- Membuat AI yang bisa mengubah data tanpa review user.
- Membuat microservices penuh sejak awal.

---

## 5. Stakeholders

| Stakeholder | Peran | Kepentingan |
|---|---|---|
| PPIC Manager | Business Owner | Akurasi output dan target. |
| Production Manager | Business Owner | Visibility performa produksi. |
| Maintenance Manager | Business Owner | Downtime follow-up. |
| QC Manager | Business Owner | Reject monitoring. |
| IT/Engineering | Technical Owner | Keamanan, deployment, maintainability. |
| Leader Shift | End User | Input downtime, shift handover. |
| Admin Sistem | Power User | User, role, sync, master data. |
| Manajemen Operasi | Executive User | Executive dashboard dan report. |

---

## 6. Personas

### 6.1 PPIC Planner

**Kebutuhan:**
- Melihat output OK vs target.
- Melihat SPK, item, line, dan mesin.
- Export data untuk analisis lanjutan.
- Membandingkan periode.

**Success Criteria:**
- Bisa membuat ringkasan harian dalam < 10 menit.
- Bisa drilldown dari KPI ke transaksi.

### 6.2 Leader Produksi

**Kebutuhan:**
- Melihat performa shift.
- Input downtime dari HP/tablet.
- Review hasil parser WA.
- Melihat mesin under-target.

**Success Criteria:**
- Input downtime < 1 menit/event.
- Dapat melihat issue shift sebelumnya.

### 6.3 Maintenance

**Kebutuhan:**
- Melihat downtime open.
- Melihat mesin dengan frekuensi trouble tertinggi.
- Mengelola action item dan SLA.

**Success Criteria:**
- Setiap downtime critical punya PIC.
- Overdue action item terlihat jelas.

### 6.4 QC

**Kebutuhan:**
- Melihat reject per item, line, mesin, shift.
- Mencari pola reject.
- Export reject report.

**Success Criteria:**
- Reject spike terdeteksi cepat.
- Reject rate konsisten dengan formula yang disepakati.

### 6.5 Manajemen

**Kebutuhan:**
- Executive summary.
- Trend output, target, reject, downtime.
- Top issue dan action.

**Success Criteria:**
- Dashboard bisa dipakai langsung di meeting.

### 6.6 Admin Sistem

**Kebutuhan:**
- Kelola user, role, permission.
- Kelola sync OData.
- Kelola parser provider.
- Monitor health system.
- Backup/restore.

**Success Criteria:**
- Bisa troubleshooting tanpa akses server langsung untuk kasus umum.

---

## 7. Product Scope

## 7.1 MVP v2.1 — Must Have

1. Authentication.
2. Role-Based Access Control.
3. Executive Overview Dashboard.
4. Output Monitoring Dashboard.
5. Target Achievement Dashboard.
6. Data Detail Explorer.
7. Master Entity Management.
8. Target Management dengan versioning.
9. Downtime Command Center.
10. Downtime Import CSV/XLSX.
11. WhatsApp Parser Preview/Commit.
12. OData Sync Center.
13. Data Quality Cockpit.
14. Audit Log.
15. Export CSV/XLSX.
16. Settings/Admin.
17. Health Check.
18. Docker Compose deployment.
19. CI lint/typecheck/test/build.
20. UAT checklist dan cutover plan.

## 7.2 v2.2 — Should Have

1. Alert & Notification.
2. Action Item / CAPA Workflow.
3. Shift Handover Report.
4. Daily Production Meeting Pack.
5. Advanced export PDF.
6. Saved views.
7. Parser regression fixture UI.
8. Data quality issue resolution workflow.

## 7.3 v2.3 — Could Have

1. OEE-lite.
2. AI Insight Assistant.
3. Mobile PWA offline draft.
4. Capacity planning.
5. BI connector.
6. Advanced anomaly detection.
7. WhatsApp gateway notification.

---

## 8. Production-Grade Tech Stack

### 8.1 Runtime Baseline

| Area | Decision |
|---|---|
| Node.js | Node 24 LTS |
| Package Manager | pnpm |
| Language | TypeScript strict mode |
| Frontend | Next.js App Router |
| Backend | NestJS or Fastify; recommended: NestJS for modular enterprise structure |
| Worker | Node.js worker app with BullMQ |
| Database | PostgreSQL 18 or latest stable supported by infra |
| Queue | Redis |
| ORM | Drizzle ORM recommended; Prisma acceptable if team prefers |
| Validation | Zod |
| API Docs | OpenAPI 3.1 |
| UI | Tailwind CSS + shadcn/ui + Radix |
| Charts | Apache ECharts for complex charts; Recharts acceptable for simpler MVP |
| Data Grid | TanStack Table + virtualization |
| Server State | TanStack Query |
| Forms | React Hook Form |
| Auth | Auth.js/OIDC or Keycloak; local auth only if SSO unavailable |
| Logging | pino/winston structured JSON logs |
| Observability | OpenTelemetry |
| Testing | Vitest, Testing Library, Playwright |
| Deployment | Docker Compose first; Kubernetes optional later |
| Reverse Proxy | Caddy or Nginx |
| CI/CD | GitHub Actions |

### 8.2 Architecture Decision

Gunakan **modular monolith + worker queue**, bukan microservices penuh.

Alasan:

- Domain masih satu kesatuan: output, target, downtime, quality, production analytics.
- Lebih mudah dipahami dan dirawat oleh tim kecil/menengah.
- Tetap scalable karena job berat dipindah ke worker.
- Deployment awal lebih sederhana.
- Dapat dipisah menjadi services di masa depan jika domain sudah matang.

### 8.3 Dependency Rule

Semua dependency wajib dipin ke versi eksplisit.

Contoh buruk:

```json
{
  "next": "latest",
  "react": "latest"
}
```

Contoh benar:

```json
{
  "next": "15.3.4",
  "react": "19.1.0"
}
```

Versi final boleh disesuaikan saat implementasi, tetapi tidak boleh menggunakan `"latest"`.

---

## 9. Target Repository Structure

```text
ppic-output-intelligence/
  apps/
    web/
      src/
        app/
        features/
        components/
        hooks/
        lib/
        styles/
      public/
      next.config.ts
      package.json

    api/
      src/
        main.ts
        modules/
          auth/
          users/
          roles/
          dashboard/
          output/
          targets/
          downtime/
          imports/
          parser/
          sync/
          data-quality/
          audit/
          settings/
          health/
        common/
          decorators/
          filters/
          guards/
          interceptors/
          pipes/
          utils/
      package.json

    worker/
      src/
        main.ts
        queues/
        jobs/
          odata-sync/
          file-import/
          wa-parser/
          export/
          data-quality/
          materialized-refresh/
        common/
      package.json

  packages/
    db/
      migrations/
      seeds/
      schema/
      src/
        client.ts
        schema.ts
        migrations.ts
      package.json

    domain/
      src/
        kpi/
        parser-contract/
        validators/
        constants/
        timezone/
        permissions/
        types/
      package.json

    ui/
      src/
        components/
        charts/
        tables/
        forms/
      package.json

    config/
      eslint/
      tsconfig/
      prettier/
      package.json

    api-client/
      src/
        generated/
        client.ts
      package.json

  docs/
    PRD.md
    ARCHITECTURE.md
    DATA_CONTRACT.md
    KPI_DEFINITIONS.md
    API_SPEC.md
    DATABASE_DESIGN.md
    SECURITY_MODEL.md
    DEPLOYMENT.md
    RUNBOOK.md
    OBSERVABILITY.md
    UAT_CHECKLIST.md
    BACKLOG.md

  docker/
    api.Dockerfile
    web.Dockerfile
    worker.Dockerfile
    nginx.conf
    caddy/Caddyfile

  scripts/
    backup-db.sh
    restore-db.sh
    seed-demo-data.ts
    create-admin.ts
    check-env.ts

  .github/
    workflows/
      ci.yml
      deploy.yml

  docker-compose.yml
  docker-compose.prod.yml
  .env.example
  pnpm-workspace.yaml
  turbo.json
  package.json
  README.md
```

---

## 10. System Architecture

### 10.1 Component Diagram

```text
[User Browser / Tablet / Mobile]
              |
              v
        [Next.js Web]
              |
              v
        [Backend API]
              |
      +-------+--------+-------------------+
      |                |                   |
      v                v                   v
 [PostgreSQL]      [Redis Queue]      [Object/File Storage]
                       |
                       v
                [Worker Service]
                       |
       +---------------+----------------+
       |               |                |
       v               v                v
[Business Central] [CSV/XLSX Import] [WA Parser / AI Provider]
```

### 10.2 Data Flow — OData Sync

```text
Business Central OData
  -> Worker fetch incremental data
  -> production_output_staging
  -> validation + normalization
  -> production_outputs
  -> data_quality_issues
  -> materialized KPI refresh
  -> dashboard API
  -> frontend
```

### 10.3 Data Flow — Downtime WA Parser

```text
Paste WA text
  -> API create parser run
  -> rules parser + optional AI parser
  -> parser rows with confidence
  -> preview UI
  -> user correction
  -> commit selected rows
  -> downtime_events
  -> audit log
  -> data quality check
```

### 10.4 Data Flow — Import CSV/XLSX

```text
Upload file
  -> store raw file
  -> parse file
  -> normalize headers
  -> dry-run validation
  -> preview valid/invalid/duplicate/conflict
  -> user commit
  -> insert/update records
  -> import run history
  -> audit log
```

---

## 11. Authentication and Authorization

### 11.1 Authentication

Preferred options:

1. OIDC/SSO using existing Microsoft/Google/Keycloak.
2. Local email/password only if SSO is not available.

### 11.2 Session Rules

- Session cookie HTTPOnly, Secure, SameSite=Lax/Strict.
- Session expiry default 8 jam.
- Refresh session policy tergantung auth provider.
- Logout invalidates session.
- Admin dapat disable user.

### 11.3 Roles

| Role | Description |
|---|---|
| Admin | Full system access. |
| Manager | Executive view, reports, approval, export. |
| PPIC | Output, target, detail, import tertentu, export. |
| ProductionLeader | Downtime input/review, shift view, output view. |
| Maintenance | Downtime, action item, maintenance reports. |
| QC | Reject view, QC notes, reject export. |
| Viewer | Read-only dashboard. |

### 11.4 Permission Matrix

| Permission | Admin | Manager | PPIC | ProductionLeader | Maintenance | QC | Viewer |
|---|---:|---:|---:|---:|---:|---:|---:|
| dashboard.view | Y | Y | Y | Y | Y | Y | Y |
| output.view | Y | Y | Y | Y | Y | Y | Y |
| output.export | Y | Y | Y | N | N | Y | N |
| target.view | Y | Y | Y | Y | N | N | Y |
| target.create | Y | N | Y | N | N | N | N |
| target.approve | Y | Y | N | N | N | N | N |
| downtime.view | Y | Y | Y | Y | Y | Y | Y |
| downtime.create | Y | N | Y | Y | Y | N | N |
| downtime.update | Y | N | Y | Y | Y | N | N |
| downtime.close | Y | Y | N | Y | Y | N | N |
| parser.preview | Y | N | Y | Y | N | N | N |
| parser.commit | Y | N | Y | Y | N | N | N |
| import.preview | Y | N | Y | N | N | N | N |
| import.commit | Y | N | Y | N | N | N | N |
| sync.view | Y | N | Y | N | N | N | N |
| sync.run | Y | N | N | N | N | N | N |
| data_quality.view | Y | Y | Y | N | N | Y | N |
| audit.view | Y | Y | N | N | N | N | N |
| settings.manage | Y | N | N | N | N | N | N |
| users.manage | Y | N | N | N | N | N | N |

### 11.5 Acceptance Criteria

```gherkin
Given user belum login
When user membuka /overview
Then user diarahkan ke /login

Given user role Viewer
When user membuka halaman import
Then sistem menampilkan forbidden state

Given user PPIC mengubah target
When perubahan berhasil disimpan
Then audit log mencatat before_value, after_value, actor, timestamp, dan request_id
```

---

## 12. KPI Definitions

Semua KPI wajib diletakkan dalam `packages/domain/src/kpi/` dan dites unit.

### 12.1 Timezone

- Semua tanggal operasional memakai timezone Asia/Jakarta.
- Timestamp database disimpan dalam UTC.
- API menerima dan mengembalikan tanggal lokal untuk filter bisnis.
- Field `created_at`, `updated_at`, `synced_at` disimpan sebagai `timestamptz`.

### 12.2 Operational Date

Default:

```text
operational_date = posting_date in Asia/Jakarta
```

Jika di masa depan perusahaan memakai cut-off shift khusus, tambahkan konfigurasi:

```text
operational_day_start_time = 07:00
```

Untuk MVP v2.1, gunakan `posting_date` sebagai tanggal operasional.

### 12.3 Output OK

```text
output_ok_qty = SUM(quantity)
WHERE normalized_output_type = 'OK'
AND quantity > 0
```

### 12.4 Reject Kg

```text
reject_kg = SUM(reject_kg)
WHERE reject_kg > 0
```

### 12.5 Reject Pcs Equivalent

```text
reject_pcs_eq = reject_kg / gross_weight_per_pcs
```

Rules:

- Jika `gross_weight_per_pcs > 0`, hitung normal.
- Jika `gross_weight_per_pcs` kosong atau 0, row masuk data_quality_issue `MISSING_GROSS_WEIGHT`.
- Untuk KPI utama, row tersebut:
  - tetap dihitung pada reject_kg,
  - tidak dihitung pada reject_pcs_eq,
  - ditandai incomplete conversion.

### 12.6 Reject Rate

```text
reject_rate = reject_pcs_eq / (output_ok_qty + reject_pcs_eq) * 100
```

Rules:

- Jika denominator = 0, reject_rate = null, bukan 0.
- UI tampilkan `N/A`.

### 12.7 Daily Target

Target per entity per hari.

```text
daily_target = production_targets.daily_target_qty
```

### 12.8 Active Days

Untuk periode filter:

```text
active_days = count(distinct posting_date)
WHERE entity has output OR configured working calendar says active
```

MVP v2.1 default:

```text
active_days = count(distinct posting_date with output for selected entity)
```

Post-MVP dapat ditingkatkan menjadi working calendar.

### 12.9 Prorata Target

```text
prorata_target = daily_target * active_days
```

### 12.10 Achievement

```text
achievement_pct = output_ok_qty / prorata_target * 100
```

Rules:

- Jika target tidak ada, status = `NO_TARGET`.
- Jika prorata_target = 0, achievement_pct = null.
- UI tampilkan `N/A`.

### 12.11 Downtime Duration

```text
duration_minutes = end_time - start_time
```

Rules:

- Jika end_time < start_time, anggap downtime lintas hari.
- Jika end_time kosong, status = OPEN dan duration berjalan sampai now.
- Jika duration <= 0, issue `INVALID_DOWNTIME_DURATION`.

### 12.12 Estimated Loss Output

```text
estimated_loss_output = duration_minutes / 60 * hourly_target
hourly_target = daily_target / planned_runtime_hours
```

Rules:

- Jika planned_runtime_hours belum tersedia, gunakan default 24 jam untuk continuous line atau 8 jam untuk shift-based sesuai setting entity.
- Jika target tidak ada, estimated loss = null dan issue `MISSING_TARGET_FOR_LOSS_ESTIMATION`.

### 12.13 Status Target

| Status | Rule |
|---|---|
| NO_TARGET | target kosong |
| NO_OUTPUT | target ada, output 0 |
| UNDER_TARGET | achievement < target_min_pct |
| ON_TRACK | achievement >= target_min_pct and <= target_max_pct |
| ABOVE_TARGET | achievement > target_max_pct |

Default threshold:

```text
target_min_pct = 95
target_max_pct = 110
```

### 12.14 Data Freshness

```text
freshness_minutes = now - latest_successful_sync.finished_at
```

Status:

| Status | Rule |
|---|---|
| FRESH | <= 120 menit |
| STALE | > 120 menit and <= 360 menit |
| CRITICAL | > 360 menit |
| NEVER_SYNCED | belum pernah sync |

---

## 13. Data Contract

## 13.1 Source: Business Central OData V4

### 13.1.1 Required Mapping

| Source Field | Target Field | Type | Required | Rule |
|---|---|---|---:|---|
| Entry_No | entry_no | bigint | Y | unique source key |
| Posting_Date | posting_date | date | Y | Asia/Jakarta business date |
| Document_Date | document_date | date | N | nullable |
| Document_No | document_no | text | Y | trim |
| External_Document_No | external_document_no | text | N | trim |
| Entry_Type | entry_type | text | Y | normalize |
| Item_No | item_no | text | Y | trim uppercase |
| Description | item_description | text | N | trim |
| Item_Category_Code | item_category_code | text | N | trim uppercase |
| Machine_Center_No | machine_center_no | text | N | trim uppercase |
| Prod_Order_Line_No | prod_line_no | text | N | trim |
| Prod_Line_Description | prod_line_description | text | N | trim |
| Quantity | quantity | numeric | Y | decimal |
| Unit_of_Measure_Code | uom | text | N | trim uppercase |
| Gross_Weight | gross_weight_per_pcs | numeric | N | decimal |
| Reject_KG | reject_kg | numeric | N | default 0 |
| Shift | shift_code | text | N | normalize |
| Operator | operator_name | text | N | trim |

### 13.1.2 Required Normalization

- Trim semua string.
- Empty string menjadi null.
- Machine/entity code uppercase.
- Item no uppercase.
- UOM uppercase.
- Quantity numeric decimal.
- Date parse strict.
- Unknown source field disimpan di `raw_payload`.

### 13.1.3 Dedupe Rule

Primary dedupe:

```text
source_system + entry_no
```

Jika `entry_no` kosong, fallback natural key:

```text
posting_date + document_no + item_no + machine_center_no + quantity + entry_type
```

### 13.1.4 Data Quality Rules

| Code | Severity | Condition |
|---|---|---|
| MISSING_ENTRY_NO | CRITICAL | entry_no kosong |
| DUPLICATE_ENTRY_NO | CRITICAL | source_system + entry_no sudah ada dengan payload beda |
| MISSING_POSTING_DATE | CRITICAL | posting_date kosong |
| MISSING_DOCUMENT_NO | WARNING | document_no kosong |
| MISSING_ITEM_NO | CRITICAL | item_no kosong |
| UNKNOWN_MACHINE | WARNING | machine tidak ditemukan di master_entities |
| MISSING_TARGET | WARNING | output entity tidak punya target aktif |
| MISSING_GROSS_WEIGHT | WARNING | reject_kg > 0 but gross_weight kosong/0 |
| NEGATIVE_QUANTITY | WARNING | quantity < 0 |
| ZERO_QUANTITY | INFO | quantity = 0 |
| INVALID_DATE | CRITICAL | tanggal tidak bisa diparse |

---

## 14. Database Design

## 14.1 Core Tables

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text,
  auth_provider text not null default 'local',
  provider_subject text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table user_roles (
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  primary key (user_id, role_id)
);

create table role_permissions (
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  primary key (role_id, permission_id)
);
```

## 14.2 Master Entity and Target

```sql
create table master_entities (
  id uuid primary key default gen_random_uuid(),
  entity_code text not null,
  display_name text not null,
  area text,
  line_code text,
  product_family text,
  report_group text,
  planned_runtime_hours numeric(8,2) not null default 24,
  is_active boolean not null default true,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_code)
);

create table master_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references master_entities(id),
  alias text not null,
  source text not null default 'manual',
  confidence numeric(5,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(alias)
);

create table production_targets (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references master_entities(id),
  target_version int not null,
  effective_from date not null,
  effective_to date,
  daily_target_qty numeric(18,4) not null,
  reject_target_pct numeric(8,4),
  min_achievement_pct numeric(8,4) not null default 95,
  max_achievement_pct numeric(8,4) not null default 110,
  status text not null default 'DRAFT',
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique(entity_id, target_version)
);

create index idx_production_targets_effective
on production_targets(entity_id, effective_from, effective_to);
```

## 14.3 Output Tables

```sql
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_url text,
  mode text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  checkpoint_before jsonb,
  checkpoint_after jsonb,
  rows_fetched int not null default 0,
  rows_inserted int not null default 0,
  rows_updated int not null default 0,
  rows_skipped int not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  triggered_by uuid references users(id)
);

create table sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  source_system text not null unique,
  last_entry_no bigint,
  last_posting_date date,
  last_successful_sync_run_id uuid references sync_runs(id),
  updated_at timestamptz not null default now()
);

create table production_output_staging (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references sync_runs(id),
  source_system text not null,
  raw_payload jsonb not null,
  row_hash text not null,
  validation_status text not null default 'PENDING',
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table production_outputs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  entry_no bigint,
  posting_date date not null,
  document_date date,
  document_no text,
  external_document_no text,
  entry_type text,
  normalized_output_type text not null,
  item_no text not null,
  item_description text,
  item_category_code text,
  machine_center_no text,
  entity_id uuid references master_entities(id),
  prod_line_no text,
  prod_line_description text,
  shift_code text,
  operator_name text,
  quantity numeric(18,4) not null default 0,
  uom text,
  gross_weight_per_pcs numeric(18,6),
  reject_kg numeric(18,4) not null default 0,
  reject_pcs_eq numeric(18,4),
  row_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  sync_run_id uuid references sync_runs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, entry_no)
);

create index idx_outputs_posting_date on production_outputs(posting_date);
create index idx_outputs_entity_date on production_outputs(entity_id, posting_date);
create index idx_outputs_item_date on production_outputs(item_no, posting_date);
create index idx_outputs_document_no on production_outputs(document_no);
create index idx_outputs_machine_date on production_outputs(machine_center_no, posting_date);
create index idx_outputs_raw_payload_gin on production_outputs using gin(raw_payload);
```

## 14.4 Downtime Tables

```sql
create table downtime_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  shift_code text,
  area text,
  entity_id uuid references master_entities(id),
  machine_code text,
  line_code text,
  category text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes int,
  status text not null default 'OPEN',
  severity text not null default 'MEDIUM',
  pic_user_id uuid references users(id),
  root_cause text,
  action_taken text,
  estimated_loss_output numeric(18,4),
  linked_signal_type text,
  source_type text not null default 'MANUAL',
  source_line text,
  parser_run_id uuid,
  natural_key text not null,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(natural_key)
);

create index idx_downtime_event_date on downtime_events(event_date);
create index idx_downtime_entity_date on downtime_events(entity_id, event_date);
create index idx_downtime_status on downtime_events(status);
```

## 14.5 Parser Tables

```sql
create table wa_parser_runs (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  parser_mode text not null,
  parser_version text not null,
  status text not null default 'PREVIEW',
  created_by uuid references users(id),
  committed_by uuid references users(id),
  committed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table wa_parser_rows (
  id uuid primary key default gen_random_uuid(),
  parser_run_id uuid not null references wa_parser_runs(id),
  row_number int not null,
  source_line text not null,
  parsed_payload jsonb not null,
  confidence numeric(5,2) not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING_REVIEW',
  downtime_event_id uuid references downtime_events(id),
  created_at timestamptz not null default now()
);
```

## 14.6 Import Tables

```sql
create table import_runs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  original_filename text not null,
  stored_file_path text,
  file_hash text not null,
  status text not null default 'PREVIEW',
  rows_total int not null default 0,
  rows_valid int not null default 0,
  rows_invalid int not null default 0,
  rows_duplicate int not null default 0,
  rows_conflict int not null default 0,
  rows_inserted int not null default 0,
  rows_updated int not null default 0,
  validation_report jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  committed_by uuid references users(id),
  committed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 14.7 Data Quality and Audit

```sql
create table data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  issue_code text not null,
  severity text not null,
  entity_type text not null,
  entity_id uuid,
  source_system text,
  source_ref text,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN',
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index idx_dq_status_severity on data_quality_issues(status, severity);
create index idx_dq_issue_code on data_quality_issues(issue_code);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_created_at on audit_logs(created_at);
create index idx_audit_actor on audit_logs(actor_user_id);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
```

## 14.8 Notifications and Action Items

```sql
create table action_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  source_type text,
  source_id uuid,
  priority text not null default 'MEDIUM',
  status text not null default 'TODO',
  owner_user_id uuid references users(id),
  due_date date,
  resolution_note text,
  created_by uuid references users(id),
  closed_by uuid references users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  severity text not null,
  title text not null,
  message text not null,
  link_url text,
  status text not null default 'UNREAD',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
```

---

## 15. API Contract

### 15.1 API Standards

- Prefix: `/api/v1`.
- Format: JSON.
- Auth: required for all except `/health`.
- Validation: Zod/class-validator on every input.
- Pagination: cursor or page/limit; MVP use page/limit.
- Sorting: explicit allowlist.
- Filtering: explicit allowlist.
- Date timezone: Asia/Jakarta for business dates.
- Write action: audit log required.
- Large job: async via queue.
- Error response standardized.

### 15.2 Success Envelope

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_01J...",
    "generatedAt": "2026-06-22T14:00:00.000Z"
  }
}
```

### 15.3 Error Envelope

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid",
    "details": []
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

### 15.4 Common Error Codes

| Code | HTTP |
|---|---:|
| UNAUTHORIZED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| VALIDATION_ERROR | 400 |
| CONFLICT | 409 |
| RATE_LIMITED | 429 |
| JOB_ALREADY_RUNNING | 409 |
| IMPORT_VALIDATION_FAILED | 422 |
| SYNC_FAILED | 500 |
| INTERNAL_ERROR | 500 |

### 15.5 Endpoint List

#### Auth

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

#### Dashboard

```text
GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/trend
GET    /api/v1/dashboard/by-entity
GET    /api/v1/dashboard/by-item
GET    /api/v1/dashboard/by-document
GET    /api/v1/dashboard/target-performance
GET    /api/v1/dashboard/downtime-summary
```

#### Output

```text
GET    /api/v1/outputs
GET    /api/v1/outputs/:id
GET    /api/v1/outputs/export
```

#### Master Entity

```text
GET    /api/v1/master/entities
POST   /api/v1/master/entities
GET    /api/v1/master/entities/:id
PATCH  /api/v1/master/entities/:id
DELETE /api/v1/master/entities/:id
POST   /api/v1/master/entities/:id/aliases
DELETE /api/v1/master/entities/:id/aliases/:aliasId
```

#### Targets

```text
GET    /api/v1/targets
POST   /api/v1/targets
GET    /api/v1/targets/:id
PATCH  /api/v1/targets/:id
POST   /api/v1/targets/:id/approve
POST   /api/v1/targets/import/preview
POST   /api/v1/targets/import/commit
```

#### Downtime

```text
GET    /api/v1/downtime/events
POST   /api/v1/downtime/events
GET    /api/v1/downtime/events/:id
PATCH  /api/v1/downtime/events/:id
DELETE /api/v1/downtime/events/:id
POST   /api/v1/downtime/events/:id/close
GET    /api/v1/downtime/summary
```

#### Import Center

```text
POST   /api/v1/imports/downtime/preview
POST   /api/v1/imports/downtime/:importRunId/commit
GET    /api/v1/imports
GET    /api/v1/imports/:id
GET    /api/v1/imports/:id/error-file
```

#### WhatsApp Parser

```text
POST   /api/v1/parser/wa/preview
POST   /api/v1/parser/wa/:parserRunId/commit
GET    /api/v1/parser/runs
GET    /api/v1/parser/runs/:id
```

#### Sync

```text
POST   /api/v1/sync/odata/run
GET    /api/v1/sync/runs
GET    /api/v1/sync/runs/:id
GET    /api/v1/sync/status
POST   /api/v1/sync/odata/resync-range
```

#### Data Quality

```text
GET    /api/v1/data-quality/issues
GET    /api/v1/data-quality/summary
PATCH  /api/v1/data-quality/issues/:id/resolve
PATCH  /api/v1/data-quality/issues/:id/ignore
```

#### Audit

```text
GET    /api/v1/audit-logs
```

#### Action Items

```text
GET    /api/v1/action-items
POST   /api/v1/action-items
PATCH  /api/v1/action-items/:id
POST   /api/v1/action-items/:id/close
```

#### Settings

```text
GET    /api/v1/settings
PATCH  /api/v1/settings
GET    /api/v1/health
GET    /api/v1/health/deep
```

### 15.6 Dashboard Summary Request

```text
GET /api/v1/dashboard/summary?from=2026-06-01&to=2026-06-22&area=PACKING&entityId=...&shift=A
```

### 15.7 Dashboard Summary Response

```json
{
  "ok": true,
  "data": {
    "period": {
      "from": "2026-06-01",
      "to": "2026-06-22",
      "timezone": "Asia/Jakarta"
    },
    "kpis": {
      "outputOkQty": 125000,
      "rejectKg": 430.5,
      "rejectPcsEq": 2100,
      "rejectRate": 1.65,
      "documentCount": 390,
      "itemCount": 207,
      "activeEntityCount": 37,
      "targetAchievementPct": 96.4,
      "downtimeMinutes": 820,
      "estimatedLossOutput": 3500
    },
    "status": {
      "syncFreshness": "FRESH",
      "dataQualityScore": 94.2
    }
  },
  "meta": {
    "requestId": "req_123",
    "generatedAt": "2026-06-22T14:00:00.000Z"
  }
}
```

---

## 16. Frontend Requirements

## 16.1 Information Architecture

```text
/login
/overview
/output
/target
/downtime
  /events
  /parser
  /import
  /analysis
/compare
/data-detail
/reports
/master-data
  /entities
  /targets
  /aliases
/action-items
/data-quality
/settings
  /users
  /roles
  /sync
  /parser
  /system-health
/audit
```

## 16.2 Frontend Feature Structure

```text
apps/web/src/features/
  overview/
    components/
    hooks/
    pages/
    schemas/
    types.ts
  output/
  target/
  downtime/
  parser/
  import-center/
  data-detail/
  reports/
  master-data/
  action-items/
  data-quality/
  audit/
  settings/
```

## 16.3 UI Principles

- Dashboard harus bisa dibaca dalam 5 detik.
- KPI cards harus lebih dominan daripada chart.
- Semua chart penting punya drilldown.
- Filter harus konsisten.
- Filter tersimpan di URL query.
- Tabel besar wajib server-side pagination.
- Semua halaman punya loading, empty, error state.
- Semua action destructive butuh confirmation dialog.
- Form penting punya validation message yang jelas.
- Input downtime harus nyaman di mobile/tablet.

## 16.4 Design System Components

Minimum components:

- AppShell.
- Sidebar.
- TopBar.
- PageHeader.
- FilterBar.
- DateRangePicker.
- KPIStatCard.
- StatusBadge.
- TrendChart.
- ParetoChart.
- DataTable.
- DetailDrawer.
- ConfirmDialog.
- FormSection.
- EmptyState.
- ErrorState.
- LoadingSkeleton.
- PermissionGate.
- AuditTimeline.
- ImportPreviewTable.
- ParserPreviewPanel.
- HealthStatusCard.

## 16.5 Dashboard Pages

### Overview Page

Contains:

- Total Output OK.
- Reject Rate.
- Target Achievement.
- Downtime Minutes.
- Estimated Loss.
- Active Machines.
- Sync Freshness.
- Data Quality Score.
- Top under-target machines.
- Top reject items.
- Top downtime categories.
- Recent alerts.

### Output Page

Contains:

- Trend output harian.
- Output by entity.
- Output by item.
- Output by category.
- Output by document/SPK.
- Pareto output.
- Data detail link.

### Target Page

Contains:

- Achievement per entity.
- Target status.
- Prorata target.
- Reject threshold status.
- Target version info.
- Target edit/import.

### Downtime Page

Contains:

- Downtime list.
- Create/edit form.
- Category summary.
- Machine downtime Pareto.
- Status open/closed.
- Root cause/action.
- Parser/import shortcut.

### Data Detail Page

Contains:

- Server-side data grid.
- Column visibility.
- Search.
- Filter.
- Sort.
- Export.
- Drilldown source.

---

## 17. Feature Specs and Acceptance Criteria

## 17.1 Executive Overview Dashboard

### Requirements

- Show KPI cards for selected period.
- Show data freshness.
- Show data quality score.
- Show top production issues.
- Show drilldown links.

### Acceptance Criteria

```gherkin
Given user Manager memilih periode 1 Juni sampai 22 Juni 2026
When user membuka Overview
Then sistem menampilkan total output OK, reject rate, target achievement, downtime minutes, active entity count
And setiap KPI dapat diklik untuk membuka detail sesuai filter
And data freshness status terlihat jelas

Given API summary gagal
When halaman Overview dibuka
Then UI menampilkan error state dengan tombol retry
And tidak menampilkan angka lama seolah data valid
```

## 17.2 Output Monitoring

### Requirements

- Filter by date, area, entity, item, document, category, shift.
- Show trend, entity, item, document, category.
- Support drilldown to detail.
- Export filtered data.

### Acceptance Criteria

```gherkin
Given user memilih filter entity tertentu
When Output Dashboard dimuat
Then semua chart dan tabel memakai filter yang sama
And URL berisi filter tersebut

Given user klik chart bar entity
When drilldown dibuka
Then Data Detail Explorer menampilkan row yang membentuk angka tersebut
```

## 17.3 Target Achievement

### Requirements

- CRUD target version.
- Approve target.
- Compute prorata target.
- Show status target.

### Acceptance Criteria

```gherkin
Given entity memiliki target aktif mulai 1 Juni 2026
When user melihat periode 1-10 Juni
Then prorata target = daily_target * active_days

Given target diubah
When perubahan disimpan
Then target lama tidak ditimpa
And versi target baru dibuat
And audit log tersimpan
```

## 17.4 Downtime Command Center

### Requirements

- Manual input.
- Edit.
- Close.
- Duplicate detection.
- Status tracking.
- Root cause/action required for close.
- Estimated loss.

### Acceptance Criteria

```gherkin
Given downtime start 2026-06-22 23:30 and end 2026-06-23 01:00
When event disimpan
Then duration_minutes = 90

Given downtime status OPEN
When user close event tanpa root cause
Then sistem menolak dengan VALIDATION_ERROR

Given user input downtime yang natural_key sama
When save
Then sistem menampilkan conflict duplicate
```

## 17.5 WA Parser

### Requirements

- Paste WA text.
- Preview parsed rows.
- Confidence score.
- Warnings.
- Manual correction.
- Commit selected rows.
- No auto-commit.

### Acceptance Criteria

```gherkin
Given user paste laporan WA
When klik Preview
Then sistem membuat parser run
And menampilkan parsed rows dengan confidence
And belum membuat downtime_event

Given row confidence < 70
When user commit tanpa review
Then sistem meminta konfirmasi atau menolak sesuai policy

Given user commit selected rows
When commit berhasil
Then downtime_events dibuat
And wa_parser_rows tertaut ke downtime_event_id
And audit log tersimpan
```

## 17.6 Import Center

### Requirements

- Upload CSV/XLSX.
- Dry-run preview.
- Validation report.
- Commit.
- Import history.
- Idempotent.

### Acceptance Criteria

```gherkin
Given file downtime memiliki 100 rows
When preview dijalankan
Then sistem menampilkan rows_valid, rows_invalid, rows_duplicate, rows_conflict
And belum ada downtime_event dibuat

Given file yang sama diimport ulang
When commit dijalankan
Then sistem tidak membuat duplikat
And rows_duplicate bertambah sesuai natural_key
```

## 17.7 OData Sync Center

### Requirements

- Manual sync.
- Scheduled sync.
- Incremental checkpoint.
- Resync range.
- Job history.
- Failure handling.
- Data freshness.

### Acceptance Criteria

```gherkin
Given latest checkpoint entry_no = 1000
When sync incremental berjalan
Then worker hanya mengambil row dengan entry_no > 1000

Given sync gagal di tengah proses
When job berhenti
Then sync_run status = FAILED
And checkpoint tidak maju melebihi data yang berhasil commit

Given sync berhasil
When user membuka Sync Center
Then latest_successful_sync terlihat
And data freshness dihitung
```

## 17.8 Data Quality Cockpit

### Requirements

- Show issues grouped by severity.
- Show affected rows.
- Resolve/ignore with note.
- Link issue to source data.

### Acceptance Criteria

```gherkin
Given output row memiliki machine unknown
When data quality job berjalan
Then issue UNKNOWN_MACHINE dibuat

Given Admin resolve issue
When resolution_note kosong
Then sistem menolak

Given issue resolved
When dashboard data quality score dihitung
Then issue tersebut tidak dihitung sebagai open issue
```

## 17.9 Audit Log

### Requirements

- Log write actions.
- Filter by actor/date/action/entity.
- Store before/after.
- Read-only for non-admin.

### Acceptance Criteria

```gherkin
Given user mengubah downtime root cause
When save berhasil
Then audit_logs menyimpan before_value dan after_value

Given user Viewer membuka audit
When request dikirim
Then API mengembalikan FORBIDDEN
```

---

## 18. Worker Jobs

## 18.1 Queues

```text
odata-sync
file-import
wa-parser
export
data-quality
materialized-refresh
notification
```

## 18.2 Job Rules

- Job harus idempotent.
- Job punya retry dengan exponential backoff.
- Job punya timeout.
- Job punya status tracking.
- Job error disimpan.
- Job critical memicu notification.
- Job tidak boleh menyimpan secret di log.

## 18.3 Job Payloads

### OData Sync Job

```json
{
  "mode": "incremental",
  "sourceSystem": "business-central",
  "requestedBy": "user_uuid",
  "range": {
    "from": "2026-06-01",
    "to": "2026-06-22"
  }
}
```

### Import Commit Job

```json
{
  "importRunId": "uuid",
  "requestedBy": "user_uuid"
}
```

### Parser Commit Job

```json
{
  "parserRunId": "uuid",
  "selectedRowIds": ["uuid"],
  "requestedBy": "user_uuid"
}
```

---

## 19. Security Requirements

### 19.1 Secret Management

- `.env` tidak boleh commit.
- `.env.example` wajib tersedia.
- Secret di production disediakan oleh environment/server.
- Log tidak boleh menampilkan password, token, OData credentials, API keys.
- CI wajib punya secret scanning minimal basic grep/scan.

### 19.2 File Upload Security

- File type allowed: `.csv`, `.xlsx`.
- Max file size default: 20 MB.
- Store original file dengan hash.
- Validate MIME dan extension.
- Jangan execute file.
- Jangan render HTML dari file.
- CSV formula injection harus dicegah saat export:
  - prefix `'` untuk cell yang dimulai `=`, `+`, `-`, `@`.

### 19.3 API Security

- Auth required.
- RBAC guard.
- Rate limit:
  - login: 5/minute/user/IP.
  - parser preview: 10/minute/user.
  - import upload: 5/minute/user.
  - export: 5/minute/user.
- Request body size limit.
- CORS restricted to app domain.
- CSRF protection jika cookie auth digunakan.
- Input validation all endpoints.
- Output encoding in UI.

### 19.4 Audit Security

- Audit log append-only at application level.
- Non-admin cannot delete audit.
- Admin cannot edit audit via UI.
- Export audit action is logged.

---

## 20. Observability Requirements

### 20.1 Logs

Structured JSON logs include:

- timestamp.
- level.
- service.
- environment.
- request_id.
- user_id when available.
- route/job name.
- duration_ms.
- status_code.
- error_code.
- error_message sanitized.

### 20.2 Metrics

Minimum metrics:

- API request count.
- API latency p50/p95/p99.
- API error rate.
- DB query latency.
- Queue job count.
- Queue job failure count.
- Sync duration.
- Sync rows fetched/inserted/skipped.
- Import duration.
- Parser confidence distribution.
- Data quality issue count.
- Data freshness minutes.

### 20.3 Health Checks

```text
GET /api/v1/health
GET /api/v1/health/deep
```

Basic health checks app process.

Deep health checks:

- PostgreSQL connection.
- Redis connection.
- latest migration status.
- worker heartbeat.
- latest successful sync.
- disk free space optional.

### 20.4 Alerts

Critical alerts:

- API down.
- Worker down.
- DB unavailable.
- Redis unavailable.
- Sync failed 3 times.
- Data stale > 6 hours.
- Disk free < 20%.
- Backup failed.

---

## 21. Deployment Requirements

## 21.1 Environments

| Environment | Purpose |
|---|---|
| local | Developer machine |
| staging | UAT and parallel validation |
| production | Real internal use |

## 21.2 Docker Services

```text
web
api
worker
postgres
redis
reverse-proxy
```

Optional:

```text
minio
grafana
prometheus
loki
```

## 21.3 .env.example

```bash
NODE_ENV=production
APP_ENV=production
APP_BASE_URL=https://ppic.example.local
TZ=Asia/Jakarta

DATABASE_URL=postgresql://ppic:ppic_password@postgres:5432/ppic
REDIS_URL=redis://redis:6379

AUTH_SECRET=replace_me
AUTH_PROVIDER=local

BC_ODATA_URL=https://businesscentral.example.com/odata/v4/...
BC_ODATA_USERNAME=replace_me
BC_ODATA_PASSWORD=replace_me

FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/data/uploads

LOG_LEVEL=info

SYNC_SCHEDULE_CRON=*/30 7-18 * * 1-6
DATA_FRESHNESS_WARNING_MINUTES=120
DATA_FRESHNESS_CRITICAL_MINUTES=360
```

## 21.4 Backup Policy

- PostgreSQL backup harian.
- Retention:
  - Daily 14 hari.
  - Weekly 8 minggu.
  - Monthly 12 bulan.
- Restore drill minimal 1x sebelum go-live.
- Backup log tersimpan.
- Backup failure memicu alert.

## 21.5 Rollback Policy

- Deployment harus immutable image tag.
- Migration harus backward-compatible untuk minor release.
- Backup sebelum migration production.
- Rollback app image jika deploy gagal.
- Rollback DB hanya jika benar-benar perlu dan sudah disetujui owner.

---

## 22. CI/CD Requirements

### 22.1 CI Pipeline

On pull request:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### 22.2 Required Checks

- lint pass.
- TypeScript pass.
- unit tests pass.
- API tests pass.
- build pass.
- no dependency `"latest"`.
- no `.env` committed.
- no obvious secret pattern.

### 22.3 Deployment Pipeline

On merge main:

1. Build Docker images.
2. Push images.
3. Deploy to staging.
4. Run smoke test.
5. Manual approval.
6. Deploy production.
7. Run health check.
8. Notify deployment result.

---

## 23. Testing Strategy

## 23.1 Unit Tests

Required for:

- KPI formulas.
- Reject conversion.
- Target achievement.
- Downtime duration.
- Natural key generation.
- Parser rules.
- Data normalization.
- Permission checks.

## 23.2 Integration Tests

Required for:

- Auth login.
- Dashboard summary API.
- Output list API.
- Target CRUD.
- Downtime CRUD.
- Import preview/commit.
- Parser preview/commit.
- Sync run creation.
- Audit log generation.

## 23.3 E2E Tests

Required flows:

1. Login -> Overview.
2. Filter dashboard -> drilldown detail.
3. Create downtime -> close downtime.
4. Paste WA -> preview -> correct -> commit.
5. Import downtime -> preview -> commit.
6. Admin run sync -> see sync history.
7. Viewer forbidden from settings.
8. PPIC update target -> audit log visible.

## 23.4 Performance Tests

Minimum test data:

- 500.000 production_outputs.
- 10.000 downtime_events.
- 1.000 targets.
- 100 users.

Targets:

- Dashboard summary p95 < 800ms.
- Detail table p95 < 1500ms.
- Import preview 10.000 rows < 30s.
- Initial dashboard interactive < 3s on normal office laptop/network.

---

## 24. UAT Checklist

### 24.1 PPIC UAT

- [ ] Output total matches Business Central for selected dates.
- [ ] SPK/document count matches expected data.
- [ ] Target achievement formula accepted.
- [ ] Export CSV/XLSX works.
- [ ] Compare period works.
- [ ] Missing target warning useful.

### 24.2 Production UAT

- [ ] Dashboard by shift/entity works.
- [ ] Downtime manual input works on mobile/tablet.
- [ ] Downtime duration correct across midnight.
- [ ] WA parser preview understandable.
- [ ] User can correct parser result before commit.

### 24.3 Maintenance UAT

- [ ] Downtime list by machine works.
- [ ] Open/closed status works.
- [ ] Root cause/action required when closing.
- [ ] Action item visible.
- [ ] Overdue issue visible.

### 24.4 QC UAT

- [ ] Reject kg displayed correctly.
- [ ] Reject pcs equivalent formula accepted.
- [ ] Reject rate matches manual sample.
- [ ] Missing gross weight issue visible.

### 24.5 Admin UAT

- [ ] User creation works.
- [ ] Role permission works.
- [ ] OData sync manual works.
- [ ] Sync failure visible.
- [ ] Health check works.
- [ ] Audit log works.
- [ ] Backup/restore tested.

### 24.6 Management UAT

- [ ] Executive dashboard readable in meeting.
- [ ] Top issues accurate.
- [ ] Data freshness visible.
- [ ] Report/export usable.

---

## 25. Cutover Plan

## 25.1 Pre-Cutover

- Freeze KPI definitions.
- Validate data contract.
- Prepare staging environment.
- Import historical data.
- Run sync against Business Central.
- Configure users and roles.
- Train key users.
- Run UAT checklist.
- Perform backup/restore drill.
- Confirm rollback plan.

## 25.2 Parallel Run

Duration: 1–2 weeks.

Daily compare:

- Output total old vs new.
- Reject old vs new.
- Target achievement old vs new.
- Downtime count old vs new.
- Top entity old vs new.

Acceptance:

- Difference explained and approved.
- Critical KPI variance <= agreed tolerance.
- No blocking issue open.

## 25.3 Go/No-Go Criteria

Go if:

- UAT critical pass.
- Sync stable for 5 working days.
- Dashboard performance pass.
- Backup restore tested.
- Admin trained.
- Rollback plan approved.

No-Go if:

- KPI mismatch unexplained.
- Auth/RBAC failure.
- Sync unstable.
- Data loss risk.
- Critical security issue.

## 25.4 Go-Live

- Backup old system DB/file.
- Tag release.
- Deploy production.
- Run migration.
- Run smoke tests.
- Announce go-live.
- Monitor for first 48 hours.

## 25.5 Rollback

- Stop new app.
- Restore previous app image.
- Restore DB backup only if data corruption occurred.
- Communicate rollback reason.
- Create incident review.

---

## 26. Migration from Existing Repo

### 26.1 What to Preserve

- Business logic understanding from old dashboard.
- OData source mapping.
- Sample data.
- Existing parser fixtures.
- Downtime import template ideas.
- Master entity target concept.
- Sync run history concept.
- Runbook learnings.

### 26.2 What to Replace

- SQLite production usage.
- Giant frontend file.
- Backend logic embedded in Next route only.
- Lack of RBAC.
- Lack of formal audit log.
- Lack of data contract.
- Lack of worker queue.
- Dependence on `"latest"` dependency versions.
- Manual deployment assumptions.

### 26.3 Migration Steps

1. Export sample data from old SQLite.
2. Map old tables to new schema.
3. Import master entities.
4. Import targets.
5. Import production outputs.
6. Import downtime events.
7. Recompute KPI materialized views.
8. Compare old vs new dashboard totals.
9. Validate parser fixture output.
10. Validate export and reports.

---

## 27. Vibecoding Execution Backlog

## 27.1 Milestone 0 — Repository Foundation

### Goal

Create monorepo foundation.

### Tasks

- Initialize pnpm workspace.
- Add Turborepo.
- Add apps/web.
- Add apps/api.
- Add apps/worker.
- Add packages/db.
- Add packages/domain.
- Add packages/ui.
- Add packages/config.
- Add packages/api-client.
- Configure TypeScript strict.
- Configure ESLint/Prettier.
- Add GitHub Actions CI.
- Add Docker Compose local.
- Add `.env.example`.
- Add README.

### Prompt

```text
Build Milestone 0 for PPIC Output Intelligence Platform.
Create the monorepo exactly as described in docs/PRD.md.
Use pnpm workspace and Turborepo.
Create apps/web, apps/api, apps/worker, packages/db, packages/domain, packages/ui, packages/config, packages/api-client.
Configure TypeScript strict, ESLint, Prettier, basic CI, Docker Compose local, and .env.example.
Do not implement business features yet.
Return changed files and commands to run.
```

### Acceptance Criteria

- `pnpm install` works.
- `pnpm lint` works.
- `pnpm typecheck` works.
- `pnpm build` works.
- Docker Compose starts PostgreSQL and Redis.
- No dependency uses `"latest"`.

---

## 27.2 Milestone 1 — Database and Domain Foundation

### Tasks

- Implement PostgreSQL schema.
- Add migrations.
- Add seed roles/permissions/admin.
- Add domain constants.
- Add KPI formula functions.
- Add parser contract types.
- Add unit tests for KPI.

### Prompt

```text
Implement Milestone 1.
Create database schema and migrations based on PRD sections 12-14.
Use Drizzle ORM unless impossible.
Add seed data for roles, permissions, and admin user.
Create domain package with KPI formulas, timezone helpers, permission constants, and parser contract types.
Add unit tests for KPI formulas and downtime duration edge cases.
```

### Acceptance Criteria

- Migration runs clean on empty database.
- Seed creates admin role and permissions.
- KPI tests pass.
- Downtime across midnight test passes.

---

## 27.3 Milestone 2 — Auth and RBAC

### Tasks

- Implement login/logout/me.
- Implement session.
- Implement RBAC guard.
- Implement user/role management.
- Implement PermissionGate frontend.
- Add audit for user management.

### Prompt

```text
Implement Milestone 2 Auth/RBAC.
Use the role and permission matrix in PRD.
Create backend guards for auth and permissions.
Create frontend login page, session handling, and PermissionGate.
Add user management for Admin.
Ensure protected routes redirect to login and unauthorized pages show forbidden state.
Add tests for permission checks.
```

### Acceptance Criteria

- Unauthenticated users cannot access dashboard.
- Viewer cannot access settings.
- Admin can create/disable user.
- Permission tests pass.

---

## 27.4 Milestone 3 — OData Sync Pipeline

### Tasks

- Implement sync_runs.
- Implement sync_checkpoints.
- Implement OData client.
- Implement staging validation.
- Implement production output upsert.
- Implement data quality issue generation.
- Implement sync center UI.
- Implement manual sync.
- Implement worker job.

### Prompt

```text
Implement Milestone 3 OData Sync Pipeline.
Build worker queue job for incremental OData sync.
Use staging table, validation, normalization, dedupe by source_system + entry_no.
Write sync_runs and sync_checkpoints.
Add API endpoints for run sync, sync status, and sync history.
Add frontend Sync Center page.
Add data quality issue creation for missing/invalid fields.
No secret may be logged.
```

### Acceptance Criteria

- Manual sync creates job.
- Successful sync updates checkpoint.
- Failed sync does not corrupt checkpoint.
- Sync run history visible.
- Unknown machine creates data quality issue.

---

## 27.5 Milestone 4 — Output Dashboard and Detail Explorer

### Tasks

- Dashboard summary API.
- Trend API.
- Group by entity/item/document.
- Detail list API with pagination.
- Overview page.
- Output page.
- Data detail page.
- Export CSV/XLSX.

### Prompt

```text
Implement Milestone 4 Output Dashboard and Data Detail.
Create dashboard summary, trend, by-entity, by-item, by-document APIs.
Use server-side filtering and pagination.
Create Overview, Output, and Data Detail pages with shared FilterBar.
Filters must be URL-driven.
Every KPI and chart must drill down to Data Detail.
Add CSV/XLSX export with CSV injection protection.
```

### Acceptance Criteria

- Dashboard summary matches detail rows.
- Detail table uses server pagination.
- Filters persist in URL.
- Export follows current filters.
- API performance acceptable with seeded test data.

---

## 27.6 Milestone 5 — Target Management

### Tasks

- Target CRUD.
- Target versioning.
- Approval.
- Target achievement API.
- Target page.
- Target import preview/commit.
- Audit log.

### Prompt

```text
Implement Milestone 5 Target Management.
Build master entity and production target CRUD with versioning.
Target edits must create a new version, not overwrite history.
Implement target approval.
Implement target achievement calculations using KPI rules.
Create Target page and target import preview/commit.
All write actions must create audit logs.
```

### Acceptance Criteria

- Target version history works.
- Achievement formula tested.
- Approval works.
- Audit log before/after saved.

---

## 27.7 Milestone 6 — Downtime Command Center

### Tasks

- Downtime CRUD.
- Natural key.
- Duration calculation.
- Close validation.
- Downtime summary.
- Downtime page.
- Maintenance/action item link optional.

### Prompt

```text
Implement Milestone 6 Downtime Command Center.
Create downtime event CRUD with natural key duplicate detection.
Implement duration calculation including cross-midnight events.
Require root cause and action taken when closing downtime.
Create downtime list, form, detail drawer, and summary charts.
Add audit logs for create/update/close/delete.
```

### Acceptance Criteria

- Duplicate downtime rejected.
- Cross-midnight duration correct.
- Close requires root cause/action.
- Downtime summary chart works.

---

## 27.8 Milestone 7 — Import Center

### Tasks

- File upload.
- CSV/XLSX parser.
- Header normalization.
- Preview validation.
- Commit job.
- Import history.
- Error file.

### Prompt

```text
Implement Milestone 7 Import Center.
Build downtime CSV/XLSX import with dry-run preview.
Validate rows, detect duplicates, conflicts, and invalid data.
Commit must be idempotent and run through worker queue.
Store import run metadata and original file hash.
Create Import Center UI with preview table and error download.
```

### Acceptance Criteria

- Preview does not write downtime_events.
- Commit writes valid rows only.
- Re-import same file creates no duplicates.
- Import history visible.

---

## 27.9 Milestone 8 — WhatsApp Parser

### Tasks

- Parser rules.
- AI provider abstraction optional.
- Preview.
- Confidence.
- Warnings.
- Manual correction.
- Commit selected rows.
- Parser regression tests.

### Prompt

```text
Implement Milestone 8 WhatsApp Parser.
Create WA parser preview/commit flow.
Use rules parser first. Add AI provider abstraction but keep it optional.
Parser preview must produce rows with parsed_payload, confidence, warnings, and source_line.
No row is committed until user selects and commits.
Allow manual correction before commit.
Add regression tests for parser fixtures.
```

### Acceptance Criteria

- Preview creates no downtime events.
- Commit creates selected events.
- Low confidence rows flagged.
- Source line stored.
- Parser tests pass.

---

## 27.10 Milestone 9 — Design System, UX Workflow, and Production Polish

### Goal

Transform the frontend from a functional MVP/admin scaffold into a consistent, production-grade manufacturing operations dashboard. This milestone is intentionally UI-focused and must not change backend contracts, database schema, RBAC behavior, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.

### Tasks

- Establish a shared design system for the web app using `docs/design.md` as the mandatory visual reference.
- Refactor the application shell, sidebar, page headers, toolbar patterns, KPI cards, tables, forms, badges, loading states, empty states, and error states.
- Group navigation into Dashboard, Operations, Tools, and Settings.
- Move logout/session actions into a dedicated user/session area.
- Standardize typography, spacing, color tokens, border radius, shadows, focus states, and responsive layout rules.
- Redesign the overview dashboard to look like an operational command center rather than a raw admin form.
- Improve all existing pages so they look like one product, not separate milestone prototypes.
- Clean up global CSS and reduce page-specific styling hacks.
- Preserve all current API integrations and real data rendering.

### Required Design Reference

This milestone must use `docs/design.md` as the primary visual design reference. The design reference is based on the Notion Beige aesthetic from designdotmd:

- Reference URL: https://designdotmd.directory/d/notion-beige
- Local reference file: `docs/design.md`

The implementation must read and follow `docs/design.md` before changing UI components. The reference should guide color palette, background tone, surface treatment, typography mood, spacing, border radius, subtle shadows, card style, navigation feel, and overall visual direction.

Interpretation for this product:
- Use the Notion Beige aesthetic as inspiration, not as a copy-paste clone.
- Adapt it into a professional PPIC/manufacturing operations dashboard.
- Keep the UI warm, calm, structured, readable, and production-grade.
- Avoid playful, overly decorative, or consumer-app styling.
- Preserve strong operational hierarchy for KPIs, filters, tables, alerts, and action buttons.

### Design Direction

- Notion Beige-inspired professional internal SaaS dashboard, based on `docs/design.md`.
- Manufacturing and operations oriented.
- Clean, compact, readable, structured, and calm.
- Strong visual hierarchy for operational KPIs, alerts, and actions.
- Avoid playful colors, excessive decoration, and raw/default HTML styling.
- Prefer reusable components over one-off page styling.

### Required Shared Components

- `AppShell`
- `Sidebar`
- `TopBar` or `UserMenu`
- `PageHeader`
- `PageToolbar`
- `FilterBar`
- `MetricCard`
- `InsightCard`
- `StatusBadge`
- `DataTable`
- `EmptyState`
- `LoadingSkeleton`
- `ErrorState`
- `FormPanel`
- `SectionHeader`
- `ConfirmDialog` where feasible

### Interaction and Motion Requirements

- Implement a collapsible sidebar with expanded and collapsed states.
- Persist the sidebar collapsed state in local storage.
- Keep collapsed sidebar icons readable with tooltips.
- On small screens, use a drawer-style sidebar instead of squeezing the layout.
- Add clear active navigation state for every route.
- Add navigation groups:
  - Dashboard
  - Operations
  - Tools
  - Settings
- Add a compact top bar or session area with current user and logout action.
- Add breadcrumbs or page context where useful.
- Add keyboard and focus-visible states for all interactive controls.
- Add subtle, fast CSS transitions for sidebar, buttons, menus, dialogs, and row hover states.
- Do not add heavy animation libraries unless absolutely necessary.
- Prefer calm transitions that match the Notion Beige-inspired design reference.

### Table and Data Interaction Requirements

- Standardize all operational tables through a shared `DataTable` component.
- Support table loading skeletons.
- Support empty state with contextual action.
- Support row-level status badges.
- Support sticky or visually clear table headers where feasible.
- Support pagination where API supports it.
- Support sorting and column visibility where feasible.
- Support compact density suitable for manufacturing operations data.
- Keep table markup accessible and readable.

### Form and Workflow Interaction Requirements

- Standardize input, select, textarea, checkbox, date input, and file upload styles.
- Use consistent field labels, helper text, validation errors, and action rows.
- Add confirmation dialogs for destructive or irreversible actions.
- Add toast notifications for create, update, approve, reject, close, preview, commit, and resolve actions.
- Add disabled/loading states for async submit buttons.
- Prevent double-submit on create/update/commit actions.
- Keep error messages human-readable and operationally useful.

### Dashboard Visualization Requirements

- Add lightweight charts where existing API data supports it.
- Recommended dashboard visualizations:
  - OK output trend
  - achievement trend
  - reject rate trend
  - downtime minutes trend
  - top downtime reasons/entities
  - data quality issue severity distribution
- Do not hardcode chart data.
- If data is unavailable, show polished empty states instead of fake charts.
- Charts must use the same design tokens as the rest of the UI.

### Recommended UI Package Policy

Prefer the existing stack. Add packages only when they materially improve accessibility, consistency, or dashboard usefulness.

Allowed additions if not already installed:

- `lucide-react` for consistent sidebar, action, status, and empty-state icons.
- `recharts` for lightweight React dashboard charts.
- `@tanstack/react-table` for headless table behavior if the project does not already use it.
- `class-variance-authority`, `clsx`, and `tailwind-merge` for reusable component variants and safe class composition.
- Radix UI primitives only as needed, such as:
  - `@radix-ui/react-collapsible`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-tooltip`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-scroll-area`
- `sonner` for toast notifications.
- `date-fns` only if date formatting/parsing is not already handled cleanly.

Use shadcn/ui style components where appropriate, but commit generated/customized components into the repo so the app owns its design system.

Dependency rules:

- Do not use dependency version `"latest"` in any `package.json`.
- Do not add large component suites such as MUI, Ant Design, Chakra UI, or Bootstrap unless explicitly approved.
- Do not add visual template packages that override the product identity.
- Keep dependency additions minimal and justified in the final summary.
- After adding packages, run the existing dependency guard, lint, typecheck, test, and build.

### Notion Beige Adaptation Requirements

The UI must follow `docs/design.md` as the primary visual reference and adapt it for a PPIC/manufacturing dashboard.

Emphasize:

- warm beige/off-white app background
- calm neutral surfaces
- subtle borders
- soft cards
- readable dark text
- muted secondary text
- compact but comfortable spacing
- understated shadows
- strong hierarchy through layout and typography, not loud colors
- restrained accent colors for operational status only

Avoid:

- bright saturated dashboard colors everywhere
- heavy gradients
- generic blue admin template styling
- raw HTML-looking inputs and tables
- over-rounded consumer-app components
- excessive animation

### Additional Acceptance Criteria

- Sidebar can collapse and expand smoothly.
- Collapsed sidebar remains usable through icons and tooltips.
- User/session/logout controls are moved out of the dashboard content area.
- All primary pages use the same `PageHeader`, `FilterBar`, `DataTable`, `MetricCard`, `StatusBadge`, `EmptyState`, and `ErrorState` patterns.
- Tables, forms, dialogs, toasts, and buttons look consistent across modules.
- Dashboard includes useful lightweight visualizations if backed by real API data.
- Any new package is justified and does not use `"latest"`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

### Page Scope

The following pages must be visually reviewed and polished if they exist:

- `/overview`
- `/downtime`
- `/tools/import-center`
- `/tools/wa-parser`
- `/settings/sync`
- `/settings/targets`
- `/settings/users`
- Any data quality, audit, or health pages if already created before this milestone runs

### Dashboard Requirements

- Replace the raw card/form layout with a polished dashboard layout.
- Use a clear page header with title, short description, and freshness/last updated information.
- Convert filters into a proper toolbar with Apply and Reset actions.
- Redesign KPI cards for OK Output, Target, Achievement, Reject KG, Reject PCS Eq, Reject Rate, Downtime Minutes, and Freshness.
- Use clear badges and status treatment for states such as `STALE`, `NO_TARGET`, warning, and critical.
- Improve Data Quality and Downtime summary panels so they look like real insight cards.
- If trend/breakdown API data already exists, add lightweight visual sections; otherwise show polished empty states without hardcoded data.

### UX Production Polish Requirements

The Design System milestone must improve user experience, not only visual styling. The application must feel easy, safe, fast, and clear for PPIC, production, supervisor, and admin users.

#### UX Goals

- Make the application easy to understand for PPIC, production, and admin users.
- Reduce user mistakes during target input, downtime closing, import commit, WA parser commit, and data quality issue handling.
- Make every important action explain its result clearly.
- Make data freshness, validation status, and source traceability visible.
- Make operational workflows guided, safe, and recoverable.
- Reduce cognitive load by showing the next action clearly.
- Keep critical actions explicit and reversible where possible.

#### Navigation UX

- Implement collapsible sidebar with persisted collapsed state.
- Add tooltips for collapsed sidebar items.
- Group navigation into Dashboard, Operations, Tools, and Settings.
- Add clear active state for the current page.
- Add responsive drawer sidebar for smaller screens.
- Move logout/session actions into a user menu or top bar.
- Add breadcrumbs or contextual page location where useful.
- Ensure users can answer: where am I, what can I do here, and what should I do next?

#### User Preference Persistence

Persist user preferences in local storage where appropriate:

- sidebar collapsed state
- dashboard filter values
- date range
- table density
- table sorting
- column visibility where implemented
- last selected import/parser type where safe

#### Feedback and Notification UX

- Add toast notifications for create, update, approve, reject, close, preview, commit, resolve, ignore, and sync actions.
- Add loading states for async actions.
- Disable submit buttons while requests are running.
- Prevent double submit on forms and commit actions.
- Show success messages with operationally useful details, such as committed row counts, updated status, skipped rows, or created entity name.
- Show failure messages with a clear retry path.
- Avoid silent refreshes after important actions.

#### Form UX

- Standardize labels, helper text, validation errors, and action buttons.
- Show inline validation near the affected field.
- Use human-readable validation messages.
- Add helper text for complex fields such as date range, shift, machine/entity, item, natural key, import type, parser type, and downtime close time.
- Preserve user input when validation fails.
- Avoid hard resets unless the user explicitly clears the form.
- Use sensible defaults for date ranges and operational filters.
- Make required fields visually clear without cluttering the form.
- Show disabled/loading state on submit buttons.

#### Workflow UX

Use guided multi-step flows for complex workflows.

Import Center flow:

1. Upload or paste
2. Preview
3. Review validation issues
4. Commit
5. Result summary

WhatsApp Parser flow:

1. Paste WhatsApp text
2. Parse preview
3. Review row issues
4. Commit
5. Result summary

Target workflow:

1. Create draft
2. Review details
3. Submit or approve
4. Show active/approved target status

Downtime workflow:

1. Create open downtime
2. Update details if needed
3. Close downtime
4. Show calculated duration and audit trail

Preview actions must not write final operational data. Commit actions must clearly state what will be written, skipped, or marked as issue.

#### Confirmation and Recovery UX

Add confirmation dialogs for sensitive actions:

- approve target
- reject target
- deactivate target
- close downtime
- commit import
- commit WA parser
- resolve data quality issue
- ignore data quality issue
- rerun sync manually where applicable

Confirmation dialogs must explain the impact of the action in plain operational language.

Prefer safe recovery patterns:

- deactivate instead of delete
- allow issue status transitions where permitted
- keep audit trail visible
- keep commit operations idempotent
- avoid irreversible actions in the UI unless explicitly required

#### Data Trust UX

Expose data trust indicators across dashboard and operational pages:

- last sync time
- freshness status
- source system or source workflow
- validation status
- data quality issue count
- audit history where relevant
- approved/unapproved status for target data
- imported/parser/manual/source label where applicable

Dashboard and operational pages must make stale, missing, invalid, duplicate, unresolved, or unapproved data obvious.

#### Data Quality UX

- Show issue severity clearly.
- Show row-level or entity-level issue details.
- Explain why an issue exists.
- Provide recommended fix text when feasible.
- Support acknowledge, resolve, and ignore actions where permissions allow.
- Show issue history or audit context where feasible.
- Avoid exposing only machine-readable error codes without explanation.
- Group related issues where helpful.

#### Table UX

- Use a consistent shared `DataTable` component.
- Support loading skeleton.
- Support empty state with contextual CTA.
- Support row status badges.
- Support pagination where API supports it.
- Support sorting where feasible.
- Support compact density suitable for operational data.
- Support column visibility where feasible.
- Keep table columns readable and avoid horizontal clutter.
- Use sticky or visually clear headers where feasible.
- Keep row actions consistent across modules.

#### Dashboard UX

The overview dashboard must behave like an operations cockpit:

- Show the current operational state first.
- Show freshness and sync status.
- Show KPI cards with clear status treatment.
- Show insight cards for data quality and downtime.
- Use real trend/breakdown data where available.
- If data is unavailable, show polished empty states instead of fake data.
- Explain missing target, stale data, never-synced data, and unresolved data quality states in human language.
- Make the dashboard useful even when some data is missing.
- Show operational next steps where appropriate.

#### Accessibility UX

- All interactive elements must have visible focus states.
- Dialogs must be keyboard accessible.
- Inputs must have labels.
- Status must not rely on color alone.
- Buttons and links must have clear text.
- Tooltips must be supplementary, not required to understand the page.
- Forms must be usable by keyboard.
- Error messages must be associated with their fields where feasible.
- Avoid contrast that is too low in the beige visual system.

#### Performance UX

- Use skeleton loading for dashboards, tables, cards, and forms.
- Use optimistic UI only where safe.
- Disable buttons during async work.
- Debounce search and filters where appropriate.
- Avoid unnecessary full-page reloads.
- Keep table pagination and rendering responsive.
- Keep charts lightweight and backed by real API data.

#### Microcopy UX

Add short, helpful microcopy where users need context:

- Explain what each page is for.
- Explain where data comes from.
- Explain what each status means.
- Explain what preview and commit will do.
- Explain why an empty state is empty.
- Explain what users should do next.

Examples:

- “Preview does not write final operational data. Commit will save valid rows only.”
- “Target belum tersedia untuk periode ini. Achievement tidak dapat dihitung sampai target disetujui.”
- “Data terakhir disinkronkan 18 menit lalu.”
- “7 rows are invalid and will be skipped during commit.”
- “Downtime masih terbuka. Tutup downtime saat mesin kembali berjalan.”

#### Bulk Action UX

For data quality and issue management, support safe bulk actions where feasible:

- select multiple issues
- acknowledge selected
- resolve selected
- ignore selected
- show confirmation before bulk changes
- show result summary after bulk action

Bulk actions must respect permissions and must not hide individual issue details.

#### UX Acceptance Criteria

- Users can navigate without guessing where features are.
- Users understand what happened after every action.
- Users can safely preview before committing import/parser data.
- Users see clear validation messages and how to fix issues.
- Users can identify stale, missing, invalid, duplicate, unresolved, or unapproved data.
- Users can recover from common mistakes without data loss.
- Tables, forms, dialogs, toasts, filters, and empty states are consistent across modules.
- Operational workflows feel guided and safe.
- The application feels like a production operations tool, not a collection of raw admin pages.

---

### Prompt

```text
Implement Milestone 9 Design System, UX Workflow, and Production Polish.

Before changing UI:
- Read `docs/design.md`.
- Use `docs/design.md` as the primary visual reference.
- The local design reference is based on Notion Beige: https://designdotmd.directory/d/notion-beige
- Treat the reference as inspiration for visual direction, not as a requirement to clone every detail exactly.

Current state:
- The application is functionally working but the UI still looks like a rough MVP/admin scaffold.
- Do not change backend behavior, database schema, API contracts, permissions, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.
- Preserve all existing routes and API integrations.
- This milestone is only for frontend visual quality, layout consistency, usability, and reusable components.
- This milestone must improve UX flows, feedback, validation, empty states, loading states, confirmation dialogs, toasts, data trust indicators, and user preference persistence.

Goal:
Transform the app into a clean production-grade manufacturing operations dashboard with a warm, calm, structured Notion Beige-inspired visual system adapted for PPIC/manufacturing operations.

Create/refactor shared UI components for AppShell, collapsible Sidebar, TopBar/UserMenu, PageHeader, PageToolbar, FilterBar, MetricCard, InsightCard, StatusBadge, DataTable, EmptyState, LoadingSkeleton, ErrorState, FormPanel, SectionHeader, ConfirmDialog, Tooltip, DropdownMenu, and Toast notifications if feasible.

Redesign navigation into Dashboard, Operations, Tools, and Settings groups. Add a collapsible sidebar, clear active navigation state, icon support, tooltip support in collapsed mode, responsive drawer behavior on small screens, and move Logout into a user/session area.

Redesign /overview so it no longer looks like raw/default admin HTML. Improve filter toolbar, KPI cards, data quality insight card, downtime insight card, spacing, hierarchy, badges, and empty states.

Visually polish /downtime, /tools/import-center, /tools/wa-parser, /settings/sync, /settings/targets, /settings/users, and any data quality/audit/health pages that already exist.

Clean up globals.css. Standardize body background, typography, card styling, borders, focus states, button styles, table styles, form fields, badges, loading states, empty states, and error states.

Do not hardcode production data. Do not add heavy UI libraries unless already installed or clearly justified. Allowed lightweight additions include lucide-react, Recharts, Radix primitives, TanStack Table, CVA/clsx/tailwind-merge, Sonner, and date-fns when justified. Do not use dependency "latest".

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build before finishing.

Return changed files, shared components created/refactored, pages improved, before/after visual notes, and remaining UI limitations.
```

### Acceptance Criteria

- UI follows `docs/design.md` visual direction and no longer looks like raw/default admin HTML.
- UX flows are guided, safe, recoverable, and clear for operational users.
- Sidebar and navigation look intentional and grouped.
- Dashboard has clear visual hierarchy and looks like a production operations dashboard.
- KPI cards have consistent styling, spacing, and status treatment.
- Filters, forms, buttons, badges, tables, loading states, empty states, and error states are consistent across pages.
- Logout/session controls are not placed awkwardly inside dashboard content.
- Existing functionality, permissions, routes, and API contracts remain intact.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` passes.

---

## 27.11 Milestone 10 — Data Quality, Audit, Health

### Tasks

- Data quality cockpit.
- Resolve/ignore.
- Audit log UI.
- Health endpoint.
- Health dashboard.
- Metrics/logging.

### Prompt

```text
Implement Milestone 10 Data Quality, Audit, and Health.
Create Data Quality Cockpit with issue summary, list, resolve, and ignore.
Create Audit Log page with filters.
Create basic and deep health endpoints.
Create Settings/System Health UI.
Ensure all write actions across implemented features produce audit logs.
Add structured logging with request_id.
```

### Acceptance Criteria

- Data quality issues visible.
- Resolve requires note.
- Audit filters work.
- Health deep checks DB and Redis.
- request_id appears in logs and API meta.

---

## 27.12 Milestone 11 — Master Data and Mapping Center

### Goal

Create a reliable master data and alias mapping foundation so OData sync, WhatsApp parser, Import Center, dashboard KPI, downtime, targets, and data quality features use consistent operational entities.

### Why This Matters

Production data usually arrives with inconsistent machine, item, line, shift, and unit names. Without a mapping center, the dashboard may show duplicated machines, missing targets, incorrect reject conversion, or unresolved data quality issues.

### Tasks

- Add master data model and UI for:
  - machines/entities
  - production lines
  - items/SKUs
  - shifts and shift calendar
  - item gross weight mapping
  - unit conversion mapping
  - source aliases from OData, Import Center, WhatsApp Parser, and manual input
- Add alias resolution logic for machine/entity, item, line, shift, unit, and source-specific codes.
- Add validation so duplicated aliases cannot point to conflicting master records.
- Add active/inactive status for master records.
- Add audit logs for create, update, deactivate, and alias changes.
- Add data quality integration so unknown machine, unknown item, missing gross weight, and unknown unit issues can be resolved by mapping them to master data.
- Add UI pages under Settings or Master Data.
- Preserve existing raw source values for traceability.

### Suggested API Endpoints

- `GET /api/v1/master/machines`
- `POST /api/v1/master/machines`
- `PATCH /api/v1/master/machines/:id`
- `GET /api/v1/master/items`
- `POST /api/v1/master/items`
- `PATCH /api/v1/master/items/:id`
- `GET /api/v1/master/shifts`
- `POST /api/v1/master/shifts`
- `PATCH /api/v1/master/shifts/:id`
- `GET /api/v1/master/aliases`
- `POST /api/v1/master/aliases`
- `PATCH /api/v1/master/aliases/:id`
- `POST /api/v1/master/aliases/resolve-issue`

### Prompt

```text
Implement Milestone 11 Master Data and Mapping Center.

Current status:
- Auth/RBAC, sync, dashboard, targets, downtime, WhatsApp Parser, Import Center, Data Quality, and UI/UX polish may already exist.
- Do not break existing API contracts or dashboard behavior.
- Add master data and alias mapping as a foundation for consistent operational data.

Build master data for machines/entities, items/SKUs, production lines, shifts, item gross weight mapping, unit conversion, and source aliases. Add alias resolution for OData, Import Center, WhatsApp Parser, and manual input.

Add API endpoints, UI pages, validation, audit logs, and data quality integration. Unknown machine/item/unit/gross weight issues should be easier to resolve through mapping.

Use Drizzle or parameterized SQL only. Do not hardcode production data. Do not use dependency "latest".

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build before finishing.
```

### Acceptance Criteria

- Users can manage machines/entities, items, shifts, units, gross weights, and aliases.
- Alias mapping resolves inconsistent source names into canonical master records.
- Duplicate/conflicting aliases are prevented.
- Unknown data quality issues can be resolved through master data mapping.
- Existing sync, import, parser, target, downtime, and dashboard behavior still works.
- Audit logs capture master data changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

## 27.13 Milestone 12 — Data Lineage and Source Traceability

### Goal

Make dashboard and operational data trustworthy by allowing users to trace every important KPI, row, and issue back to its source.

### Tasks

- Add lineage fields or read models where needed:
  - source type: OData, Import, WhatsApp Parser, Manual
  - source run ID
  - source row ID
  - natural key
  - row hash
  - created/committed by
  - committed at
  - latest audit event
- Add drill-down APIs for KPI source rows.
- Add source traceability panels in dashboard, output list, downtime detail, target detail, import run detail, parser run detail, and data quality issue detail.
- Add "View source rows" actions from dashboard KPI cards and insight cards.
- Add source badges consistently across tables and details.
- Preserve raw source payload/reference where safe, without exposing secrets.
- Add audit context for corrections and status changes.

### Suggested API Endpoints

- `GET /api/v1/lineage/outputs`
- `GET /api/v1/lineage/downtime`
- `GET /api/v1/lineage/kpi/:metric`
- `GET /api/v1/lineage/issues/:id`
- `GET /api/v1/lineage/entities/:type/:id`

### Prompt

```text
Implement Milestone 12 Data Lineage and Source Traceability.

Goal:
Every important number and operational row should be traceable to its source. Users should be able to click KPI cards, output rows, downtime events, import/parser rows, and data quality issues to understand where the data came from, when it entered the system, and who/what committed it.

Add source type, source run, source row, natural key, hash, actor, timestamp, and audit context where needed. Add drill-down APIs and UI panels.

Do not expose secrets or raw credentials. Do not break existing API contracts. Use real source data only, no fake lineage.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- KPI values can be traced to source rows.
- Source badges are visible in operational tables.
- Import/parser/sync/manual origins are distinguishable.
- Data quality issues show source context and recommended next action.
- Audit trail is connected to entity detail where feasible.
- No secrets or sensitive tokens are exposed.
- All validation commands pass.

---

## 27.14 Milestone 13 — Notification and Alert Center

### Goal

Create in-app operational alerts so users know when sync fails, data is stale, target is missing, downtime remains open, reject rate is high, or critical data quality issues appear.

### Tasks

- Add notification/alert data model if needed.
- Add alert rules for:
  - sync failure
  - stale data
  - never-synced data
  - missing approved target
  - open downtime over threshold
  - reject rate over threshold
  - high invalid row count after import/parser preview
  - critical data quality issues
- Add in-app Notification Center.
- Add badge counts in sidebar/topbar.
- Add dashboard alert cards for critical operational states.
- Add mark as read/unread and resolve/dismiss where appropriate.
- Add user-specific and role-based notification visibility.
- Add audit log for notification rule changes if rules are configurable.
- Keep external notifications optional for future extension.

### Suggested API Endpoints

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/summary`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/alerts/evaluate`
- `GET /api/v1/alert-rules`
- `PATCH /api/v1/alert-rules/:id`

### Prompt

```text
Implement Milestone 13 Notification and Alert Center.

Build in-app alerts for sync failure, stale data, missing target, long-open downtime, high reject rate, invalid import/parser rows, and critical data quality issues.

Add Notification Center UI, sidebar/topbar badge counts, dashboard alert cards, read/unread state, and role-aware visibility. Keep external email/WhatsApp/Slack notifications out of scope unless trivial and explicitly optional.

Do not spam users. Alerts should be deduplicated and operationally useful.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Critical operational states create visible alerts.
- Users can see and mark notifications as read.
- Dashboard shows important alert cards.
- Alerts are deduplicated and not noisy.
- Permissions and roles are respected.
- All validation commands pass.

---

## 27.15 Milestone 14 — Human-Readable Audit Timeline and Activity Feed

### Goal

Turn technical audit logs into understandable activity history for operational users and administrators.

### Tasks

- Build human-readable audit log messages.
- Add global Activity Feed page.
- Add entity-level Activity Timeline on detail pages:
  - target detail
  - downtime detail
  - import run detail
  - parser run detail
  - data quality issue detail
  - user/admin actions
- Add filters for actor, module, action, entity type, entity ID, and date range.
- Show before/after values in readable format.
- Hide or redact sensitive fields.
- Add friendly activity summaries, for example:
  - "Admin approved target for Machine A on 2026-06-23."
  - "Sari closed downtime MC-02 after 47 minutes."
  - "Import Center committed 82 valid rows and skipped 5 invalid rows."
  - "OData sync completed with 2 data quality warnings."
- Add audit detail drawer/panel.
- Keep raw audit data available for admin users where appropriate.

### Suggested API Endpoints

- `GET /api/v1/activity`
- `GET /api/v1/activity/entities/:type/:id`
- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/:id`

### Prompt

```text
Implement Milestone 14 Human-Readable Audit Timeline and Activity Feed.

Convert existing audit logs into a user-friendly Activity Feed and entity-level timelines. Add readable messages, filters, before/after value display, redaction for sensitive fields, and detail panels.

Do not remove raw audit logs. Do not expose secrets. Keep audit logs append-only.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Audit logs are readable by non-developer users.
- Entity details show relevant activity history.
- Sensitive fields are hidden/redacted.
- Filters work.
- Existing audit data remains intact.
- All validation commands pass.

---

## 27.16 Milestone 15 — UAT Mode, Demo Data, and Guided Testing Pack

### Goal

Make the project easy to test, demo, and validate with stakeholders using realistic sample data and guided scripts.

### Tasks

- Add demo/UAT seed mode.
- Add realistic sample data:
  - users and roles
  - machines/entities
  - items/SKUs
  - approved targets
  - production outputs
  - open and closed downtime events
  - import runs
  - WhatsApp parser runs
  - data quality issues
  - audit/activity events
  - notifications/alerts
- Add sample files:
  - downtime CSV
  - downtime XLSX if feasible
  - production output CSV if supported
  - WhatsApp sample text
- Add documentation:
  - `docs/UAT.md`
  - `docs/DEMO_SCRIPT.md`
  - `docs/SAMPLE_DATA.md`
  - `docs/QA_CHECKLIST.md`
- Add reset script for demo data in local development only.
- Add guided manual test checklist for stakeholders.
- Ensure demo mode cannot run accidentally in production.

### Suggested Commands

- `pnpm db:seed:demo`
- `pnpm demo:reset`
- `pnpm demo:check`

### Prompt

```text
Implement Milestone 15 UAT Mode, Demo Data, and Guided Testing Pack.

Create realistic demo/UAT data and documentation so the system can be tested and presented easily. Add seed scripts, sample import/parser files, demo reset command, UAT guide, demo script, sample data guide, and QA checklist.

Demo/reset scripts must be safe and must not run accidentally in production.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Demo data can be seeded locally.
- Stakeholders can follow a documented UAT script.
- Sample import/parser files are available.
- Demo reset is safe and clearly limited to non-production.
- Dashboard and core workflows look populated and realistic in demo mode.
- All validation commands pass.

---

## 27.17 Milestone 16 — Critical Flow E2E Automation

### Goal

Add browser-level regression protection for critical workflows so UI/UX polish and future refactors do not break core usage.

### Tasks

- Add Playwright E2E setup.
- Add E2E environment configuration.
- Add stable test data setup/teardown.
- Add critical flow tests:
  - login
  - view dashboard
  - trigger mock sync
  - create target
  - approve target
  - create downtime
  - close downtime
  - preview WhatsApp parser
  - commit WhatsApp parser
  - preview import
  - commit import
  - view data quality issues
  - view audit/activity logs
  - view notifications if implemented
- Add smoke test subset for CI.
- Add documentation for running E2E tests locally and in CI.
- Keep tests deterministic and not dependent on external services.

### Suggested Commands

- `pnpm e2e`
- `pnpm e2e:ui`
- `pnpm e2e:smoke`

### Prompt

```text
Implement Milestone 16 Critical Flow E2E Automation.

Add Playwright-based E2E tests for login, dashboard, mock sync, target create/approve, downtime create/close, WA parser preview/commit, import preview/commit, data quality, audit/activity, and notifications where available.

Tests must be deterministic, local-friendly, and CI-friendly. Use demo/UAT data setup where appropriate.

Do not use dependency "latest". Run pnpm lint, pnpm typecheck, pnpm test, pnpm build, and pnpm e2e.
```

### Acceptance Criteria

- Playwright is configured.
- Critical flows are covered.
- E2E tests can run locally.
- CI can run smoke E2E tests.
- Test data setup is deterministic.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm e2e` pass.

---

## 27.18 Milestone 17 — Production Readiness Pack, Hardening, and UAT
### Tasks

- Docker Compose production.
- Reverse proxy config.
- Backup scripts.
- Restore scripts.
- Smoke tests.
- Playwright tests.
- UAT docs.
- Cutover checklist.
- Performance seed.

### Production Readiness Pack Requirements

Production readiness must include operational runbooks and scripts, not only Docker configuration.

Required additions:

- `docker-compose.prod.yml`
- reverse proxy example configuration
- `.env.production.example`
- environment variable checklist
- database backup script
- database restore script
- smoke test script
- healthcheck script
- deployment guide
- rollback guide
- migration guide
- operations guide
- backup and restore guide
- performance seed script if feasible
- production readiness checklist

Recommended files:

- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS.md`
- `docs/BACKUP_RESTORE.md`
- `docs/ENVIRONMENT.md`
- `docs/ROLLBACK.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `scripts/smoke-test.sh`
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
- `scripts/healthcheck.sh`

Acceptance additions:

- A fresh operator can deploy the system using documentation.
- Backup and restore commands are documented and locally testable.
- Smoke tests verify API, web, database, Redis, auth, and core pages.
- Rollback path is documented.
- No production secrets are committed.

---

### Prompt

```text
Implement Milestone 17 Production Readiness Pack, Hardening, and UAT.
Add docker-compose.prod.yml, reverse proxy config, backup and restore scripts.
Add smoke tests and Playwright E2E for critical flows.
Add seed script for performance testing.
Create docs/RUNBOOK.md, docs/DEPLOYMENT.md, docs/UAT_CHECKLIST.md, docs/CUTOVER.md.
Ensure production readiness checklist passes.
```

### Acceptance Criteria

- Production Docker Compose boots.
- Backup script works.
- Restore script documented.
- E2E critical flows pass.
- UAT checklist complete.
- No hardcoded secret.

---

## 28. Definition of Ready

A story is ready if:

- User persona is clear.
- Business value is clear.
- Input/output data known.
- Acceptance criteria written.
- Permission requirement known.
- Audit requirement known.
- API or UI affected area known.
- Edge cases listed.
- Test expectation known.

---

## 29. Definition of Done

A story is done if:

- Code implemented.
- TypeScript strict passes.
- Lint passes.
- Unit tests pass.
- Relevant integration tests pass.
- UI has loading/empty/error states.
- API input validation exists.
- Permission checks exist.
- Audit log exists for write action.
- Errors use standard envelope.
- Logs contain request_id.
- Documentation updated if behavior changes.
- No dependency uses `"latest"`.
- No secret committed.
- Feature verified against acceptance criteria.

---

## 30. Production Readiness Checklist

### Application

- [ ] Auth enabled.
- [ ] RBAC enforced.
- [ ] All write actions audited.
- [ ] Health endpoints working.
- [ ] Error pages implemented.
- [ ] Rate limiting active.
- [ ] Upload limits active.
- [ ] Logs structured.
- [ ] Request ID enabled.

### Database

- [ ] Migrations applied.
- [ ] Indexes created.
- [ ] Backup configured.
- [ ] Restore tested.
- [ ] Data retention policy documented.
- [ ] Seed admin created.
- [ ] No test data in production.

### Sync

- [ ] OData credentials configured.
- [ ] Manual sync tested.
- [ ] Scheduled sync tested.
- [ ] Failed sync handling tested.
- [ ] Data freshness alert configured.
- [ ] Checkpoint validated.

### Security

- [ ] HTTPS enabled.
- [ ] Secure cookies.
- [ ] Secret not logged.
- [ ] `.env` not committed.
- [ ] User roles reviewed.
- [ ] File upload validation active.
- [ ] CSV injection protection active.

### Observability

- [ ] API logs visible.
- [ ] Worker logs visible.
- [ ] DB health visible.
- [ ] Redis health visible.
- [ ] Alert rules configured.
- [ ] Deployment log available.

### UAT

- [ ] PPIC signed off.
- [ ] Production signed off.
- [ ] Maintenance signed off.
- [ ] QC signed off.
- [ ] Admin signed off.
- [ ] Management signed off.

---

## 31. Open Questions Before Development

These should be answered before or during Milestone 0–1:

1. SSO provider apa yang tersedia: Google, Microsoft, Keycloak, atau local only?
2. Apakah aplikasi hanya internal/VPN atau akan diakses dari internet?
3. Berapa target data historis yang perlu dimigrasi?
4. Berapa interval sync OData yang diinginkan?
5. Apakah Business Central OData menyediakan Entry_No stabil untuk semua row?
6. Apakah ada working calendar per line/entity?
7. Apakah shift memiliki cut-off jam khusus?
8. Apakah target harian cukup, atau perlu target per shift?
9. Apakah reject pcs equivalent formula sudah final?
10. Apakah downtime WA punya format umum yang bisa dijadikan fixture?
11. Apakah PDF report wajib di v2.1 atau bisa v2.2?
12. Apakah notifikasi WhatsApp boleh digunakan?
13. Apakah ada kebijakan retensi audit log?
14. Siapa approver target?
15. Siapa PIC go-live dan rollback?

---

## 32. Initial Seed Data

### 32.1 Roles

```text
Admin
Manager
PPIC
ProductionLeader
Maintenance
QC
Viewer
```

### 32.2 Permissions

Use permission matrix from section 11.

### 32.3 App Settings

```json
{
  "timezone": "Asia/Jakarta",
  "targetMinPct": 95,
  "targetMaxPct": 110,
  "dataFreshnessWarningMinutes": 120,
  "dataFreshnessCriticalMinutes": 360,
  "defaultPlannedRuntimeHours": 24,
  "parserLowConfidenceThreshold": 70,
  "parserMediumConfidenceThreshold": 85
}
```

---

## 33. Documentation to Generate During Implementation

The coding agent must create/update:

```text
docs/ARCHITECTURE.md
docs/DATA_CONTRACT.md
docs/KPI_DEFINITIONS.md
docs/API_SPEC.md
docs/DATABASE_DESIGN.md
docs/SECURITY_MODEL.md
docs/DEPLOYMENT.md
docs/RUNBOOK.md
docs/OBSERVABILITY.md
docs/UAT_CHECKLIST.md
docs/CUTOVER.md
docs/BACKLOG.md
```

Each document can start concise but must be accurate and updated with actual implementation.

---

## 34. Coding Standards

### 34.1 TypeScript

- `strict: true`.
- No implicit any.
- No unsafe any unless isolated with explanation.
- Shared types in `packages/domain`.
- API client generated or typed.

### 34.2 Backend

- Controllers thin.
- Business logic in services.
- Database access in repositories.
- Validation at DTO/schema level.
- Guards for auth/permission.
- Interceptor for request ID and response envelope.
- Exception filter for error envelope.
- Audit service used for write actions.

### 34.3 Frontend

- Feature-based modules.
- No giant page file.
- Prefer server components for static shell.
- Use client components for interactive filters/charts/forms.
- Use TanStack Query for API calls.
- Use URL state for filters.
- Use accessible components.
- Keep chart and table components reusable.

### 34.4 Worker

- Jobs idempotent.
- Job payload typed.
- Retry/backoff configured.
- No secret in logs.
- Write job status.
- Use transactions for critical DB writes.

### 34.5 Database

- Use migrations.
- Do not modify production DB manually.
- All new columns documented.
- Index every common filter path.
- Avoid destructive migration without backup and approval.

---

## 35. Minimal Local Development Commands

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected local URLs:

```text
Web: http://localhost:3000
API: http://localhost:4000/api/v1/health
```

---

## 36. Minimal Production Deployment Commands

```bash
cp .env.example .env.production
# edit .env.production securely
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api pnpm db:migrate
docker compose -f docker-compose.prod.yml exec api pnpm db:seed:admin
curl https://ppic.example.local/api/v1/health
```

---

## 37. Acceptance for PRD v2.1

This PRD is considered execution-ready if:

- Coding agent can generate repo skeleton from it.
- Engineering can create sprint backlog from milestones.
- Stakeholders can validate MVP scope.
- QA can write test cases from acceptance criteria.
- Admin can understand deployment and UAT expectations.
- Product owner can cut scope using P0/P1/P2.

---

## 38. Final Implementation Priority

Build in this order:

1. Foundation.
2. Database/domain.
3. Auth/RBAC.
4. OData sync.
5. Output dashboard.
6. Target management.
7. Downtime management.
8. Import center.
9. WA parser.
10. Design system, UX workflow, and production polish.
11. Data quality/audit/health.
12. Master data and mapping center.
13. Data lineage and source traceability.
14. Notification and alert center.
15. Human-readable audit timeline and activity feed.
16. UAT mode, demo data, and guided testing pack.
17. Critical flow E2E automation.
18. Production readiness pack, hardening, and UAT.
19. UAT/cutover.

The platform should not be considered exceptional until the following product excellence foundations are implemented: master data mapping, source lineage, notification center, human-readable activity timeline, demo/UAT pack, E2E automation, and production readiness pack.

Do not build AI Insight Assistant before core sync, dashboard, downtime, audit, and data quality are stable.

---

## 39. References for Implementation

Use official documentation during implementation:

- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- Next.js App Router: https://nextjs.org/docs/app
- PostgreSQL documentation: https://www.postgresql.org/docs/current/
- PostgreSQL JSONB and GIN indexes: https://www.postgresql.org/docs/current/datatype-json.html
- BullMQ documentation: https://docs.bullmq.io/
- OpenTelemetry documentation: https://opentelemetry.io/docs/
- TanStack Query: https://tanstack.com/query
- TanStack Table: https://tanstack.com/table
- Zod: https://zod.dev/
- shadcn/ui: https://ui.shadcn.com/
- Drizzle ORM: https://orm.drizzle.team/
- Docker Compose: https://docs.docker.com/compose/

---

## 40. Appendix — Example Cursor/Windsurf Master Prompt

```text
I want to rebuild my existing PPIC dashboard into a production-grade PPIC Output Intelligence Platform.

Read docs/PRD.md fully and follow it as the source of truth.

Important:
- Build a modular monorepo using pnpm and Turborepo.
- Use Next.js App Router for web.
- Use NestJS or Fastify for API; prefer NestJS.
- Use PostgreSQL, Redis, BullMQ, TypeScript strict.
- Use Drizzle ORM unless there is a strong reason not to.
- Do not use SQLite for production.
- Do not use dependency "latest".
- Do not create huge files.
- Implement auth, RBAC, audit log, validation, error envelopes, health checks, and tests.
- Implement features milestone by milestone.
- Start with Milestone 0 only.
- After each milestone, run lint, typecheck, tests, and build.
- Explain changed files and how to run locally.
```

---

## 41. Appendix — Example First Implementation Prompt

```text
Implement Milestone 0 from docs/PRD.md.

Create:
- pnpm workspace
- Turborepo
- apps/web with Next.js App Router
- apps/api with NestJS
- apps/worker with Node.js TypeScript
- packages/db
- packages/domain
- packages/ui
- packages/config
- packages/api-client
- docker-compose.yml with postgres and redis
- .env.example
- GitHub Actions CI
- README with local setup

Constraints:
- TypeScript strict
- no dependency "latest"
- no hardcoded secrets
- scripts: dev, build, lint, typecheck, test
- each app/package must have clear package.json
- output should be production-oriented skeleton, not throwaway prototype
```

---

## 42. Appendix — Example Second Implementation Prompt

```text
Implement Milestone 1 from docs/PRD.md.

Create PostgreSQL schema and migrations for:
- users, roles, permissions
- master_entities, aliases, targets
- sync_runs, sync_checkpoints, staging, production_outputs
- downtime_events
- wa_parser_runs, wa_parser_rows
- import_runs
- data_quality_issues
- audit_logs
- action_items, notifications

Create:
- seed roles and permissions
- seed admin creation script
- domain KPI formula functions
- downtime duration helper
- natural key helper
- unit tests

Constraints:
- Use transactions where needed
- Use timestamptz for timestamps
- Store business dates as date
- Use Asia/Jakarta helper for business date handling
- Add indexes from PRD
- Do not implement UI yet
```

---

## 43. Appendix — Production Edge Cases

Implementation must handle:

- OData returns duplicate Entry_No.
- OData unavailable.
- OData slow response.
- OData returns malformed date.
- Quantity negative.
- Quantity zero.
- Gross weight missing.
- Machine unknown.
- Target missing.
- Target effective date overlap.
- Downtime start/end across midnight.
- Downtime without end time.
- Duplicate downtime from same WA paste.
- CSV header typo.
- XLSX empty rows.
- Import repeated file.
- Parser low confidence.
- User session expired.
- User permission changed while logged in.
- Export too large.
- Redis unavailable.
- Worker crashed mid-job.
- Database migration failed.
- Backup failed.
- Disk almost full.

---

## 44. Appendix — Manual QA Smoke Test

After deployment, run:

1. Open `/login`.
2. Login as Admin.
3. Open `/overview`.
4. Confirm health badge is visible.
5. Open `/settings/system-health`.
6. Confirm DB and Redis healthy.
7. Trigger manual OData sync with small range.
8. Confirm sync run success.
9. Open `/output`.
10. Apply date filter.
11. Click KPI drilldown.
12. Export filtered data.
13. Create downtime event.
14. Close downtime event with root cause/action.
15. Paste WA text in parser preview.
16. Commit one parsed row.
17. Open data quality cockpit.
18. Resolve one issue.
19. Open audit log.
20. Confirm all write actions logged.

---

## 45. Appendix — Go-Live Sign-Off Template

```text
Project: PPIC Output Intelligence Platform
Version: v2.1
Environment: Production
Go-Live Date:

Sign-off:
- PPIC:
- Produksi:
- Maintenance:
- QC:
- IT/Admin:
- Management:

Checklist:
[ ] KPI validated
[ ] Sync validated
[ ] Downtime validated
[ ] Target validated
[ ] Auth/RBAC validated
[ ] Backup/restore validated
[ ] Rollback plan approved
[ ] Users trained
[ ] Critical issues closed

Decision:
[ ] GO
[ ] NO-GO

Notes:
```

---

# PRD v3 — Enterprise Readiness and Operational Excellence Backlog

## Purpose

PRD v3 captures the enterprise-grade improvements that are intentionally deferred from v2. The v2 scope should stay focused on completing the core PPIC platform, UI/UX polish, data quality, audit, health, production hardening, and UAT readiness.

v3 should start only after the v2 platform is stable, tested, demoable, and accepted by users.

## v3 Product Direction

The v3 goal is to transform the PPIC Output Intelligence Platform from a production-ready internal dashboard into an enterprise-grade operations platform with stronger security, observability, performance, reliability, release discipline, configurability, retention, exception handling, and disaster recovery.

## v3 Scope Boundary

v3 should not be started until:

- core dashboard and KPI flows are stable
- OData/mock sync is stable
- target management is stable
- downtime workflow is stable
- import center is stable
- WhatsApp parser is stable
- data quality, audit, and health features are stable
- UI/UX polish is complete
- UAT/demo data pack exists
- critical E2E flows exist or are planned
- production readiness basics are complete

---

## v3.1 Security Hardening and Compliance

### Goal

Harden authentication, authorization, sessions, sensitive actions, API access, headers, and secrets handling so the platform is safer for real internal production use.

### Scope

- Security headers.
- CSRF review and protection where applicable.
- Rate limiting for login and sensitive endpoints.
- Brute-force protection.
- Password policy.
- Session expiration behavior.
- Refresh behavior if applicable.
- Login, logout, and failed login audit.
- Permission matrix documentation.
- Admin action confirmation.
- Secrets management guide.
- Vulnerability scan command.
- Dependency security audit command.
- Secure error handling so internal details are not exposed to users.

### Suggested Tasks

- Add request rate limiting for authentication endpoints.
- Add failed-login tracking.
- Add temporary lockout or cooldown after repeated failures.
- Add audit events for login, logout, failed login, role change, password change, and user deactivation.
- Add security headers at API/web layer.
- Review cookie/session settings.
- Add permission matrix documentation.
- Add secure production environment checklist.
- Add `pnpm security:audit` or equivalent script if feasible.

### Acceptance Criteria

- Login brute-force attempts are mitigated.
- Sensitive user/admin actions are audited.
- Security headers are configured.
- Permission matrix is documented.
- Secrets handling is documented.
- Security audit commands are documented.
- No production secrets are committed.

---

## v3.2 Observability Metrics, Logs, and Traces

### Goal

Make the platform observable enough to diagnose slow APIs, failed syncs, stuck queues, bad imports, parser failures, database issues, and user-facing errors.

### Scope

- Structured JSON logs.
- Request ID / correlation ID.
- API latency metrics.
- Error rate metrics.
- Queue metrics.
- Sync duration metrics.
- Import duration metrics.
- Parser duration metrics.
- Slow query logging.
- Health and readiness expansion.
- Observability dashboard or admin page.
- OpenTelemetry-ready instrumentation if feasible.
- Prometheus metrics endpoint if feasible.
- Grafana dashboard template if feasible.

### Suggested Tasks

- Add correlation ID middleware.
- Return correlation ID in error responses.
- Add structured logs for API requests and background jobs.
- Add metrics for sync, import, parser, dashboard queries, and queue jobs.
- Add worker heartbeat metric.
- Add `/metrics` endpoint if feasible.
- Add docs for log fields and metric names.
- Add dashboard or docs for observing system health.

### Acceptance Criteria

- Every API request has a correlation ID.
- Errors can be traced through logs.
- Sync/import/parser durations are logged or measured.
- Queue status is visible.
- Slow operations can be diagnosed.
- Observability docs exist.

---

## v3.3 SLO, SLA, and Operational Quality Targets

### Goal

Define measurable operational quality targets so the platform has clear expectations for speed, freshness, reliability, and recovery.

### Scope

- API p95 latency target.
- Dashboard load target.
- Sync success rate target.
- Import preview/commit duration target.
- Parser preview/commit duration target.
- Data freshness thresholds.
- Uptime target.
- Recovery Time Objective.
- Recovery Point Objective.
- Error budget concept if useful.

### Example Targets

- Dashboard overview p95 load time below 1.5 seconds for normal operational data.
- API p95 latency below 500ms for common read endpoints.
- Import preview for 5,000 rows below 10 seconds in local benchmark.
- Parser preview for 1,000 lines below 5 seconds in local benchmark.
- Sync success rate target at least 99% in stable environments.
- Data freshness warning after 30 minutes without successful sync.
- Critical stale warning after 60 minutes.
- RTO target documented.
- RPO target documented.

### Acceptance Criteria

- SLO/SLA document exists.
- Freshness thresholds are documented.
- Performance targets are measurable.
- Recovery targets are documented.
- Dashboard/health page reflects freshness and critical thresholds where relevant.

---

## v3.4 Performance, Load Testing, and Large Dataset Validation

### Goal

Prove the platform remains usable with realistic large operational datasets.

### Scope

- Large dataset seed.
- Dashboard load test.
- Import large file test.
- Parser large text test.
- Sync batch test.
- API response time check.
- Memory usage check where feasible.
- Large table pagination check.
- Performance notes and known limits.

### Suggested Dataset Targets

- 100,000 production output rows.
- 10,000 downtime events.
- 10,000 data quality issues.
- 1,000 target records.
- 5,000-row import preview.
- 1,000-line WhatsApp parser preview.
- 365 days of realistic output history if feasible.

### Suggested Commands

- `pnpm seed:large`
- `pnpm perf:dashboard`
- `pnpm perf:import`
- `pnpm perf:parser`

### Acceptance Criteria

- Large dataset can be seeded locally.
- Dashboard remains responsive with large data.
- Import/parser large inputs are tested.
- Pagination prevents unbounded table rendering.
- Performance limitations are documented.

---

## v3.5 Database Indexing and Query Optimization

### Goal

Keep operational dashboards and tables fast as data grows.

### Scope

- Review dashboard queries.
- Review downtime queries.
- Review target queries.
- Review import/parser run queries.
- Review data quality issue queries.
- Add indexes for common filters.
- Add composite indexes for common access paths.
- Add pagination enforcement.
- Add query timeout handling where feasible.
- Add `EXPLAIN ANALYZE` notes for heavy queries.

### Recommended Index Areas

- `production_outputs(business_date, machine_code, item_code)`
- `production_outputs(source_type, source_run_id)`
- `downtime_events(started_at, machine_code, status)`
- `targets(period_type, period_start, machine_code, item_code, status)`
- `data_quality_issues(status, severity, created_at)`
- `audit_logs(entity_type, entity_id, created_at)`
- `import_runs(status, created_at)`
- `import_rows(run_id, status)`
- `parser_runs(status, created_at)`
- `parser_rows(run_id, status)`

### Acceptance Criteria

- Common dashboard queries have appropriate indexes.
- Heavy queries have documented explain plans.
- Tables use pagination where needed.
- No user-facing page performs unsafe unbounded queries.
- Performance tests pass for expected data volume.

---

## v3.6 Reliability, Queue Resilience, and Idempotency

### Goal

Make sync, import, parser, and background processing safe to retry and resilient to partial failures.

### Scope

- Retry policy.
- Dead-letter queue.
- Job timeout.
- Job deduplication.
- Worker heartbeat.
- Queue dashboard/status.
- Stuck job detection.
- Manual retry failed job.
- Idempotency key for commit actions.
- Safe retry for import/parser commits.
- Partial failure handling.
- Clear job status UX.

### Suggested Tasks

- Add job IDs and idempotency keys.
- Add safe retry for OData sync.
- Add safe retry for import commit.
- Add safe retry for WhatsApp parser commit.
- Add failed job review UI.
- Add manual retry action for admins.
- Add dead-letter handling.
- Add worker health to system health page.

### Acceptance Criteria

- Failed jobs can be reviewed.
- Failed jobs can be retried safely where appropriate.
- Import/parser commit retry does not create duplicates.
- Stuck jobs are detectable.
- Worker health is visible.
- Queue failures are audited and surfaced to users/admins.

---

## v3.7 Release Management and CI/CD

### Goal

Make releases repeatable, validated, and safe.

### Scope

- GitHub Actions CI.
- Lint/typecheck/test/build pipeline.
- Migration check.
- Docker build check.
- Smoke test after deploy.
- Release notes.
- Versioning strategy.
- Changelog.
- Tag convention.
- Branching/release process documentation.

### Suggested Files

- `.github/workflows/ci.yml`
- `.github/workflows/docker-build.yml`
- `docs/RELEASE_PROCESS.md`
- `docs/CHANGELOG.md`
- `docs/VERSIONING.md`
- `docs/CI_CD.md`

### Suggested Pipeline

- Pull request: lint, typecheck, test, build.
- Main branch: lint, typecheck, test, build, Docker build.
- Release tag: production artifact build and release notes.
- Deployment: migration check and smoke test.

### Acceptance Criteria

- CI runs on pull requests.
- Main branch validates build and tests.
- Docker build is validated.
- Release process is documented.
- Versioning and tag convention are documented.
- Smoke test process is documented.

---

## v3.8 Feature Flags and Configurable Business Rules

### Goal

Allow safe rollout and operational configuration without code changes.

### Scope

- Feature flag model/config.
- Admin settings UI.
- Enable/disable WA parser.
- Enable/disable Import Center.
- Enable/disable notification rules.
- Enable/disable demo mode.
- Configurable business thresholds:
  - stale data threshold
  - achievement good/warning/critical threshold
  - reject rate alert threshold
  - downtime long-open threshold
  - import duplicate behavior
  - parser commit behavior
  - working calendar
  - shift definitions

### Suggested Tasks

- Add feature flag config layer.
- Add settings UI for operational thresholds.
- Add audit logs for settings changes.
- Add permission guard for settings management.
- Ensure critical feature flags fail safely.
- Ensure demo mode cannot be enabled in production accidentally.

### Acceptance Criteria

- Key features can be enabled/disabled safely.
- Business thresholds can be configured.
- Settings changes are audited.
- Feature flags respect permissions.
- Dangerous settings cannot be changed without confirmation.

---

## v3.9 Data Retention, Archiving, and Cleanup

### Goal

Control database growth and make long-term operation sustainable.

### Scope

- Retention policy for sync runs.
- Retention policy for import/parser row details.
- Retention policy for failed jobs.
- Audit log retention policy.
- Archive strategy for old production output if needed.
- Cleanup job for expired temporary data.
- Storage growth dashboard or report.
- Documentation for retention settings.

### Example Retention Policy

- Parser row detail retained for 180 days.
- Import row detail retained for 180 days.
- Sync run detail retained for 365 days.
- Failed jobs retained for 90 days.
- Audit logs retained for at least 2 years or per company policy.
- Aggregated dashboard data retained longer than raw temporary rows.

### Acceptance Criteria

- Retention policy is documented.
- Cleanup/archive scripts exist where appropriate.
- Cleanup jobs are safe and auditable.
- Important audit records are not accidentally deleted.
- Storage growth can be reviewed.

---

## v3.10 Error Catalog and Exception UX

### Goal

Make errors consistent, understandable, traceable, and safe for users and developers.

### Scope

- Standard error response format.
- Error code catalog.
- User-facing error copy.
- Technical details hidden by default.
- Correlation ID shown on error pages and toast details.
- Retry guidance.
- Validation error consistency.
- Module-specific error codes.

### Example Error Codes

- `AUTH_PERMISSION_DENIED`
- `AUTH_SESSION_EXPIRED`
- `TARGET_OVERLAP`
- `TARGET_NOT_APPROVED`
- `DOWNTIME_ALREADY_CLOSED`
- `IMPORT_DUPLICATE_ROWS`
- `IMPORT_INVALID_FILE`
- `PARSER_NO_VALID_ROWS`
- `SYNC_ODATA_TIMEOUT`
- `DATA_QUALITY_UNKNOWN_MACHINE`
- `DATA_QUALITY_UNKNOWN_ITEM`
- `DATA_QUALITY_MISSING_GROSS_WEIGHT`

### Suggested Files

- `docs/ERROR_CODES.md`
- `docs/EXCEPTION_HANDLING.md`

### Acceptance Criteria

- API errors follow a consistent format.
- UI shows understandable error messages.
- Correlation ID appears for unexpected errors.
- Error catalog is documented.
- Validation errors are field-specific where applicable.

---

## v3.11 Operational Command Center

### Goal

Add a single operational cockpit for supervisors/admins to monitor the most important system and production states.

### Suggested Route

- `/operations`

### Scope

- Sync status.
- Worker status.
- Queue status.
- Open downtime.
- Critical data quality issues.
- Missing targets.
- Failed imports/parsers.
- Pending approvals.
- Latest alerts.
- Recent audit/activity.
- Stale data status.
- Quick actions based on permission.

### UX Direction

The page should answer:

- What needs attention now?
- What is broken or stale?
- What workflows are waiting?
- What should an operator/admin do next?

### Acceptance Criteria

- Command center summarizes key operational risks.
- Users see prioritized alerts/actions.
- Quick actions respect permissions.
- The page uses existing APIs where possible.
- The page does not duplicate every dashboard detail unnecessarily.

---

## v3.12 Disaster Recovery Drill

### Goal

Ensure backup, restore, rollback, and recovery procedures are tested and documented.

### Scope

- Restore drill guide.
- Backup verification.
- Simulated database restore.
- RTO/RPO checklist.
- Rollback rehearsal.
- Migration rollback notes.
- Production incident checklist.
- Recovery communication template if useful.

### Suggested Files

- `docs/DISASTER_RECOVERY.md`
- `docs/RESTORE_DRILL.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/RTO_RPO.md`

### Suggested Scripts

- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
- `scripts/verify-backup.sh`
- `scripts/dr-restore-drill.sh`

### Acceptance Criteria

- A backup can be restored in a local drill.
- Restore steps are documented.
- Rollback procedure is documented.
- RTO/RPO targets are documented.
- Disaster recovery checklist exists.
- No production secrets are included in docs or scripts.

---

## v3 Recommended Execution Order

1. Security Hardening and Compliance
2. Observability Metrics, Logs, and Traces
3. SLO, SLA, and Operational Quality Targets
4. Performance, Load Testing, and Large Dataset Validation
5. Database Indexing and Query Optimization
6. Reliability, Queue Resilience, and Idempotency
7. Release Management and CI/CD
8. Feature Flags and Configurable Business Rules
9. Data Retention, Archiving, and Cleanup
10. Error Catalog and Exception UX
11. Operational Command Center
12. Disaster Recovery Drill

## v3 Definition of Excellent

The platform can be considered enterprise-grade excellent when:

- security controls are documented and tested
- observability can explain failures and slowdowns
- performance is validated with large data
- queue jobs are retry-safe and idempotent
- CI/CD validates changes before release
- key business rules are configurable
- old data can be retained, archived, or cleaned safely
- errors are consistent and traceable
- operators have a command center
- backup and restore have been tested through a drill

