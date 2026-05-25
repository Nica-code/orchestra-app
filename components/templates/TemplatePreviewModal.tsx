'use client';

import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { renderPreview } from '@/lib/templateEngine';

interface Props {
  open: boolean;
  onClose: () => void;
  template: { subject: string; body: string };
  attachments?: { file_name: string }[];
  fromEmail?: string;
  onEdit?: () => void;
}

// Highlights {{variables}} in raw HTML string, returns safe HTML.
function highlightVariablesInHtml(html: string): string {
  return html.replace(
    /\{\{\s*([a-zA-Z_]+)\s*\}\}/g,
    '<mark style="background:#fef08a;border-radius:3px;padding:0 2px">{{$1}}</mark>',
  );
}

// Strip HTML for subject (subject is plain text)
function highlightVariablesPlain(text: string) {
  const parts = text.split(/(\{\{\s*[a-zA-Z_]+\s*\}\})/g);
  return parts.map((part, i) =>
    /^\{\{\s*[a-zA-Z_]+\s*\}\}$/.test(part)
      ? <mark key={i} className="rounded bg-yellow-200 px-0.5">{part}</mark>
      : <span key={i}>{part}</span>,
  );
}

export function TemplatePreviewModal({ open, onClose, template, attachments = [], fromEmail, onEdit }: Props) {
  const [tab, setTab] = useState<'preview' | 'raw'>('preview');
  const rendered = renderPreview(template);

  return (
    <Modal open={open} onClose={onClose} title="Email Preview" maxWidth="max-w-2xl">
      <div className="flex gap-1 border-b border-slate-200">
        {(['preview', 'raw'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'}`}
          >
            {t === 'preview' ? 'Preview' : 'Raw (with variables)'}
          </button>
        ))}
      </div>

      {tab === 'preview' ? (
        <div className="mt-4">
          <div className="rounded-lg border border-slate-200">
            <div className="space-y-1 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p><span className="text-slate-400">From:</span> {fromEmail || 'your-connected-email@example.com'}</p>
              <p><span className="text-slate-400">To:</span> Sarah Johnson</p>
              <p><span className="text-slate-400">Subject:</span> <strong>{rendered.subject.replace(/<[^>]+>/g, '')}</strong></p>
            </div>
            <div
              className="px-4 py-4 text-sm text-slate-800 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: rendered.body }}
            />
            {attachments.length > 0 && (
              <div className="border-t border-slate-200 px-4 py-3">
                {attachments.map((a, i) => (
                  <p key={i} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Paperclip className="h-3.5 w-3.5" /> {a.file_name}
                  </p>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">This is how the email will look with sample data filled in.</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-400">Subject</p>
          <p className="mt-1 text-sm">{highlightVariablesPlain(template.subject)}</p>
          <p className="mt-4 text-xs font-medium uppercase text-slate-400">Body</p>
          <div
            className="mt-1 text-sm text-slate-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: highlightVariablesInHtml(template.body) }}
          />
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        {onEdit && <Button variant="secondary" onClick={onEdit}>Edit Template</Button>}
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
