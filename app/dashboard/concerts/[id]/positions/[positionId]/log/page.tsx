import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { SendLogClient, type LogRow } from './client';

export default async function SendLogPage({ params }: { params: { id: string; positionId: string } }) {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const { data: position } = await admin
    .from('concert_positions').select('*').eq('id', params.positionId).maybeSingle();
  if (!position || position.concert_id !== params.id) notFound();
  const { data: concert } = await admin.from('concerts').select('*').eq('id', params.id).maybeSingle();
  if (!concert || concert.organization_id !== organization.id) notFound();

  const { data: cpm } = await admin
    .from('concert_position_musicians')
    .select('*, musicians(first_name, last_name, email)')
    .eq('concert_position_id', params.positionId)
    .order('rank');

  const { data: logs } = await admin
    .from('send_logs')
    .select('*')
    .eq('concert_position_id', params.positionId)
    .order('created_at', { ascending: false });
  const logByCpm = new Map<string, NonNullable<typeof logs>[number]>();
  for (const l of logs ?? []) {
    if (l.concert_position_musician_id && !logByCpm.has(l.concert_position_musician_id)) {
      logByCpm.set(l.concert_position_musician_id, l);
    }
  }

  const summary = { totalContacted: 0, accepted: 0, declined: 0, noResponse: 0, skipped: 0 };
  const rows: LogRow[] = (cpm ?? []).map((r) => {
    const m = (r as { musicians: { first_name: string; last_name: string; email: string } | null }).musicians;
    if (r.status === 'accepted') { summary.totalContacted++; summary.accepted++; }
    else if (r.status === 'declined') { summary.totalContacted++; summary.declined++; }
    else if (r.status === 'no_response') { summary.totalContacted++; summary.noResponse++; }
    else if (r.status === 'sent') summary.totalContacted++;
    else if (r.status === 'skipped') summary.skipped++;
    const sl = logByCpm.get(r.id);
    return {
      rank: r.rank,
      name: `${m?.first_name ?? ''} ${m?.last_name ?? ''}`.trim(),
      email: m?.email ?? '',
      status: r.status,
      skipReason: r.skip_reason ?? null,
      sentAt: sl?.sent_at ?? null,
      respondedAt: r.responded_at ?? null,
      tokenExpiresAt: sl?.token_expires_at ?? null,
      emailSubject: sl?.email_subject ?? null,
      emailBody: sl?.email_body ?? null,
    };
  });

  const acceptedRow = rows.find((r) => r.status === 'accepted');

  return (
    <SendLogClient
      concertId={params.id}
      positionId={params.positionId}
      concertName={concert.name}
      positionName={position.position_name}
      positionStatus={position.status}
      autoResend={position.auto_resend_enabled}
      rows={rows}
      summary={summary}
      acceptedName={acceptedRow?.name ?? null}
      acceptedAt={acceptedRow?.respondedAt ?? null}
    />
  );
}
