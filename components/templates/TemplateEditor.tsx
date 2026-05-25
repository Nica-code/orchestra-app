'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Paperclip, X, FileText, Image as ImageIcon, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TEMPLATE_VARIABLES } from '@/lib/templateEngine';
import type { EmailTemplateWithMeta, TemplateAttachment } from '@/types';

const MAX_FILES = 3;
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const EDITOR_VARIABLES = TEMPLATE_VARIABLES.map((v) => ({
  label: v.description,
  key: v.key,
}));

export function TemplateEditor({ template }: { template?: EmailTemplateWithMeta }) {
  const router = useRouter();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [existingAttachments, setExistingAttachments] = useState<TemplateAttachment[]>(
    template?.attachments ?? []
  );
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalAttachments = existingAttachments.length + stagedFiles.length;

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_FILES - totalAttachments;
    if (incoming.length > room) toast.error(`Max ${MAX_FILES} attachments`);
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
    const res = await fetch(
      `/api/templates/${template.id}/attachments?attachment=${att.id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) { toast.error('Failed to remove attachment'); return; }
    setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success('Attachment removed');
  };

  const uploadStaged = async (templateId: string) => {
    for (const file of stagedFiles) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/templates/${templateId}/attachments`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error(`${file.name}: ${b.error || 'upload failed'}`);
      }
    }
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Template name is required';
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!body.trim() || body === '<p></p>') errs.body = 'Body is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      let templateId = template?.id;
      if (isEdit) {
        const res = await fetch(`/api/templates/${templateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, body, is_default: isDefault }),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, body, is_default: isDefault }),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
        templateId = b.template.id;
      }
      if (stagedFiles.length > 0 && templateId) await uploadStaged(templateId);
      toast.success(isEdit ? 'Template updated' : 'Template created');
      router.push('/dashboard/templates');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">

      {/* ── Top bar (Google Docs-style) ── */}
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-2.5">
        {/* Template name — editable inline */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Template"
          className={`flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300 ${
            errors.name ? 'placeholder:text-red-400' : ''
          }`}
        />
        {errors.name && (
          <span className="text-xs text-red-500">{errors.name}</span>
        )}

        {/* Default toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-3.5 w-3.5 rounded text-indigo-600"
          />
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Star className="h-3 w-3" /> Default
          </span>
        </label>

        <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
          Preview
        </Button>
        <Button size="sm" onClick={save} loading={saving}>
          Save
        </Button>
        <button
          onClick={() => router.push('/dashboard/templates')}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>

      {/* ── Subject line ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-2">
        <span className="shrink-0 text-sm font-medium text-slate-400">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line…"
          className="flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
        />
        {errors.subject && (
          <span className="text-xs text-red-500">{errors.subject}</span>
        )}
      </div>

      {/* ── Rich text editor (fills remaining space) ── */}
      <div className="flex-1 overflow-hidden">
        <RichTextEditor
          content={body}
          onChange={setBody}
          placeholder="Write your email template here… Use the { } button to insert variables like {{name}}."
          variables={EDITOR_VARIABLES}
          minHeight={500}
        />
      </div>

      {/* ── Attachments bar ── */}
      <div className="border-t border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Attachments</span>

          {/* Existing */}
          {existingAttachments.map((a) => (
            <div key={a.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              {a.mime_type.startsWith('image/')
                ? <ImageIcon className="h-3 w-3" />
                : <FileText className="h-3 w-3" />}
              {a.file_name}
              <span className="text-slate-400">{fmtSize(a.file_size)}</span>
              <button onClick={() => removeExisting(a)} className="text-slate-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Staged */}
          {stagedFiles.map((f, i) => (
            <div key={`s-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
              <FileText className="h-3 w-3" />
              {f.name}
              <button
                onClick={() => setStagedFiles((p) => p.filter((_, idx) => idx !== i))}
                className="text-indigo-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add attachment */}
          {totalAttachments < MAX_FILES && (
            <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400 hover:text-indigo-600">
              <Paperclip className="h-3.5 w-3.5" /> Add file
              <input
                type="file"
                multiple
                accept={ALLOWED_EXT.join(',')}
                className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ''; }}
              />
            </label>
          )}
        </div>
        {errors.body && (
          <p className="mt-1 text-xs text-red-500">{errors.body}</p>
        )}
      </div>

      <TemplatePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={{ subject, body }}
        attachments={[
          ...existingAttachments.map((a) => ({ file_name: a.file_name })),
          ...stagedFiles.map((f) => ({ file_name: f.name })),
        ]}
      />
    </div>
  );
}
