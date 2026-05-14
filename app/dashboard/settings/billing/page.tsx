import { requireManager } from '@/lib/auth';
import { PLAN_CONFIG, daysRemaining } from '@/lib/plans';
import { BillingActions } from './actions';

export default async function BillingPage() {
  const { plan, manager } = await requireManager();
  const cfg = PLAN_CONFIG[plan.plan_type];
  const trialDays = plan.status === 'trialing' ? daysRemaining(plan.trial_ends_at) : null;
  const pct = Math.min(100, Math.round((plan.send_count / plan.send_limit) * 100));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>

      <div className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Current plan</p>
              <p className="text-xl font-semibold">{cfg.name}</p>
              <p className="text-sm text-slate-500">${cfg.priceMonthly}/month</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              plan.status === 'active' ? 'bg-green-100 text-green-800' :
              plan.status === 'trialing' ? 'bg-amber-100 text-amber-800' :
              plan.status === 'past_due' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-700'
            }`}>{plan.status}</span>
          </div>

          {trialDays !== null && trialDays > 0 && (
            <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Trial ends in <strong>{trialDays}</strong> day{trialDays === 1 ? '' : 's'}. Add a payment method to stay subscribed.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">Monthly sends</p>
          <p className="mt-1 text-lg font-semibold">{plan.send_count} / {plan.send_limit} used</p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Billing period started {new Date(plan.billing_period_start).toLocaleDateString()}
          </p>
        </section>

        <BillingActions
          isAdmin={manager.role === 'admin'}
          planType={plan.plan_type}
          hasStripeCustomer={!!plan.stripe_customer_id}
        />
      </div>
    </div>
  );
}
