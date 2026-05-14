import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { managerLimit, PLAN_CONFIG } from '@/lib/plans';
import { ManagersList } from './list';

export default async function ManagersPage() {
  const { manager, organization, plan } = await requireManager();
  const admin = createAdminClient();

  const [{ data: managers }, { data: invites }] = await Promise.all([
    admin.from('managers').select('*').eq('organization_id', organization.id).order('created_at'),
    admin.from('manager_invites').select('*')
      .eq('organization_id', organization.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at'),
  ]);

  const limit = managerLimit(plan.plan_type);
  const used = (managers?.length ?? 0) + (invites?.length ?? 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Managers</h1>
      <p className="mt-1 text-sm text-slate-600">
        {used} of {limit} manager slot{limit === 1 ? '' : 's'} used ({PLAN_CONFIG[plan.plan_type].name} plan)
      </p>
      <ManagersList
        currentManagerId={manager.id}
        currentManagerRole={manager.role}
        managers={managers ?? []}
        invites={invites ?? []}
        limit={limit}
        used={used}
      />
    </div>
  );
}
