-- Part 9: notifications + preferences
-- NOTE: spec called this "008_notifications.sql" but 008 was already used
-- (send_logs). Numbered 010 to keep migrations sequential.

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  manager_id      uuid references public.managers(id) on delete cascade,
  type            text not null,
  title           text not null,
  message         text not null,
  action_url      text,
  read            boolean not null default false,
  read_at         timestamptz,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_notifications_manager_id on public.notifications(manager_id);
create index if not exists idx_notifications_read on public.notifications(read) where read = false;
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

create table if not exists public.notification_preferences (
  id                   uuid primary key default gen_random_uuid(),
  manager_id           uuid not null unique references public.managers(id) on delete cascade,
  accepted_email       boolean not null default true,
  accepted_inapp       boolean not null default true,
  declined_email       boolean not null default true,
  declined_inapp       boolean not null default true,
  no_response_email    boolean not null default true,
  no_response_inapp    boolean not null default true,
  exhausted_email      boolean not null default true,
  exhausted_inapp      boolean not null default true,
  limit_warning_email  boolean not null default true,
  limit_warning_inapp  boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- Track payment-failed state for the dashboard banner
alter table public.plans add column if not exists payment_failed boolean not null default false;

-- RLS ------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "managers access own notifications" on public.notifications;
create policy "managers access own notifications"
  on public.notifications for select
  using (
    manager_id in (select id from public.managers where user_id = auth.uid() and status = 'active')
  );

drop policy if exists "managers update own notifications" on public.notifications;
create policy "managers update own notifications"
  on public.notifications for update
  using (
    manager_id in (select id from public.managers where user_id = auth.uid() and status = 'active')
  );

drop policy if exists "managers access own notification prefs" on public.notification_preferences;
create policy "managers access own notification prefs"
  on public.notification_preferences for all
  using (
    manager_id in (select id from public.managers where user_id = auth.uid() and status = 'active')
  )
  with check (
    manager_id in (select id from public.managers where user_id = auth.uid() and status = 'active')
  );
