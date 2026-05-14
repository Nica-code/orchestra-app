import type { PlanType } from '@/types';

export type BillingInterval = 'monthly' | 'annual';

export function priceIdFor(planType: PlanType, interval: BillingInterval): string | null {
  if (planType === 'starter' && interval === 'monthly') return process.env.STRIPE_PRICE_STARTER_MONTHLY ?? null;
  if (planType === 'starter' && interval === 'annual')  return process.env.STRIPE_PRICE_STARTER_ANNUAL ?? null;
  if (planType === 'pro' && interval === 'monthly')     return process.env.STRIPE_PRICE_PRO_MONTHLY ?? null;
  if (planType === 'pro' && interval === 'annual')      return process.env.STRIPE_PRICE_PRO_ANNUAL ?? null;
  return null;
}

export function planTypeFromPriceId(priceId: string | null | undefined): PlanType | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY || priceId === process.env.STRIPE_PRICE_STARTER_ANNUAL) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'pro';
  return null;
}
