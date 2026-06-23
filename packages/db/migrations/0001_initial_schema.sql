create extension if not exists pgcrypto;

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

create table master_entities (
  id uuid primary key default gen_random_uuid(),
  entity_code text not null unique,
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
  updated_at timestamptz not null default now()
);

create table master_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references master_entities(id),
  alias text not null unique,
  source text not null default 'manual',
  confidence numeric(5,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
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
  natural_key text not null unique,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_downtime_event_date on downtime_events(event_date);
create index idx_downtime_entity_date on downtime_events(entity_id, event_date);
create index idx_downtime_status on downtime_events(status);

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
