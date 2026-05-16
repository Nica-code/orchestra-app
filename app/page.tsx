'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Menu, X } from 'lucide-react';
import { track } from '@/lib/analytics';

const STARTER_FEATURES = [
  '1 manager account', '500 sends per month', 'Unlimited musicians',
  'Gmail & Outlook integration', 'Custom email templates', 'Send history & logs', '30-day free trial',
];
const PRO_FEATURES = [
  '3 manager accounts', '3,000 sends per month', 'Everything in Starter',
  'Priority support', '30-day free trial',
];
const FEATURES = [
  { title: 'Your Email, Your Identity', body: 'Gmail and Outlook integration. Emails come from you.' },
  { title: 'Automatic Sequential Sending', body: 'Contacts musicians in ranked order. Moves on automatically.' },
  { title: 'Custom Email Templates', body: 'Save your standard email. Names and details fill in automatically.' },
  { title: 'Full Send History', body: 'See exactly who was contacted, when, and what they said.' },
  { title: 'Multi-Manager Support', body: 'Multiple managers can share the same musician lists.' },
  { title: 'Works on Any Device', body: 'Manage from your computer. Musicians respond from their phone.' },
];
const FAQS = [
  { q: "Does it work with my orchestra's email address?", a: 'Yes. FirstCall connects to Gmail, Google Workspace, and Microsoft Outlook, so emails come from your real orchestra email address.' },
  { q: 'Can multiple managers use the same account?', a: 'Yes. The Pro plan supports up to 3 managers sharing the same musician lists and concert management.' },
  { q: 'What happens when a musician accepts?', a: "You receive an email notification immediately. The reply-to is set to the musician's address, so you can continue the conversation directly." },
  { q: 'Can I import my existing musician list?', a: 'Yes. Upload any CSV or Excel file with your musician list and FirstCall will import it in minutes.' },
  { q: 'Is there a contract or commitment?', a: 'No. All plans are month-to-month. Cancel anytime with no fees.' },
  { q: 'What happens after the free trial?', a: 'After 30 days, your saved payment method will be charged. You can cancel before then with no charge.' },
];

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { track('landing_page_viewed'); }, []);

  const starterPrice = annual ? '$278/year' : '$29/month';
  const proPrice = annual ? '$568/year' : '$59/month';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-indigo-600">FirstCall</span>
          <nav className="hidden items-center gap-4 sm:flex">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign In</Link>
            <Link href="/auth/signup" onClick={() => track('cta_clicked', { location: 'nav' })}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Start Free Trial
            </Link>
          </nav>
          <button className="sm:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:hidden">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600">Sign In</Link>
            <Link href="/auth/signup" className="rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white">
              Start Free Trial
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Find Substitute Musicians. Stop Wasting Hours on Emails.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          FirstCall automates the process of contacting substitute musicians in ranked order —
          so you can fill positions in minutes, not hours.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/signup" onClick={() => track('cta_clicked', { location: 'hero' })}
            className="w-full rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700 sm:w-auto">
            Start Free Trial — No Credit Card
          </Link>
          <a href="#how-it-works"
            className="w-full rounded-md border border-slate-300 px-6 py-3 text-base font-semibold hover:bg-slate-50 sm:w-auto">
            See How It Works
          </a>
        </div>
        <div className="mx-auto mt-12 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-6 text-left text-sm">
          <p className="font-medium text-slate-500">Ranked list → Email sent → Response</p>
          <div className="mt-3 space-y-2">
            <div className="rounded bg-white p-2 shadow-sm">1. Sarah Johnson — emailed ✓</div>
            <div className="rounded bg-green-50 p-2 text-green-800">Sarah accepted — position filled ✓</div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-slate-200 bg-slate-50 py-6">
        <p className="text-center text-sm text-slate-500">
          Trusted by chamber orchestras, symphony orchestras, and ensembles across the United States
        </p>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">The old way is broken</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { t: 'Hours of manual emails', b: 'Contacting musicians one by one, waiting for each response before moving to the next.' },
            { t: 'Missed performances', b: "Slow back-and-forth means positions go unfilled when musicians aren't available." },
            { t: 'No tracking or history', b: 'No record of who was contacted, when, or why they declined.' },
          ].map((c) => (
            <div key={c.t} className="rounded-lg border border-slate-200 p-5">
              <p className="font-semibold">{c.t}</p>
              <p className="mt-1 text-sm text-slate-600">{c.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">The new way</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { n: 1, t: 'Build your ranked list', b: 'Import your substitute musicians from a spreadsheet. Rank them by preference for each position.' },
              { n: 2, t: 'Start sending with one click', b: 'FirstCall emails your top-ranked available musician automatically, using your own email address.' },
              { n: 3, t: 'Fill positions in minutes', b: 'Musicians accept or decline with one click. On decline, the next musician is contacted automatically.' },
            ].map((s) => (
              <div key={s.n} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{s.n}</div>
                <p className="mt-3 font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-slate-600">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 p-5">
              <p className="font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Simple, transparent pricing</h2>
          <p className="mt-1 text-center text-slate-600">Start free for 30 days. No credit card required.</p>
          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-md bg-slate-200 p-1">
              <button onClick={() => setAnnual(false)}
                className={`rounded px-4 py-1.5 text-sm font-medium ${!annual ? 'bg-white shadow' : 'text-slate-600'}`}>Monthly</button>
              <button onClick={() => setAnnual(true)}
                className={`rounded px-4 py-1.5 text-sm font-medium ${annual ? 'bg-white shadow' : 'text-slate-600'}`}>
                Annual <span className="text-green-700">Save 20%</span>
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-500">For small ensembles and chamber orchestras</p>
              <p className="mt-2 text-2xl font-bold">Starter</p>
              <p className="text-lg">{starterPrice}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {STARTER_FEATURES.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-green-600" />{f}</li>
                ))}
              </ul>
              <Link href="/auth/signup" onClick={() => track('pricing_plan_clicked', { plan: 'starter' })}
                className="mt-6 block rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700">
                Start Free Trial
              </Link>
            </div>
            <div className="rounded-lg border-2 border-indigo-600 bg-white p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">For professional orchestras</p>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Most Popular</span>
              </div>
              <p className="mt-2 text-2xl font-bold">Pro</p>
              <p className="text-lg">{proPrice}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-green-600" />{f}</li>
                ))}
              </ul>
              <Link href="/auth/signup" onClick={() => track('pricing_plan_clicked', { plan: 'pro' })}
                className="mt-6 block rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700">
                Start Free Trial
              </Link>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Need more sends? Additional sends are $10 per 1,000.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-8 space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="rounded-lg border border-slate-200">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-4 py-3 text-left font-medium">
                {f.q}
                <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && <p className="px-4 pb-3 text-sm text-slate-600">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-indigo-600 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to stop chasing musicians?</h2>
          <p className="mt-2 text-indigo-100">
            Join orchestras that have automated their substitute musician process.
          </p>
          <Link href="/auth/signup" onClick={() => track('cta_clicked', { location: 'final' })}
            className="mt-6 inline-block rounded-md bg-white px-6 py-3 text-base font-semibold text-indigo-700 hover:bg-indigo-50">
            Start Free Trial
          </Link>
          <p className="mt-3 text-sm text-indigo-200">
            No credit card required • Cancel anytime • 30-day free trial
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <div>
            <p className="font-bold text-indigo-600">FirstCall</p>
            <p className="text-xs text-slate-500">Automate substitute musician outreach.</p>
          </div>
          <div className="flex gap-4 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-900">Contact</Link>
          </div>
          <p className="text-xs text-slate-400">© 2026 FirstCall. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
