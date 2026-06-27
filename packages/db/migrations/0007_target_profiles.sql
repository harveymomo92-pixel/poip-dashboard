create table if not exists target_profiles (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references master_entities(id),
  machine_center_no text,
  machine_center_no_normalized text,
  target_bucket text not null,
  target_bucket_normalized text not null,
  effective_from date not null,
  effective_to date,
  target_qty numeric(18, 4) not null,
  unit text not null default 'PCS',
  is_active boolean not null default true,
  approval_status text not null default 'draft',
  source text not null default 'manual',
  notes text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_target_profiles_lookup_exact
on target_profiles (
  entity_id,
  target_bucket_normalized,
  machine_center_no_normalized,
  effective_from
);

create index if not exists idx_target_profiles_lookup_bucket
on target_profiles (
  entity_id,
  target_bucket_normalized,
  effective_from
);

create index if not exists idx_target_profiles_active_approval
on target_profiles (is_active, approval_status);
