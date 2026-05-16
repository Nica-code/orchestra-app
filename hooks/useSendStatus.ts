'use client';

import { useEffect, useRef, useState } from 'react';

export interface SendStatusData {
  position_status: string;
  current_musician: { name: string; email: string; sent_at: string | null } | null;
  deadline: string | null;
  time_remaining: string | null;
  total_contacted: number;
  total_available: number;
  auto_resend_enabled: boolean;
  latest_send_log: unknown;
}

/**
 * Polls /api/send/status/[id] every 30s while the position is active.
 * Stops once status becomes 'filled' or 'exhausted'.
 */
export function useSendStatus(concertPositionId: string, isActive: boolean): SendStatusData | null {
  const [status, setStatus] = useState<SendStatusData | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    stopped.current = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/send/status/${concertPositionId}`);
        if (!res.ok) return;
        const data: SendStatusData = await res.json();
        setStatus(data);
        if (data.position_status === 'filled' || data.position_status === 'exhausted') {
          stopped.current = true;
          if (timer) clearInterval(timer);
        }
      } catch {
        /* ignore transient errors */
      }
    };

    poll();
    timer = setInterval(() => { if (!stopped.current) poll(); }, 30000);
    return () => { if (timer) clearInterval(timer); };
  }, [concertPositionId, isActive]);

  return status;
}
