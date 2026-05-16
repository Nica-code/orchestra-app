import 'server-only';
import { createAdminClient } from './supabase-server';
import type { ActivityLog } from '@/types';

/**
 * Inserts an activity log row. NEVER throws — activity logging must not
 * break the main operation. Call AFTER the main operation succeeds.
 */
export async function logActivity(params: {
  organizationId: string;
  managerId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('activity_logs').insert({
      organization_id: params.organizationId,
      manager_id: params.managerId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
    });
  } catch (err) {
    console.error('[activityLogger] failed to log activity:', err);
  }
}

/** Builds a human-readable description from an activity log row. */
export function getActivityDescription(log: Pick<ActivityLog, 'action' | 'details'>): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  const s = (k: string): string => (d[k] === undefined || d[k] === null ? '' : String(d[k]));
  const musician = s('musician_name');
  const position = s('position_name');
  const concert = s('concert_name');

  switch (log.action) {
    case 'concert_created': return `Created concert "${concert}"`;
    case 'concert_updated': return `Updated concert "${concert}"`;
    case 'concert_deleted': return `Deleted concert "${concert}"`;
    case 'concert_status_changed': return `Changed "${concert}" status to ${s('status')}`;
    case 'position_added': return `Added ${position} position to "${concert}"`;
    case 'position_updated': return `Updated ${position} position in "${concert}"`;
    case 'position_deleted': return `Removed ${position} position from "${concert}"`;
    case 'send_started': return `Started sending for ${position} (${concert})`;
    case 'send_accepted': return `${musician} accepted ${position} for ${concert}`;
    case 'send_declined': return `${musician} declined ${position} for ${concert}`;
    case 'send_no_response': return `No response from ${musician} for ${position} (${concert})`;
    case 'send_failed': return `Email to ${musician} failed (${position}, ${concert})`;
    case 'send_skipped': return `Skipped ${musician} for ${position} — ${s('reason')}`;
    case 'send_next_triggered': return `Sent to next musician for ${position} (${concert})`;
    case 'position_exhausted': return `${position} exhausted — no musicians available (${concert})`;
    case 'position_filled': return `${position} filled for ${concert}`;
    case 'musician_added': return `Added musician ${musician}`;
    case 'musician_updated': return `Updated musician ${musician}`;
    case 'musician_deleted': return `Deleted musician ${musician}`;
    case 'musician_imported': return `Imported ${s('count')} musicians`;
    case 'musician_blacklisted': return `Blacklisted ${musician}`;
    case 'musician_unblacklisted': return `Un-blacklisted ${musician}`;
    case 'template_created': return `Created template "${s('template_name')}"`;
    case 'template_updated': return `Updated template "${s('template_name')}"`;
    case 'template_deleted': return `Deleted template "${s('template_name')}"`;
    case 'manager_invited': return `Invited manager ${s('email')}`;
    case 'manager_removed': return `Removed manager ${s('email')}`;
    case 'email_connected': return `Connected email account (${s('provider')})`;
    case 'email_disconnected': return 'Disconnected email account';
    case 'plan_upgraded': return `Upgraded plan to ${s('plan')}`;
    case 'plan_downgraded': return `Downgraded plan to ${s('plan')}`;
    default: return log.action.replace(/_/g, ' ');
  }
}

/** Maps an action to a broad category, for the activity-log filter UI. */
export function getActionCategory(action: string): 'send' | 'concert' | 'musician' | 'account' {
  if (action.startsWith('send_') || action.startsWith('position_')) return 'send';
  if (action.startsWith('concert_')) return 'concert';
  if (action.startsWith('musician_') || action.startsWith('template_')) return 'musician';
  return 'account';
}

export const ACTION_CATEGORIES: Record<string, string[]> = {
  send: ['send_started', 'send_accepted', 'send_declined', 'send_no_response', 'send_failed',
    'send_skipped', 'send_next_triggered', 'position_exhausted', 'position_filled',
    'position_added', 'position_updated', 'position_deleted'],
  concert: ['concert_created', 'concert_updated', 'concert_deleted', 'concert_status_changed'],
  musician: ['musician_added', 'musician_updated', 'musician_deleted', 'musician_imported',
    'musician_blacklisted', 'musician_unblacklisted', 'template_created', 'template_updated', 'template_deleted'],
  account: ['manager_invited', 'manager_removed', 'email_connected', 'email_disconnected',
    'plan_upgraded', 'plan_downgraded'],
};
