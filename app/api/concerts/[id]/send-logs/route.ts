import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

// GET /api/concerts/[id]/send-logs — all send logs for a project, with musician names
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Verify concert belongs to org
  const { data: concert } = await admin
    .from('concerts')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', ctx.organization.id)
    .maybeSingle();
  if (!concert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get all position IDs for this concert
  const { data: positions } = await admin
    .from('concert_positions')
    .select('id')
    .eq('concert_id', params.id);

  const positionIds = (positions ?? []).map((p) => p.id);
  if (positionIds.length === 0) return NextResponse.json({ logs: [] });

  // Fetch logs with musician info joined
  const { data: logs, error } = await admin
    .from('send_logs')
    .select(`
      id, status, sent_at, responded_at, email_subject, email_body,
      musician_id, skip_reason, concert_position_id,
      musicians ( id, first_name, last_name, email )
    `)
    .in('concert_position_id', positionIds)
    .order('sent_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: logs ?? [] });
}
