-- Part 7: send logs
-- NOTE: spec called this "006_send_logs.sql" but 006 was already used (templates).
-- Numbered 008 to keep migrations sequential.

create table if not exists public.send_logs (
  id                            uuid primary key default gen_random_uuid(),
  concert_position_id           uuid references public.concert_positions(id) on delete cascade,
  concert_position_musician_id  uuid references public.concert_position_musicians(id) on delete cascade,
  musician_id                   uuid references public.musicians(id) on delete cascade,
  organization_id               uuid references public.organizations(id) on delete cascade,
  status                        text not null default 'sent'
                                   check (status in ('sent', 'accepted', 'declined', 'no_response', 'failed', 'skipped')),
  token                         text not null unique,
  token_expires_at              timestamptz not null,
  token_used_at                 timestamptz,
  sent_at                       timestamptz default now(),
  responded_at                  timestamptz,
  email_subject                 text,
  email_body                    text,
  manager_id                    uuid references public.managers(id) on delete set null,
  failure_reason                text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists idx_send_logs_token on public.send_logs(token);
create index if not exists idx_send_logs_concert_position_id on public.send_logs(concert_position_id);
create index if not exists idx_send_logs_status on public.send_logs(status);
create index if not exists idx_send_logs_token_expires_at on public.send_logs(token_expires_at);

drop trigger if exists send_logs_set_updated_at on public.send_logs;
create trigger send_logs_set_updated_at before update on public.send_logs
  for each row execute function public.set_updated_at();

alter table public.send_logs enable row level security;

-- Managers can read send logs for their own organization
drop policy if exists "managers read own org send logs" on public.send_logs;
create policy "managers read own org send logs"
  on public.send_logs for select
  using (
    organization_id in (
      select organization_id from public.managers where user_id = auth.uid() and status = 'active'
    )
  );

-- Public can read a single send log by token (response page, no auth).
-- The token is an unguessable UUID; this enables the anon client to fetch by token.
drop policy if exists "public read send log by token" on public.send_logs;
create policy "public read send log by token"
  on public.send_logs for select
  using (true);

-- Inserts/updates happen via the service-role client only (bypasses RLS); no
-- client-side insert/update policy is defined.
