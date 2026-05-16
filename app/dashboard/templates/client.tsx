'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Paperclip, Plus, Pencil, Copy, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { EmailTemplateWithMeta } from '@/types';

export function TemplatesClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplateWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateWithMeta | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/templates')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setTemplates(d.templates ?? []);
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const duplicate = async (t: EmailTemplateWithMeta) => {
    const res = await fetch(`/api/templates/${t.id}/duplicate`, { method: 'POST' });
    if (!res.ok) { toast.error('Duplicate failed'); return; }
    toast.success('Template duplicated');
    load();
  };

  const setDefault = async (t: EmailTemplateWithMeta) => {
    const res = await fetch(`/api/templates/${t.id}/set-default`, { method: 'POST' });
    if (!res.ok) { toast.error('Failed to set default'); return; }
    toast.success(`"${t.name}" is now the default`);
    load();
  };

  const doDelete = async (t: EmailTemplateWithMeta) => {
    const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    toast.success('Template deleted');
    load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
        <Link href="/dashboard/templates/new">
          <Button><Plus className="h-4 w-4" /> New Template</Button>
        </Link>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-slate-400">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-slate-300 p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-lg font-medium text-slate-700">No templates yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Templates save your standard email format. Musician names and concert details are filled in automatically.
          </p>
          <Link href="/dashboard/templates/new" className="mt-4 inline-block">
            <Button>Create your first template</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                {t.is_default && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Default</span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{t.subject}</p>
              <p className="mt-2 line-clamp-2 flex-1 whitespace-pre-wrap text-sm text-slate-600">{t.body}</p>

              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                {!!t.attachment_count && t.attachment_count > 0 && (
                  <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {t.attachment_count}</span>
                )}
                <span>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/templates/${t.id}/edit`)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => duplicate(t)}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                {!t.is_default && (
                  <Button size="sm" variant="secondary" onClick={() => setDefault(t)}>
                    <Star className="h-3.5 w-3.5" /> Set as Default
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(t)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
        title="Delete template"
        message={deleteTarget
          ? `Are you sure you want to delete "${deleteTarget.name}"? Deleting it will not affect emails already sent.`
          : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
