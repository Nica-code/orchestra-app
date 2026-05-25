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

  // Broadcast mode: position filled by someone else
  if (sendLog.skip_reason === 'position_filled_by_other') {
    const filledMessage = concert?.filled_message ||
      `Thank you for considering this opportunity. Someone else has accepted the position, so we're all set for now. We truly appreciate your time and will keep you in mind for future opportunities.`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-[480px]">
          <div className="rounded-xl bg-white p-6 shadow-sm text-center">
            <div className="text-center mb-4">
              {organization?.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={organization.logo_url} alt={orgName} className="mx-auto h-12 w-12 rounded object-cover" />
                : <p className="text-lg font-bold text-indigo-600">{orgName}</p>}
            </div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Position Filled</h1>
            <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">{filledMessage}</p>
            <p className="mt-4 text-xs text-slate-400">{orgName} · {concert?.name}</p>
          </div>
        </div>
      </div>
    );
  }

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
