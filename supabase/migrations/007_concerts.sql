-- Part 6: concerts, positions, and position musician lists
-- NOTE: spec called this "005_concerts.sql" but 005 was already used in Part 4
-- (email_integrations). Numbered 007 to keep migrations sequential.

create table if not exists public.concerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid references public.managers(id) on delete set null,
  name            text not null,
  dates           date[] not null,
  rehearsal_dates date[],
  venue           text,
  notes           text,
  status          text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists concerts_organization_id_idx on public.concerts(organization_id);

create table if not exists public.concert_positions (
  id                     uuid primary key default gen_random_uuid(),
  concert_id             uuid not null references public.concerts(id) on delete cascade,
  position_name          text not null,
  musicians_needed       integer not null default 1,
  template_id            uuid references public.email_templates(id) on delete set null,
  response_deadline_type text not null default 'days' check (response_deadline_type in ('days', 'specific_date')),
  response_deadline_days integer default 2,
  response_deadline_date timestamptz,
  auto_resend_enabled    boolean not null default false,
  auto_resend_days       integer default 2,
  status                 text not null default 'pending' check (status in ('pending', 'active', 'filled', 'exhausted', 'cancelled')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists concert_positions_concert_id_idx on public.concert_positions(concert_id);

create table if not exists public.concert_position_musicians (
  id                  uuid primary key default gen_random_uuid(),
  concert_position_id uuid not null references public.concert_positions(id) on delete cascade,
  musician_id         uuid not null references public.musicians(id) on delete cascade,
  rank                integer not null,
  status              text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'declined', 'no_response', 'skipped')),
  sent_at             timestamptz,
  responded_at        timestamptz,
  skip_reason         text,
  created_at          timestamptz not null default now(),
  unique (concert_position_id, musician_id)
);
create index if not exists cpm_concert_position_id_idx on public.concert_position_musicians(concert_position_id);

drop trigger if exists concerts_set_updated_at on public.concerts;
create trigger concerts_set_updated_at before update on public.concerts
  for each row execute function public.set_updated_at();

drop trigger if exists concert_positions_set_updated_at on public.concert_positions;
create trigger concert_positions_set_updated_at before update on public.concert_positions
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.concerts enable row level security;
alter table public.concert_positions enable row level security;
alter table public.concert_position_musicians enable row level security;

drop policy if exists "managers manage own org concerts" on public.concerts;
create policy "managers manage own org concerts"
  on public.concerts for all
  using (
    organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
  )
  with check (
    organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
  );

drop policy if exists "managers manage own org concert positions" on public.concert_positions;
create policy "managers manage own org concert positions"
  on public.concert_positions for all
  using (
    concert_id in (
      select c.id from public.concerts c
      where c.organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
    )
  )
  with check (
    concert_id in (
      select c.id from public.concerts c
      where c.organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
    )
  );

drop policy if exists "managers manage own org position musicians" on public.concert_position_musicians;
create policy "managers manage own org position musicians"
  on public.concert_position_musicians for all
  using (
    concert_position_id in (
      select cp.id from public.concert_positions cp
      join public.concerts c on c.id = cp.concert_id
      where c.organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
    )
  )
  with check (
    concert_position_id in (
      select cp.id from public.concert_positions cp
      join public.concerts c on c.id = cp.concert_id
      where c.organization_id in (select organization_id from public.managers where user_id = auth.uid() and status = 'active')
    )
  );
