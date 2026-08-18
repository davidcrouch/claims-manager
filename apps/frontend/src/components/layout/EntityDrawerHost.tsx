'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ChatFormHost } from '@/components/chat/ChatFormHost';
import { drawerRegistry } from '@/lib/ai/drawer-registry';

export type OpenEntityDrawerArgs = {
  /** Key in `drawerRegistry` (e.g. TaskDetailDrawer, AppointmentFormDrawer). */
  component: string;
  props?: Record<string, unknown>;
};

type EntityDrawerContextValue = {
  openEntityDrawer: (args: OpenEntityDrawerArgs) => void;
  closeEntityDrawer: () => void;
  isOpen: boolean;
  activeComponent: string | null;
  /** App-shell chat drawer is open — forms shrink to the companion 60% width. */
  companionChatOpen: boolean;
  /** Any BottomFormDrawer (hosted or page-level) is currently open. */
  hasOpenFormDrawer: boolean;
  registerFormDrawer: (id: string, open: boolean) => void;
};

const EntityDrawerContext = createContext<EntityDrawerContextValue | null>(null);

/**
 * App-shell host for entity drawers shared by Schedule, chat canvas tools, and MCP Apps.
 * Mount once under AppShell; callers use `useEntityDrawer().openEntityDrawer(...)`.
 */
export function EntityDrawerProvider({
  children,
  companionChatOpen = false,
}: {
  children: ReactNode;
  /** When chat is open beside the form, pass through for width layout. */
  companionChatOpen?: boolean;
}) {
  const [request, setRequest] = useState<OpenEntityDrawerArgs | null>(null);
  const [openFormIds, setOpenFormIds] = useState<ReadonlySet<string>>(() => new Set());

  const registerFormDrawer = useCallback((id: string, isOpen: boolean) => {
    setOpenFormIds((prev) => {
      const has = prev.has(id);
      if (isOpen === has) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const openEntityDrawer = useCallback((args: OpenEntityDrawerArgs) => {
    if (!drawerRegistry[args.component]) {
      console.warn(
        `[frontend:EntityDrawerProvider.openEntityDrawer] Unknown drawer "${args.component}"`,
      );
      return;
    }
    setRequest((prev) => {
      if (prev?.component === args.component) {
        return {
          component: args.component,
          props: { ...prev.props, ...args.props },
        };
      }
      return { component: args.component, props: args.props ?? {} };
    });
  }, []);

  const closeEntityDrawer = useCallback(() => {
    setRequest(null);
  }, []);

  const value = useMemo<EntityDrawerContextValue>(
    () => ({
      openEntityDrawer,
      closeEntityDrawer,
      isOpen: !!request,
      activeComponent: request?.component ?? null,
      companionChatOpen,
      hasOpenFormDrawer: openFormIds.size > 0 || !!request,
      registerFormDrawer,
    }),
    [
      openEntityDrawer,
      closeEntityDrawer,
      request,
      companionChatOpen,
      openFormIds,
      registerFormDrawer,
    ],
  );

  return (
    <EntityDrawerContext.Provider value={value}>
      {children}
      {request && (
        <ChatFormHost
          component={request.component}
          props={request.props ?? {}}
          open={!!request}
          onOpenChange={(next) => {
            if (!next) setRequest(null);
          }}
          companionChatOpen={companionChatOpen}
        />
      )}
    </EntityDrawerContext.Provider>
  );
}

export function useEntityDrawer(): EntityDrawerContextValue {
  const ctx = useContext(EntityDrawerContext);
  if (!ctx) {
    throw new Error(
      'frontend:useEntityDrawer - must be used within EntityDrawerProvider',
    );
  }
  return ctx;
}

/** Optional hook when the host may be absent (e.g. shared chat token page). */
export function useEntityDrawerOptional(): EntityDrawerContextValue | null {
  return useContext(EntityDrawerContext);
}
