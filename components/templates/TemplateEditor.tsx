'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TEMPLATE_VARIABLES } from '@/lib/templateEngine';
import type { EmailTemplateWithMeta, TemplateAttachment } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Template name is required').max(150),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
});

const SUBJECT_VARS = ['name', 'concert_name', 'position', 'date', 'venue'] as const;
const BODY_VARS: { label: string; key: string }[] = [
  { label: 'Name', key: 'name' },
  { label: 'Concert', key: 'concert_name' },
  { label: 'Position', key: 'position' },
  { label: 'Date', key: 'date' },
  { label: 'Venue', key: 'venue' },
  { label: 'Deadline', key: 'deadline' },
];
const MAX_FILES = 3;
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TemplateEditor({ template }: { template?: EmailTemplateWithMeta }) {
  const router = useRouter();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [existingAttachments, setExistingAttachments] = useState<TemplateAttachment[]>(template?.attachments ?? []);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [showVars, setShowVars] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insert = (
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    value: string,
    setValue: (v: string) => void,
    variable: string,
  ) => {
    const el = ref.current;
    const token = `{{${variable}}}`;
    if (!el) { setValue(value + token); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const totalAttachments = existingAttachments.length + stagedFiles.length;

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_FILES - totalAttachments;
    if (incoming.length > room) {
      toast.error(`You can attach at most ${MAX_FILES} files`);
    }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, Math.max(0, room))) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) { toast.error(`${f.name}: unsupported type`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10MB`); continue; }
      accepted.push(f);
    }
    setStagedFiles((prev) => [...prev, ...accepted]);
  };

  const removeExisting = async (att: TemplateAttachment) => {
    if (!template) return;
    const res = await fetch(`/api/templates/${template.id}/attachments?attachment=${att.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to remove attachment'); return; }
    setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success('Attachment removed');
  };

  const uploadStaged = async (templateId: string) => {
    for (const file of stagedFiles) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/templates/${templateId}/attachments`, { method: 'POST', body: fd });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error(`${file.name}: ${b.error || 'upload failed'}`);
      }
    }
  };

  const save = async () => {
    const parsed = schema.safeParse({ name, subject, body });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        const res = await fetch(`/api/templates/${template!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, body, is_default: isDefault }),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
        if (stagedFiles.length > 0) await uploadStaged(template!.id);
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, body, is_default: isDefault }),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
        if (stagedFiles.length > 0) await uploadStaged(b.template.id);
      }
      toast.success(isEdit ? 'Template updated' : 'Template created');
      router.push('/dashboard/templates');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Template' : 'New Template'}</h1>

      {/* Section 1 — Name */}
      <div className="mt-6 space-y-2">
        <Input
          label="Template Name (internal only — musicians won't see this)"
          placeholder="e.g. Standard Sub Request, Pops Concert"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
      </div>

      {/* Section 2 — Subject */}
      <div className="mt-5">
        <Input
          label="Subject Line"
          placeholder="Substitute Request — {{concert_name}}"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          ref={subjectRef}
          error={errors.subject}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUBJECT_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insert(subjectRef, subject, setSubject, v)}
              className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Section 3 — Body */}
      <div className="mt-5">
        <label className="mb-1 block text-sm font-medium text-slate-700">Email Body</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {BODY_VARS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insert(bodyRef, body, setBody, v.key)}
              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              + {v.label}
            </button>
          ))}
        </div>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste your existing email template here. Use the buttons above to insert automatic fields that will be filled in for each musician."
          className="block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ minHeight: 300 }}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-red-600">{errors.body}</span>
          <span className="text-slate-400">{body.length} characters</span>
        </div>
      </div>

      {/* Section 4 — Variables reference */}
      <div className="mt-5 rounded-md border border-slate-200">
        <button
          type="button"
          onClick={() => setShowVars((s) => !s)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700"
        >
          {showVars ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Available Variables
        </button>
        {showVars && (
          <table className="w-full border-t border-slate-200 text-sm">
            <tbody className="divide-y divide-slate-100">
              {TEMPLATE_VARIABLES.map((v) => (
                <tr key={v.key}>
                  <td className="px-4 py-2 font-mono text-xs text-indigo-700">{`{{${v.key}}}`}</td>
                  <td className="px-4 py-2 text-slate-600">{v.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 5 — Attachments */}
      <div className="mt-5">
        <label className="mb-1 block text-sm font-medium text-slate-700">Attachments (optional)</label>
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
          <Paperclip className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-1 text-sm text-slate-600">Click to add files — PDF, DOC, DOCX, JPG, PNG (max 10MB, {MAX_FILES} files)</p>
          <input
            type="file"
            multiple
            accept={ALLOWED_EXT.join(',')}
            className="hidden"
            onChange={(e) => { onPickFiles(e.target.files); e.target.value = ''; }}
            disabled={totalAttachments >= MAX_FILES}
          />
        </label>
        <div className="mt-2 space-y-1.5">
          {existingAttachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
              {a.mime_type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-slate-400" /> : <FileText className="h-4 w-4 text-slate-400" />}
              <span className="flex-1">{a.file_name}</span>
              <span className="text-xs text-slate-400">{fmtSize(a.file_size)}</span>
              <button type="button" onClick={() => removeExisting(a)} className="text-slate-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {stagedFiles.map((f, i) => (
            <div key={`staged-${i}`} className="flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm">
              {f.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-slate-400" /> : <FileText className="h-4 w-4 text-slate-400" />}
              <span className="flex-1">{f.name}</span>
              <span className="text-xs text-slate-400">{fmtSize(f.size)} · pending</span>
              <button type="button" onClick={() => setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 6 — Settings */}
      <div className="mt-5 rounded-md border border-slate-200 p-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4" />
          <span>
            <span className="text-sm font-medium text-slate-700">Set as default template</span>
            <span className="block text-xs text-slate-500">Default template is pre-selected when creating concert positions.</span>
          </span>
        </label>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-3 lg:pl-72">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button variant="secondary" onClick={() => setPreviewOpen(true)}>Preview</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/dashboard/templates')}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save Template</Button>
          </div>
        </div>
      </div>

      <TemplatePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={{ subject, body }}
        attachments={[...existingAttachments.map((a) => ({ file_name: a.file_name })), ...stagedFiles.map((f) => ({ file_name: f.name }))]}
      />
    </div>
  );
}
