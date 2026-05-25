'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MAX_BYTES = 10 * 1024 * 1024;
const REQUIRED = ['first_name', 'last_name', 'email', 'position', 'rank'] as const;
const OPTIONAL = ['phone', 'notes'] as const;
type FieldKey = (typeof REQUIRED)[number] | (typeof OPTIONAL)[number];
const FIELD_LABELS: Record<FieldKey, string> = {
  first_name: 'First Name', last_name: 'Last Name', email: 'Email',
  position: 'Position', rank: 'Rank', phone: 'Phone', notes: 'Notes',
};
const ALIASES: Record<FieldKey, string[]> = {
  first_name: ['firstname', 'first', 'fname', 'givenname'],
  last_name: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  email: ['email', 'emailaddress', 'mail', 'e-mail'],
  position: ['position', 'instrument', 'role', 'section', 'part'],
  rank: ['rank', 'ranking', 'priority', 'order'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'tel'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks'],
};
const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, '');

type Mapping = Record<FieldKey, string>;
interface ImportError { row: number; reason: string; data: Record<string, unknown>; }

export function ImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({} as Mapping);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: ImportError[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const parseFile = async (f: File) => {
    if (f.size > MAX_BYTES) { toast.error('File exceeds the 10MB limit'); return; }
    const lower = f.name.toLowerCase();
    let parsedRows: Record<string, unknown>[] = [];
    try {
      if (lower.endsWith('.csv')) {
        const text = await f.text();
        const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        parsedRows = res.data;
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const wb = XLSX.read(await f.arrayBuffer());
        parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      } else {
        toast.error('Unsupported file type. Use .csv, .xlsx, or .xls'); return;
      }
    } catch {
      toast.error('Could not parse that file'); return;
    }
    if (parsedRows.length === 0) { toast.error('File has no data rows'); return; }

    const cols = Object.keys(parsedRows[0]);
    // auto-detect mapping
    const auto = {} as Mapping;
    [...REQUIRED, ...OPTIONAL].forEach((field) => {
      const match = cols.find((c) => ALIASES[field].includes(norm(c)))
        ?? cols.find((c) => norm(c).includes(norm(field)));
      auto[field] = match ?? '';
    });

    setFile(f);
    setHeaders(cols);
    setRows(parsedRows);
    setMapping(auto);
    setStep(2);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const requiredMapped = REQUIRED.every((f) => mapping[f]);

  const mapped = useMemo(() => {
    return rows.map((r) => {
      const out: Record<string, string> = {};
      ([...REQUIRED, ...OPTIONAL] as FieldKey[]).forEach((f) => {
        out[f] = mapping[f] ? String(r[mapping[f]] ?? '').trim() : '';
      });
      return out;
    });
  }, [rows, mapping]);

  const rowIssues = (r: Record<string, string>): string[] => {
    const issues: string[] = [];
    REQUIRED.forEach((f) => { if (!r[f]) issues.push(`Missing ${FIELD_LABELS[f]}`); });
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) issues.push('Invalid email');
    if (r.rank && !Number.isInteger(Number(r.rank))) issues.push('Rank not a number');
    return issues;
  };
  const warningCount = useMemo(() => mapped.filter((r) => rowIssues(r).length > 0).length, [mapped]);

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setProgress(20);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      setProgress(50);
      const res = await fetch('/api/musicians/import', { method: 'POST', body: fd });
      setProgress(90);
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Import failed'); return; }
      setResult(body);
      setProgress(100);
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrors = () => {
    if (!result) return;
    const csv = Papa.unparse(result.errors.map((e) => ({ row: e.row, reason: e.reason, ...e.data })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'import-errors.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(1); setFile(null); setHeaders([]); setRows([]); setMapping({} as Mapping);
    setResult(null); setProgress(0);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Import Contacts</h1>
      <p className="mt-1 text-sm text-slate-500">Step {step} of 4</p>

      {/* STEP 1 — Upload */}
      {step === 1 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-6 rounded-lg border-2 border-dashed p-12 text-center ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm text-slate-600">Drag and drop your file here</p>
          <p className="text-xs text-slate-400">Accepts .csv, .xlsx, .xls — max 10MB</p>
          <label className="mt-4 inline-block">
            <span className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">Or click to browse</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
          </label>
        </div>
      )}

      {/* STEP 2 — Map columns */}
      {step === 2 && (
        <div className="mt-6">
          <p className="text-sm text-slate-600">File: <strong>{file?.name}</strong> ({rows.length} rows)</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([...REQUIRED, ...OPTIONAL] as FieldKey[]).map((f) => (
              <div key={f}>
                <label className="block text-sm font-medium text-slate-700">
                  {FIELD_LABELS[f]} {REQUIRED.includes(f as typeof REQUIRED[number]) && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={mapping[f] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Not mapped —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium text-slate-700">Preview (first 3 rows)</p>
          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>{[...REQUIRED, ...OPTIONAL].map((f) => <th key={f} className="px-2 py-1.5 text-left">{FIELD_LABELS[f as FieldKey]}</th>)}</tr>
              </thead>
              <tbody>
                {mapped.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {[...REQUIRED, ...OPTIONAL].map((f) => <td key={f} className="px-2 py-1.5">{r[f]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={reset}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!requiredMapped}>
              {requiredMapped ? 'Continue' : 'Map all required fields'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Preview & import */}
      {step === 3 && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-medium text-slate-700">Ready to import {mapped.length - warningCount} musicians</span>
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {warningCount} rows have issues
              </span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>{[...REQUIRED, ...OPTIONAL].map((f) => <th key={f} className="px-2 py-1.5 text-left">{FIELD_LABELS[f as FieldKey]}</th>)}</tr>
              </thead>
              <tbody>
                {mapped.slice(0, 10).map((r, i) => {
                  const issues = rowIssues(r);
                  return (
                    <tr key={i} title={issues.join('; ')} className={`border-t border-slate-100 ${issues.length ? 'bg-yellow-50' : ''}`}>
                      {[...REQUIRED, ...OPTIONAL].map((f) => <td key={f} className="px-2 py-1.5">{r[f]}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mapped.length > 10 && <p className="mt-1 text-xs text-slate-400">Showing first 10 of {mapped.length} rows.</p>}

          {importing && (
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={importing}>Back</Button>
            <Button onClick={runImport} loading={importing} disabled={!requiredMapped}>Import</Button>
          </div>
        </div>
      )}

      {/* STEP 4 — Results */}
      {step === 4 && result && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-lg font-semibold text-green-700">Successfully imported {result.imported} contacts</p>
          {result.skipped > 0 && (
            <div className="mt-2">
              <p className="text-sm text-amber-700">{result.skipped} rows skipped due to errors.</p>
              <button onClick={downloadErrors} className="mt-1 text-sm font-medium text-indigo-600 hover:underline">
                Download error report
              </button>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <Link href="/dashboard/musicians"><Button>View Contacts</Button></Link>
            <Button variant="secondary" onClick={reset}>Import Another File</Button>
          </div>
        </div>
      )}
    </div>
  );
}
