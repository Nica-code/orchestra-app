-- Orchestra App initial schema
-- Part 1: organizations, managers, plans

create extension if not exists "pgcrypto";

-- ORGANIZATIONS ---------------------------------------------------------------
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- MANAGERS --------------------------------------------------------------------
create table if not exists public.managers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  email           text not null,
  role            text not null default 'manager' check (role in ('admin', 'manager')),
  status          text not null default 'active' check (status in ('active', 'pending')),
  created_at      timestamptz not null default now()
);
create index if not exists managers_organization_id_idx on public.managers(organization_id);
create index if not exists managers_user_id_idx on public.managers(user_id);

-- PLANS -----------------------------------------------------------------------
create table if not exists public.plans (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  plan_type               text not null default 'starter' check (plan_type in ('starter', 'pro')),
  send_count              integer not null default 0,
  send_limit              integer not null default 500,
  billing_period_start    timestamptz not null default now(),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  trial_ends_at           timestamptz,
  status                  text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists plans_organization_id_idx on public.plans(organization_id);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- RLS: enabled by default; policies will be added in later migrations
alter table public.organizations enable row level security;
alter table public.managers enable row level security;
alter table public.plans enable row level security;
