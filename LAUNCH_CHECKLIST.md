# Callscade — Launch Checklist

Work through this before sharing with first real users.

## Security
- [ ] All API routes validate authentication
- [ ] All data queries filter by `organization_id`
- [ ] RLS policies enabled on all Supabase tables
- [ ] SMTP passwords encrypted at rest (AES-256-GCM)
- [ ] OAuth tokens not exposed to client
- [ ] Stripe webhook signature verified
- [ ] `CRON_SECRET` set and verified in cron routes
- [ ] No secrets in client-side code
- [ ] No `console.log` with sensitive data in production

## Stripe
- [ ] Stripe account in live mode (not test mode)
- [ ] All 4 price IDs created and added to env vars
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] Webhook events selected: subscription created/updated/deleted,
      invoice payment_succeeded/payment_failed, subscription trial_will_end
- [ ] Stripe Customer Portal configured and enabled
- [ ] Test end-to-end payment flow in test mode first
      (test card: `4242 4242 4242 4242`, any future expiry/CVC)

## Supabase
- [ ] RLS enabled on ALL tables
- [ ] All 11 migrations run in the production database
- [ ] Storage buckets exist: `organization-logos`, `template-attachments`
- [ ] Email auth enabled; "Confirm email" decision made for production
- [ ] SMTP configured in Supabase for auth emails

## Email (Resend)
- [ ] Sending domain verified in Resend
- [ ] `NOTIFY_FROM_EMAIL` uses the verified domain
- [ ] All notification email types tested

## Google Cloud (Gmail OAuth)
- [ ] OAuth consent screen configured; Gmail API enabled
- [ ] Production redirect URI added
- [ ] App verified, or test users added (gmail.send is a restricted scope —
      start verification early, it takes weeks)

## Microsoft Azure (Outlook OAuth)
- [ ] App registration complete; production redirect URI added
- [ ] Delegated permissions granted: Mail.Send, User.Read, offline_access

## Vercel
- [ ] All environment variables added to the Vercel dashboard
- [ ] Custom domain configured
- [ ] Cron jobs enabled (requires Vercel Pro)
- [ ] Function timeout appropriate for send functions

## Application
- [ ] Error boundaries on major routes (`app/error.tsx`, `app/dashboard/error.tsx`)
- [ ] 404 page (`app/not-found.tsx`)
- [ ] Forms validated client- and server-side
- [ ] Mobile responsive on all pages (test at 375px)
- [ ] Loading states on async actions
- [ ] Onboarding flow works end-to-end
- [ ] Landing page live and indexed
- [ ] Analytics verified in PostHog

## Testing
- [ ] Full signup flow
- [ ] Email connection (Gmail / Outlook / SMTP)
- [ ] CSV import with real data
- [ ] Full send flow: create concert → add position → start sending →
      accept → manager notified
- [ ] Decline flow (auto-advance to next)
- [ ] No-response cron
- [ ] Trial → paid conversion
- [ ] Overage billing
- [ ] Response page on a real mobile device
- [ ] All notification emails received and formatted correctly

**Most critical step: switching Stripe to live mode. Test the full flow in
production before launch.**
