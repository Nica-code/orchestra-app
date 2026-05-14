import { redirect } from 'next/navigation';
import { getCurrentManager } from '@/lib/auth';
import { daysRemaining } from '@/lib/plans';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentManager();
  if (!ctx) redirect('/auth/login');

  const { organization, plan, manager } = ctx;
  if (!organization.onboarding_completed) redirect('/onboarding');

  const trialDaysLeft = plan.status === 'trialing' ? daysRemaining(plan.trial_ends_at) : null;

  return (
    <DashboardShell
      organizationName={organization.name}
      logoUrl={organization.logo_url}
      managerEmail={manager.email}
      trialDaysLeft={trialDaysLeft}
    >
      {children}
    </DashboardShell>
  );
}
