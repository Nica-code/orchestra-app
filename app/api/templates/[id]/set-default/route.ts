import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

// POST /api/templates/[id]/set-default — make this the org's default template.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: template } = await admin.from('email_templates').select('id, organization_id').eq('id', params.id).maybeSingle();
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  if (template.organization_id !== ctx.organization.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await admin.from('email_templates').update({ is_default: false }).eq('organization_id', ctx.organization.id);
  const { error } = await admin.from('email_templates').update({ is_default: true }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
