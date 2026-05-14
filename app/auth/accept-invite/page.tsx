'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface InviteInfo {
  email: string;
  role: string;
  organization_name: string;
  is_existing_user: boolean;
}

const schema = z.object({ password: z.string().min(8, 'At least 8 characters').optional() });
type FormData = z.infer<typeof schema>;

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) { setError('Missing invite token'); return; }
    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) { setError(body.error || 'Invalid invite'); return; }
        setInfo(body);
      })
      .catch(() => setError('Failed to load invite'));
  }, [token]);

  const onSubmit = async ({ password }: FormData) => {
    if (!info || !token) return;
    if (!info.is_existing_user && (!password || password.length < 8)) {
      toast.error('Password is required for new accounts');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Failed to accept'); return; }
      toast.success('Welcome aboard!');
      if (body.requiresLogin) router.push('/auth/login');
      else { router.push('/dashboard'); router.refresh(); }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg bg-white p-8 shadow text-center max-w-md">
        <h1 className="text-xl font-bold text-red-700">Invite problem</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </div>
    );
  }
  if (!info) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
      <h1 className="text-2xl font-bold text-slate-900">Join {info.organization_name}</h1>
      <p className="mt-1 text-sm text-slate-600">
        You&apos;ve been invited as a {info.role} for <strong>{info.email}</strong>.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        {!info.is_existing_user && (
          <Input label="Choose a password" type="password" {...register('password')} error={errors.password?.message} />
        )}
        <Button type="submit" loading={submitting} className="w-full" size="lg">
          {info.is_existing_user ? 'Join Organization' : 'Create Account & Join'}
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
        <AcceptInviteInner />
      </Suspense>
    </div>
  );
}
