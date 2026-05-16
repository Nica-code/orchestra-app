'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatConcertDates } from '@/lib/concertDates';

export interface HistoryRow {
  id: string;
  name: string;
  dates: string[];
  status: string;
  completedAt: string;
  totalPositions: number;
  filledPositions: number;
  exhaustedPositions: number;
  fillRate: number;
}

function fillBadge(rate: number): string {
  if (rate >= 100) return 'bg-green-100 text-green-700';
  if (rate >= 75) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function HistoryClient({ rows }: { rows: HistoryRow[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, search, status]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/concerts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to concerts
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Past Concerts</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by concert name…"
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Concert</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Positions</th>
              <th className="px-4 py-3">Fill Rate</th>
              <th className="px-4 py-3">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No past concerts.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/concerts/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                    {r.name}
                  </Link>
                  {r.status === 'cancelled' && <span className="ml-2 text-xs text-red-600">(cancelled)</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatConcertDates(r.dates)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.totalPositions} position{r.totalPositions === 1 ? '' : 's'}, {r.filledPositions} filled
                  {r.exhaustedPositions > 0 ? `, ${r.exhaustedPositions} exhausted` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fillBadge(r.fillRate)}`}>
                    {r.fillRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(r.completedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
