'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { EntityActivity } from '@/lib/api-client';

interface UseActivitiesResult {
  activities: EntityActivity[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (p: number) => void;
  refresh: () => void;
}

export function useActivities(params: {
  entityType: string;
  entityId: string;
  limit?: number;
  refreshInterval?: number;
}): UseActivitiesResult {
  const api = useApiClient();
  const [activities, setActivities] = useState<EntityActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.getActivities({
        entityType: params.entityType,
        entityId: params.entityId,
        page,
        limit: params.limit ?? 50,
      });
      const rows = Array.isArray(result?.data) ? result.data : [];
      setActivities(rows);
      setTotal(typeof result?.total === 'number' ? result.total : rows.length);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activities';
      console.error('[useActivities] fetch failed', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [api, params.entityType, params.entityId, page, params.limit]);

  useEffect(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!params.refreshInterval) return;
    const interval = setInterval(() => void fetchData(), params.refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, params.refreshInterval]);

  return {
    activities,
    total,
    loading,
    error,
    page,
    setPage,
    refresh: fetchData,
  };
}
