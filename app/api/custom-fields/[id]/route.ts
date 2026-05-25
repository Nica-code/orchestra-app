import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const updateSchema = z.object({
  label:       z.string().min(1).max(80).optional(),
  field_type:  z.enum(['text', 'number', 'date', 'boolean', 'select']).optional(),
  options:     z.array(z.string()).nullable().optional(),
  is_required: z.boolean().optional(),
});

// DELETE /api/custom-fields/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('custom_field_definitions')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', ctx.organization.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/custom-fields/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('custom_field_definitions')
    .update(body)
    .eq('id', params.id)
    .eq('organization_id', ctx.organization.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field: data });
}
