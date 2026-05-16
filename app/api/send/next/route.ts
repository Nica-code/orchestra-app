import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { triggerNextManually } from '@/lib/sendEngine';

export const runtime = 'nodejs';

const schema = z.object({ concertPositionId: z.string().uuid() });

// POST /api/send/next
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const { data: position } = await admin
    .from('concert_positions')
    .select('id, concerts(organization_id)')
    .eq('id', body.concertPositionId)
    .maybeSingle();
  const orgId = (position as { concerts: { organization_id: string } | null } | null)?.concerts?.organization_id;
  if (!position || orgId !== ctx.organization.id) {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 });
  }

  const result = await triggerNextManually(body.concertPositionId, ctx.manager.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
