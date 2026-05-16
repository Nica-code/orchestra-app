import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

// GET /api/musicians/positions -> [{ position, count }]
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('musicians')
    .select('position')
    .eq('organization_id', ctx.organization.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.position, (counts.get(row.position) ?? 0) + 1);

  const positions = Array.from(counts.entries())
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => a.position.localeCompare(b.position));

  return NextResponse.json({ positions });
}
