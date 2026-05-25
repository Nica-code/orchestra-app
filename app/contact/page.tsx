import Link from 'next/link';

export const metadata = { title: 'Contact — Callscade' };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to home</Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Contact us</h1>
      <p className="mt-3 text-slate-600">
        Questions or feedback? Email us at{' '}
        <a href="mailto:support@callscade.app" className="font-medium text-indigo-600 hover:underline">
          support@callscade.app
        </a>{' '}
        and we&apos;ll get back to you within one business day.
      </p>
    </div>
  );
}
