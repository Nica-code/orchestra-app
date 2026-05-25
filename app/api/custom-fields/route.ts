import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const createSchema = z.object({
  label:         z.string().min(1).max(80),
  field_type:    z.enum(['text', 'number', 'date', 'boolean', 'select']).default('text'),
  options:       z.array(z.string()).optional().nullable(),
  is_required:   z.boolean().optional().default(false),
  display_order: z.number().int().optional().default(0),
});

// GET /api/custom-fields — list all definitions for the org
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('custom_field_definitions')
    .select('*')
    .eq('organization_id', ctx.organization.id)
    .order('display_order')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fields: data ?? [] });
}

// POST /api/custom-fields — create a new field definition
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = createSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }

  const admin = createAdminClient();

  // auto display_order = current max + 1
  const { count } = await admin
    .from('custom_field_definitions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', ctx.organization.id);

  const { data, error } = await admin
    .from('custom_field_definitions')
    .insert({
      organization_id: ctx.organization.id,
      label:           body.label,
      field_type:      body.field_type,
      options:         body.options ?? null,
      is_required:     body.is_required,
      display_order:   count ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field: data });
}
