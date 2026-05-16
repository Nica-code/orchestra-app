# FirstCall — Environment Variables

Copy `.env.example` to `.env.local` and fill in the values below.
`NEXT_PUBLIC_*` variables are exposed to the browser — never put secrets in them.

## Supabase — required
| Variable | Where to get it | Client-safe |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon key) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role) | **No — server only** |

## Stripe — required for billing
| Variable | Where to get it | Client-safe |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | No |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → signing secret | No |
| `STRIPE_PRICE_STARTER_MONTHLY` | Stripe → Products → price ID | No |
| `STRIPE_PRICE_STARTER_ANNUAL` | Stripe → Products → price ID | No |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe → Products → price ID | No |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe → Products → price ID | No |

> Note: price-ID variable names use the `STRIPE_PRICE_*` convention (see `lib/stripe-prices.ts`).

## Google — optional (Gmail sending)
| Variable | Where to get it | Client-safe |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → OAuth client | No |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials → OAuth client | No |

## Microsoft — optional (Outlook sending)
| Variable | Where to get it | Client-safe |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | Azure Portal → App registrations → Overview | No |
| `MICROSOFT_CLIENT_SECRET` | Azure Portal → App registrations → Certificates & secrets | No |

## Resend — required (system emails)
| Variable | Where to get it | Client-safe |
|---|---|---|
| `RESEND_API_KEY` | Resend → API Keys | No |
| `NOTIFY_FROM_EMAIL` | A verified Resend domain address | No |

## PostHog — optional (analytics)
| Variable | Where to get it | Client-safe |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API Key | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (or EU) | Yes |

## App — required
| Variable | Notes | Client-safe |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public site URL (e.g. `https://firstcall.app`) | Yes |
| `ENCRYPTION_KEY` | 32-character random string — encrypts SMTP passwords. **Never change once set.** | No |
| `CRON_SECRET` | Random string — authenticates Vercel Cron requests. Set the same value in Vercel. | No |

## MVP minimum
To run the app locally you need: Supabase (3), Resend (2), App (3).
Stripe, Google, Microsoft, and PostHog can be added later — the app degrades gracefully without them.
