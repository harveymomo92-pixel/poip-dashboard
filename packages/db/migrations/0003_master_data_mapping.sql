alter table master_entity_aliases
  add column if not exists source_system text not null default 'business-central',
  add column if not exists source_field text not null default 'machine_center_no',
  add column if not exists alias_normalized text,
  add column if not exists match_confidence numeric(5,2),
  add column if not exists created_by uuid references users(id),
  add column if not exists updated_by uuid references users(id),
  add column if not exists updated_at timestamptz not null default now();

update master_entity_aliases
set alias_normalized = upper(regexp_replace(trim(coalesce(alias, '')), '[^A-Za-z0-9]+', '', 'g'))
where alias_normalized is null;

update master_entity_aliases
set match_confidence = confidence
where match_confidence is null and confidence is not null;

alter table master_entity_aliases
  alter column alias_normalized set not null;

create index if not exists idx_master_alias_lookup
on master_entity_aliases(source_system, source_field, alias_normalized)
where is_active = true;

create index if not exists idx_master_alias_entity
on master_entity_aliases(entity_id, is_active);

create table if not exists item_conversion_mappings (
  id uuid primary key default gen_random_uuid(),
  item_no text not null,
  uom text not null default '',
  gross_weight_per_pcs numeric(18,6) not null,
  source text not null default 'manual',
  is_active boolean not null default true,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists item_conversion_active_unique
on item_conversion_mappings(upper(item_no), upper(coalesce(uom, '')))
where is_active = true;

create index if not exists idx_item_conversion_lookup
on item_conversion_mappings(upper(item_no), upper(coalesce(uom, '')), is_active);

create index if not exists idx_outputs_prod_line_no
on production_outputs(prod_line_no);

create index if not exists idx_outputs_prod_line_description
on production_outputs(prod_line_description);

