'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  managerName: string;
  created_at: string;
}

const PAGE_SIZE = 25;
const DATE_RANGES = [
  { value: '', label: 'All time' },
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];
const CATEGORIES = [
  { value: '', label: 'All Actions' },
  { value: 'send', label: 'Send Activity' },
  { value: 'concert', label: 'Project Management' },
  { value: 'musician', label: 'Contact Management' },
  { value: 'account', label: 'Account & Settings' },
];

export function ActivityClient({ managers }: { managers: { id: string; email: string }[] }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [managerId, setManagerId] = useState('');
  const [category, setCategory] = useState('');
  const [dateRange, setDateRange] = useState('');

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (managerId) p.set('managerId', managerId);
    if (category) p.set('actionCategory', category);
    if (dateRange) {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(dateRange, 10));
      p.set('dateFrom', from.toISOString());
    }
    return p;
  }, [managerId, category, dateRange]);

  const load = useCallback(() => {
    setLoading(true);
    const p = buildParams();
    p.set('page', String(page));
    p.set('limit', String(PAGE_SIZE));
    fetch(`/api/activity?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => toast.error('Failed to load activity'))
      .finally(() => setLoading(false));
  }, [buildParams, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [managerId, category, dateRange]);

  const exportCsv = () => {
    window.location.href = `/api/activity/export?${buildParams()}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={managerId} onChange={(e) => setManagerId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Managers</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-500">No activity found.</td></tr>
            )}
            {!loading && items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-3 text-slate-600" title={new Date(it.created_at).toLocaleString()}>
                  {new Date(it.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-600">{it.managerName}</td>
                <td className="px-4 py-3 text-slate-800">{it.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">{total} entries</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="px-2 py-1.5 text-slate-600">Page {page} of {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
