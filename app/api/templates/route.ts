import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const createSchema = z.object({
  name: z.string().min(1).max(150),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  is_default: z.boolean().optional(),
});

// GET /api/templates — all templates for the manager's org, default first.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: templates, error } = await admin
    .from('email_templates')
    .select('*')
    .eq('organization_id', ctx.organization.id)
    .eq('is_one_off', false)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (templates ?? []).map((t) => t.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: atts } = await admin
      .from('template_attachments')
      .select('template_id')
      .in('template_id', ids);
    for (const a of atts ?? []) counts.set(a.template_id, (counts.get(a.template_id) ?? 0) + 1);
  }

  return NextResponse.json({
    templates: (templates ?? []).map((t) => ({ ...t, attachment_count: counts.get(t.id) ?? 0 })),
  });
}

// POST /api/templates — create a template.
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = createSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  if (body.is_default) {
    await admin.from('email_templates').update({ is_default: false }).eq('organization_id', ctx.organization.id);
  }

  const { data, error } = await admin
    .from('email_templates')
    .insert({
      organization_id: ctx.organization.id,
      name: body.name,
      subject: body.subject,
      body: body.body,
      is_default: body.is_default ?? false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
