import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  if (!ctx.plan.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const session = await stripe.billingPortal.sessions.create({
    customer: ctx.plan.stripe_customer_id,
    return_url: `${appUrl}/dashboard/settings/billing`,
  });
  return NextResponse.json({ url: session.url });
}
