'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookMarked, Trash2 } from 'lucide-react';
import type { Concert } from '@/types';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/concerts?status=draft&limit=100')
      .then((r) => r.json())
      .then((d) => setDrafts(d.concerts ?? []))
      .catch(() => toast.error('Failed to load drafts'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/concerts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success('Draft deleted');
    } catch {
      toast.error('Failed to delete draft');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Drafts</h1>
        <p className="mt-0.5 text-sm text-slate-500">Saved drafts — click to continue editing</p>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-slate-400">Loading…</p>
      ) : drafts.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <BookMarked className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">No drafts saved</p>
          <p className="mt-1 text-sm text-slate-400">
            While composing, click &ldquo;Save Draft&rdquo; to save your work here.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {drafts.map((d) => (
            <div key={d.id} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors">
              <BookMarked className="h-4 w-4 shrink-0 text-slate-300" />
              <Link
                href={`/dashboard/email/compose?draft=${d.id}`}
                className="flex-1 min-w-0"
              >
                <p className="truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700">
                  {d.name || '(Untitled draft)'}
                </p>
                <p className="text-xs text-slate-400">Last edited {timeAgo(d.updated_at)}</p>
              </Link>
              <button
                type="button"
                onClick={() => deleteDraft(d.id)}
                disabled={deleting === d.id}
                className="shrink-0 rounded p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                title="Delete draft"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
