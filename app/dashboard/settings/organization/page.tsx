import { requireManager } from '@/lib/auth';
import { OrganizationSettingsForm } from './form';

export default async function OrganizationSettingsPage() {
  const { organization } = await requireManager();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Organization</h1>
      <p className="mt-1 text-sm text-slate-600">Update your organization name and logo.</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <OrganizationSettingsForm
          id={organization.id}
          name={organization.name}
          logoUrl={organization.logo_url}
        />
      </div>
    </div>
  );
}
