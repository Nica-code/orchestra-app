import { requireManager } from '@/lib/auth';
import { getCurrentUsage, getUsageHistory } from '@/lib/usage';
import { daysRemaining } from '@/lib/plans';
import { BillingClient } from './client';

export default async function BillingPage() {
  const { manager, plan } = await requireManager();
  const [usage, history] = await Promise.all([
    getCurrentUsage(manager.organization_id),
    getUsageHistory(manager.organization_id, 12),
  ]);

  return (
    <BillingClient
      isAdmin={manager.role === 'admin'}
      planType={plan.plan_type}
      status={plan.status}
      trialDaysLeft={plan.status === 'trialing' ? daysRemaining(plan.trial_ends_at) : null}
      cancelsAt={(plan as { cancels_at?: string | null }).cancels_at ?? null}
      hasStripeCustomer={!!plan.stripe_customer_id}
      usage={usage}
      history={history}
    />
  );
}
