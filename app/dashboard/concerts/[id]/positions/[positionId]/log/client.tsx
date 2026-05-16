'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCountdown, formatCountdown } from '@/hooks/useCountdown';

export interface LogRow {
  rank: number;
  name: string;
  email: string;
  status: string;
  skipReason: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  tokenExpiresAt: string | null;
  emailSubject: string | null;
  emailBody: string | null;
}

interface Props {
  concertId: string;
  positionId: string;
  concertName: string;
  positionName: string;
  positionStatus: string;
  autoResend: boolean;
  rows: LogRow[];
  summary: { totalContacted: number; accepted: number; declined: number; noResponse: number; skipped: number };
  acceptedName: string | null;
  acceptedAt: string | null;
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  sent: { cls: 'bg-blue-100 text-blue-700', label: 'Awaiting response' },
  accepted: { cls: 'bg-green-100 text-green-700', label: 'Accepted' },
  declined: { cls: 'bg-red-100 text-red-700', label: 'Declined' },
  no_response: { cls: 'bg-slate-100 text-slate-600', label: 'No response' },
  failed: { cls: 'border border-red-300 text-red-700', label: 'Failed' },
  skipped: { cls: 'bg-slate-100 italic text-slate-500', label: 'Skipped' },
  pending: { cls: 'bg-slate-50 text-slate-400', label: 'Not contacted' },
};

function PendingCountdown({ iso }: { iso: string }) {
  const cd = useCountdown(iso);
  return <span className={cd.isExpired ? 'text-red-600' : 'text-blue-700'}>{formatCountdown(cd)}</span>;
}

export function SendLogClient(props: Props) {
  const router = useRouter();
  const [emailModal, setEmailModal] = useState<LogRow | null>(null);
  const [busy, setBusy] = useState(false);

  const sendNext = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/send/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertPositionId: props.positionId }),
      });
      const b = await res.json();
      if (!res.ok) { toast.error(b.error || 'Failed'); return; }
      if (b.sent) toast.success(`Email sent to ${b.musicianName}`);
      else toast.warning(b.reason || 'Nothing sent');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { label: 'Contacted', value: props.summary.totalContacted },
    { label: 'Accepted', value: props.summary.accepted },
    { label: 'Declined', value: props.summary.declined },
    { label: 'No Response', value: props.summary.noResponse },
    { label: 'Skipped', value: props.summary.skipped },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/dashboard/concerts/${props.concertId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to concert
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{props.positionName} — Send Log</h1>
      <p className="text-sm text-slate-500">{props.concertName}</p>

      {/* Banners */}
      {props.positionStatus === 'filled' && props.acceptedName && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✓ Position filled by <strong>{props.acceptedName}</strong>
          {props.acceptedAt && ` — accepted ${fmt(props.acceptedAt)}`}
        </div>
      )}
      {props.positionStatus === 'exhausted' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          All musicians have been contacted — {props.summary.totalContacted} contacted, none available.
          Consider adding more musicians to your list.
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Musician</th>
              <th className="px-4 py-3">Sent At</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Responded At</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.rows.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
              const isPending = r.status === 'sent';
              return (
                <tr key={r.rank} className={isPending ? 'bg-blue-50' : ''}>
                  <td className="px-4 py-3">{r.rank}</td>
                  <td className={`px-4 py-3 ${r.status === 'skipped' ? 'text-slate-400' : ''}`}>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.sentAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                      {r.status === 'accepted' && <Check className="h-3 w-3" />}
                      {r.status === 'declined' && <X className="h-3 w-3" />}
                      {r.status === 'no_response' && <Clock className="h-3 w-3" />}
                      {badge.label}
                    </span>
                    {r.status === 'skipped' && r.skipReason && (
                      <span className="ml-1 text-xs text-slate-400" title={r.skipReason}>({r.skipReason})</span>
                    )}
                    {isPending && r.tokenExpiresAt && (
                      <div className="mt-1 text-xs">
                        Response due in <PendingCountdown iso={r.tokenExpiresAt} />
                        {props.autoResend
                          ? <div className="text-slate-400">Will auto-send to next when expired</div>
                          : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmt(r.respondedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.emailBody && (
                      <button onClick={() => setEmailModal(r)} className="text-xs font-medium text-indigo-600 hover:underline">
                        View Email
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {props.rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No musicians on this list.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {props.positionStatus === 'active' && !props.autoResend && (
        <div className="mt-4">
          <Button onClick={sendNext} loading={busy}>Send to Next Musician</Button>
        </div>
      )}

      <Modal open={!!emailModal} onClose={() => setEmailModal(null)} title="Email Preview" maxWidth="max-w-2xl">
        {emailModal && (
          <div>
            <div className="space-y-1 border-b border-slate-200 pb-3 text-sm">
              <p><span className="text-slate-400">To:</span> {emailModal.email}</p>
              <p><span className="text-slate-400">Subject:</span> <strong>{emailModal.emailSubject}</strong></p>
              <p><span className="text-slate-400">Sent:</span> {fmt(emailModal.sentAt)}</p>
            </div>
            <div className="mt-3 max-h-[50vh] overflow-y-auto text-sm"
              dangerouslySetInnerHTML={{ __html: emailModal.emailBody ?? '' }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
