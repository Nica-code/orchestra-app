import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadOwnedConcert } from '@/lib/concertAuth';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dates: z.array(z.string().regex(dateRe)).min(1).optional(),
  rehearsal_dates: z.array(z.string().regex(dateRe)).nullable().optional(),
  venue: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, concert } = await loadOwnedConcert(params.id);
  if (error) return error;
  const { data: positions } = await admin!
    .from('concert_positions')
    .select('*')
    .eq('concert_id', params.id)
    .order('created_at');
  return NextResponse.json({ concert: { ...concert, positions: positions ?? [] } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await loadOwnedConcert(params.id);
  if (error) return error;

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const { data, error: updErr } = await admin!
    .from('concerts')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ concert: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, concert } = await loadOwnedConcert(params.id);
  if (error) return error;

  if (concert!.status === 'active') {
    return NextResponse.json({ error: 'Cannot delete an active concert' }, { status: 409 });
  }
  const { error: delErr } = await admin!.from('concerts').delete().eq('id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
