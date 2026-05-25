'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Circle, SkipForward, Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface RecipientRow {
  id: string;
  musician_id: string;
  rank: number;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  skip_reason: string | null;
  musicians: { first_name: string; last_name: string; email: string } | null;
}

interface SendLog {
  id: string;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  email_subject: string | null;
  email_body: string | null;
  musician_id: string;
  skip_reason: string | null;
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

const STATUS_CFG: Record<string, { label: string; icon: typeof Circle; cls: string }> = {
  pending:     { label: 'Pending',   icon: Circle,       cls: 'text-slate-400' },
  sent:        { label: 'Awaiting',  icon: Clock,        cls: 'text-blue-500' },
  accepted:    { label: 'Accepted',  icon: CheckCircle2, cls: 'text-green-500' },
  declined:    { label: 'Declined',  icon: XCircle,      cls: 'text-red-400' },
  no_response: { label: 'No reply',  icon: Clock,        cls: 'text-amber-500' },
  skipped:     { label: 'Skipped',   icon: SkipForward,  cls: 'text-slate-300' },
};

function timeStr(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function EmailViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [bodyOpen, setBodyOpen] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [concertRes, posRes] = await Promise.all([
        fetch(`/api/concerts/${id}`),
        fetch(`/api/concerts/${id}/positions`),
      ]);
      if (!concertRes.ok) throw new Error('Concert not found');
      const concertData = await concertRes.json();
      const posData = await posRes.json();

      setProject(concertData.concert ?? null);
      const pos: Position | null = posData.positions?.[0] ?? null;
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="mx-auto max-w-3xl pt-16 text-center text-slate-400">Loading…</div>;
  if (!project) return <div className="mx-auto max-w-3xl pt-16 text-center text-slate-400">Not found</div>;

  const isBroadcast = position?.send_mode === 'broadcast';

  // The email body to preview — grab from the first send log that has a body
  const firstLog = sendLogs.find((l) => l.email_body);

  // Sort recipients by rank
  const sorted = [...recipients].sort((a, b) => a.rank - b.rank);

  const projectStatusCls =
    project.status === 'active'    ? 'bg-blue-100 text-blue-700' :
    project.status === 'filled'    ? 'bg-green-100 text-green-700' :
    project.status === 'completed' ? 'bg-green-100 text-green-700' :
    project.status === 'cancelled' ? 'bg-red-100 text-red-700'    :
                                     'bg-slate-100 text-slate-600';

  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {isBroadcast ? '📡 Broadcast' : '⬇ Cascade'} · {timeStr(project.created_at) ?? ''}
          </p>
        </div>
        <span className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${projectStatusCls}`}>
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>
      </div>

      {/* Email body preview (collapsible) */}
      {firstLog && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setBodyOpen((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left"
          >
            <Mail className="h-4 w-4 text-slate-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{firstLog.email_subject}</p>
            </div>
            {bodyOpen
              ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
          </button>
          {bodyOpen && (
            <div
              className="px-4 py-4 text-sm text-slate-800 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: firstLog.email_body ?? '' }}
            />
          )}
        </div>
      )}

      {/* Recipients */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
            // Use send log status if available (more accurate than cpm status)
            const log = sendLogs.find((l) => l.musician_id === r.musician_id);
            const statusKey = log?.status ?? r.status;
            const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.pending;
            const Icon = cfg.icon;
            const name = r.musicians
              ? `${r.musicians.first_name} ${r.musicians.last_name}`
              : '—';
            const email = r.musicians?.email ?? '';
            const when = log?.responded_at
              ? `responded ${timeStr(log.responded_at)}`
              : log?.sent_at
                ? `sent ${timeStr(log.sent_at)}`
                : null;

            return (
              <div key={r.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {!isBroadcast && (
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-300">
                      {r.rank}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{name}</p>
                    <p className="text-xs text-slate-400">
                      {email}{when ? ` · ${when}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${cfg.cls}`} />
                    <span className={`text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    {log?.email_body && (
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="ml-1 rounded p-0.5 text-xs text-slate-400 hover:text-indigo-600"
                        title="View email sent to this person"
                      >
                        {expandedLog === log.id
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {/* Inline email body for this recipient */}
                {expandedLog === log?.id && log?.email_body && (
                  <div
                    className="border-t border-indigo-50 bg-indigo-50 px-4 py-3 text-sm text-slate-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: log.email_body }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
