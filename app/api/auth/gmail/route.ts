import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getGmailAuthUrl } from '@/lib/gmail';

export const runtime = 'nodejs';

// GET /api/auth/gmail — redirect the manager to Google's consent screen.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 500 });
  }

  const url = getGmailAuthUrl(ctx.manager.id);
  return NextResponse.redirect(url);
}
