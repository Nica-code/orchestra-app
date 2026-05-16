import { format } from 'date-fns';
import { createAdminClient } from '@/lib/supabase-server';
import { formatConcertDates } from '@/lib/concertDates';
import { ResponseClient } from './client';

export const dynamic = 'force-dynamic';

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export default async function ResponsePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: sendLog } = await admin
    .from('send_logs')
    .select('*')
    .eq('token', params.token)
    .maybeSingle();

  if (!sendLog) {
    return <ErrorScreen title="Invalid Link"
      message="This response link is invalid or does not exist. Please check your email for the correct link." />;
  }

  // Load concert / position / organization / musician for display
  const { data: position } = sendLog.concert_position_id
    ? await admin.from('concert_positions').select('*').eq('id', sendLog.concert_position_id).maybeSingle()
    : { data: null };
  const { data: concert } = position
    ? await admin.from('concerts').select('*').eq('id', position.concert_id).maybeSingle()
    : { data: null };
  const { data: organization } = concert
    ? await admin.from('organizations').select('name, logo_url').eq('id', concert.organization_id).maybeSingle()
    : { data: null };
  const { data: musician } = sendLog.musician_id
    ? await admin.from('musicians').select('first_name, last_name').eq('id', sendLog.musician_id).maybeSingle()
    : { data: null };

  const orgName = organization?.name ?? 'the orchestra';

  if (sendLog.token_used_at) {
    const when = sendLog.responded_at ? format(new Date(sendLog.responded_at), 'MMMM d, yyyy') : '';
    const verb = sendLog.status === 'accepted' ? 'accepted' : 'declined';
    return <ErrorScreen title="Already Responded"
      message={`You have already responded to this request. You ${verb}${when ? ` on ${when}` : ''}. Please contact ${orgName} if you have questions.`} />;
  }

  if (new Date(sendLog.token_expires_at) < new Date()) {
    return <ErrorScreen title="Link Expired"
      message={`This response link has expired. Please contact ${orgName} directly.`} />;
  }

  return (
    <ResponseClient
      token={params.token}
      firstName={musician?.first_name ?? 'there'}
      organizationName={orgName}
      logoUrl={organization?.logo_url ?? null}
      concertName={concert?.name ?? 'Concert'}
      positionName={position?.position_name ?? 'Position'}
      dates={concert ? formatConcertDates(concert.dates) : ''}
      venue={concert?.venue ?? null}
      deadline={format(new Date(sendLog.token_expires_at), "EEEE, MMMM d 'at' h:mm a")}
      deadlineSoon={new Date(sendLog.token_expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000}
    />
  );
}
