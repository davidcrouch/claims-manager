'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineItemsProvider,
  LineItemsTable,
  type ApiGroup,
  type LineItemsMode,
  type LineItemsActions,
  LINE_ITEMS_PAGE_SIZE,
} from '@/components/line-items';
import type { LineItemsPageQuery } from '@/types/api';

const PREFIX = 'frontend:PagedLineItemsTable';

type LineItemsFetchResult = {
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  total?: number;
  groupSummaries?: Array<{ id: string; label: string }>;
  error?: string;
};

export interface PagedLineItemsTableProps {
  documentId: string;
  loadAction: (id: string, query?: LineItemsPageQuery) => Promise<LineItemsFetchResult>;
  fallbackGroups?: ApiGroup[];
  emptyLabel?: string;
  reloadToken?: number;
  readOnly?: boolean;
  mode?: LineItemsMode;
  actions?: LineItemsActions;
}

export function PagedLineItemsTable({
  documentId,
  loadAction,
  fallbackGroups,
  emptyLabel,
  reloadToken = 0,
  readOnly = true,
  mode,
  actions,
}: PagedLineItemsTableProps) {
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [groupSummaries, setGroupSummaries] = useState<Array<{ id: string; label: string }>>([]);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const fallbackRef = useRef(fallbackGroups);
  fallbackRef.current = fallbackGroups;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, hiddenGroupIds]);

  const visibleGroupIds = useMemo(() => {
    if (hiddenGroupIds.size === 0 || groupSummaries.length === 0) return undefined;
    return groupSummaries.map((group) => group.id).filter((id) => !hiddenGroupIds.has(id));
  }, [hiddenGroupIds, groupSummaries]);

  const loadPage = useCallback(async () => {
    if (visibleGroupIds && visibleGroupIds.length === 0) {
      setGroups([]);
      setTotal(0);
      setUseFallback(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadAction(documentId, {
        search: debouncedSearch || undefined,
        groupIds: visibleGroupIds,
        page,
        limit: LINE_ITEMS_PAGE_SIZE,
      });
      if (result.success) {
        const next = (result.groups ?? []) as ApiGroup[];
        const resultTotal = result.total ?? 0;
        const fallback = fallbackRef.current;
        const canFallback =
          !!fallback?.length &&
          page === 1 &&
          !debouncedSearch &&
          !visibleGroupIds &&
          next.length === 0 &&
          resultTotal === 0;
        if (canFallback) {
          setUseFallback(true);
          setGroups(fallback);
          setTotal(0);
          setError(null);
        } else {
          setUseFallback(false);
          setGroups(next);
          setTotal(resultTotal);
          if (result.groupSummaries) setGroupSummaries(result.groupSummaries);
          setError(null);
        }
      } else if (fallbackRef.current?.length) {
        setUseFallback(true);
        setGroups(fallbackRef.current);
        setError(null);
      } else {
        console.error(`${PREFIX}.loadPage — ${result.error}`);
        setError(result.error ?? 'Failed to load line items');
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, loadAction, debouncedSearch, visibleGroupIds, page]);

  useEffect(() => {
    void loadPage();
  }, [loadPage, reloadToken]);

  if (loading && groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && groups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!useFallback && groups.length === 0 && total === 0 && !debouncedSearch && hiddenGroupIds.size === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {emptyLabel ?? 'No line items found.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const effectiveMode: LineItemsMode = mode ?? (readOnly ? 'readonly' : 'edit');

  return (
    <LineItemsProvider
      groups={groups}
      mode={effectiveMode}
      paging={
        useFallback
          ? undefined
          : {
              page,
              pageSize: LINE_ITEMS_PAGE_SIZE,
              total,
              onPageChange: setPage,
              groupSummaries,
              hiddenGroupIds,
              onHiddenGroupIdsChange: setHiddenGroupIds,
              search,
              onSearchChange: setSearch,
              serverFiltered: true,
            }
      }
      actions={actions}
    >
      <LineItemsTable />
    </LineItemsProvider>
  );
}
