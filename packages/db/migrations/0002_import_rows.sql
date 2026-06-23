create table if not exists import_rows (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id),
  row_number int not null,
  raw_payload jsonb not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  natural_key text,
  row_hash text not null,
  status text not null default 'PENDING_REVIEW',
  issues jsonb not null default '[]'::jsonb,
  committed_entity_type text,
  committed_entity_id uuid,
  created_at timestamptz not null default now(),
  unique(import_run_id, row_number)
);

create index if not exists idx_import_rows_run_status
on import_rows(import_run_id, status);

create index if not exists idx_import_rows_natural_key
on import_rows(natural_key);
