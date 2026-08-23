'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DragState, DropIndicator } from './lib/types';

export interface LineItemsDragContextValue {
  activeDrag: DragState | null;
  dropIndicator: DropIndicator | null;
}

const LineItemsDragContext = createContext<LineItemsDragContextValue>({
  activeDrag: null,
  dropIndicator: null,
});

export function LineItemsDragProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LineItemsDragContextValue;
}) {
  return <LineItemsDragContext.Provider value={value}>{children}</LineItemsDragContext.Provider>;
}

export function useLineItemsDrag(): LineItemsDragContextValue {
  return useContext(LineItemsDragContext);
}
