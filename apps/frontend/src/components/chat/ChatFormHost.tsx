'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  drawerRegistry,
  loadCanvasComponent,
  type CanvasDrawerProps,
} from '@/lib/ai/drawer-registry';

export interface ChatFormHostProps {
  component: string;
  props: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, form leaves a clear strip for the existing chat drawer. */
  companionChatOpen?: boolean;
}

/**
 * Mounts a registry form drawer (Quote/Task/Contact) in normal drawer mode
 * when a chat tool requests a canvas component. Opens as a right-side full-height drawer.
 */
export function ChatFormHost({
  component,
  props,
  open,
  onOpenChange,
  companionChatOpen = false,
}: ChatFormHostProps) {
  const [NativeComponent, setNativeComponent] = useState<ComponentType<CanvasDrawerProps> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setNativeComponent(null);
    void loadCanvasComponent(component).then((Comp) => {
      if (!cancelled) setNativeComponent(() => Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [component]);

  if (!NativeComponent) return null;

  return (
    <NativeComponent
      open={open}
      onOpenChange={onOpenChange}
      companionChatOpen={companionChatOpen}
      aiAssistEnabled={false}
      {...(drawerRegistry[component]?.defaultProps ?? {})}
      {...props}
    />
  );
}
