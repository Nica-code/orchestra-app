import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

// Stub — fully built in Part 8.
export default async function SendLogPage({ params }: { params: { id: string; positionId: string } }) {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const { data: position } = await admin
    .from('concert_positions')
    .select('id, position_name, concert_id, concerts(organization_id)')
    .eq('id', params.positionId)
    .maybeSingle();
  const orgId = (position as { concerts: { organization_id: string } | null } | null)?.concerts?.organization_id;
  if (!position || position.concert_id !== params.id || orgId !== organization.id) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/concerts/${params.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to concert
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{position.position_name} — Send Log</h1>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Musician</th>
              <th className="px-4 py-3">Email Sent</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Responded At</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                Send log will appear here once sending begins.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
