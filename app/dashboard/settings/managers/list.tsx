'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Manager, ManagerInvite, ManagerRole } from '@/types';

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['admin', 'manager']),
});
type InviteForm = z.infer<typeof inviteSchema>;

interface Props {
  currentManagerId: string;
  currentManagerRole: ManagerRole;
  managers: Manager[];
  invites: ManagerInvite[];
  limit: number;
  used: number;
}

export function ManagersList({ currentManagerId, currentManagerRole, managers, invites, limit, used }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const isAdmin = currentManagerRole === 'admin';
  const atLimit = used >= limit;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'manager' },
  });

  const sendInvite = async (data: InviteForm) => {
    const res = await fetch('/api/managers/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) { toast.error(body.error || 'Failed to send invite'); return; }
    toast.success(`Invite sent to ${data.email}`);
    reset();
    setModalOpen(false);
    router.refresh();
  };

  const removeManager = async (id: string) => {
    if (!confirm('Remove this manager?')) return;
    const res = await fetch(`/api/managers/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json(); toast.error(b.error || 'Failed'); return; }
    toast.success('Manager removed');
    router.refresh();
  };

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <div />
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)} disabled={atLimit} title={atLimit ? 'Upgrade to add more managers' : ''}>
            Invite Manager
          </Button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {managers.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">{m.email}{m.id === currentManagerId && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                <td className="px-4 py-3 capitalize">{m.role}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${m.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && m.id !== currentManagerId && (
                    <button onClick={() => removeManager(m.id)} className="text-red-600 hover:text-red-700" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id} className="bg-slate-50">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3 capitalize">{i.role}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">pending</span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite manager</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit(sendInvite)} className="mt-4 space-y-4">
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  {...register('role')}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>Send Invite</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
