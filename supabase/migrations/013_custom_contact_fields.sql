-- Custom field definitions per organization
create table if not exists custom_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label         text not null,
  field_type    text not null default 'text'
                  check (field_type in ('text','number','date','boolean','select')),
  options       text[] default null,   -- for field_type = 'select'
  is_required   boolean not null default false,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

alter table custom_field_definitions enable row level security;
create policy "org members can manage custom fields"
  on custom_field_definitions for all
  using (organization_id in (
    select organization_id from managers where user_id = auth.uid()
  ));

-- Store custom field values on each musician as JSONB { field_id: value }
alter table musicians
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- Index for lookups
create index if not exists idx_custom_field_defs_org
  on custom_field_definitions(organization_id, display_order);
