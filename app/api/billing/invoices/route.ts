import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET /api/billing/invoices — last 12 Stripe invoices for the org's customer.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const customerId = ctx.plan.stripe_customer_id;
  if (!customerId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const list = await stripe.invoices.list({ customer: customerId, limit: 12 });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      description: inv.lines.data[0]?.description ?? 'FirstCall subscription',
      amount: (inv.amount_paid || inv.amount_due) / 100,
      status: inv.status,
      pdf: inv.invoice_pdf,
    }));
    return NextResponse.json({ invoices });
  } catch (err) {
    console.error('[billing/invoices] Stripe error:', err);
    return NextResponse.json({ invoices: [], error: 'Could not load invoices' });
  }
}
