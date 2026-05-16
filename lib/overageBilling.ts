// Overage billing via Stripe.
// APPROACH: Stripe Invoice Items (not metered billing). At the end of each
// billing period we create a one-off invoice item + invoice for the overage,
// which Stripe auto-charges against the customer's saved payment method.
import 'server-only';
import { stripe } from './stripe';
import { createAdminClient } from './supabase-server';
import { logActivity } from './activityLogger';
import { calculateOverageCharge } from './usage';

export async function chargeOverage(organizationId: string): Promise<{
  charged: boolean; amountCents: number; invoiceId: string | null;
}> {
  const admin = createAdminClient();
  const { data: plan } = await admin.from('plans').select('*').eq('organization_id', organizationId).maybeSingle();
  if (!plan) return { charged: false, amountCents: 0, invoiceId: null };

  const overageCount: number = plan.overage_count ?? 0;
  if (overageCount <= 0) return { charged: false, amountCents: 0, invoiceId: null };

  const amountCents = calculateOverageCharge(overageCount);
  if (amountCents <= 0) return { charged: false, amountCents: 0, invoiceId: null };

  if (!plan.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) {
    console.warn('[overageBilling] no Stripe customer / key — skipping overage charge');
    return { charged: false, amountCents, invoiceId: null };
  }

  const blocks = Math.ceil(overageCount / 1000);
  try {
    await stripe.invoiceItems.create({
      customer: plan.stripe_customer_id,
      amount: amountCents,
      currency: 'usd',
      description: `Overage: ${overageCount} additional sends (${blocks} block${blocks === 1 ? '' : 's'} of 1,000 at $10/block)`,
    });
    const invoice = await stripe.invoices.create({
      customer: plan.stripe_customer_id,
      auto_advance: true, // Stripe finalizes + auto-charges
    });

    // Mark the most recent usage_history row as charged
    const { data: latest } = await admin
      .from('usage_history').select('id')
      .eq('organization_id', organizationId)
      .order('billing_period_start', { ascending: false })
      .limit(1).maybeSingle();
    if (latest) {
      await admin.from('usage_history')
        .update({ overage_charged: true, overage_amount_cents: amountCents })
        .eq('id', latest.id);
    }

    await logActivity({
      organizationId, managerId: null, action: 'overage_charged',
      details: { overageCount, amountCents, blocks },
    });

    return { charged: true, amountCents, invoiceId: invoice.id };
  } catch (err) {
    console.error('[overageBilling] Stripe error:', err);
    return { charged: false, amountCents, invoiceId: null };
  }
}
