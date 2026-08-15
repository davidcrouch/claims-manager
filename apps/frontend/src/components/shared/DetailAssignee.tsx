'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { User } from 'lucide-react';
import { OrgUserSelect } from '@/components/forms/OrgUserSelect';
import { listOrgUsersForSelectAction } from '@/app/(app)/mutations';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/api';

export type ResolvedDetailAssignee = {
  assigneeName: string | null;
  assignedToUserId: string | null;
  fromJob: boolean;
};

export function resolveDetailAssignee({
  entityAssigneeName,
  entityAssignedToUserId,
  job,
}: {
  entityAssigneeName?: string | null;
  entityAssignedToUserId?: string | null;
  job?: Pick<Job, 'assigneeName' | 'assignedToUserId'> | null;
}): ResolvedDetailAssignee {
  const entityName = entityAssigneeName?.trim() || null;
  const entityId = entityAssignedToUserId?.trim() || null;
  if (entityName || entityId) {
    return {
      assigneeName: entityName,
      assignedToUserId: entityId,
      fromJob: false,
    };
  }

  const jobName = job?.assigneeName?.trim() || null;
  const jobId = job?.assignedToUserId?.trim() || null;
  if (jobName || jobId) {
    return {
      assigneeName: jobName,
      assignedToUserId: jobId,
      fromJob: true,
    };
  }

  return { assigneeName: null, assignedToUserId: null, fromJob: false };
}

function useOrgUserNameMap() {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listOrgUsersForSelectAction().then((rows) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const row of rows) {
        next[row.id] = row.name;
      }
      setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}

function resolveUserLabel(
  name: string | null | undefined,
  userId: string | null | undefined,
  nameById: Record<string, string>,
): string | null {
  const trimmedName = name?.trim() || null;
  if (trimmedName) return trimmedName;
  const id = userId?.trim() || null;
  if (!id) return null;
  return nameById[id] ?? null;
}

/** Resolves a user id to a display name (falls back to `fallback` while loading / if unknown). */
export function OrgUserLabel({
  name,
  userId,
  fallback = '—',
}: {
  name?: string | null;
  userId?: string | null;
  fallback?: string;
}) {
  const nameById = useOrgUserNameMap();
  return <>{resolveUserLabel(name, userId, nameById) ?? fallback}</>;
}

function formatProviderLabel(provider?: string | null): string | null {
  const value = provider?.trim();
  if (!value) return null;
  if (value === 'crunchwork') return 'Crunchwork';
  if (value === 'internal') return 'Internal';
  return value;
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-sm font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function DetailAssignee({
  assigneeName,
  assignedToUserId,
  fromJob = false,
  editing = false,
  saving = false,
  onChange,
  unassignedLabel = 'Unassigned',
  fallbackAssigneeName,
  fallbackAssignedToUserId,
  createdByName,
  createdByUserId,
  updatedByName,
  updatedByUserId,
  provider,
  className,
  id = 'detail-assignee',
}: {
  assigneeName?: string | null;
  assignedToUserId?: string | null;
  fromJob?: boolean;
  editing?: boolean;
  saving?: boolean;
  onChange?: (userId: string | null) => void;
  /** Clear option label in the user dropdown. */
  unassignedLabel?: string;
  /** Job assignee shown on the closed control when estimate has no explicit assignee. */
  fallbackAssigneeName?: string | null;
  fallbackAssignedToUserId?: string | null;
  createdByName?: string | null;
  createdByUserId?: string | null;
  updatedByName?: string | null;
  updatedByUserId?: string | null;
  /** Shown for Created when no creating user is set (provider-originated). */
  provider?: string | null;
  className?: string;
  id?: string;
}) {
  const canEdit = Boolean(editing && onChange);
  const displayName = assigneeName?.trim() || null;
  const nameById = useOrgUserNameMap();
  const fallbackName = useMemo(
    () =>
      resolveUserLabel(fallbackAssigneeName, fallbackAssignedToUserId, nameById),
    [fallbackAssigneeName, fallbackAssignedToUserId, nameById],
  );

  const hasCreatedUser = Boolean(
    createdByName?.trim() || createdByUserId?.trim(),
  );
  const createdFromUser = useMemo(
    () => resolveUserLabel(createdByName, createdByUserId, nameById),
    [createdByName, createdByUserId, nameById],
  );
  const createdLabel = hasCreatedUser
    ? (createdFromUser ?? '—')
    : (formatProviderLabel(provider) ?? '—');
  const updatedLabel = useMemo(
    () => resolveUserLabel(updatedByName, updatedByUserId, nameById),
    [updatedByName, updatedByUserId, nameById],
  );
  const showUpdated = Boolean(
    updatedByName?.trim() || updatedByUserId?.trim(),
  );

  return (
    <div
      className={cn(
        'relative z-10 ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-8 gap-y-2 bg-background pr-6 pl-3 text-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
        <MetaLabel>Assigned</MetaLabel>
        {canEdit ? (
          <div className="min-w-56 w-64 max-w-80">
            <OrgUserSelect
              id={id}
              showLabel={false}
              value={assignedToUserId || null}
              onChange={onChange!}
              disabled={saving}
              unassignedLabel={unassignedLabel}
              unassignedDisplayName={fallbackName}
              unassignedDisplayHint={fallbackName ? 'from job' : null}
            />
          </div>
        ) : (
          <span className="inline-flex min-w-0 items-baseline gap-1.5">
            <span className="truncate font-medium text-foreground">
              {displayName ?? fallbackName ?? '—'}
            </span>
            {(fromJob || (!assignedToUserId && fallbackName)) && (displayName ?? fallbackName) ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                from job
              </span>
            ) : null}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 self-center pb-1.5">
        <div className="flex items-center gap-2">
          <MetaLabel>Created</MetaLabel>
          <span className="truncate font-medium text-foreground">
            {createdLabel}
          </span>
        </div>
        {showUpdated ? (
          <div className="flex items-center gap-2">
            <MetaLabel>Updated</MetaLabel>
            <span className="truncate font-medium text-foreground">
              {updatedLabel ?? '—'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
