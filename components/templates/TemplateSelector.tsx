'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { EmailTemplateWithMeta } from '@/types';

interface Props {
  onSelect: (template: EmailTemplateWithMeta) => void;
  selectedTemplateId?: string;
}

/** Dropdown of the organization's templates. Used in the Part 6 concert flow. */
export function TemplateSelector({ onSelect, selectedTemplateId }: Props) {
  const [templates, setTemplates] = useState<EmailTemplateWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(selectedTemplateId ?? '');

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        const list: EmailTemplateWithMeta[] = d.templates ?? [];
        setTemplates(list);
        // Pre-select: explicit prop, else the default template
        const initial = selectedTemplateId
          ? list.find((t) => t.id === selectedTemplateId)
          : list.find((t) => t.is_default);
        if (initial) { setValue(initial.id); onSelect(initial); }
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (id: string) => {
    setValue(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t) onSelect(t);
  };

  if (loading) return <p className="text-sm text-slate-400">Loading templates…</p>;

  if (templates.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No templates yet.{' '}
        <a href="/dashboard/templates/new" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
          Create one
        </a>
      </p>
    );
  }

  return (
    <div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="" disabled>Select a template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.is_default ? ' (Default)' : ''} — {t.subject}
          </option>
        ))}
      </select>
      <a
        href="/dashboard/templates/new"
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline"
      >
        + Create New Template
      </a>
    </div>
  );
}
