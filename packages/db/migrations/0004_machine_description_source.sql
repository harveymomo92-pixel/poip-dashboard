alter table production_outputs
  add column if not exists machine_description text;

update production_outputs
set machine_description = upper(nullif(btrim(coalesce(
  raw_payload ->> 'Machine_Description',
  raw_payload ->> 'MachineDescription',
  raw_payload ->> 'Machine Description',
  raw_payload ->> 'machine_description'
)), ''))
where machine_description is null
  and nullif(btrim(coalesce(
    raw_payload ->> 'Machine_Description',
    raw_payload ->> 'MachineDescription',
    raw_payload ->> 'Machine Description',
    raw_payload ->> 'machine_description'
  )), '') is not null;

create index if not exists idx_outputs_machine_description_date
on production_outputs(machine_description, posting_date);
