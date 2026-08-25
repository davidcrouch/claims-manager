'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  Briefcase,
  ChevronsUpDown,
  MapPin,
  ExternalLink,
  X,
  Filter,
  Search,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { JobsPickerDrawer } from '@/components/jobs/JobsPickerDrawer';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { formatDate, formatDateTime, formatCurrency, formatAddress } from '@/components/shared/detail';
import { jobHeaderSubtitle, jobHeaderTitle } from '@/components/shared/job-label';
import type { Job, Claim } from '@/types/api';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type Dict = Record<string, unknown>;

export type EntityPageAccent =
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'orange'
  | 'teal'
  | 'indigo'
  | 'rose'
  | 'slate';

const ACCENT_CLASSES: Record<
  EntityPageAccent,
  { iconBg: string; iconText: string; badgeBg: string; badgeText: string }
> = {
  blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  violet: { iconBg: 'bg-violet-100', iconText: 'text-violet-600', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700' },
  orange: { iconBg: 'bg-orange-100', iconText: 'text-orange-600', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
  teal: { iconBg: 'bg-teal-100', iconText: 'text-teal-600', badgeBg: 'bg-teal-100', badgeText: 'text-teal-700' },
  indigo: { iconBg: 'bg-indigo-100', iconText: 'text-indigo-600', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  rose: { iconBg: 'bg-rose-100', iconText: 'text-rose-600', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
  slate: { iconBg: 'bg-muted', iconText: 'text-muted-foreground', badgeBg: 'bg-muted', badgeText: 'text-muted-foreground' },
};

export interface EntityStat {
  label: string;
  value: ReactNode;
}

export interface EntityBreakdownItem {
  name: string;
  count: number;
}

export interface EntityPageHeaderProps {
  icon: IconComponent;
  title: string;
  accent?: EntityPageAccent;
  total: number;
  showing?: number;
  search?: string;
  statusSelectedCount?: number;
  stats?: EntityStat[];
  breakdown?: EntityBreakdownItem[];
  /** When set, the header shows job details and the entity list is scoped to this job. */
  job?: Job | null;
  parentClaim?: Claim | null;
}

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function addressLine(job: Job): string {
  return formatAddress(job.address as Dict | undefined, {
    fallback: {
      suburb: job.addressSuburb,
      state: job.addressState,
      postcode: job.addressPostcode,
      country: job.addressCountry,
    },
  });
}

/**
 * Unified page header for entity list pages. Adapts between two modes:
 * - Job-filtered: shows job details, picker, and entity metrics scoped to job
 * - All-jobs: shows aggregate entity metrics with option to select a job
 */
export function EntityPageHeader({
  icon: Icon,
  title,
  accent = 'slate',
  total,
  showing,
  search,
  statusSelectedCount,
  stats,
  breakdown,
  job,
  parentClaim,
}: EntityPageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const accentCls = ACCENT_CLASSES[accent];

  const handleJobSelect = (selectedJob: Job) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('jobId', selectedJob.id);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearJobFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('jobId');
    params.delete('jobIds');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const trimmedSearch = search?.trim();
  const hasStatusFilter = typeof statusSelectedCount === 'number' && statusSelectedCount > 0;
  const showShowing = typeof showing === 'number' && showing !== total;

  if (job) {
    const api = getApi(job);
    const topLabel = jobHeaderSubtitle(job);
    const linkTitle = jobHeaderTitle(job);
    const statusName =
      job.status?.name ??
      ((api.status as Dict | undefined)?.name as string | undefined) ??
      'Unknown';
    const jobTypeName =
      job.jobType?.name ??
      ((api.jobType as Dict | undefined)?.name as string | undefined);
    const address = addressLine(job);
    const parentClaimNumber =
      parentClaim?.claimNumber ??
      parentClaim?.externalReference ??
      ((api.claim as Dict | undefined)?.claimNumber as string | undefined) ??
      ((api.claim as Dict | undefined)?.externalReference as string | undefined);

    return (
      <>
        <PageHeaderLayout
          icon={
            <PageHeaderIcon
              icon={Briefcase}
              className="bg-emerald-100"
              iconClassName="text-emerald-600"
            />
          }
          topTitle={
            topLabel ? (
              <Link
                href={`/jobs/${job.id}`}
                className="group min-w-0 max-w-full rounded-md outline-none transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                title="View job"
              >
                <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {topLabel}
                </p>
              </Link>
            ) : undefined
          }
          title={
            <Link
              href={`/jobs/${job.id}`}
              className="group min-w-0 max-w-full rounded-md outline-none transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title="View job"
            >
              <h1 className="truncate font-mono text-lg font-semibold leading-tight uppercase underline-offset-4 group-hover:underline">
                {linkTitle}
              </h1>
            </Link>
          }
          titleActions={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                title="Switch job"
                aria-label="Switch job"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={clearJobFilter}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                title={`Show all ${title.toLowerCase()}`}
                aria-label="Clear job filter"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          }
          topRow={
            <>
              <StatusBadge status={statusName} />
              {jobTypeName && <TypeBadge type={jobTypeName} />}
              {address && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {address}
                </span>
              )}
              {job.claimId && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Claim:</span>
                  <Link
                    href={`/claims/${job.claimId}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {parentClaimNumber ?? job.claimId}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accentCls.badgeBg} ${accentCls.badgeText}`}
              >
                {total.toLocaleString()} {title.toLowerCase()}
              </span>
            </>
          }
          bottomRow={
            <>
              <PageHeaderField label="Request">{formatDate(job.requestDate)}</PageHeaderField>
              <PageHeaderField label="Updated">{formatDateTime(job.updatedAt)}</PageHeaderField>
              {job.excess != null && job.excess !== '' && (
                <PageHeaderField label="Excess">{formatCurrency(job.excess)}</PageHeaderField>
              )}
              {stats?.map((s) => (
                <PageHeaderField key={s.label} label={s.label}>
                  {s.value}
                </PageHeaderField>
              ))}
            </>
          }
        />
        <JobsPickerDrawer
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          selectedJobId={job.id}
          onJobSelect={handleJobSelect}
        />
      </>
    );
  }

  return (
    <>
      <PageHeaderLayout
        icon={
          <PageHeaderIcon
            icon={Icon}
            className={accentCls.iconBg}
            iconClassName={accentCls.iconText}
          />
        }
        title={title}
        topRow={
          <>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accentCls.badgeBg} ${accentCls.badgeText}`}>
              {total.toLocaleString()} total
            </span>
            {showShowing && (
              <span className="text-xs text-muted-foreground">
                Showing {showing!.toLocaleString()}
              </span>
            )}
            {trimmedSearch && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <Search className="h-3 w-3" />
                &ldquo;{trimmedSearch}&rdquo;
              </span>
            )}
            {hasStatusFilter && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                {statusSelectedCount} {statusSelectedCount === 1 ? 'status' : 'statuses'}
              </span>
            )}
            {breakdown && breakdown.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                {breakdown.map((item) => (
                  <span
                    key={item.name}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {item.name}
                    <span className="font-medium text-foreground">{item.count}</span>
                  </span>
                ))}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title="Filter by job"
            >
              <Briefcase className="h-3 w-3" />
              Filter by job
            </button>
          </>
        }
        bottomRow={
          stats && stats.length > 0
            ? stats.map((s) => (
                <PageHeaderField key={s.label} label={s.label}>
                  {s.value}
                </PageHeaderField>
              ))
            : undefined
        }
      />
      <JobsPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedJobId=""
        onJobSelect={handleJobSelect}
      />
    </>
  );
}
