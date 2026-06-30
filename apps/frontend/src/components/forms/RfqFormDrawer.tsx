'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { createRfqAction } from '@/app/(app)/mutations';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { getQuoteLineItemsAction } from '@/app/(app)/quotes/actions';
import type { Quote } from '@/types/api';
import type { ApiGroup, ApiCombo, ApiItem } from '@/components/quotes/quote-line-items.types';

type WizardStep = 'details' | 'scope';

const STEPS: WizardStep[] = ['details', 'scope'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'RFQ Details',
  scope: 'Select Scope',
};

export interface RfqFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function RfqFormDrawer({
  open,
  onOpenChange,
  jobId,
}: RfqFormDrawerProps) {
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('details');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Step 2 state
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep('details');
    setName('');
    setDescription('');
    setSelectedQuoteId(null);
    setGroups([]);
    setSelectedItemIds(new Set());
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (open) {
      setQuotesLoading(true);
      fetchJobQuotesAction(jobId)
        .then((data) => setQuotes(data ?? []))
        .finally(() => setQuotesLoading(false));
    } else {
      reset();
    }
  }, [open, jobId, reset]);

  async function loadLineItems(quoteId: string) {
    setLineItemsLoading(true);
    setError(null);
    try {
      const result = await getQuoteLineItemsAction(quoteId);
      if (result.success && result.groups) {
        const parsed = result.groups as unknown as ApiGroup[];
        setGroups(parsed);
        const allIds = collectAllItemIds(parsed);
        setSelectedItemIds(allIds);
      } else {
        setError(result.error ?? 'Failed to load estimate line items');
        setGroups([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load line items');
      setGroups([]);
    } finally {
      setLineItemsLoading(false);
    }
  }

  function handleNextStep() {
    if (!selectedQuoteId) {
      setError('Please select an estimate');
      return;
    }
    setError(null);
    loadLineItems(selectedQuoteId);
    setStep('scope');
  }

  function handleBack() {
    setStep('details');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleSubmit() {
    if (!selectedQuoteId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRfqAction({
        jobId,
        quoteId: selectedQuoteId,
        name: name || undefined,
        note: description || undefined,
        includePricing: true,
        includeQuantities: true,
        selectedItemIds: Array.from(selectedItemIds),
      });
      if (result.success) {
        handleOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create RFQ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFQ');
    } finally {
      setSubmitting(false);
    }
  }

  // Checkbox helpers
  function toggleItem(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleCombo(combo: ApiCombo) {
    const comboItemIds = (combo.items ?? []).map((i) => i.id!).filter(Boolean);
    const allIds = combo.id ? [combo.id, ...comboItemIds] : comboItemIds;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const allSelected = allIds.every((id) => next.has(id));
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleGroup(group: ApiGroup) {
    const groupItemIds = collectGroupItemIds(group);
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const allSelected = groupItemIds.every((id) => next.has(id));
      if (allSelected) {
        groupItemIds.forEach((id) => next.delete(id));
      } else {
        groupItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function isGroupChecked(group: ApiGroup): boolean | 'indeterminate' {
    const ids = collectGroupItemIds(group);
    if (ids.length === 0) return false;
    const selectedCount = ids.filter((id) => selectedItemIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === ids.length) return true;
    return 'indeterminate';
  }

  function isComboChecked(combo: ApiCombo): boolean | 'indeterminate' {
    const comboItemIds = (combo.items ?? []).map((i) => i.id!).filter(Boolean);
    const allIds = combo.id ? [combo.id, ...comboItemIds] : comboItemIds;
    if (allIds.length === 0) return false;
    const selectedCount = allIds.filter((id) => selectedItemIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === allIds.length) return true;
    return 'indeterminate';
  }

  const stepIndex = STEPS.indexOf(step);
  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create RFQ"
      description={STEP_LABELS[step]}
      icon={<Send className="h-5 w-5" />}
    >
      {/* Step pills */}
      <div className="border-b border-slate-200 px-8 py-3">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex
                  ? 'bg-slate-900 text-white'
                  : i < stepIndex
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}. {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      </div>

      <BottomFormDrawerBody>
        {step === 'details' && (
          <div className="space-y-6">
            {/* Name + Description */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rfq-name">Name (optional)</Label>
                <Input
                  id="rfq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="RFQ name"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rfq-description">Description (optional)</Label>
                <Textarea
                  id="rfq-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this RFQ covers..."
                  rows={3}
                />
              </div>
            </div>

            {/* Estimate selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Estimate</Label>
              <p className="text-sm text-muted-foreground">
                Choose which estimate to base this RFQ on. You can select specific scope items in the next step.
              </p>

              {quotesLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading estimates...
                </div>
              ) : quotes.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No estimates found for this job. Create an estimate first.
                </p>
              ) : (
                <div className="space-y-2">
                  {quotes.map((q) => (
                    <label
                      key={q.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        selectedQuoteId === q.id
                          ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rfq-estimate"
                        value={q.id}
                        checked={selectedQuoteId === q.id}
                        onChange={() => setSelectedQuoteId(q.id)}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {q.quoteNumber ?? q.name ?? `Estimate ${q.id.slice(0, 8)}`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {q.quoteType?.name && <span>{q.quoteType.name}</span>}
                          {q.status?.name && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              {q.status.name}
                            </span>
                          )}
                          {q.totalAmount && (
                            <span>${Number(q.totalAmount).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'scope' && (
          <div className="space-y-4">
            {selectedQuote && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-sm font-medium">
                  Estimate: {selectedQuote.quoteNumber ?? selectedQuote.name ?? selectedQuote.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Select the line items to include in this RFQ. Groups and assemblies can be toggled to select/deselect all children.
                </p>
              </div>
            )}

            {lineItemsLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading line items...
              </div>
            ) : groups.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This estimate has no line items. Add items to the estimate first.
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.id ?? `group-${group.index}`} className="rounded-lg border border-slate-200">
                    {/* Group header */}
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <Checkbox
                        checked={isGroupChecked(group) === true}
                        indeterminate={isGroupChecked(group) === 'indeterminate'}
                        onCheckedChange={() => toggleGroup(group)}
                        aria-label={`Select all items in ${group.groupLabel?.name ?? 'group'}`}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        {group.groupLabel?.name ?? group.description ?? `Group ${(group.index ?? 0) + 1}`}
                      </span>
                      {group.total != null && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          ${group.total.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-slate-50 px-4 py-1">
                      {/* Direct items */}
                      {(group.items ?? []).map((item) => (
                        <LineItemRow
                          key={item.id ?? `item-${item.index}`}
                          item={item}
                          checked={!!item.id && selectedItemIds.has(item.id)}
                          onToggle={() => item.id && toggleItem(item.id)}
                          indent={0}
                        />
                      ))}

                      {/* Combos / assemblies */}
                      {(group.combos ?? []).map((combo) => (
                        <div key={combo.id ?? `combo-${combo.index}`} className="py-1">
                          {/* Combo header */}
                          <div className="flex items-center gap-3 rounded-md bg-blue-50/50 px-3 py-2">
                            <Checkbox
                              checked={isComboChecked(combo) === true}
                              indeterminate={isComboChecked(combo) === 'indeterminate'}
                              onCheckedChange={() => toggleCombo(combo)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-900">
                                {combo.name ?? combo.component ?? `Assembly ${(combo.index ?? 0) + 1}`}
                              </p>
                              {combo.description && (
                                <p className="text-xs text-blue-700/70">{combo.description}</p>
                              )}
                            </div>
                            {combo.quantity != null && (
                              <span className="text-xs text-muted-foreground">
                                Qty: {combo.quantity}
                              </span>
                            )}
                            {combo.total != null && (
                              <span className="text-xs text-muted-foreground">
                                ${combo.total.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Combo child items */}
                          <div className="ml-6">
                            {(combo.items ?? []).map((item) => (
                              <LineItemRow
                                key={item.id ?? `combo-item-${item.index}`}
                                item={item}
                                checked={!!item.id && selectedItemIds.has(item.id)}
                                onToggle={() => item.id && toggleItem(item.id)}
                                indent={1}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-3">
          {step === 'details' && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNextStep} disabled={!selectedQuoteId}>
                Next: Select Scope
              </Button>
            </>
          )}
          {step === 'scope' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button onClick={handleSubmit} disabled={submitting || selectedItemIds.size === 0}>
                  {submitting ? 'Creating...' : 'Create RFQ'}
                </Button>
              </div>
            </>
          )}
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

// --- Helper components ---

interface LineItemRowProps {
  item: ApiItem;
  checked: boolean;
  onToggle: () => void;
  indent: number;
}

function LineItemRow({ item, checked, onToggle, indent }: LineItemRowProps) {
  return (
    <div
      className={`flex items-center gap-3 py-2 ${indent > 0 ? 'pl-2' : ''}`}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm">
          {item.name ?? item.component ?? item.description ?? 'Unnamed item'}
        </p>
        {item.description && item.name && (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      {item.quantity != null && (
        <span className="shrink-0 text-xs text-muted-foreground">
          Qty: {item.quantity}
        </span>
      )}
      {item.unitType?.name && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {item.unitType.name}
        </span>
      )}
      {item.total != null && (
        <span className="shrink-0 text-xs font-medium tabular-nums">
          ${item.total.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// --- Utility functions ---

function collectAllItemIds(groups: ApiGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const item of group.items ?? []) {
      if (item.id) ids.add(item.id);
    }
    for (const combo of group.combos ?? []) {
      if (combo.id) ids.add(combo.id);
      for (const item of combo.items ?? []) {
        if (item.id) ids.add(item.id);
      }
    }
  }
  return ids;
}

function collectGroupItemIds(group: ApiGroup): string[] {
  const ids: string[] = [];
  for (const item of group.items ?? []) {
    if (item.id) ids.push(item.id);
  }
  for (const combo of group.combos ?? []) {
    if (combo.id) ids.push(combo.id);
    for (const item of combo.items ?? []) {
      if (item.id) ids.push(item.id);
    }
  }
  return ids;
}
