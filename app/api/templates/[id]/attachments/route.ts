import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const BUCKET = 'template-attachments';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

async function ownTemplate(id: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: template } = await admin.from('email_templates').select('id, organization_id').eq('id', id).maybeSingle();
  if (!template) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) };
  if (template.organization_id !== ctx.organization.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ctx, admin };
}

// POST /api/templates/[id]/attachments — upload one attachment.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx, admin } = await ownTemplate(params.id);
  if (error) return error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
  if (!ALLOWED[file.type]) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG' }, { status: 400 });
  }

  const { count } = await admin!
    .from('template_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', params.id);
  if ((count ?? 0) >= MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} attachments per template` }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${ctx!.organization.id}/${params.id}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin!.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  const { data: pub } = admin!.storage.from(BUCKET).getPublicUrl(path);
  const { data: record, error: insErr } = await admin!
    .from('template_attachments')
    .insert({
      template_id: params.id,
      file_name: file.name,
      file_url: pub.publicUrl,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();
  if (insErr) {
    await admin!.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ attachment: record });
}

// DELETE /api/templates/[id]/attachments?attachment=<id>
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await ownTemplate(params.id);
  if (error) return error;

  const attachmentId = req.nextUrl.searchParams.get('attachment');
  if (!attachmentId) return NextResponse.json({ error: 'Missing attachment id' }, { status: 400 });

  const { data: attachment } = await admin!
    .from('template_attachments')
    .select('file_url')
    .eq('id', attachmentId)
    .eq('template_id', params.id)
    .maybeSingle();
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const marker = `/${BUCKET}/`;
  const idx = attachment.file_url.indexOf(marker);
  if (idx >= 0) await admin!.storage.from(BUCKET).remove([attachment.file_url.slice(idx + marker.length)]);

  const { error: delErr } = await admin!.from('template_attachments').delete().eq('id', attachmentId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
