'use client';

import type { ComponentType, ReactNode, SVGProps } from 'react';
import Link from 'next/link';
import {
  Bot,
  Building2,
  Cable,
  ListTree,
  Package,
  Server,
  Sparkles,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { SetCurrentJob } from './CurrentJobProvider';
import { jobHeaderTitle } from '@/components/shared/job-label';
import type { Job } from '@/types/api';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ADMIN_PAGE_HEADER_ICONS = {
  bot: Bot,
  sparkles: Sparkles,
  package: Package,
  server: Server,
  cable: Cable,
  'list-tree': ListTree,
  building: Building2,
} as const;

export type AdminPageHeaderIcon = keyof typeof ADMIN_PAGE_HEADER_ICONS;

export function PageHeaderIcon({
  icon: Icon,
  className,
  iconClassName,
}: {
  icon: IconComponent;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        className,
      )}
    >
      <Icon className={cn('h-4 w-4', iconClassName)} />
    </span>
  );
}

export function PageHeaderField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function renderMainTitle(title: ReactNode, mono?: boolean) {
  if (typeof title === 'string' || typeof title === 'number') {
    return (
      <h1
        className={cn(
          'truncate text-lg font-semibold leading-tight',
          mono && 'font-mono uppercase',
        )}
      >
        {title}
      </h1>
    );
  }
  return title;
}

function renderCwTitle(topTitle: ReactNode) {
  if (typeof topTitle === 'string' || typeof topTitle === 'number') {
    return (
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {topTitle}
      </p>
    );
  }
  return topTitle;
}

function renderSubtitle(subtitle: ReactNode) {
  if (typeof subtitle === 'string' || typeof subtitle === 'number') {
    return (
      <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
    );
  }
  return subtitle;
}

export interface PageHeaderLayoutProps {
  /** Back button or other control; sits beside the menu collapse. */
  leading?: ReactNode;
  /** Entity icon; sits to the right of the chrome cluster. */
  icon: ReactNode;
  /** Top of the title column (CW / external reference). */
  topTitle?: ReactNode;
  /** Record title. Row 2 when `topTitle` is set, otherwise row 1. */
  title: ReactNode;
  /** Render string titles in mono uppercase (internal numbers). */
  titleMono?: boolean;
  /** Title-column row 2 when `topTitle` is omitted (e.g. admin description). */
  subtitle?: ReactNode;
  /** Controls beside the titles (job picker); spans both rows. */
  titleActions?: ReactNode;
  /** Badges and chips aligned with the top title. */
  topRow?: ReactNode;
  /** Fields aligned with the record title. */
  bottomRow?: ReactNode;
  titleColumnClassName?: string;
  className?: string;
  /** When set on a detail page, shows the internal job number above collapse + back. */
  job?: Job | null;
}

/**
 * Shared app-header content grid:
 * chrome (job / collapse / back) | entity icon | titles | badges / fields.
 * Page actions and the user menu live in `AppHeader` as sibling full-height columns.
 */
function HeaderSidebarTrigger() {
  return (
    <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
  );
}

function isInternalJobProvider(provider?: string | null): boolean {
  const normalized = (provider ?? '').trim().toLowerCase();
  return !normalized || normalized === 'internal' || normalized === 'direct';
}

function HeaderChrome({
  job,
  leading,
}: {
  job?: Job | null;
  leading?: ReactNode;
}) {
  const controls = (
    <div className="flex items-center">
      <HeaderSidebarTrigger />
      {leading}
    </div>
  );

  if (!job) {
    return <div className="flex items-center self-stretch">{controls}</div>;
  }

  const internal = isInternalJobProvider(job.provider);

  return (
    <div className="flex flex-col items-start justify-center gap-0.5">
      <Link
        href={`/jobs/${job.id}`}
        className={cn(
          'max-w-48 truncate rounded-md px-2 py-0.5 font-mono text-xs font-semibold uppercase leading-tight tracking-wide text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-1',
          internal
            ? 'bg-emerald-600 focus-visible:ring-emerald-500/40'
            : 'bg-blue-600 focus-visible:ring-blue-500/40',
        )}
        title="View current job"
      >
        {jobHeaderTitle(job)}
      </Link>
      {controls}
    </div>
  );
}

export function PageHeaderLayout({
  leading,
  icon,
  topTitle,
  title,
  titleMono,
  subtitle,
  titleActions,
  topRow,
  bottomRow,
  titleColumnClassName,
  className,
  job,
}: PageHeaderLayoutProps) {
  const hasActions = titleActions != null && titleActions !== false;
  const hasTopTitle = topTitle != null && topTitle !== false && topTitle !== '';
  const hasSubtitle =
    !hasTopTitle && subtitle != null && subtitle !== false && subtitle !== '';
  const hasTopRow = topRow != null && topRow !== false;
  const hasBottomRow = bottomRow != null && bottomRow !== false;
  const twoRows = hasTopTitle || hasSubtitle || hasBottomRow;

  const cols: string[] = ['auto', 'auto', 'minmax(0,auto)'];
  if (hasActions) cols.push('auto');
  cols.push('minmax(0,1fr)');

  let nextCol = 1;
  const chromeCol = nextCol++;
  const iconCol = nextCol++;
  const titleCol = nextCol++;
  const actionsCol = hasActions ? nextCol++ : 0;
  const metaCol = nextCol++;
  const rowSpan = twoRows ? '1 / -1' : '1';
  const titleCellClass = cn(
    'min-w-0 max-w-[22rem] self-center',
    titleColumnClassName,
  );

  return (
    <>
      {job ? <SetCurrentJob job={job} /> : null}
      <div
        data-slot="page-header-layout"
        className={cn('grid w-full min-w-0 items-center gap-x-3 gap-y-0.5', className)}
        style={{
          gridTemplateColumns: cols.join(' '),
          gridTemplateRows: twoRows ? 'auto auto' : 'auto',
        }}
      >
        <div
          className="flex items-center self-stretch"
          style={{ gridColumn: chromeCol, gridRow: rowSpan }}
        >
          <HeaderChrome job={job} leading={leading} />
        </div>

        <div
          className="flex items-center self-stretch"
          style={{ gridColumn: iconCol, gridRow: rowSpan }}
        >
          {icon}
        </div>

        {hasTopTitle ? (
          <>
            <div className={titleCellClass} style={{ gridColumn: titleCol, gridRow: 1 }}>
              {renderCwTitle(topTitle)}
            </div>
            <div className={titleCellClass} style={{ gridColumn: titleCol, gridRow: 2 }}>
              {renderMainTitle(title, titleMono)}
            </div>
          </>
        ) : (
          <>
            <div className={titleCellClass} style={{ gridColumn: titleCol, gridRow: 1 }}>
              {renderMainTitle(title, titleMono)}
            </div>
            {hasSubtitle ? (
              <div
                className={cn(titleCellClass, 'max-w-2xl')}
                style={{ gridColumn: titleCol, gridRow: 2 }}
              >
                {renderSubtitle(subtitle)}
              </div>
            ) : null}
          </>
        )}

        {hasActions ? (
          <div
            className="flex items-center self-stretch"
            style={{ gridColumn: actionsCol, gridRow: rowSpan }}
          >
            {titleActions}
          </div>
        ) : null}

        {hasTopRow ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 self-center"
            style={{ gridColumn: metaCol, gridRow: 1 }}
          >
            {topRow}
          </div>
        ) : null}

        {hasBottomRow ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 self-center text-xs"
            style={{ gridColumn: metaCol, gridRow: twoRows ? 2 : 1 }}
          >
            {bottomRow}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function AdminPageHeader({
  icon,
  title,
  description,
}: {
  icon: AdminPageHeaderIcon;
  title: string;
  description?: string;
}) {
  const Icon = ADMIN_PAGE_HEADER_ICONS[icon];
  return (
    <PageHeaderLayout
      icon={
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </span>
      }
      title={title}
      subtitle={description}
      titleColumnClassName="max-w-2xl"
    />
  );
}
