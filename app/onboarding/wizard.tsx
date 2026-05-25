'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Mail, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PLAN_CONFIG } from '@/lib/plans';
import type { PlanType } from '@/types';

type Interval = 'monthly' | 'annual';

const FEATURES: Record<PlanType, string[]> = {
  starter: ['1 manager', '500 sends per month', 'Gmail / Outlook / SMTP', 'Unlimited musicians', 'Email templates'],
  pro: ['3 managers', '3,000 sends per month', 'Everything in Starter', 'Priority support'],
};

export function OnboardingWizard({ initialStep, currentPlanType }: { initialStep: number; currentPlanType: PlanType }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [interval, setInterval] = useState<Interval>('monthly');
  const [planChoice, setPlanChoice] = useState<PlanType>(currentPlanType);
  const [busy, setBusy] = useState(false);

  const advance = async (next: number, completed = false) => {
    setBusy(true);
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: next, completed }),
      });
      setStep(next);
      if (completed) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const choosePlan = async (planType: PlanType) => {
    setPlanChoice(planType);
    setBusy(true);
    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planType, billing_interval: interval }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Failed to start trial');
        return;
      }
      toast.success('Trial started!');
      await advance(2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Stepper step={step} />

        {step === 1 && (
          <Step1Plan
            interval={interval}
            setInterval={setInterval}
            onChoose={choosePlan}
            busy={busy}
            current={planChoice}
          />
        )}
        {step === 2 && <Step2Email onNext={() => advance(3)} busy={busy} />}
        {step === 3 && <Step3Musicians onNext={() => advance(4)} busy={busy} />}
        {step === 4 && (
          <Step4Done
            onFinish={async (to) => {
              await advance(4, true);
              router.push(to);
            }}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ['Plan', 'Email', 'Musicians', 'Done'];
  return (
    <ol className="mb-8 flex items-center justify-between">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <li key={label} className="flex flex-1 items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            <span className={`ml-2 hidden text-sm sm:inline ${active ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className={`mx-3 h-px flex-1 ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Plan({ interval, setInterval, onChoose, busy, current }: {
  interval: 'monthly' | 'annual';
  setInterval: (i: 'monthly' | 'annual') => void;
  onChoose: (p: PlanType) => void;
  busy: boolean;
  current: PlanType;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Choose your plan</h1>
      <p className="mt-1 text-slate-600">Start with a 30-day free trial. No credit card required.</p>

      <div className="mt-6 inline-flex rounded-md bg-slate-200 p-1">
        <button
          onClick={() => setInterval('monthly')}
          className={`rounded px-4 py-1.5 text-sm font-medium ${interval === 'monthly' ? 'bg-white shadow' : 'text-slate-600'}`}
        >Monthly</button>
        <button
          onClick={() => setInterval('annual')}
          className={`rounded px-4 py-1.5 text-sm font-medium ${interval === 'annual' ? 'bg-white shadow' : 'text-slate-600'}`}
        >
          Annual <span className="ml-1 rounded bg-green-100 px-1.5 text-xs text-green-800">Save 20%</span>
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(['starter', 'pro'] as PlanType[]).map((p) => {
          const cfg = PLAN_CONFIG[p];
          const price = interval === 'monthly' ? cfg.priceMonthly : cfg.priceAnnual;
          const unit = interval === 'monthly' ? '/month' : '/year';
          return (
            <div key={p} className={`rounded-lg border bg-white p-6 ${current === p ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
              <h3 className="text-lg font-semibold">{cfg.name}</h3>
              <p className="mt-2"><span className="text-3xl font-bold">${price}</span><span className="text-slate-500">{unit}</span></p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {FEATURES[p].map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-green-600" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => onChoose(p)} loading={busy} className="mt-6 w-full" size="lg">
                Start 30-day Free Trial
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">No credit card required to start trial.</p>
    </div>
  );
}

function Step2Email({ onNext, busy }: { onNext: () => void; busy: boolean }) {
  return (
    <div className="rounded-lg bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Connect your email</h1>
      <p className="mt-1 text-slate-600">Sends will come from your address so musicians recognize you.</p>
      <div className="mt-6 space-y-3">
        <a href="/api/auth/gmail" className="flex w-full items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
          <Mail className="h-5 w-5" />
          <span className="flex-1">Connect Gmail / Google Workspace</span>
        </a>
        <a href="/api/auth/outlook" className="flex w-full items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
          <Mail className="h-5 w-5" />
          <span className="flex-1">Connect Outlook / Microsoft 365</span>
        </a>
        <a href="/dashboard/settings/email" className="block text-center text-sm text-indigo-600 hover:underline">
          Or use another provider (SMTP) in Settings
        </a>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onNext} className="text-sm text-slate-600 hover:underline">Skip for now</button>
        <Button onClick={onNext} loading={busy}>Continue</Button>
      </div>
    </div>
  );
}

function Step3Musicians({ onNext, busy }: { onNext: () => void; busy: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const rows = text.split(/\r?\n/).slice(0, 6).map((r) => r.split(','));
    setPreview(rows);
  };

  return (
    <div className="rounded-lg bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Import musicians</h1>
      <p className="mt-1 text-slate-600">Upload your substitute musician list to get started.</p>

      <label className="mt-6 block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:bg-slate-50">
        <Upload className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">
          {file ? <strong>{file.name}</strong> : 'Click to upload CSV or Excel file'}
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>

      {preview && preview.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {preview.map((row, i) => (
                <tr key={i} className={i === 0 ? 'bg-slate-50 font-semibold' : ''}>
                  {row.map((cell, j) => <td key={j} className="px-2 py-1.5">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 py-1.5 text-xs text-slate-500">Preview of first {preview.length} rows. Full import available after onboarding.</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button onClick={onNext} className="text-sm text-slate-600 hover:underline">
          Skip for now — I&apos;ll add musicians manually
        </button>
        <Button onClick={onNext} loading={busy}>Continue</Button>
      </div>
    </div>
  );
}

function Step4Done({ onFinish, busy }: { onFinish: (to: string) => void; busy: boolean }) {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <Check className="h-6 w-6 text-green-700" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re all set!</h1>
      <p className="mt-2 text-slate-600">Your account and 30-day trial are active.</p>

      <div className="mx-auto mt-6 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm">
        <ul className="space-y-2 text-slate-700">
          <li>✅ Organization created</li>
          <li>✅ Free trial started</li>
          <li>✅ Ready to add musicians and concerts</li>
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={() => onFinish('/dashboard/email/compose')} loading={busy} size="lg">
          Create Your First Concert
        </Button>
        <Button variant="secondary" onClick={() => onFinish('/dashboard')} size="lg">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
