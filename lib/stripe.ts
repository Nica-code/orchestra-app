import Stripe from 'stripe';
import { loadStripe, Stripe as StripeClient } from '@stripe/stripe-js';

// Lazy server-side Stripe singleton — avoids throwing at module-load if the key
// isn't set yet (which would break `next build` for routes that import it).
let _stripe: Stripe | null = null;
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
      _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia', typescript: true });
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});

// Client-side Stripe (singleton)
let stripePromise: Promise<StripeClient | null> | null = null;
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
};
