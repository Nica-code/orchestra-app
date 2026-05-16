-- Part 5: email templates + attachments
-- NOTE: spec called this "004_templates.sql" but 004 was already used in Part 3
-- (RLS policies). Numbered 006 to keep migrations sequential.

create table if not exists public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  subject         text not null,
  body            text not null,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists email_templates_organization_id_idx on public.email_templates(organization_id);

create table if not exists public.template_attachments (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.email_templates(id) on delete cascade,
  file_name   text not null,
  file_url    text not null,
  file_size   integer not null,
  mime_type   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists template_attachments_template_id_idx on public.template_attachments(template_id);

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.email_templates enable row level security;
alter table public.template_attachments enable row level security;

drop policy if exists "managers manage own org templates" on public.email_templates;
create policy "managers manage own org templates"
  on public.email_templates for all
  using (
    organization_id in (
      select organization_id from public.managers where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    organization_id in (
      select organization_id from public.managers where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "managers manage own org template attachments" on public.template_attachments;
create policy "managers manage own org template attachments"
  on public.template_attachments for all
  using (
    template_id in (
      select t.id from public.email_templates t
      where t.organization_id in (
        select organization_id from public.managers where user_id = auth.uid() and status = 'active'
      )
    )
  )
  with check (
    template_id in (
      select t.id from public.email_templates t
      where t.organization_id in (
        select organization_id from public.managers where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- Storage bucket for template attachments
insert into storage.buckets (id, name, public)
values ('template-attachments', 'template-attachments', true)
on conflict (id) do nothing;
