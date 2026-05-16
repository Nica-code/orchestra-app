import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentManager } from './auth';

/**
 * Validates the Supabase session for an API route.
 * Returns null fields if not authenticated.
 */
export async function validateAuth() {
  const ctx = await getCurrentManager();
  if (!ctx) return { user: null, manager: null, organization: null, plan: null };
  return {
    user: ctx.session.user,
    manager: ctx.manager,
    organization: ctx.organization,
    plan: ctx.plan,
  };
}

/** Logs an error with context and returns a safe HTTP response. */
export function handleApiError(error: unknown, context: string): NextResponse {
  console.error(`[${context}]`, error);

  const message = error instanceof Error ? error.message : String(error);

  // Stripe errors expose a `type`/`code`
  const stripeType = (error as { type?: string })?.type;
  if (stripeType?.startsWith('Stripe')) {
    return NextResponse.json(
      { error: 'Payment service error. Please try again shortly.' },
      { status: 502 },
    );
  }

  // Postgres/Supabase unique-constraint violations
  if (/duplicate key|unique constraint/i.test(message)) {
    return NextResponse.json({ error: 'That record already exists.' }, { status: 409 });
  }
  // RLS / permission
  if (/row-level security|permission denied/i.test(message)) {
    return NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 });
  }

  return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
}
