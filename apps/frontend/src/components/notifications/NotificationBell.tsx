'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchUnreadCountAction,
  fetchNotificationsAction,
  markNotificationReadAction,
} from '@/app/(app)/notifications/actions';
import type { AppNotification } from '@/types/api';

const POLL_INTERVAL_MS = 30_000;

const ENTITY_ROUTE_MAP: Record<string, string> = {
  job: 'jobs',
  claim: 'claims',
  quote: 'quotes',
  purchase_order: 'purchase-orders',
  invoice: 'invoices',
  work_order: 'work-orders',
  message: 'messages',
  task: 'tasks',
  report: 'reports',
  appointment: 'appointments',
};

const ENTITY_HAS_DETAIL_PAGE = new Set([
  'job', 'claim', 'quote', 'purchase_order', 'invoice',
  'work_order', 'report',
]);

const PARENT_ROUTE_ENTITIES = new Set(['attachment']);

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    const c = await fetchUnreadCountAction();
    setCount(c);
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCount]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideButton = panelRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideButton && !insideDropdown) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const res = await fetchNotificationsAction({ isRead: false, limit: 15 });
    setItems(res?.data ?? []);
    setLoading(false);
  };

  const handleItemClick = async (item: AppNotification) => {
    setOpen(false);
    markNotificationReadAction(item.id).then(() => refreshCount());

    const route = ENTITY_ROUTE_MAP[item.entityType] ?? item.entityType;
    const jobId = (item.metadata?.jobId as string) ?? null;
    const parentEntityType = (item.metadata?.parentEntityType as string) ?? null;
    const parentEntityId = (item.metadata?.parentEntityId as string) ?? null;

    if (PARENT_ROUTE_ENTITIES.has(item.entityType) && parentEntityType && parentEntityId) {
      const parentRoute = ENTITY_ROUTE_MAP[parentEntityType] ?? parentEntityType;
      router.push(`/${parentRoute}/${parentEntityId}`);
    } else if (ENTITY_HAS_DETAIL_PAGE.has(item.entityType)) {
      router.push(`/${route}/${item.entityId}`);
    } else if (jobId) {
      router.push(`/jobs/${jobId}`);
    } else {
      router.push(`/${route}`);
    }
  };

  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      setBtnRect(btnRef.current.getBoundingClientRect());
    }
    handleOpen();
  };

  return (
    <div ref={panelRef}>
      <Button
        ref={btnRef as React.Ref<HTMLButtonElement>}
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={handleToggle}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      {open && btnRect && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          style={{
            top: btnRect.bottom + 8,
            right: window.innerWidth - btnRect.right,
          }}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications
            </h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No unread notifications
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.entityType.replace(/_/g, ' ')} &middot;{' '}
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
