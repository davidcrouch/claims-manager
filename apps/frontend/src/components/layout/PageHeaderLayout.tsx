import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

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
  /** Back button or other control; spans both rows. */
  leading?: ReactNode;
  /** Entity icon; spans both rows. */
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
}

/**
 * Shared app-header content grid:
 * icon (full height) | CW title / record title | badges / fields.
 * Page actions and the user menu live in `AppHeader` as sibling full-height columns.
 */
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
}: PageHeaderLayoutProps) {
  const hasLeading = leading != null && leading !== false;
  const hasActions = titleActions != null && titleActions !== false;
  const hasTopTitle = topTitle != null && topTitle !== false && topTitle !== '';
  const hasSubtitle =
    !hasTopTitle && subtitle != null && subtitle !== false && subtitle !== '';
  const hasTopRow = topRow != null && topRow !== false;
  const hasBottomRow = bottomRow != null && bottomRow !== false;
  const twoRows = hasTopTitle || hasSubtitle || hasBottomRow;

  const cols: string[] = [];
  if (hasLeading) cols.push('auto');
  cols.push('auto');
  cols.push('minmax(0,auto)');
  if (hasActions) cols.push('auto');
  cols.push('minmax(0,1fr)');

  let nextCol = 1;
  const leadingCol = hasLeading ? nextCol++ : 0;
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
    <div
      data-slot="page-header-layout"
      className={cn('grid w-full min-w-0 items-center gap-x-3 gap-y-0.5', className)}
      style={{
        gridTemplateColumns: cols.join(' '),
        gridTemplateRows: twoRows ? 'auto auto' : 'auto',
      }}
    >
      {hasLeading ? (
        <div
          className="flex items-center self-stretch"
          style={{ gridColumn: leadingCol, gridRow: rowSpan }}
        >
          {leading}
        </div>
      ) : null}

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
  );
}

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: IconComponent;
  title: string;
  description?: string;
}) {
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
