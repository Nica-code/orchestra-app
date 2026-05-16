import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { ActivityClient } from './client';

export default async function ActivityPage() {
  const { organization } = await requireManager();
  const admin = createAdminClient();
  const { data: managers } = await admin
    .from('managers').select('id, email').eq('organization_id', organization.id);
  return <ActivityClient managers={managers ?? []} />;
}
