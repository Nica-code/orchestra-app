-- Send mode: cascade (sequential) or broadcast (all at once, first-come-first-served)
alter table concert_positions
  add column if not exists send_mode text not null default 'cascade'
    check (send_mode in ('cascade', 'broadcast'));

-- Editable "position already filled" message shown when someone opens a blocked link
alter table concerts
  add column if not exists filled_message text;
