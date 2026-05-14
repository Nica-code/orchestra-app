import { requireManager } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OnboardingWizard } from './wizard';

export default async function OnboardingPage() {
  const { organization, plan } = await requireManager();
  if (organization.onboarding_completed) redirect('/dashboard');
  return (
    <OnboardingWizard
      initialStep={organization.onboarding_step ?? 1}
      currentPlanType={plan.plan_type}
    />
  );
}
