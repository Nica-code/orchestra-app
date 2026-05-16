'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface Props {
  token: string;
  firstName: string;
  organizationName: string;
  logoUrl: string | null;
  concertName: string;
  positionName: string;
  dates: string;
  venue: string | null;
  deadline: string;
  deadlineSoon: boolean;
}

type Screen = 'choose' | 'confirm-accept' | 'confirm-decline' | 'accepted' | 'declined';

export function ResponseClient(props: Props) {
  const [screen, setScreen] = useState<Screen>('choose');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (screen === 'accepted' || screen === 'declined') {
      const t = setTimeout(() => { try { window.close(); } catch { /* blocked */ } }, 3000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const submit = async (response: 'accepted' | 'declined') => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/response/${props.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Something went wrong'); return; }
      setScreen(response === 'accepted' ? 'accepted' : 'declined');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const btn = 'flex w-full items-center justify-center gap-2 rounded-lg text-base font-semibold';
  const btnH = { minHeight: 56 };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-[480px]">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          {/* Org header */}
          <div className="text-center">
            {props.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={props.logoUrl} alt={props.organizationName} className="mx-auto h-12 w-12 rounded object-cover" />
              : <p className="text-lg font-bold text-indigo-600">{props.organizationName}</p>}
          </div>

          {/* Concert card */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-bold text-slate-900">{props.concertName}</p>
            <p className="mt-1 text-sm text-slate-700">Position: {props.positionName}</p>
            {props.dates && <p className="text-sm text-slate-700">{props.dates}</p>}
            {props.venue && <p className="text-sm text-slate-600">{props.venue}</p>}
          </div>

          {(screen === 'choose') && (
            <>
              <div className="mt-4 text-sm text-slate-700">
                <p>Hi {props.firstName},</p>
                <p className="mt-1">{props.organizationName} is inviting you to perform.</p>
                <p className="mt-1">Please respond below:</p>
              </div>
              <p className={`mt-3 text-sm ${props.deadlineSoon ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                Please respond by {props.deadline}
              </p>
              {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <div className="mt-5 space-y-3">
                <button style={btnH} onClick={() => setScreen('confirm-accept')}
                  className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
                  <Check className="h-5 w-5" /> Accept
                </button>
                <button style={btnH} onClick={() => setScreen('confirm-decline')}
                  className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                  <X className="h-5 w-5" /> Decline
                </button>
              </div>
            </>
          )}

          {screen === 'confirm-accept' && (
            <div className="mt-5">
              <p className="text-lg font-bold text-slate-900">Confirm Acceptance</p>
              <p className="mt-2 text-sm text-slate-700">
                You are accepting the position of {props.positionName} for {props.concertName}
                {props.dates ? ` (${props.dates})` : ''}. Please confirm this is correct:
              </p>
              {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <div className="mt-4 space-y-3">
                <button style={btnH} disabled={submitting} onClick={() => submit('accepted')}
                  className={`${btn} bg-green-600 text-white hover:bg-green-700 disabled:opacity-60`}>
                  {submitting ? 'Submitting…' : 'Confirm — I Accept'}
                </button>
                <button style={btnH} disabled={submitting} onClick={() => { setScreen('choose'); setError(null); }}
                  className={`${btn} border border-slate-300 bg-white text-slate-700`}>
                  Go Back
                </button>
              </div>
            </div>
          )}

          {screen === 'confirm-decline' && (
            <div className="mt-5">
              <p className="text-lg font-bold text-slate-900">Confirm Decline</p>
              <p className="mt-2 text-sm text-slate-700">
                You are declining this offer for {props.positionName} for {props.concertName}
                {props.dates ? ` (${props.dates})` : ''}.
              </p>
              {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <div className="mt-4 space-y-3">
                <button style={btnH} disabled={submitting} onClick={() => submit('declined')}
                  className={`${btn} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}>
                  {submitting ? 'Submitting…' : 'Confirm — I Decline'}
                </button>
                <button style={btnH} disabled={submitting} onClick={() => { setScreen('choose'); setError(null); }}
                  className={`${btn} border border-slate-300 bg-white text-slate-700`}>
                  Go Back
                </button>
              </div>
            </div>
          )}

          {screen === 'accepted' && (
            <div className="mt-6 text-center">
              <div className="mx-auto flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="mt-4 text-xl font-bold text-slate-900">You have accepted!</p>
              <p className="mt-2 text-sm text-slate-600">
                Thank you, {props.firstName}. {props.organizationName} has been notified.
              </p>
              <p className="mt-1 text-sm text-slate-500">You may now close this window.</p>
            </div>
          )}

          {screen === 'declined' && (
            <div className="mt-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <X className="h-8 w-8 text-slate-500" />
              </div>
              <p className="mt-4 text-xl font-bold text-slate-900">You have declined.</p>
              <p className="mt-2 text-sm text-slate-600">
                Thank you for letting us know, {props.firstName}.
              </p>
              <p className="mt-1 text-sm text-slate-500">You may now close this window.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
