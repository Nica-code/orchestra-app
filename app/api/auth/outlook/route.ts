import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getOutlookAuthUrl } from '@/lib/outlook';

export const runtime = 'nodejs';

// GET /api/auth/outlook — redirect the manager to Microsoft's consent screen.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Microsoft OAuth is not configured' }, { status: 500 });
  }

  return NextResponse.redirect(getOutlookAuthUrl(ctx.manager.id));
}
