import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { priceIdFor } from '@/lib/stripe-prices';
import { PLAN_CONFIG, trialEndsAt, TRIAL_DAYS } from '@/lib/plans';

const schema = z.object({
  plan_type: z.enum(['starter', 'pro']),
  billing_interval: z.enum(['monthly', 'annual']),
});

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const priceId = priceIdFor(body.plan_type, body.billing_interval);
  const admin = createAdminClient();

  // Stripe-less path: if no price ID configured, just update the local plan (dev fallback)
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    await admin.from('plans').update({
      plan_type: body.plan_type,
      send_limit: PLAN_CONFIG[body.plan_type].sendLimit,
      status: 'trialing',
      trial_ends_at: trialEndsAt(),
    }).eq('organization_id', ctx.organization.id);
    return NextResponse.json({ ok: true, stripe: false });
  }

  // Reuse existing Stripe customer if any
  let customerId = ctx.plan.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.manager.email,
      name: ctx.organization.name,
      metadata: { organization_id: ctx.organization.id },
    });
    customerId = customer.id;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: TRIAL_DAYS,
    trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
    payment_settings: { save_default_payment_method: 'on_subscription' },
    metadata: { organization_id: ctx.organization.id, plan_type: body.plan_type },
  });

  await admin.from('plans').update({
    plan_type: body.plan_type,
    send_limit: PLAN_CONFIG[body.plan_type].sendLimit,
    status: 'trialing',
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : trialEndsAt(),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  }).eq('organization_id', ctx.organization.id);

  return NextResponse.json({ ok: true, subscription_id: subscription.id });
}
