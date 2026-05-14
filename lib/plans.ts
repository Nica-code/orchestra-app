import type { PlanType } from '@/types';

export const PLAN_CONFIG: Record<PlanType, {
  name: string;
  managerLimit: number;
  sendLimit: number;
  priceMonthly: number; // USD
  priceAnnual: number;  // USD
}> = {
  starter: { name: 'Starter', managerLimit: 1, sendLimit: 500, priceMonthly: 29, priceAnnual: 278 },
  pro:     { name: 'Pro',     managerLimit: 3, sendLimit: 3000, priceMonthly: 59, priceAnnual: 568 },
};

export const TRIAL_DAYS = 30;

export function trialEndsAt(from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toISOString();
}

export function daysRemaining(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function managerLimit(planType: PlanType) {
  return PLAN_CONFIG[planType].managerLimit;
}
