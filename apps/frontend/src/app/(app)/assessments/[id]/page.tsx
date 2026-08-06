import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AssessmentDetailClient } from '@/components/assessments/AssessmentDetailClient';
import { AssessmentPageHeader } from '@/components/assessments/AssessmentPageHeader';
import type { Metadata } from 'next';
import type { Job } from '@/types/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Assessment | EnsureOS' };

  const assessment = await api.getAssessment(id).catch(() => null);
  const title = assessment?.name ?? 'Assessment';
  return { title: `${title} | EnsureOS` };
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { id } = await params;
  const { jobId } = await searchParams;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const assessment = await api.getAssessment(id).catch((err: unknown) => {
    console.error(
      'frontend:AssessmentDetailPage - getAssessment failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!assessment) notFound();

  const effectiveJobId = jobId ?? assessment.jobId ?? undefined;
  let job: Job | null = null;
  if (effectiveJobId) {
    job = await api.getJob(effectiveJobId).catch((err: unknown) => {
      console.error(
        'frontend:AssessmentDetailPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
  }

  const backHref = job ? `/assessments?jobId=${job.id}` : '/assessments';

  return (
    <>
      <SetPageHeader>
        <AssessmentPageHeader assessment={assessment} job={job} backHref={backHref} />
      </SetPageHeader>
      <AssessmentDetailClient assessment={assessment} />
    </>
  );
}
