-- Part 8: activity logs
-- NOTE: spec called this "007_activity_logs.sql" but 007 was already used
-- (concerts). Numbered 009 to keep migrations sequential.

create table if not exists public.activity_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  manager_id      uuid references public.managers(id) on delete set null,
  action          text not null,
  entity_type     text,
  entity_id       uuid,
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_activity_logs_organization_id on public.activity_logs(organization_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "managers read own org activity" on public.activity_logs;
create policy "managers read own org activity"
  on public.activity_logs for select
  using (
    organization_id in (
      select organization_id from public.managers where user_id = auth.uid() and status = 'active'
    )
  );
-- Inserts happen via the service-role client only.
