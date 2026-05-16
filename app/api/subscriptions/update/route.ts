import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { priceIdFor } from '@/lib/stripe-prices';
import { PLAN_CONFIG } from '@/lib/plans';
import { logActivity } from '@/lib/activityLogger';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

const schema = z.object({
  newPlanType: z.enum(['starter', 'pro']),
  billingInterval: z.enum(['monthly', 'annual']),
});

const RANK: Record<string, number> = { starter: 0, pro: 1 };

// POST /api/subscriptions/update — upgrade (immediate) or downgrade (at period end).
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const priceId = priceIdFor(body.newPlanType, body.billingInterval);
  const admin = createAdminClient();
  const subId = ctx.plan.stripe_subscription_id;
  const isUpgrade = RANK[body.newPlanType] > RANK[ctx.plan.plan_type];

  // No Stripe subscription yet (dev fallback): just update the local plan.
  if (!subId || !priceId || !process.env.STRIPE_SECRET_KEY) {
    await admin.from('plans').update({
      plan_type: body.newPlanType,
      send_limit: PLAN_CONFIG[body.newPlanType].sendLimit,
    }).eq('organization_id', ctx.organization.id);
    return NextResponse.json({ ok: true, applied: 'immediate', stripe: false });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subId);
    const itemId = subscription.items.data[0]?.id;

    if (isUpgrade) {
      // Immediate, prorated
      await stripe.subscriptions.update(subId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
      });
      await admin.from('plans').update({
        plan_type: body.newPlanType,
        send_limit: PLAN_CONFIG[body.newPlanType].sendLimit,
        stripe_price_id: priceId,
        pending_plan_type: null,
      }).eq('organization_id', ctx.organization.id);

      await logActivity({
        organizationId: ctx.organization.id, managerId: ctx.manager.id,
        action: 'plan_upgraded', details: { plan: body.newPlanType },
      });
      await createNotification({
        organizationId: ctx.organization.id, managerId: ctx.manager.id, type: 'plan_upgraded',
        title: `Upgraded to ${PLAN_CONFIG[body.newPlanType].name}`,
        message: `Your new limit is ${PLAN_CONFIG[body.newPlanType].sendLimit.toLocaleString()} sends/month.`,
        actionUrl: '/dashboard/settings/billing',
      });
      return NextResponse.json({ ok: true, applied: 'immediate' });
    }

    // Downgrade — schedule at period end, keep current limit until then
    await stripe.subscriptions.update(subId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
    });
    await admin.from('plans').update({
      pending_plan_type: body.newPlanType,
      stripe_price_id: priceId,
    }).eq('organization_id', ctx.organization.id);

    await logActivity({
      organizationId: ctx.organization.id, managerId: ctx.manager.id,
      action: 'plan_downgraded', details: { plan: body.newPlanType, scheduled: true },
    });
    const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
    const effectiveDate = periodEnd
      ? new Date(periodEnd * 1000).toLocaleDateString() : 'the next billing date';
    return NextResponse.json({ ok: true, applied: 'scheduled', effectiveDate });
  } catch (err) {
    console.error('[subscriptions/update] Stripe error:', err);
    return NextResponse.json({ error: 'Could not update subscription. Please try again.' }, { status: 502 });
  }
}
