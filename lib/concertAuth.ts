import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentManager } from './auth';
import { createAdminClient } from './supabase-server';

type AdminClient = ReturnType<typeof createAdminClient>;
type Ctx = NonNullable<Awaited<ReturnType<typeof getCurrentManager>>>;

interface ConcertResult {
  error?: NextResponse;
  admin?: AdminClient;
  ctx?: Ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  concert?: any;
}
interface PositionResult extends ConcertResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  position?: any;
}

/** Loads a concert and verifies it belongs to the current manager's org. */
export async function loadOwnedConcert(concertId: string): Promise<ConcertResult> {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: concert } = await admin.from('concerts').select('*').eq('id', concertId).maybeSingle();
  if (!concert) return { error: NextResponse.json({ error: 'Concert not found' }, { status: 404 }) };
  if (concert.organization_id !== ctx.organization.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ctx, admin, concert };
}

/** Loads a position, verifying it belongs to the given concert and the manager's org. */
export async function loadOwnedPosition(concertId: string, positionId: string): Promise<PositionResult> {
  const owned = await loadOwnedConcert(concertId);
  if (owned.error) return owned;
  const { data: position } = await owned.admin!
    .from('concert_positions')
    .select('*')
    .eq('id', positionId)
    .maybeSingle();
  if (!position || position.concert_id !== concertId) {
    return { error: NextResponse.json({ error: 'Position not found' }, { status: 404 }) };
  }
  return { ...owned, position };
}
