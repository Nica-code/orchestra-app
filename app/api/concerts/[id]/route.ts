import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadOwnedConcert } from '@/lib/concertAuth';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  accept_deadline_hours: z.number().int().min(1).max(8760).optional(),
  accept_deadline_text: z.string().max(500).nullable().optional(),
  custom_variables: z.record(z.string(), z.string()).optional(),
  status: z.enum(['draft', 'active', 'filled', 'completed', 'cancelled']).optional(),
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
