import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadOwnedConcert } from '@/lib/concertAuth';
import type { ProjectStatus } from '@/types';

const schema = z.object({ status: z.enum(['draft', 'active', 'filled', 'completed', 'cancelled']) });

// Allowed transitions
const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft:     ['active', 'cancelled'],
  active:    ['filled', 'completed', 'cancelled'],
  filled:    ['closed' as ProjectStatus, 'cancelled'],
  completed: [],
  cancelled: [],
};

// PUT /api/concerts/[id]/status
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, concert } = await loadOwnedConcert(params.id);
  if (error) return error;

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const current = concert!.status as ProjectStatus;
  const next = body.status;
  if (current === next) return NextResponse.json({ concert });
  if (!TRANSITIONS[current].includes(next)) {
    return NextResponse.json({ error: `Cannot change status from ${current} to ${next}` }, { status: 409 });
  }

  // Marking completed requires all positions filled or cancelled
  if (next === 'completed') {
    const { data: positions } = await admin!
      .from('concert_positions')
      .select('status')
      .eq('concert_id', params.id);
    const unfinished = (positions ?? []).filter((p) => p.status !== 'filled' && p.status !== 'cancelled');
    if (unfinished.length > 0) {
      return NextResponse.json({
        error: 'All positions must be filled or cancelled before completing the concert',
      }, { status: 409 });
    }
  }

  const { data, error: updErr } = await admin!
    .from('concerts')
    .update({ status: next })
    .eq('id', params.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ concert: data });
}
