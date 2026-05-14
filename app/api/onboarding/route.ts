import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const schema = z.object({
  step: z.number().int().min(1).max(4).optional(),
  completed: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.step !== undefined) update.onboarding_step = body.step;
  if (body.completed !== undefined) update.onboarding_completed = body.completed;

  const admin = createAdminClient();
  const { error } = await admin.from('organizations').update(update).eq('id', ctx.organization.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
