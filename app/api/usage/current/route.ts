import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getCurrentUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const summary = await getCurrentUsage(ctx.organization.id);
  return NextResponse.json({
    ...summary,
    isTrialing: ctx.plan.status === 'trialing',
    trialEndsAt: ctx.plan.trial_ends_at,
    paymentFailed: !!(ctx.plan as { payment_failed?: boolean }).payment_failed,
  });
}
