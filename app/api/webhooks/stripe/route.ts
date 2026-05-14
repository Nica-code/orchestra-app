import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-server';
import { planTypeFromPriceId } from '@/lib/stripe-prices';
import { PLAN_CONFIG } from '@/lib/plans';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

async function findPlanByCustomer(customerId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('plans').select('*, organizations(name), managers!inner(email,role)')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return { admin, plan: data };
}

async function adminEmailFor(orgId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('managers').select('email').eq('organization_id', orgId).eq('role', 'admin').limit(1).maybeSingle();
  return data?.email ?? null;
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

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const planType = planTypeFromPriceId(priceId);
        const status = sub.status === 'trialing' ? 'trialing'
          : sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'cancelled'
          : sub.status === 'paused' ? 'past_due'
          : 'trialing';

        const update: Record<string, unknown> = {
          status,
          stripe_subscription_id: sub.id,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        };
        if (planType) {
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
        await admin.from('plans').update({
          status: 'active',
          send_count: 0,
          billing_period_start: new Date().toISOString(),
        }).eq('stripe_customer_id', invoice.customer as string);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await admin.from('plans').update({ status: 'past_due' }).eq('stripe_customer_id', customerId);
        const { plan } = await findPlanByCustomer(customerId);
        if (plan) {
          const email = await adminEmailFor(plan.organization_id);
          if (email) {
            await sendEmail({
              to: email,
              subject: 'Payment failed — please update your card',
              html: `<p>We couldn't process your latest payment for Orchestra App. Please update your payment method in the <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing">billing settings</a> to keep your account active.</p>`,
            });
          }
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const { plan } = await findPlanByCustomer(sub.customer as string);
        if (plan) {
          const email = await adminEmailFor(plan.organization_id);
          if (email) {
            await sendEmail({
              to: email,
              subject: 'Your trial ends in 3 days',
              html: `<p>Your Orchestra App trial ends soon. Add a payment method to keep your account active when the trial ends.</p>
                     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing">Manage billing →</a></p>`,
            });
          }
        }
        break;
      }
      default:
        console.log('[stripe-webhook] unhandled:', event.type);
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
