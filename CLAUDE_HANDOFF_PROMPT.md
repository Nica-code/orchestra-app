# Claude Code / Codex — Project Handoff Prompt

Paste the section below into a new Claude Code (or Codex) session at the start
of work on this project. It briefs the assistant on what the project is, where
context lives, and what's already been done.

---

## PASTE THIS:

I'm continuing work on **FirstCall** (working title), a Next.js 14 + Supabase
SaaS for orchestra managers that automates substitute musician outreach.
Managers build ranked musician lists; the app emails them one at a time and
auto-advances on decline / no-response.

**Repo:** https://github.com/Nica-code/orchestra-app (clone is at this
working directory).

**Tech stack:** Next.js 14 App Router (TypeScript) · Tailwind · Supabase
(Postgres + RLS + auth + storage) · Stripe billing · Resend (system email) ·
Gmail API / Microsoft Graph / Nodemailer for outbound · PostHog · Vercel.

**Status: all 11 build parts are complete.** The app builds clean
(`npm run build` passes). 11 SQL migrations exist in `supabase/migrations/`
(numbered 001–011). The full feature set is in place: auth + onboarding +
Stripe billing, musician CRUD + CSV import + ranked lists + blacklist +
availability, email integration (Gmail/Outlook/SMTP) with unified router,
template editor + variable engine, concert + position management with
musician-list snapshot, the sequential send engine + accept/decline response
page + hourly no-response cron, activity log + dashboard + send log,
notifications (in-app + email + preferences + bell), usage tracking +
overage billing + plan upgrade/downgrade flow, and a public marketing
landing page at `/`.

**Detailed memory:** I've been saving per-part progress notes at
`~/.claude/projects/<encoded-path>/memory/`. Please read `MEMORY.md` (the
index) and the individual `partN_progress.md` files BEFORE proposing
changes — each one lists decisions made, deviations from the original
spec, and items left partial. The most important context lives in
`architecture_decisions.md` and `external_accounts.md`.

**Pre-launch work that's still pending** (see `LAUNCH_CHECKLIST.md` and
`ENVIRONMENT_VARIABLES.md` in the repo root):
- Stripe price IDs not yet filled in `.env.local`
  (var names: `STRIPE_PRICE_STARTER_MONTHLY`, `_ANNUAL`,
  `STRIPE_PRICE_PRO_MONTHLY`, `_ANNUAL`)
- Google + Microsoft OAuth credentials still empty (Gmail/Outlook won't
  connect until those are set up). SMTP works today.
- Resend domain not verified — notification emails currently use the
  `onboarding@resend.dev` placeholder
- Not yet deployed to Vercel

**Conventions I want you to follow:**
- Add new SQL migrations as `supabase/migrations/NNN_*.sql` with the next
  sequential number; user runs them manually via the Supabase SQL Editor.
- API routes use the service-role client; per-org isolation is enforced
  in code (RLS is defense-in-depth).
- The send engine never hard-blocks at the send limit — it charges overage.
- Use the existing UI primitives in `components/ui/` and the patterns from
  the existing pages.
- When you make changes, run `npx tsc --noEmit` and `npm run build` before
  declaring success.

Please confirm you've read the memory files, then ask what I'd like to work
on next.

---

## How memory works across machines

The memory files travel with the handoff bundle, restored to
`~/.claude/projects/<encoded-project-path>/memory/`. The "encoded path" is
the project's absolute path with `/` replaced by `-`. If you install the
project at `~/Downloads/Apps/orchestra-app`, the encoded dir is
`-Users-<you>-Downloads-Apps-orchestra-app`. The setup script handles this
automatically.
