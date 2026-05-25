-- Migration 016: Mark auto-created compose templates so they stay hidden from the Templates list
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS is_one_off boolean NOT NULL DEFAULT false;

-- Back-fill: any existing auto-generated templates (named "[Compose] ...") are one-off
UPDATE public.email_templates
  SET is_one_off = true
  WHERE name LIKE '[Compose] %';
