import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadOwnedPosition } from '@/lib/concertAuth';

const putSchema = z.object({
  order: z.array(z.object({ id: z.string().uuid(), rank: z.number().int().min(1) })).min(1),
});

// GET — full ranked musician list for the position, with status + flags.
export async function GET(_req: NextRequest, { params }: { params: { id: string; positionId: string } }) {
  const { error, admin, concert } = await loadOwnedPosition(params.id, params.positionId);
  if (error) return error;

  const { data: rows } = await admin!
    .from('concert_position_musicians')
    .select('*, musicians(first_name, last_name, email, is_blacklisted)')
    .eq('concert_position_id', params.positionId)
    .order('rank');

  // Determine which musicians are unavailable on any concert date
  const musicianIds = (rows ?? []).map((r) => r.musician_id);
  const unavailable = new Set<string>();
  const dates: string[] = concert!.dates ?? [];
  if (musicianIds.length > 0 && dates.length > 0) {
    const { data: windows } = await admin!
      .from('musician_availability')
      .select('musician_id, start_date, end_date')
      .in('musician_id', musicianIds);
    for (const w of windows ?? []) {
      if (dates.some((d) => w.start_date <= d && w.end_date >= d)) {
        unavailable.add(w.musician_id);
      }
    }
  }

  const musicians = (rows ?? []).map((r) => {
    const m = (r as { musicians: { first_name: string; last_name: string; email: string; is_blacklisted: boolean } | null }).musicians;
    return {
      id: r.id,
      concert_position_id: r.concert_position_id,
      musician_id: r.musician_id,
      rank: r.rank,
      status: r.status,
      sent_at: r.sent_at,
      responded_at: r.responded_at,
      skip_reason: r.skip_reason,
      created_at: r.created_at,
      first_name: m?.first_name ?? '',
      last_name: m?.last_name ?? '',
      email: m?.email ?? '',
      is_blacklisted: m?.is_blacklisted ?? false,
      currently_unavailable: unavailable.has(r.musician_id),
    };
  });

  return NextResponse.json({ musicians });
}

// PUT — reorder the position's musician list (only before sending starts).
export async function PUT(req: NextRequest, { params }: { params: { id: string; positionId: string } }) {
  const { error, admin, position } = await loadOwnedPosition(params.id, params.positionId);
  if (error) return error;

  if (position!.status !== 'pending') {
    return NextResponse.json({ error: 'Musician order cannot be changed after sending has started' }, { status: 409 });
  }

  let body;
  try { body = putSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  for (const { id, rank } of body.order) {
    const { error: updErr } = await admin!
      .from('concert_position_musicians')
      .update({ rank })
      .eq('id', id)
      .eq('concert_position_id', params.positionId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
