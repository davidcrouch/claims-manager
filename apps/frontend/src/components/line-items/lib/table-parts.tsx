'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Shared horizontal padding so thead cells align with ItemRow td cells. */
export const LI_TH_LEAD_DRAG = 'w-8 pl-1 py-1.5';
export const LI_TH_LEAD_CHECK = (isLead: boolean) => cn('w-6 py-1.5', isLead && 'pl-1');
export const LI_TH_CELL = 'px-4 py-1.5';
export const LI_TH_CELL_RIGHT = 'px-4 py-1.5 text-right';
export const LI_TH_MONEY = 'pl-6 pr-4 py-1.5 text-right';
export const LI_TD_CELL = 'px-4 py-2.5';
export const LI_TD_CELL_RIGHT = 'px-4 py-2.5 text-right';
export const LI_TD_MONEY = 'pl-6 pr-4 py-2.5 text-right font-mono text-sm';
/** Right-aligned child count on group / scope / assembly headers. */
export const LI_HEADER_COUNT = 'shrink-0 pl-4 text-right text-xs tabular-nums';
/** Left inset for group / scope / assembly header totals so they sit clear of the item count. */
export const LI_HEADER_TOTAL = 'shrink-0 pl-6 text-sm font-medium tabular-nums';
export const LI_TD_MONEY_INPUT = 'w-full bg-transparent pl-6 pr-4 py-2.5 outline-none text-right font-mono text-slate-700';
export const LI_TD_ACTIONS = 'w-10 px-2 py-2.5';
export const LI_TH_ACTIONS = 'w-10 px-2 py-1.5';
export const LI_TD_NOTES = 'px-3 py-2.5';
export const LI_TH_NOTES = 'px-3 py-1.5';
export const LI_TH_NOWRAP = 'whitespace-nowrap';

/** Wide name column; other cols stay fixed-width so header labels stay on one line. */
export function nameColClass(showCategory?: boolean) {
  return showCategory ? 'w-[32%]' : 'w-[42%]';
}

interface TableLayoutProps {
  showDragHandle?: boolean;
  showBulkSelect?: boolean;
  showSelect?: boolean;
  showCategory?: boolean;
  showQuantities?: boolean;
  showPricing?: boolean;
  showMarkup?: boolean;
  showGst?: boolean;
  showNotesColumn?: boolean;
}

export function LineItemsColGroup({
  showDragHandle,
  showBulkSelect,
  showSelect,
  showCategory,
  showQuantities,
  showPricing,
  showMarkup,
  showGst,
  showNotesColumn,
}: TableLayoutProps) {
  // Array children avoid whitespace text nodes inside <colgroup> (invalid HTML / hydration error).
  const cols = [
    showDragHandle ? <col key="drag" className="w-8" /> : null,
    showBulkSelect ? <col key="bulk" className="w-6" /> : null,
    showSelect ? <col key="select" className="w-6" /> : null,
    <col key="name" className={nameColClass(showCategory)} />,
    <col key="type" className="w-[70px]" />,
    showCategory ? <col key="category" className="w-[120px]" /> : null,
    showQuantities ? <col key="qty" className="w-[80px]" /> : null,
    showQuantities ? <col key="unit" className="w-[64px]" /> : null,
    showPricing ? <col key="unit-price" className="w-[110px]" /> : null,
    showPricing ? <col key="extended" className="w-[100px]" /> : null,
    showPricing && showMarkup ? <col key="markup" className="w-[90px]" /> : null,
    showPricing && showGst ? <col key="gst" className="w-[80px]" /> : null,
    showPricing ? <col key="total" className="w-[100px]" /> : null,
    showNotesColumn ? <col key="notes" className="w-[100px]" /> : null,
    <col key="actions" className="w-10" />,
  ].filter(Boolean);

  return <colgroup>{cols}</colgroup>;
}

export function LineItemsThead({
  showDragHandle,
  showBulkSelect,
  showSelect,
  showCategory,
  showQuantities,
  showPricing,
  showMarkup,
  showGst,
  showNotesColumn,
}: TableLayoutProps) {
  const checkLead = !showDragHandle;
  return (
    <thead className="bg-slate-50/60">
      <tr className={cn('text-left text-[11px] font-medium uppercase tracking-wide text-slate-400', LI_TH_NOWRAP)}>
        {showDragHandle && <th scope="col" className={LI_TH_LEAD_DRAG} />}
        {showBulkSelect && <th scope="col" className={LI_TH_LEAD_CHECK(checkLead)} />}
        {showSelect && <th scope="col" className={LI_TH_LEAD_CHECK(checkLead)} />}
        <th scope="col" className={LI_TH_CELL}>Name</th>
        <th scope="col" className={LI_TH_CELL}>Type</th>
        {showCategory && <th scope="col" className={LI_TH_CELL}>Category</th>}
        {showQuantities && <th scope="col" className={LI_TH_CELL_RIGHT}>Qty</th>}
        {showQuantities && <th scope="col" className={LI_TH_CELL_RIGHT}>Unit</th>}
        {showPricing && <th scope="col" className={LI_TH_MONEY}>Unit Price</th>}
        {showPricing && <th scope="col" className={LI_TH_MONEY}>Extended</th>}
        {showPricing && showMarkup && <th scope="col" className={LI_TH_MONEY}>Markup</th>}
        {showPricing && showGst && <th scope="col" className={LI_TH_CELL_RIGHT}>GST</th>}
        {showPricing && <th scope="col" className={LI_TH_MONEY}>Total</th>}
        {showNotesColumn && <th scope="col" className={LI_TH_NOTES}>Notes</th>}
        <th scope="col" className={LI_TH_ACTIONS} />
      </tr>
    </thead>
  );
}

/** Wraps the full table so header override toggles do not break thead/table structure. */
export function LineItemsTableShell({
  children,
  showOverrides,
  overrides,
}: {
  children: ReactNode;
  showOverrides?: boolean;
  overrides?: ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {showOverrides && overrides && (
        <div className="pointer-events-none absolute left-3/4 top-0 z-10 -translate-x-1/2">
          <div className="pointer-events-auto py-1.5">{overrides}</div>
        </div>
      )}
    </div>
  );
}
