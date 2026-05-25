'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Users, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import type { RecipientGroupWithCount } from '@/types';

function NewGroupModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const b = await res.json();
      if (!res.ok) { toast.error(b.error || 'Failed to create group'); return; }
      toast.success('Group created');
      setName('');
      setDescription('');
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Recipient Group" maxWidth="max-w-md">
      <div className="space-y-3">
        <Input
          label="Group Name"
          placeholder="e.g. Violin Subs, Emergency List, Principal Players"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What is this group used for?"
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim()}>Create Group</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<RecipientGroupWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecipientGroupWithCount | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/groups')
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const doDelete = async (g: RecipientGroupWithCount) => {
    const res = await fetch(`/api/groups/${g.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    toast.success('Group deleted');
    load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recipient Groups</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Saved, ordered contact sequences — reuse them across any project
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </div>

      {/* Groups */}
      <div className="mt-6">
        {loading ? (
          <p className="text-center text-slate-400">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-600">No groups yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Create a group to save a ranked contact sequence you can reuse across projects.
            </p>
            <Button className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> New Group
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{g.name}</p>
                  <p className="text-sm text-slate-400">
                    {g.member_count} contact{g.member_count === 1 ? '' : 's'}
                    {g.description ? ` · ${g.description}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setDeleteTarget(g)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete group"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Link href={`/dashboard/groups/${g.id}`} className="shrink-0">
                  <button className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                    Manage <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewGroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
        title="Delete group"
        message={deleteTarget ? `Delete "${deleteTarget.name}" and all its members? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
