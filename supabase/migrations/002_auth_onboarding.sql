-- Part 2: auth, onboarding, manager invites

-- Organizations: onboarding tracking
alter table public.organizations
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step integer not null default 1;

-- Manager invitations
create table if not exists public.manager_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            text not null default 'manager' check (role in ('admin', 'manager')),
  token           text not null unique,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  invited_by      uuid references public.managers(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists manager_invites_token_idx on public.manager_invites(token);
create index if not exists manager_invites_organization_id_idx on public.manager_invites(organization_id);

alter table public.manager_invites enable row level security;

-- Storage bucket for org logos (idempotent insert)
insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;
