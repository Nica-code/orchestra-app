import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { Users } from 'lucide-react';

export default async function PositionsPage() {
  const { organization } = await requireManager();
  const admin = createAdminClient();
  const { data } = await admin
    .from('musicians')
    .select('position')
    .eq('organization_id', organization.id);

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.position, (counts.get(row.position) ?? 0) + 1);
  const positions = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Positions</h1>
      <p className="mt-1 text-sm text-slate-600">Each position has its own ranked list of contacts.</p>

      {positions.length === 0 ? (
        <p className="mt-8 text-center text-slate-500">
          No positions yet. Add musicians to create positions.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {positions.map(([position, count]) => (
            <div key={position} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <Users className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold">{position}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{count} contact${count === 1 ? '' : 's'}</p>
              <Link
                href={`/dashboard/musicians/positions/${encodeURIComponent(position)}`}
                className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View &amp; Reorder →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
