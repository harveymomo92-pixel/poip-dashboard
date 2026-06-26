create table if not exists master_entity_conditional_rules (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references master_entities(id),
  source_system text not null default 'business-central',
  source_field text not null,
  source_value text not null,
  source_value_normalized text not null,
  condition_type text not null,
  condition_value text not null,
  condition_value_normalized text not null,
  source text not null default 'manual',
  is_active boolean not null default true,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists master_entity_conditional_rules_unique
on master_entity_conditional_rules (
  source_system,
  source_field,
  source_value_normalized,
  condition_type,
  condition_value_normalized,
  is_active
);

create index if not exists idx_master_conditional_rule_lookup
on master_entity_conditional_rules(source_system, source_field, source_value_normalized, is_active);

create index if not exists idx_master_conditional_rule_entity
on master_entity_conditional_rules(entity_id, is_active);

create index if not exists idx_outputs_source_entity_fields
on production_outputs(source_system, entity_id, normalized_output_type);
