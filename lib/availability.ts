import { createAdminClient } from './supabase-server';

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

/**
 * Checks whether a musician is available on a given date.
 * Returns { available: false, reason } if the date falls inside any
 * manager-set unavailability window.
 *
 * Called by the send engine (Part 7).
 */
export async function isMusicianAvailable(
  musicianId: string,
  concertDate: string | Date,
): Promise<AvailabilityResult> {
  const date = typeof concertDate === 'string' ? concertDate.slice(0, 10) : concertDate.toISOString().slice(0, 10);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('musician_availability')
    .select('start_date, end_date, reason')
    .eq('musician_id', musicianId)
    .lte('start_date', date)
    .gte('end_date', date);

  if (error) {
    // Fail open: if we can't check, assume available rather than blocking sends
    console.error('[availability] check failed:', error.message);
    return { available: true };
  }

  if (data && data.length > 0) {
    return { available: false, reason: data[0].reason ?? 'Unavailable' };
  }
  return { available: true };
}

/** Synchronous helper: is `today` inside any of the supplied windows? */
export function isCurrentlyUnavailable(
  windows: { start_date: string; end_date: string }[],
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  return windows.some((w) => w.start_date <= today && w.end_date >= today);
}
