import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Callscade' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to home</Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-3 text-slate-600">Coming soon. Contact us with any questions in the meantime.</p>
    </div>
  );
}
