import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const postSchema = z.object({
  start_date: z.string().regex(dateRe, 'Expected YYYY-MM-DD'),
  end_date: z.string().regex(dateRe, 'Expected YYYY-MM-DD'),
  reason: z.string().max(200).nullable().optional(),
});

async function ownMusician(id: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: musician } = await admin.from('musicians').select('id, organization_id').eq('id', id).maybeSingle();
  if (!musician) return { error: NextResponse.json({ error: 'Musician not found' }, { status: 404 }) };
  if (musician.organization_id !== ctx.organization.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await ownMusician(params.id);
  if (error) return error;
  const { data } = await admin!
    .from('musician_availability')
    .select('*')
    .eq('musician_id', params.id)
    .order('start_date');
  return NextResponse.json({ availability: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await ownMusician(params.id);
  if (error) return error;

  let body;
  try { body = postSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  if (body.start_date > body.end_date) {
    return NextResponse.json({ error: 'Start date must be on or before end date' }, { status: 400 });
  }

  const { data, error: insErr } = await admin!
    .from('musician_availability')
    .insert({ musician_id: params.id, ...body })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ availability: data });
}

// DELETE /api/musicians/[id]/availability?entry=<availability_id>
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await ownMusician(params.id);
  if (error) return error;

  const entryId = req.nextUrl.searchParams.get('entry');
  if (!entryId) return NextResponse.json({ error: 'Missing entry id' }, { status: 400 });

  const { error: delErr } = await admin!
    .from('musician_availability')
    .delete()
    .eq('id', entryId)
    .eq('musician_id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
