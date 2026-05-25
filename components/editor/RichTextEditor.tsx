'use client';

import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { toast } from 'sonner';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Link as LinkIcon, Upload, ChevronDown,
  Heading1, Heading2, Heading3,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variable {
  label: string;
  key: string;
}

interface Props {
  content: string;                      // HTML string
  onChange: (html: string) => void;
  placeholder?: string;
  variables?: Variable[];
  minHeight?: number;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-slate-200" />;
}

// ─── Main editor ─────────────────────────────────────────────────────────────

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
  variables = [],
  minHeight = 480,
}: Props) {
  const [showVarMenu, setShowVarMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-600 underline' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-full prose prose-sm max-w-none prose-indigo',
      },
    },
  });

  // Insert {{variable}} at cursor
  const insertVariable = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${key}}}`).run();
    setShowVarMenu(false);
  }, [editor]);

  // Upload .docx and convert to HTML via mammoth
  const handleDocUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.docx')) { toast.error('Only .docx files are supported'); return; }
    try {
      const mammoth = (await import('mammoth')).default;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (result.messages.length > 0) {
        toast.info('Document imported — some formatting may have changed');
      }
      editor?.commands.setContent(result.value);
      onChange(result.value);
      toast.success(`"${file.name}" imported`);
    } catch (err) {
      toast.error('Failed to import document');
      console.error(err);
    }
  }, [editor, onChange]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">

        {/* Undo / Redo */}
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}>
          <Undo className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}>
          <Redo className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Headings */}
        <ToolBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Inline styles */}
        <ToolBtn title="Bold" active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Link" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn title="Bullet List" active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Numbered List" active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Alignment */}
        <ToolBtn title="Align Left" active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Align Center" active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Align Right" active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Variables dropdown */}
        {variables.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVarMenu((s) => !s)}
              className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              {'{ }'} Insert Variable <ChevronDown className="h-3 w-3" />
            </button>
            {showVarMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg">
                <p className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase text-slate-400">
                  Variables
                </p>
                {variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertVariable(v.key); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="text-slate-700">{v.label}</span>
                    <span className="font-mono text-xs text-indigo-500">{`{{${v.key}}}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload .docx */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-7 items-center gap-1.5 rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
          >
            <Upload className="h-3.5 w-3.5" /> Import .docx
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleDocUpload(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* ── Document page (Google Docs feel) ── */}
      <div className="flex-1 overflow-y-auto bg-slate-100 px-6 py-8">
        <div
          className="mx-auto rounded-lg bg-white px-12 py-10 shadow-sm"
          style={{ maxWidth: 760, minHeight }}
          onClick={() => editor.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Word count ── */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs text-slate-400">
        <span>
          {editor.storage.characterCount?.characters?.() ?? editor.getText().length} characters
        </span>
        <span>
          {editor.getText().trim().split(/\s+/).filter(Boolean).length} words
        </span>
      </div>
    </div>
  );
}
