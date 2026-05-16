import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Get Started — FirstCall' };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <span className="text-lg font-bold text-indigo-600">FirstCall</span>
        </div>
      </header>
      {children}
    </div>
  );
}
