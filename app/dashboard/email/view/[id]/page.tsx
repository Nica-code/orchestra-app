'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Circle, SkipForward, Mail } from 'lucide-react';

interface Recipient {
  id: string;
  musician_id: string;
  rank: number;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  skip_reason: string | null;
  musician: { first_name: string; last_name: string; email: string } | null;
}

interface SendLog {
  id: string;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  email_subject: string | null;
  email_body: string | null;
  musician_id: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Position {
  id: string;
  send_mode: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; cls: string }> = {
  pending:    { label: 'Pending',   icon: Circle,       cls: 'text-slate-400' },
  sent:       { label: 'Awaiting',  icon: Clock,        cls: 'text-blue-500' },
  accepted:   { label: 'Accepted',  icon: CheckCircle2, cls: 'text-green-500' },
  declined:   { label: 'Declined',  icon: XCircle,      cls: 'text-red-400' },
  no_response:{ label: 'No reply',  icon: Clock,        cls: 'text-amber-500' },
  skipped:    { label: 'Skipped',   icon: SkipForward,  cls: 'text-slate-300' },
};

function timeStr(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EmailViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLog, setPreviewLog] = useState<SendLog | null>(null);

  const load = useCallback(async () => {
    try {
      const [concertRes, posRes] = await Promise.all([
        fetch(`/api/concerts/${id}`),
        fetch(`/api/concerts/${id}/positions`),
      ]);
      const concertData = await concertRes.json();
      const posData = await posRes.json();

      setProject(concertData.concert ?? null);
      const pos = posData.positions?.[0] ?? null;
      setPosition(pos);

      if (pos) {
        const [musRes, logRes] = await Promise.all([
          fetch(`/api/concerts/${id}/positions/${pos.id}/musicians`),
          fetch(`/api/concerts/${id}/send-logs`),
        ]);
        const musData = await musRes.json();
        const logData = await logRes.json();
        setRecipients(musData.musicians ?? []);
        setSendLogs(logData.logs ?? []);
      }
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Find the most recently sent email body to preview
  const latestSentLog = sendLogs.find((l) => l.email_body) ?? null;

  const statusCfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  if (loading) {
    return <div className="mx-auto max-w-3xl pt-10 text-center text-slate-400">Loading…</div>;
  }

  if (!project) {
    return <div className="mx-auto max-w-3xl pt-10 text-center text-slate-400">Not found</div>;
  }

  const isBroadcast = position?.send_mode === 'broadcast';

  // Sort recipients by rank
  const sorted = [...recipients].sort((a, b) => a.rank - b.rank);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-0.5 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {isBroadcast ? '📡 Broadcast' : '⬇ Cascade'} · sent {timeStr(project.created_at)}
          </p>
        </div>
        <span className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          project.status === 'active'    ? 'bg-blue-100 text-blue-700' :
          project.status === 'filled'    ? 'bg-green-100 text-green-700' :
          project.status === 'completed' ? 'bg-green-100 text-green-700' :
          project.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                           'bg-slate-100 text-slate-600'
        }`}>
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>
      </div>

      {/* Email preview */}
      {latestSentLog && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Email sent</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {latestSentLog.email_subject}
            </p>
          </div>
          <div
            className="px-4 py-4 text-sm text-slate-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: latestSentLog.email_body ?? '' }}
          />
        </div>
      )}

      {/* Recipients */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Recipients
            <span className="ml-2 text-xs font-normal text-slate-400">
              {isBroadcast ? 'All sent simultaneously' : 'Cascade order'}
            </span>
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sorted.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-400">No recipients</p>
          )}
          {sorted.map((r) => {
            const cfg = statusCfg(r.status);
            const Icon = cfg.icon;
            // Find send log for this recipient to show email preview
            const log = sendLogs.find((l) => l.musician_id === r.musician_id);

            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                {/* Rank badge (cascade only) */}
                {!isBroadcast && (
                  <span className="shrink-0 w-6 text-center text-xs font-bold text-slate-300">
                    {r.rank}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {r.musician
                      ? `${r.musician.first_name} ${r.musician.last_name}`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.musician?.email}
                    {r.responded_at && ` · responded ${timeStr(r.responded_at)}`}
                    {r.sent_at && !r.responded_at && ` · sent ${timeStr(r.sent_at)}`}
                    {r.skip_reason === 'position_filled_by_other' && ' · position filled by someone else'}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <Icon className={`h-4 w-4 ${cfg.cls}`} />
                  <span className={`text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                  {log?.email_body && (
                    <button
                      onClick={() => setPreviewLog(previewLog?.id === log.id ? null : log)}
                      className="ml-1 text-xs text-slate-400 underline hover:text-slate-700"
                    >
                      view
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual email preview (expanded inline) */}
      {previewLog && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-indigo-100 px-4 py-2">
            <p className="text-xs font-semibold text-indigo-700">Email preview</p>
            <button onClick={() => setPreviewLog(null)} className="text-xs text-indigo-400 hover:text-indigo-700">close</button>
          </div>
          <div
            className="px-4 py-4 text-sm text-slate-800 prose prose-sm max-w-none bg-white"
            dangerouslySetInnerHTML={{ __html: previewLog.email_body ?? '' }}
          />
        </div>
      )}
    </div>
  );
}
