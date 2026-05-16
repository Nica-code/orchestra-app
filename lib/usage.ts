// Central usage tracking module.
import 'server-only';
import { createAdminClient } from './supabase-server';
import { logActivity } from './activityLogger';
import { PLAN_CONFIG } from './plans';
import type { UsageSummary, UsageHistory, PlanType } from '@/types';

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export async function getCurrentUsage(organizationId: string): Promise<UsageSummary> {
  const admin = createAdminClient();
  const { data: plan } = await admin.from('plans').select('*').eq('organization_id', organizationId).maybeSingle();

  const sendCount = plan?.send_count ?? 0;
  const sendLimit = plan?.send_limit ?? 0;
  const periodStart: string = plan?.billing_period_start ?? new Date().toISOString();
  const periodEnd: string = plan?.billing_period_end
    ?? new Date(new Date(periodStart).getTime() + 30 * 86400000).toISOString();

  return {
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    planType: plan?.plan_type ?? 'starter',
    sendCount,
    sendLimit,
    overageCount: Math.max(0, sendCount - sendLimit),
    percentageUsed: sendLimit > 0 ? Math.round((sendCount / sendLimit) * 100) : 0,
    remainingSends: Math.max(0, sendLimit - sendCount),
    isOverLimit: sendLimit > 0 && sendCount >= sendLimit,
    daysRemainingInPeriod: daysUntil(periodEnd),
  };
}

/** Atomically increments send_count (and overage_count if over limit). */
export async function incrementSendCount(organizationId: string): Promise<{
  newCount: number; isOverLimit: boolean; overageCount: number;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('increment_send_count', { org_id: organizationId });
  let newCount = 0;
  let limit = 0;
  if (!error && Array.isArray(data) && data[0]) {
    newCount = data[0].new_count ?? 0;
    limit = data[0].limit_value ?? 0;
  } else {
    // Fallback: read-modify-write (RPC missing)
    const { data: plan } = await admin.from('plans').select('id, send_count, send_limit')
      .eq('organization_id', organizationId).maybeSingle();
    if (plan) {
      newCount = (plan.send_count ?? 0) + 1;
      limit = plan.send_limit ?? 0;
      await admin.from('plans').update({ send_count: newCount }).eq('id', plan.id);
    }
  }

  const isOverLimit = limit > 0 && newCount > limit;
  const overageCount = Math.max(0, newCount - limit);
  if (isOverLimit) {
    await admin.from('plans').update({ overage_count: overageCount }).eq('organization_id', organizationId);
  }
  return { newCount, isOverLimit, overageCount };
}

/** Overage is always enabled — we charge rather than block. canSend is always true. */
export async function checkSendAllowance(organizationId: string): Promise<{
  canSend: boolean; reason?: string; currentCount: number; limit: number; overageEnabled: boolean;
}> {
  const usage = await getCurrentUsage(organizationId);
  return {
    canSend: true,
    reason: usage.isOverLimit ? 'Over monthly limit — overage charges apply' : undefined,
    currentCount: usage.sendCount,
    limit: usage.sendLimit,
    overageEnabled: true,
  };
}

/**
 * Overage charge: $10 per block of 1,000 overage sends (ceiling division).
 *   1 send → 1 block → $10 ; 1000 → 1 block → $10 ; 1001 → 2 blocks → $20
 * Returns the charge in cents.
 */
export function calculateOverageCharge(overageCount: number): number {
  if (overageCount <= 0) return 0;
  const blocks = Math.ceil(overageCount / 1000);
  return blocks * 1000; // $10.00 = 1000 cents per block
}

/** Archives the current period to usage_history and resets the plan counters. */
export async function resetBillingPeriod(organizationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: plan } = await admin.from('plans').select('*').eq('organization_id', organizationId).maybeSingle();
  if (!plan) return;

  const periodStart: string = plan.billing_period_start ?? new Date().toISOString();
  const periodEnd: string = plan.billing_period_end ?? new Date().toISOString();

  await admin.from('usage_history').insert({
    organization_id: organizationId,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    plan_type: plan.plan_type,
    send_limit: plan.send_limit,
    send_count: plan.send_count ?? 0,
    overage_count: plan.overage_count ?? 0,
    overage_charged: false,
    overage_amount_cents: 0,
  });

  // Apply a scheduled downgrade, if any
  const newPlanType: PlanType = (plan.pending_plan_type as PlanType) ?? plan.plan_type;
  const newLimit = PLAN_CONFIG[newPlanType]?.sendLimit ?? plan.send_limit;
  const now = new Date();
  const nextEnd = new Date(now.getTime() + 30 * 86400000);

  await admin.from('plans').update({
    plan_type: newPlanType,
    send_limit: newLimit,
    send_count: 0,
    overage_count: 0,
    pending_plan_type: null,
    billing_period_start: now.toISOString(),
    billing_period_end: nextEnd.toISOString(),
  }).eq('organization_id', organizationId);

  await logActivity({ organizationId, managerId: null, action: 'billing_period_reset' });
}

export async function getUsageHistory(organizationId: string, limit = 12): Promise<UsageHistory[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('usage_history')
    .select('*')
    .eq('organization_id', organizationId)
    .order('billing_period_start', { ascending: false })
    .limit(limit);
  return (data ?? []) as UsageHistory[];
}
