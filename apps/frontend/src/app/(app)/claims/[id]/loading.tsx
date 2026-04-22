import { Skeleton } from '@/components/ui/skeleton';

export default function ClaimDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-60" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-52" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        </div>
      </div>

      <Skeleton className="h-8 w-[520px]" />

      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
