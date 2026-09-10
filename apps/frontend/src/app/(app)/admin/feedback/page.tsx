import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FeedbackListClient } from '@/components/admin/FeedbackListClient';

export const metadata = { title: 'Feedback — EnsureOS' };

export default async function FeedbackPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <Suspense fallback={null}>
      <FeedbackListClient />
    </Suspense>
  );
}
