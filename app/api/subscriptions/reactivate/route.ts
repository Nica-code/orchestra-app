import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { logActivity } from '@/lib/activityLogger';

export const runtime = 'nodejs';

// POST /api/subscriptions/reactivate — undo a scheduled cancellation.
export async function POST() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const admin = createAdminClient();
  const subId = ctx.plan.stripe_subscription_id;

  if (subId && process.env.STRIPE_SECRET_KEY) {
    try {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    } catch (err) {
      console.error('[subscriptions/reactivate] Stripe error:', err);
      return NextResponse.json({ error: 'Could not reactivate subscription. Please try again.' }, { status: 502 });
    }
  }

  await admin.from('plans')
    .update({ status: 'active', cancels_at: null })
    .eq('organization_id', ctx.organization.id);

  await logActivity({
    organizationId: ctx.organization.id, managerId: ctx.manager.id, action: 'plan_upgraded',
    details: { reactivated: true },
  });
  return NextResponse.json({ ok: true });
}
