import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-server';
import { planTypeFromPriceId } from '@/lib/stripe-prices';
import { PLAN_CONFIG } from '@/lib/plans';
import { resetBillingPeriod } from '@/lib/usage';
import { notifyPaymentFailed, notifyTrialEnding } from '@/lib/notifications';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const RANK: Record<string, number> = { starter: 0, pro: 1 };

async function findPlanByCustomer(customerId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('plans').select('*').eq('stripe_customer_id', customerId).maybeSingle();
  return { admin, plan: data };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] signature failed:', message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency — skip events we've already processed.
  const { data: existing } = await admin
    .from('stripe_webhook_events').select('id').eq('stripe_event_id', event.id).maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const planType = planTypeFromPriceId(priceId);
        const status = sub.cancel_at_period_end ? 'cancelling'
          : sub.status === 'trialing' ? 'trialing'
          : sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'cancelled'
          : sub.status === 'paused' ? 'past_due'
          : 'trialing';

        const { plan } = await findPlanByCustomer(sub.customer as string);
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        const update: Record<string, unknown> = {
          status,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancels_at: sub.cancel_at_period_end && periodEnd
            ? new Date(periodEnd * 1000).toISOString() : null,
        };
        if (planType && plan) {
          const isDowngrade = RANK[planType] < RANK[plan.plan_type];
          if (isDowngrade) {
            // Keep current limit until period end; resetBillingPeriod applies it.
            update.pending_plan_type = planType;
          } else {
            update.plan_type = planType;
            update.send_limit = PLAN_CONFIG[planType].sendLimit;
            update.pending_plan_type = null;
          }
        } else if (planType && !plan) {
          update.plan_type = planType;
          update.send_limit = PLAN_CONFIG[planType].sendLimit;
        }
        await admin.from('plans').update(update).eq('stripe_customer_id', sub.customer as string);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from('plans').update({ status: 'cancelled' }).eq('stripe_customer_id', sub.customer as string);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const { plan } = await findPlanByCustomer(customerId);

        await admin.from('plans').update({ status: 'active', payment_failed: false })
          .eq('stripe_customer_id', customerId);

        // A renewal (not the first invoice) starts a fresh billing period.
        if (invoice.billing_reason === 'subscription_cycle' && plan) {
          await resetBillingPeriod(plan.organization_id);
        }
        // Sync the period window from the Stripe invoice line.
        const line = invoice.lines.data[0];
        if (line?.period && plan) {
          await admin.from('plans').update({
            billing_period_start: new Date(line.period.start * 1000).toISOString(),
            billing_period_end: new Date(line.period.end * 1000).toISOString(),
          }).eq('stripe_customer_id', customerId);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await admin.from('plans').update({ status: 'past_due', payment_failed: true })
          .eq('stripe_customer_id', customerId);
        const { plan } = await findPlanByCustomer(customerId);
        if (plan) {
          const { data: managers } = await admin
            .from('managers').select('id').eq('organization_id', plan.organization_id).eq('status', 'active');
          for (const m of managers ?? []) {
            await notifyPaymentFailed({
              organizationId: plan.organization_id, managerId: m.id, planType: plan.plan_type ?? 'starter',
            });
          }
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const { plan } = await findPlanByCustomer(sub.customer as string);
        if (plan) {
          const daysRemaining = sub.trial_end
            ? Math.max(0, Math.ceil((sub.trial_end * 1000 - Date.now()) / 86400000))
            : 3;
          const { data: managers } = await admin
            .from('managers').select('id').eq('organization_id', plan.organization_id).eq('status', 'active');
          for (const m of managers ?? []) {
            await notifyTrialEnding({
              organizationId: plan.organization_id, managerId: m.id,
              daysRemaining, planType: plan.plan_type ?? 'starter',
            });
          }
        }
        break;
      }
      default:
        console.log('[stripe-webhook] unhandled:', event.type);
    }

    // Record the event as processed (idempotency).
    await admin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id, event_type: event.type,
    });
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
