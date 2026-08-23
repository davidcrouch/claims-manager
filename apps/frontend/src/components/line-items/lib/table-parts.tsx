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
  return (
    <colgroup>
      {showDragHandle && <col className="w-8" />}
      {showBulkSelect && <col className="w-6" />}
      {showSelect && <col className="w-6" />}
      <col className={nameColClass(showCategory)} />
      <col className="w-[70px]" /> {/* Type */}
      {showCategory && <col className="w-[120px]" />}
      {showQuantities && <col className="w-[80px]" />}
      {showQuantities && <col className="w-[64px]" />}
      {showPricing && <col className="w-[110px]" />}
      {showPricing && <col className="w-[100px]" />}
      {showPricing && showMarkup && <col className="w-[90px]" />}
      {showPricing && showGst && <col className="w-[80px]" />}
      {showPricing && <col className="w-[100px]" />}
      {showNotesColumn && <col className="w-[100px]" />}
      <col className="w-10" /> {/* Actions */}
    </colgroup>
  );
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
