import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const putSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logo_url: z.string().url().nullable().optional(),
});

async function authorize(orgId: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (ctx.manager.organization_id !== orgId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ctx };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await authorize(params.id);
  if (error) return error;
  return NextResponse.json({ organization: ctx!.organization });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await authorize(params.id);
  if (error) return error;

  let body;
  try { body = putSchema.parse(await req.json()); }
  catch (e) {
    return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: updErr } = await admin
    .from('organizations')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ organization: data });
}
