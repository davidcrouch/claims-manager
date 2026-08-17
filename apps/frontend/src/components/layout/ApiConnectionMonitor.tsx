'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const LOG = 'frontend:ApiConnectionMonitor';
const ONLINE_POLL_MS = 10_000;
const OFFLINE_POLL_MS = 3_000;

async function probeUpstream(): Promise<boolean> {
  try {
    const res = await fetch('/api/health/upstream', {
      method: 'GET',
      cache: 'no-store',
    });
    return res.ok;
  } catch (err) {
    console.warn(
      `${LOG}:probeUpstream — failed:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Polls Nest via /api/health/upstream. Shows a banner while down and
 * calls router.refresh() once when connectivity returns.
 */
export function ApiConnectionMonitor() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const wasOfflineRef = useRef(false);
  const inFlightRef = useRef(false);
  const offlineRef = useRef(false);

  const check = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const ok = await probeUpstream();
      if (!ok) {
        wasOfflineRef.current = true;
        offlineRef.current = true;
        setOffline(true);
        return;
      }
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        offlineRef.current = false;
        setOffline(false);
        console.info(`${LOG}:check — upstream restored, refreshing`);
        router.refresh();
      } else if (offlineRef.current) {
        offlineRef.current = false;
        setOffline(false);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    void check();

    let timer: number | undefined;

    const schedule = () => {
      if (timer != null) window.clearInterval(timer);
      const ms = offlineRef.current ? OFFLINE_POLL_MS : ONLINE_POLL_MS;
      timer = window.setInterval(() => {
        void check().then(() => {
          // Retune interval if online/offline state changed.
          const desired = offlineRef.current ? OFFLINE_POLL_MS : ONLINE_POLL_MS;
          if (desired !== ms) schedule();
        });
      }, ms);
    };
    schedule();

    const onOnline = () => void check();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer != null) window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check]);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
    >
      Backend unavailable — reconnecting…
    </div>
  );
}
