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
    }),
    [openEntityDrawer, closeEntityDrawer, request],
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
