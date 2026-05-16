-- Part 10: usage tracking & billing
-- NOTE: spec called this "009_usage.sql" but 009 was already used (activity_logs).
-- Numbered 011 to keep migrations sequential.

-- plans: additional billing columns (send_count/send_limit/billing_period_start
-- and payment_failed already exist from earlier migrations).
alter table public.plans add column if not exists billing_period_end timestamptz;
alter table public.plans add column if not exists overage_count integer not null default 0;
alter table public.plans add column if not exists stripe_price_id text;
alter table public.plans add column if not exists pending_plan_type text;
alter table public.plans add column if not exists cancels_at timestamptz;

create table if not exists public.usage_history (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references public.organizations(id) on delete cascade,
  billing_period_start  timestamptz not null,
  billing_period_end    timestamptz not null,
  plan_type             text not null,
  send_limit            integer not null,
  send_count            integer not null default 0,
  overage_count         integer not null default 0,
  overage_charged       boolean not null default false,
  overage_amount_cents  integer not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists idx_usage_history_organization_id on public.usage_history(organization_id);
create index if not exists idx_usage_history_billing_period on public.usage_history(billing_period_start desc);

create table if not exists public.stripe_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  stripe_event_id  text unique not null,
  event_type       text not null,
  processed_at     timestamptz not null default now()
);

alter table public.usage_history enable row level security;

drop policy if exists "managers read own org usage history" on public.usage_history;
create policy "managers read own org usage history"
  on public.usage_history for select
  using (
    organization_id in (
      select organization_id from public.managers where user_id = auth.uid() and status = 'active'
    )
  );

-- Atomic send-count increment helper (avoids read-then-write races).
create or replace function public.increment_send_count(org_id uuid)
returns table (new_count integer, limit_value integer)
language plpgsql security definer as $$
begin
  return query
  update public.plans
    set send_count = send_count + 1
  where organization_id = org_id
  returning send_count, send_limit;
end;
$$;
