'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Trash2, StickyNote, Upload, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { AddEditMusician } from '@/components/musicians/AddEditMusician';
import type { Musician, MusicianWithStatus } from '@/types';

const PAGE_SIZE = 50;

export function MusiciansClient() {
  const [musicians, setMusicians] = useState<MusicianWithStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('rank');

  const [positions, setPositions] = useState<{ position: string; count: number }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Musician | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Musician | null>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadPositions = useCallback(() => {
    fetch('/api/musicians/positions').then((r) => r.json()).then((d) => setPositions(d.positions ?? [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      search: debouncedSearch, position, status, sort,
      page: String(page), limit: String(PAGE_SIZE),
    });
    fetch(`/api/musicians?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setMusicians(d.musicians ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => toast.error('Failed to load musicians'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, position, status, sort, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPositions(); }, [loadPositions]);

  const positionNames = useMemo(() => positions.map((p) => p.position), [positions]);

  const suggestNextRank = useCallback((pos: string) => {
    const ranks = musicians.filter((m) => m.position === pos).map((m) => m.rank);
    return ranks.length ? Math.max(...ranks) + 1 : 1;
  }, [musicians]);

  const doDelete = async (m: Musician) => {
    const res = await fetch(`/api/musicians/${m.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error || 'Delete failed'); return; }
    toast.success('Musician removed');
    load(); loadPositions();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Musicians</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/musicians/positions">
            <Button variant="secondary">Positions</Button>
          </Link>
          <Link href="/dashboard/musicians/import">
            <Button variant="secondary"><Upload className="h-4 w-4" /> Import from CSV</Button>
          </Link>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Musician
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={position} onChange={(e) => { setPosition(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Positions</option>
          {positionNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="blacklisted">Blacklisted</option>
          <option value="has_notes">Has notes</option>
          <option value="unavailable">Currently Unavailable</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="rank">Sort: Rank</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="position">Sort: Position</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && musicians.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                No musicians yet. Import a CSV or add manually.
              </td></tr>
            )}
            {!loading && musicians.map((m) => (
              <tr key={m.id} className={m.is_blacklisted ? 'bg-red-50' : ''}>
                <td className="px-4 py-3">{m.rank}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{m.first_name} {m.last_name}</td>
                <td className="px-4 py-3 text-slate-600">{m.email}</td>
                <td className="px-4 py-3">{m.position}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${m.is_blacklisted ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {m.is_blacklisted ? 'Blacklisted' : 'Active'}
                    </span>
                    {m.currently_unavailable && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Unavailable</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {m.notes ? (
                    <span title={m.notes} className="inline-flex cursor-help text-slate-400">
                      <StickyNote className="h-4 w-4" />
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditing(m); setModalOpen(true); }}
                      className="text-slate-500 hover:text-indigo-600" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(m)}
                      className="text-slate-500 hover:text-red-600" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">{total} musicians</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="px-2 py-1.5 text-slate-600">Page {page} of {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <AddEditMusician
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load(); loadPositions(); }}
        musician={editing}
        positions={positionNames}
        suggestNextRank={suggestNextRank}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
        title="Remove musician"
        message={deleteTarget ? `Are you sure you want to remove ${deleteTarget.first_name} ${deleteTarget.last_name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
