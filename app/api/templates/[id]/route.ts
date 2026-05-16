import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

const BUCKET = 'template-attachments';

async function loadOwned(id: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: template } = await admin.from('email_templates').select('*').eq('id', id).maybeSingle();
  if (!template) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) };
  if (template.organization_id !== ctx.organization.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ctx, admin, template };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, template } = await loadOwned(params.id);
  if (error) return error;
  const { data: attachments } = await admin!
    .from('template_attachments')
    .select('*')
    .eq('template_id', params.id)
    .order('created_at');
  return NextResponse.json({ template: { ...template, attachments: attachments ?? [] } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, ctx } = await loadOwned(params.id);
  if (error) return error;

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  if (body.is_default === true) {
    await admin!.from('email_templates').update({ is_default: false }).eq('organization_id', ctx!.organization.id);
  }

  const { data, error: updErr } = await admin!
    .from('email_templates')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await loadOwned(params.id);
  if (error) return error;

  // Remove attachment files from storage first
  const { data: attachments } = await admin!
    .from('template_attachments')
    .select('file_url')
    .eq('template_id', params.id);
  const paths: string[] = [];
  for (const a of attachments ?? []) {
    const marker = `/${BUCKET}/`;
    const idx = a.file_url.indexOf(marker);
    if (idx >= 0) paths.push(a.file_url.slice(idx + marker.length));
  }
  if (paths.length > 0) await admin!.storage.from(BUCKET).remove(paths);

  // Cascade deletes template_attachments rows
  const { error: delErr } = await admin!.from('email_templates').delete().eq('id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
