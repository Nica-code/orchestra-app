'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({ name: z.string().min(1, 'Name is required').max(120) });
type FormData = z.infer<typeof schema>;

export function OrganizationSettingsForm({ id, name, logoUrl }: { id: string; name: string; logoUrl: string | null }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentLogo, setCurrentLogo] = useState(logoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });

  const onSubmit = async (values: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Save failed'); return; }
      toast.success('Organization updated');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const onLogoChange = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createBrowserClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `${id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('organization-logos').upload(path, file, { upsert: true });
      if (upErr) { toast.error(`Upload failed: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('organization-logos').getPublicUrl(path);
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: pub.publicUrl }),
      });
      if (!res.ok) { toast.error('Failed to save logo'); return; }
      setCurrentLogo(pub.publicUrl);
      toast.success('Logo updated');
      router.refresh();
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Logo</p>
        <div className="flex items-center gap-4">
          {currentLogo ? (
            <img src={currentLogo} alt="Logo" className="h-16 w-16 rounded object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">No logo</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onLogoChange(e.target.files[0])}
          />
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            Upload new logo
          </Button>
        </div>
      </div>

      <Input label="Organization name" {...register('name')} error={errors.name?.message} />

      <Button type="submit" loading={submitting}>Save changes</Button>
    </form>
  );
}
