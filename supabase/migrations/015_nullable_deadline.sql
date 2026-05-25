-- Migration 015: Make accept_deadline_hours nullable (supports "no deadline" option)
ALTER TABLE public.concerts ALTER COLUMN accept_deadline_hours DROP NOT NULL;
ALTER TABLE public.concerts ALTER COLUMN accept_deadline_hours SET DEFAULT NULL;

-- Also widen response_deadline_type to allow 'none' (for positions with no expiry)
ALTER TABLE public.concert_positions DROP CONSTRAINT IF EXISTS concert_positions_response_deadline_type_check;
ALTER TABLE public.concert_positions ADD CONSTRAINT concert_positions_response_deadline_type_check
  CHECK (response_deadline_type IN ('days', 'specific_date', 'none'));
