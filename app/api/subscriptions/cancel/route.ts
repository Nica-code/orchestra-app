import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { logActivity } from '@/lib/activityLogger';

export const runtime = 'nodejs';

// POST /api/subscriptions/cancel — cancel at period end.
export async function POST() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const admin = createAdminClient();
  const subId = ctx.plan.stripe_subscription_id;

  let cancelsAt: string | null = null;
  if (subId && process.env.STRIPE_SECRET_KEY) {
    try {
      const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
      cancelsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    } catch (err) {
      console.error('[subscriptions/cancel] Stripe error:', err);
      return NextResponse.json({ error: 'Could not cancel subscription. Please try again.' }, { status: 502 });
    }
  }

  await admin.from('plans')
    .update({ status: 'cancelling', cancels_at: cancelsAt })
    .eq('organization_id', ctx.organization.id);

  await logActivity({
    organizationId: ctx.organization.id, managerId: ctx.manager.id, action: 'plan_downgraded',
    details: { cancelled: true },
  });
  return NextResponse.json({ ok: true, cancelsAt });
}
