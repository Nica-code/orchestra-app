# FirstCall

A web SaaS that helps orchestra managers automate finding substitute musicians.
Managers build ranked musician lists, and FirstCall emails them one at a time —
automatically advancing to the next musician on decline or no-response.

## Tech stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (Postgres + RLS)
- **Payments:** Stripe
- **System email:** Resend
- **Outbound email:** Gmail API, Microsoft Graph, Nodemailer (SMTP)
- **Analytics:** PostHog
- **Hosting:** Vercel

## Local development

1. Clone the repo.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in values
   (see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)).
4. Run the SQL migrations in `supabase/migrations/` in order, via the
   Supabase SQL Editor (001 → 011).
5. `npm run dev` → http://localhost:3000

## Project structure

- `app/` — routes (App Router). `app/dashboard/*` is the authenticated app;
  `app/api/*` is the API; `app/response/[token]` is the public musician page.
- `lib/` — core logic: `sendEngine.ts` (sequential sending), `usage.ts`
  (billing/usage), `notifications.ts`, `email.ts` (Gmail/Outlook/SMTP router),
  `templateEngine.ts`, Supabase clients.
- `components/` — UI, organized by feature.
- `supabase/migrations/` — numbered SQL migrations.
- `hooks/` — client hooks (`useCurrentPlan`, `useSendStatus`, `useCountdown`).

## Architecture notes

- API routes use the Supabase service-role client; per-organization isolation
  is enforced in code. RLS policies are defense-in-depth.
- The send engine never hard-blocks at the plan limit — it charges overage.
- Two Vercel Cron jobs: hourly no-response check, monthly billing reset.

## Deployment

Deploy to Vercel. Add all environment variables from
[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) to the Vercel project,
configure the Stripe webhook endpoint, then work through
[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) before going live.
