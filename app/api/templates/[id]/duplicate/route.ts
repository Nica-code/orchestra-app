import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

// POST /api/templates/[id]/duplicate — copy a template (and its attachment rows).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: original } = await admin.from('email_templates').select('*').eq('id', params.id).maybeSingle();
  if (!original) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  if (original.organization_id !== ctx.organization.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: copy, error } = await admin
    .from('email_templates')
    .insert({
      organization_id: original.organization_id,
      name: `${original.name} (copy)`,
      subject: original.subject,
      body: original.body,
      is_default: false,
    })
    .select()
    .single();
  if (error || !copy) return NextResponse.json({ error: error?.message ?? 'Copy failed' }, { status: 500 });

  // Copy attachment rows (reuse the same stored files / URLs)
  const { data: attachments } = await admin
    .from('template_attachments')
    .select('file_name, file_url, file_size, mime_type')
    .eq('template_id', params.id);
  if (attachments && attachments.length > 0) {
    await admin.from('template_attachments').insert(
      attachments.map((a) => ({ ...a, template_id: copy.id })),
    );
  }

  return NextResponse.json({ template: copy });
}
