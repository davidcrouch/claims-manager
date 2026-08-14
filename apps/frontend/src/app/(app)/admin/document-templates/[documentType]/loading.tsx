import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentTemplateDetailLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="mt-2 h-10 w-80" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}
