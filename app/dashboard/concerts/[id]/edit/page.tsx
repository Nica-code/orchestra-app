import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { ConcertForm } from '@/components/concerts/ConcertForm';

export default async function EditConcertPage({ params }: { params: { id: string } }) {
  const { organization } = await requireManager();
  const admin = createAdminClient();
  const { data: concert } = await admin.from('concerts').select('*').eq('id', params.id).maybeSingle();
  if (!concert || concert.organization_id !== organization.id) notFound();
  return <ConcertForm concert={concert} />;
}
