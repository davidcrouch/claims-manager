import { useMemo } from 'react';
import type { ApiGroup, ApiItem } from '../lib/types';
import { computeItemMoney, lineTotalFromItem, resolveInvoicedAmount, resolvePreviouslyInvoicedAmount } from '../lib/money';
import type { EditInputs } from './use-line-item-edit';

export interface GrandTotals {
  subTotal: number;
  /** Sum of qty × buyCost across lines. */
  extendedCost: number;
  markup: number;
  totalTax: number;
  total: number;
  /** Sum of per-line invoiced amounts (bill/invoice progress). */
  invoiced: number;
  /** Sum of per-line previously invoiced amounts. */
  previouslyInvoiced: number;
}

/**
 * Hook that computes grand totals across all visible line items.
 * Memoised so it only recalculates when groups or edit inputs change.
 */
export function useGrandTotals(
  groups: ApiGroup[],
  editInputs: EditInputs,
  showMarkup: boolean,
  showGst: boolean,
  selectedIds?: Set<string>,
  hideUnselected = false,
  lockSaleTotal = false,
): GrandTotals {
  return useMemo(() => {
    let extended = 0;
    let extendedCost = 0;
    let markup = 0;
    let totalTax = 0;
    let total = 0;
    let invoiced = 0;
    let previouslyInvoiced = 0;

    function addItem(item: ApiItem, rowKey: string) {
      if (hideUnselected && item.id && selectedIds && !selectedIds.has(item.id)) return;
      const money = computeItemMoney(item, editInputs[rowKey], true, true);
      extended += money.extended;
      extendedCost += money.buyExtended;
      markup += money.markupAmt;
      totalTax += money.gstAmt;
      // Prefer full commercial total (incl. markup + GST) so invoice/WO headers match.
      // Cost-mode POs keep sale price locked to the stored/source total.
      total += lockSaleTotal || !editInputs[rowKey]
        ? lineTotalFromItem(item)
        : money.total;
      invoiced += resolveInvoicedAmount(item, editInputs[rowKey]);
      previouslyInvoiced += resolvePreviouslyInvoicedAmount(item);
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const gId = g.id ?? `group-${gi}`;
      for (let ii = 0; ii < (g.items ?? []).length; ii++) {
        const item = g.items![ii];
        addItem(item, `${gId}-item-${item.id ?? ii}`);
      }
      for (let ci = 0; ci < (g.combos ?? []).length; ci++) {
        const combo = g.combos![ci];
        const comboKey = `${gId}-combo-${combo.id ?? ci}`;
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          addItem(item, `${comboKey}-item-${item.id ?? ii}`);
        }
      }
      for (let si = 0; si < (g.scopes ?? []).length; si++) {
        const scope = g.scopes![si];
        const scopeKey = `${gId}-scope-${scope.id ?? si}`;
        for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
          const item = scope.items![ii];
          addItem(item, `${scopeKey}-item-${item.id ?? ii}`);
        }
        for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
          const combo = scope.combos![ci];
          const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
          for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
            const item = combo.items![ii];
            addItem(item, `${comboKey}-item-${item.id ?? ii}`);
          }
        }
      }
    }

    const subTotal = extended + (showMarkup ? markup : 0) + (showGst ? totalTax : 0);
    return { subTotal, extendedCost, markup, totalTax, total, invoiced, previouslyInvoiced };
  }, [groups, editInputs, showMarkup, showGst, selectedIds, hideUnselected, lockSaleTotal]);
}
