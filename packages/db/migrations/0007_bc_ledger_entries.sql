do $$
begin
  if to_regclass('public.bc_ledger_entries') is null
     and to_regclass('public.production_outputs') is not null then
    alter table public.production_outputs rename to bc_ledger_entries;
  end if;

  if to_regclass('public.bc_ledger_entry_staging') is null
     and to_regclass('public.production_output_staging') is not null then
    alter table public.production_output_staging rename to bc_ledger_entry_staging;
  end if;
end $$;

alter table public.bc_ledger_entries
  add column if not exists bc_domain text not null default 'UNKNOWN_REVIEW',
  add column if not exists movement_domain text not null default 'UNKNOWN_REVIEW',
  add column if not exists movement_status text not null default 'UNCLASSIFIED',
  add column if not exists mapping_status text not null default 'UNMAPPED_NEEDS_REVIEW',
  add column if not exists source_identity_field text,
  add column if not exists source_identity_value text,
  add column if not exists dashboard_ready boolean not null default false,
  add column if not exists future_use_ready boolean not null default false,
  add column if not exists classification_reason text,
  add column if not exists mapping_reason text,
  add column if not exists classified_at timestamptz,
  add column if not exists mapped_at timestamptz;

alter table public.bc_ledger_entry_staging
  add column if not exists bc_domain text,
  add column if not exists movement_domain text,
  add column if not exists movement_status text,
  add column if not exists mapping_status text,
  add column if not exists source_identity_field text,
  add column if not exists source_identity_value text,
  add column if not exists classification_reason text,
  add column if not exists mapping_reason text;

create index if not exists idx_bc_ledger_entries_posting_date
  on public.bc_ledger_entries(posting_date);
create index if not exists idx_bc_ledger_entries_entry_no
  on public.bc_ledger_entries(entry_no);
create index if not exists idx_bc_ledger_entries_entry_type
  on public.bc_ledger_entries(entry_type);
create index if not exists idx_bc_ledger_entries_normalized_output_type
  on public.bc_ledger_entries(normalized_output_type);
create index if not exists idx_bc_ledger_entries_bc_domain
  on public.bc_ledger_entries(bc_domain);
create index if not exists idx_bc_ledger_entries_movement_domain
  on public.bc_ledger_entries(movement_domain);
create index if not exists idx_bc_ledger_entries_movement_status
  on public.bc_ledger_entries(movement_status);
create index if not exists idx_bc_ledger_entries_mapping_status
  on public.bc_ledger_entries(mapping_status);
create index if not exists idx_bc_ledger_entries_entity_id
  on public.bc_ledger_entries(entity_id);
create index if not exists idx_bc_ledger_entries_dashboard_ready
  on public.bc_ledger_entries(dashboard_ready);
create index if not exists idx_bc_ledger_entries_future_use_ready
  on public.bc_ledger_entries(future_use_ready);
create index if not exists idx_bc_ledger_entries_prod_line_description
  on public.bc_ledger_entries(prod_line_description);
create index if not exists idx_bc_ledger_entries_prod_line_no
  on public.bc_ledger_entries(prod_line_no);
create index if not exists idx_bc_ledger_entries_machine_center_no
  on public.bc_ledger_entries(machine_center_no);

create or replace view public.production_output_kpi_rows as
select *
from public.bc_ledger_entries
where bc_domain = 'PRODUCTION_OUTPUT'
  and mapping_status = 'MAPPED_READY'
  and dashboard_ready = true;

create or replace view public.reject_attachment_rows as
select *
from public.bc_ledger_entries
where bc_domain in ('REJECT_ATTACHMENT', 'SCRAP_OR_WASTE');

create or replace view public.future_use_movement_rows as
select *
from public.bc_ledger_entries
where bc_domain in (
  'TRANSFER_OR_INVENTORY',
  'CONSUMPTION_OR_MATERIAL_USAGE',
  'SALES',
  'PURCHASE_OR_RECEIVING',
  'SPAREPART_OR_MATERIAL',
  'SCRAP_OR_WASTE'
);

create or replace view public.bc_ledger_review_rows as
select *
from public.bc_ledger_entries
where mapping_status in (
    'MAPPED_FALLBACK_REVIEW',
    'UNMAPPED_SOURCE_GAP',
    'UNMAPPED_NEEDS_REVIEW',
    'BLOCKED_UNSAFE'
  )
  or bc_domain in ('SOURCE_DATA_GAP', 'UNKNOWN_REVIEW');

create or replace view public.production_outputs as
select *
from public.bc_ledger_entries;

create or replace view public.production_output_staging as
select *
from public.bc_ledger_entry_staging;
