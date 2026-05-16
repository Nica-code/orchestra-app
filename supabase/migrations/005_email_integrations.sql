-- Part 4: email integrations (per-manager connected email accounts)
-- NOTE: spec called this "003_email_integrations.sql" but 003 was already used
-- in Part 3 (musicians). Numbered 005 to keep migrations sequential.

create table if not exists public.email_integrations (
  id                       uuid primary key default gen_random_uuid(),
  manager_id               uuid not null references public.managers(id) on delete cascade,
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  provider                 text not null check (provider in ('gmail', 'outlook', 'smtp')),
  email_address            text not null,
  access_token             text,
  refresh_token            text,
  token_expires_at         timestamptz,
  smtp_host                text,
  smtp_port                integer,
  smtp_secure              boolean,
  smtp_username            text,
  smtp_password_encrypted  text,
  smtp_password_iv         text,
  smtp_from_name           text,
  is_active                boolean not null default true,
  connected_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (manager_id)
);
create index if not exists email_integrations_organization_id_idx on public.email_integrations(organization_id);

drop trigger if exists email_integrations_set_updated_at on public.email_integrations;
create trigger email_integrations_set_updated_at
  before update on public.email_integrations
  for each row execute function public.set_updated_at();

-- RLS: a manager can only access their own integration record
alter table public.email_integrations enable row level security;

drop policy if exists "managers manage own email integration" on public.email_integrations;
create policy "managers manage own email integration"
  on public.email_integrations
  for all
  using (
    manager_id in (
      select id from public.managers where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    manager_id in (
      select id from public.managers where user_id = auth.uid() and status = 'active'
    )
  );
