-- Part 3: musician list management

-- MUSICIANS -------------------------------------------------------------------
create table if not exists public.musicians (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  position        text not null,
  rank            integer not null,
  notes           text,
  is_blacklisted  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, email)
);
create index if not exists musicians_organization_id_idx on public.musicians(organization_id);
create index if not exists musicians_position_idx on public.musicians(organization_id, position);

drop trigger if exists musicians_set_updated_at on public.musicians;
create trigger musicians_set_updated_at
  before update on public.musicians
  for each row execute function public.set_updated_at();

-- MUSICIAN AVAILABILITY (manager-managed unavailability windows) ---------------
create table if not exists public.musician_availability (
  id          uuid primary key default gen_random_uuid(),
  musician_id uuid not null references public.musicians(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists musician_availability_musician_id_idx on public.musician_availability(musician_id);

alter table public.musicians enable row level security;
alter table public.musician_availability enable row level security;
