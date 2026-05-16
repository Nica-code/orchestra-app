import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// mapping: our field -> source column header
const mappingSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().min(1),
  position: z.string().min(1),
  rank: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

interface ImportError { row: number; reason: string; data: Record<string, unknown>; }

function parseFile(name: string, buf: Buffer): Record<string, unknown>[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = buf.toString('utf-8');
    const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return result.data;
  }
  // xlsx / xls
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const mappingRaw = form.get('mapping');

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });

  let mapping;
  try { mapping = mappingSchema.parse(JSON.parse(String(mappingRaw ?? '{}'))); }
  catch { return NextResponse.json({ error: 'Invalid or missing column mapping' }, { status: 400 }); }

  let rows: Record<string, unknown>[];
  try {
    rows = parseFile(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: `Failed to parse file: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Existing emails in this org (to skip dupes)
  const { data: existing } = await admin
    .from('musicians')
    .select('email')
    .eq('organization_id', ctx.organization.id);
  const seenEmails = new Set((existing ?? []).map((m) => String(m.email).toLowerCase()));

  const valid: Record<string, unknown>[] = [];
  const errors: ImportError[] = [];

  rows.forEach((raw, i) => {
    const get = (key: string) => String(raw[key] ?? '').trim();
    const first_name = get(mapping.first_name);
    const last_name = get(mapping.last_name);
    const email = get(mapping.email).toLowerCase();
    const position = get(mapping.position);
    const rankStr = get(mapping.rank);
    const phone = mapping.phone ? get(mapping.phone) : '';
    const notes = mapping.notes ? get(mapping.notes) : '';
    const rowNum = i + 2; // header is row 1

    const missing: string[] = [];
    if (!first_name) missing.push('first name');
    if (!last_name) missing.push('last name');
    if (!email) missing.push('email');
    if (!position) missing.push('position');
    if (!rankStr) missing.push('rank');
    if (missing.length) {
      errors.push({ row: rowNum, reason: `Missing required: ${missing.join(', ')}`, data: raw });
      return;
    }
    if (!emailRe.test(email)) {
      errors.push({ row: rowNum, reason: 'Invalid email format', data: raw });
      return;
    }
    const rank = Number(rankStr);
    if (!Number.isFinite(rank) || rank < 1 || !Number.isInteger(rank)) {
      errors.push({ row: rowNum, reason: 'Rank must be a positive integer', data: raw });
      return;
    }
    if (seenEmails.has(email)) {
      errors.push({ row: rowNum, reason: 'Duplicate email (already exists or repeated in file)', data: raw });
      return;
    }
    seenEmails.add(email);
    valid.push({
      organization_id: ctx.organization.id,
      first_name, last_name, email, position, rank,
      phone: phone || null,
      notes: notes || null,
    });
  });

  let imported = 0;
  if (valid.length > 0) {
    // insert in chunks of 500
    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500);
      const { error, data } = await admin.from('musicians').insert(chunk).select('id');
      if (error) {
        return NextResponse.json({ error: `Insert failed: ${error.message}`, imported, skipped: errors.length, errors }, { status: 500 });
      }
      imported += data?.length ?? 0;
    }
  }

  return NextResponse.json({ imported, skipped: errors.length, errors });
}
