import 'server-only';
import { createAdminClient } from './supabase-server';
import { getActivityDescription } from './activityLogger';
import type { ActivityLog } from '@/types';

export interface DashboardStats {
  activeConcerts: number;
  positionsBeingFilled: number;
  filledToday: number;
  pendingResponses: number;
}

export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  const admin = createAdminClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const nowIso = new Date().toISOString();

  const { data: concerts } = await admin
    .from('concerts').select('id, status').eq('organization_id', organizationId);
  const activeConcerts = (concerts ?? []).filter((c) => c.status === 'active').length;
  const concertIds = (concerts ?? []).map((c) => c.id);

  let positionsBeingFilled = 0;
  if (concertIds.length > 0) {
    const { count } = await admin
      .from('concert_positions').select('id', { count: 'exact', head: true })
      .in('concert_id', concertIds).eq('status', 'active');
    positionsBeingFilled = count ?? 0;
  }

  const { count: filledToday } = await admin
    .from('send_logs').select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId).eq('status', 'accepted')
    .gte('responded_at', startOfToday.toISOString());

  const { count: pendingResponses } = await admin
    .from('send_logs').select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId).eq('status', 'sent')
    .gt('token_expires_at', nowIso);

  return {
    activeConcerts,
    positionsBeingFilled,
    filledToday: filledToday ?? 0,
    pendingResponses: pendingResponses ?? 0,
  };
}

export interface RecentActivityItem {
  id: string;
  description: string;
  managerName: string;
  createdAt: string;
  timeAgo: string;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export async function getRecentActivity(organizationId: string, limit = 10): Promise<RecentActivityItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('activity_logs')
    .select('*, managers(email)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const mgr = (row as { managers: { email: string } | null }).managers;
    return {
      id: row.id,
      description: getActivityDescription(row as ActivityLog),
      managerName: mgr?.email ?? 'System',
      createdAt: row.created_at,
      timeAgo: timeAgo(row.created_at),
    };
  });
}
