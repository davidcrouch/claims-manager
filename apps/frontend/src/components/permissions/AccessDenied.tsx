import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AccessDenied({
  title = 'Permission required',
  description = 'You do not have permission to view this page. If you need access, contact your organisation administrator to update your role.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-xl font-medium tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants(), 'mt-6 h-9 px-4')}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
