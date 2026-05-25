-- Migration 012: Refactor concerts → generic projects
-- Removes concert-specific constraints, adds project-level template/deadline/variables,
-- and introduces recipient_groups for reusable ordered contact sequences.

-- ─── 1. Relax concerts table ─────────────────────────────────────────────────

-- Make dates optional (projects no longer require performance dates)
ALTER TABLE public.concerts ALTER COLUMN dates DROP NOT NULL;
ALTER TABLE public.concerts ALTER COLUMN dates SET DEFAULT NULL;

-- Expand status to include 'filled' (replaces 'completed' conceptually; keep
-- 'completed' for backward-compat with existing rows)
ALTER TABLE public.concerts DROP CONSTRAINT IF EXISTS concerts_status_check;
ALTER TABLE public.concerts ADD CONSTRAINT concerts_status_check
  CHECK (status IN ('draft', 'active', 'filled', 'completed', 'cancelled'));

-- Project-level default template (positions can still override per-position)
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Accept-deadline: how many hours to wait before auto-advancing
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS accept_deadline_hours integer NOT NULL DEFAULT 48;

-- Optional human-readable deadline sentence inserted into emails
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS accept_deadline_text text;

-- User-defined template variables, e.g. {"fee": "$200", "program": "Beethoven 5"}
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS custom_variables jsonb NOT NULL DEFAULT '{}';

-- ─── 2. Recipient Groups ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipient_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipient_groups_org_idx ON public.recipient_groups(organization_id);

DROP TRIGGER IF EXISTS recipient_groups_set_updated_at ON public.recipient_groups;
CREATE TRIGGER recipient_groups_set_updated_at
  BEFORE UPDATE ON public.recipient_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Recipient Group Members ───────────────────────────────────────────────
-- musician_id is nullable: NULL means this is an ad-hoc contact not in the
-- main contacts table. name + email are always required.

CREATE TABLE IF NOT EXISTS public.recipient_group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.recipient_groups(id) ON DELETE CASCADE,
  musician_id uuid REFERENCES public.musicians(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  rank        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);
CREATE INDEX IF NOT EXISTS rgm_group_idx ON public.recipient_group_members(group_id);

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.recipient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers manage own org recipient groups" ON public.recipient_groups;
CREATE POLICY "managers manage own org recipient groups"
  ON public.recipient_groups FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.managers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.managers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "managers manage own org group members" ON public.recipient_group_members;
CREATE POLICY "managers manage own org group members"
  ON public.recipient_group_members FOR ALL
  USING (
    group_id IN (
      SELECT g.id FROM public.recipient_groups g
      WHERE g.organization_id IN (
        SELECT organization_id FROM public.managers
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT g.id FROM public.recipient_groups g
      WHERE g.organization_id IN (
        SELECT organization_id FROM public.managers
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
