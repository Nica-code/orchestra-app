'use client';

import { useEffect, useState } from 'react';

export interface CurrentPlan {
  planType: 'starter' | 'pro';
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  sendCount: number;
  sendLimit: number;
  percentageUsed: number;
  isNearLimit: boolean; // 80%+
  isOverLimit: boolean; // 100%+
  paymentFailed: boolean;
}

interface CacheEntry { data: CurrentPlan; at: number; }
let cache: CacheEntry | null = null;
const TTL = 5 * 60 * 1000;

/** Invalidate the cached plan (call after a send or plan change). */
export function invalidateCurrentPlan(): void { cache = null; }

export function useCurrentPlan(): CurrentPlan | null {
  const [plan, setPlan] = useState<CurrentPlan | null>(cache?.data ?? null);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL) {
      setPlan(cache.data);
      return;
    }
    let active = true;
    fetch('/api/usage/current')
      .then((r) => r.json())
      .then((d) => {
        if (!active || d.error) return;
        let trialDays: number | null = null;
        if (d.isTrialing && d.trialEndsAt) {
          trialDays = Math.max(0, Math.ceil((new Date(d.trialEndsAt).getTime() - Date.now()) / 86400000));
        }
        const result: CurrentPlan = {
          planType: d.planType ?? 'starter',
          isTrialing: !!d.isTrialing,
          trialDaysRemaining: trialDays,
          sendCount: d.sendCount ?? 0,
          sendLimit: d.sendLimit ?? 0,
          percentageUsed: d.percentageUsed ?? 0,
          isNearLimit: (d.percentageUsed ?? 0) >= 80,
          isOverLimit: !!d.isOverLimit,
          paymentFailed: !!d.paymentFailed,
        };
        cache = { data: result, at: Date.now() };
        setPlan(result);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return plan;
}
