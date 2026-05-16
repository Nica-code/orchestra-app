import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import type { EmailTemplateWithMeta } from '@/types';

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const { data: template } = await admin
    .from('email_templates')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!template || template.organization_id !== organization.id) notFound();

  const { data: attachments } = await admin
    .from('template_attachments')
    .select('*')
    .eq('template_id', params.id)
    .order('created_at');

  const withMeta: EmailTemplateWithMeta = { ...template, attachments: attachments ?? [] };
  return <TemplateEditor template={withMeta} />;
}
