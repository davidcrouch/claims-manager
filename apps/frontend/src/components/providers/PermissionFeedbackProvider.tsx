'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { PermissionDeniedDialog } from '@/components/permissions/PermissionDeniedDialog';
import {
  isPermissionDeniedMessage,
  notifyPermissionDenied,
  registerPermissionDeniedHandler,
  type PermissionDeniedOptions,
} from '@/lib/permission-feedback';

export function PermissionFeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<string | undefined>();

  const showDenied = useCallback((options?: PermissionDeniedOptions) => {
    setAction(options?.action);
    setOpen(true);
  }, []);

  useEffect(() => {
    registerPermissionDeniedHandler(showDenied);
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<PermissionDeniedOptions>).detail;
      showDenied(detail);
    };
    window.addEventListener('ensureos:permission-denied', onEvent);
    return () => {
      registerPermissionDeniedHandler(null);
      window.removeEventListener('ensureos:permission-denied', onEvent);
    };
  }, [showDenied]);

  useEffect(() => {
    const originalError = toast.error.bind(toast);
    const patched: typeof toast.error = ((message, data) => {
      if (isPermissionDeniedMessage(message)) {
        notifyPermissionDenied();
        return;
      }
      return originalError(message, data);
    }) as typeof toast.error;
    try {
      toast.error = patched;
    } catch (err) {
      console.warn(
        '[PermissionFeedbackProvider] could not intercept toast.error',
        err,
      );
      return;
    }
    return () => {
      toast.error = originalError;
    };
  }, []);

  return (
    <>
      {children}
      <PermissionDeniedDialog
        open={open}
        action={action}
        onOpenChange={setOpen}
      />
    </>
  );
}
