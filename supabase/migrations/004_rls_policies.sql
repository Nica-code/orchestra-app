-- Part 3: Row Level Security policies for musicians + musician_availability.
-- Note: the app's API routes use the service-role client, which bypasses RLS.
-- These policies are defense-in-depth for any direct (anon/authenticated) access.

-- Helper: orgs the current auth user manages
-- (inlined as subquery in each policy to avoid a SECURITY DEFINER function)

-- MUSICIANS -------------------------------------------------------------------
alter table public.musicians enable row level security;

drop policy if exists "managers manage own org musicians" on public.musicians;
create policy "managers manage own org musicians"
  on public.musicians
  for all
  using (
    organization_id in (
      select organization_id from public.managers
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    organization_id in (
      select organization_id from public.managers
      where user_id = auth.uid() and status = 'active'
    )
  );

-- MUSICIAN AVAILABILITY -------------------------------------------------------
alter table public.musician_availability enable row level security;

drop policy if exists "managers manage own org availability" on public.musician_availability;
create policy "managers manage own org availability"
  on public.musician_availability
  for all
  using (
    musician_id in (
      select m.id from public.musicians m
      where m.organization_id in (
        select organization_id from public.managers
        where user_id = auth.uid() and status = 'active'
      )
    )
  )
  with check (
    musician_id in (
      select m.id from public.musicians m
      where m.organization_id in (
        select organization_id from public.managers
        where user_id = auth.uid() and status = 'active'
      )
    )
  );
