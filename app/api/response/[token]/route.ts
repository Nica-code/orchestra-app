import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processResponse } from '@/lib/sendEngine';

export const runtime = 'nodejs';

const schema = z.object({ response: z.enum(['accepted', 'declined']) });

// Simple in-memory rate limiter: max 5 requests per token per minute.
const hits = new Map<string, number[]>();
function rateLimited(token: string): boolean {
  const now = Date.now();
  const window = 60 * 1000;
  const recent = (hits.get(token) ?? []).filter((t) => now - t < window);
  recent.push(now);
  hits.set(token, recent);
  return recent.length > 5;
}

// POST /api/response/[token] — PUBLIC (secured by the unguessable token).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  if (rateLimited(token)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  let body;
  try { body = schema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid response value' }, { status: 400 }); }

  try {
    const result = await processResponse(token, body.response);
    return NextResponse.json({ success: true, action: result.action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    if (/invalid response link/i.test(msg)) return NextResponse.json({ error: msg }, { status: 404 });
    if (/already been used/i.test(msg)) return NextResponse.json({ error: msg }, { status: 409 });
    if (/expired/i.test(msg)) return NextResponse.json({ error: msg }, { status: 410 });
    console.error('[response] error:', msg);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
