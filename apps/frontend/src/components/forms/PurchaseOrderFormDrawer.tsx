'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Package,
  ShoppingCart,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  LineItemsProvider,
  LineItemsTable,
  collectSelectableLineItemIds,
  syncLineItemSelectionAncestors,
  type ApiGroup,
} from '@/components/line-items';
import { createPurchaseOrderAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  fetchJobWorkOrdersAction,
  fetchJobProposalsAction,
} from '@/app/(app)/jobs/[id]/actions';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import {
  ContactSearchField,
  contactFromCreated,
  type ContactSearchHit,
} from '@/components/forms/JobContactsPicker';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { formatCurrency } from '@/components/shared/detail';
import type { JobOption } from '@/components/shared/job-label';
import type { Job, Proposal, WorkOrder } from '@/types/api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Wizard types
// ---------------------------------------------------------------------------

type WizardStep = 'details' | 'source' | 'lineItems';

const ALL_STEPS: WizardStep[] = ['details', 'source', 'lineItems'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  source: 'Select Source',
  lineItems: 'Select Line Items',
};

type SourceType = 'workOrder' | 'proposal';

type SelectedContact = {
  id: string;
  name: string;
  email?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function workOrderLabel(wo: WorkOrder): string {
  return entityDisplayLabel(
    wo.internalNumber,
    wo.name,
    wo.workOrderNumber,
    wo.externalId,
  );
}

function proposalLabel(p: Proposal): string {
  return (
    entityDisplayLabel(p.proposalNumber, p.name, p.reference) || p.id
  );
}

function contactFromHit(hit: ContactSearchHit): SelectedContact {
  return { id: hit.id, name: hit.name, email: hit.email };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PurchaseOrderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, preselects this job (still shown via the job card). */
  jobId?: string;
  /** Full job for richer initial display. */
  job?: Job | null;
  /** Optional fallback labels when full job is not yet loaded. */
  jobs?: JobOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PurchaseOrderFormDrawer({
  open,
  onOpenChange,
  jobId,
  job,
  jobs,
}: PurchaseOrderFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } = useCreateSubmitPhase();

  // --- wizard state ---
  const [step, setStep] = useState<WizardStep>('details');
  const [error, setError] = useState<string | null>(null);

  // --- job state ---
  const [pickedJobId, setPickedJobId] = useState('');
  const [pickedJob, setPickedJob] = useState<Job | null>(null);
  const effectiveJobId = pickedJobId;

  // --- contact state ---
  const [selectedContact, setSelectedContact] =
    useState<SelectedContact | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);

  // --- source data ---
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [contactProposals, setContactProposals] = useState<Proposal[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);

  // --- source selection ---
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    null,
  );

  // --- line-items step (work order source) ---
  const [woGroups, setWoGroups] = useState<ApiGroup[]>([]);
  const [woLineItemsLoading, setWoLineItemsLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  // --- form ---
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      name: '',
      startDate: todayISO(),
      endDate: '',
      note: '',
    },
  });

  // ---------------------------------------------------------------------------
  // Visible steps depend on selected source type
  // ---------------------------------------------------------------------------

  const visibleSteps = useMemo((): WizardStep[] => {
    if (sourceType === 'workOrder') {
      return ['details', 'source', 'lineItems'];
    }
    return ['details', 'source'];
  }, [sourceType]);

  const stepIndex = Math.max(0, visibleSteps.indexOf(step));

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const resetWizard = useCallback(() => {
    const initialId = jobId ?? job?.id ?? '';
    setStep('details');
    setError(null);
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
    setSelectedContact(null);
    setContactDrawerOpen(false);
    setWorkOrders([]);
    setContactProposals([]);
    setSourceLoading(false);
    setSourceType(null);
    setSelectedSourceId(null);
    setWoGroups([]);
    setWoLineItemsLoading(false);
    setSelectedItemIds(new Set());
    resetPhase();
    form.reset({
      name: '',
      startDate: todayISO(),
      endDate: '',
      note: '',
    });
  }, [jobId, job, form, resetPhase]);

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
  }, [open, jobId, job, resetWizard]);

  function handleJobPicked(next: Job) {
    setPickedJob(next);
    setPickedJobId(next.id);
    setSelectedContact(null);
    setSourceType(null);
    setSelectedSourceId(null);
  }

  // ---------------------------------------------------------------------------
  // Load source data when advancing to step 2
  // ---------------------------------------------------------------------------

  const loadSourceData = useCallback(async () => {
    if (!effectiveJobId) return;
    setSourceLoading(true);
    setError(null);
    try {
      const [wosRaw, proposalsRaw] = await Promise.all([
        fetchJobWorkOrdersAction(effectiveJobId),
        fetchJobProposalsAction(effectiveJobId),
      ]);

      setWorkOrders(wosRaw ?? []);

      // Filter proposals to those received from the selected contact
      const allProposals = proposalsRaw ?? [];
      if (selectedContact) {
        const contactEmail = selectedContact.email?.toLowerCase();
        const contactId = selectedContact.id;
        const filtered = allProposals.filter((p) => {
          const fromPayload = p.proposalFrom as Record<string, unknown> | null;
          if (fromPayload?.contactId === contactId) return true;
          if (
            contactEmail &&
            typeof fromPayload?.email === 'string' &&
            fromPayload.email.toLowerCase() === contactEmail
          ) {
            return true;
          }
          return false;
        });
        setContactProposals(filtered);
      } else {
        setContactProposals([]);
      }
    } catch (err) {
      console.error(
        '[frontend:PurchaseOrderFormDrawer.loadSourceData]',
        err,
      );
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load source data for this job',
      );
    } finally {
      setSourceLoading(false);
    }
  }, [effectiveJobId, selectedContact]);

  // ---------------------------------------------------------------------------
  // Load work order line items for Step 3
  // ---------------------------------------------------------------------------

  async function loadWorkOrderLineItems(woId: string) {
    setWoLineItemsLoading(true);
    setError(null);
    try {
      const result = await getWorkOrderLineItemsAction(woId, { all: true });
      if (result.success && result.groups) {
        const parsed = result.groups as unknown as ApiGroup[];
        setWoGroups(parsed);
        setSelectedItemIds(new Set(collectSelectableLineItemIds(parsed)));
      } else {
        setError(result.error ?? 'Failed to load work order line items');
        setWoGroups([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load line items',
      );
      setWoGroups([]);
    } finally {
      setWoLineItemsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Contact management
  // ---------------------------------------------------------------------------

  function selectContact(contact: SelectedContact) {
    setSelectedContact(contact);
    setError(null);
  }

  function clearContact() {
    setSelectedContact(null);
    setContactProposals([]);
    if (sourceType === 'proposal') {
      setSourceType(null);
      setSelectedSourceId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Source selection helpers
  // ---------------------------------------------------------------------------

  function selectSource(type: SourceType, id: string) {
    setSourceType(type);
    setSelectedSourceId(id);
    setError(null);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function goNext() {
    setError(null);

    if (step === 'details') {
      if (!effectiveJobId) {
        setError('Please select a job');
        return;
      }
      setStep('source');
      void loadSourceData();
      return;
    }

    if (step === 'source') {
      if (sourceType === 'workOrder' && selectedSourceId) {
        // Advance to line-items selection step
        setStep('lineItems');
        void loadWorkOrderLineItems(selectedSourceId);
        return;
      }
      // Proposal selected or no source — create directly
      void onCreate();
    }
  }

  function goBack() {
    setError(null);
    if (step === 'lineItems') {
      setStep('source');
      return;
    }
    if (step === 'source') {
      setStep('details');
    }
  }

  // ---------------------------------------------------------------------------
  // Prevent closing while contact drawer is open
  // ---------------------------------------------------------------------------

  function handleOpenChange(next: boolean) {
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function onCreate() {
    if (!effectiveJobId) {
      setError('Job is required');
      return;
    }

    const values = form.getValues();

    startCreating();
    setError(null);
    try {
      const body: Record<string, unknown> = {
        jobId: effectiveJobId,
        name: values.name || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        note: values.note || undefined,
      };

      // Attach contact info as poTo
      if (selectedContact) {
        body.poTo = {
          contactId: selectedContact.id,
          name: selectedContact.name,
          email: selectedContact.email,
        };
        body.poToEmail = selectedContact.email || undefined;
      }

      // Link source and pass line-item instructions
      if (sourceType === 'workOrder' && selectedSourceId) {
        body.purchaseOrderPayload = {
          sourceWorkOrderId: selectedSourceId,
        };
        body.selectedItemIds = Array.from(
          syncLineItemSelectionAncestors(woGroups, selectedItemIds),
        );

        // Populate total from the selected work order
        const wo = workOrders.find((w) => w.id === selectedSourceId);
        if (wo?.totalAmount != null) {
          const amt = Number(wo.totalAmount);
          if (Number.isFinite(amt)) body.totalAmount = amt;
        }
      } else if (sourceType === 'proposal' && selectedSourceId) {
        const prop = contactProposals.find(
          (p) => p.id === selectedSourceId,
        );
        if (prop?.quoteId) {
          body.quoteId = prop.quoteId;
        }
        body.purchaseOrderPayload = {
          sourceProposalId: selectedSourceId,
          sourceRfqId: prop?.rfqId || undefined,
          copyLineItemsFromProposal: true,
        };

        // Populate total from the selected proposal
        if (prop?.totalAmount != null) {
          const amt = Number(prop.totalAmount);
          if (Number.isFinite(amt)) body.totalAmount = amt;
        }
      }

      const result = await createPurchaseOrderAction(body);
      if (result.success) {
        if (result.purchaseOrder?.id) {
          resetPhase();
          onOpenChange(false);
          router.push(
            `/purchase-orders/${result.purchaseOrder.id}?tab=line-items`,
          );
          router.refresh();
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create purchase order');
        resetPhase();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create purchase order',
      );
      resetPhase();
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data for rendering
  // ---------------------------------------------------------------------------

  const hasAnySources =
    workOrders.length > 0 || contactProposals.length > 0;

  const selectedWorkOrder = useMemo(
    () =>
      sourceType === 'workOrder'
        ? workOrders.find((w) => w.id === selectedSourceId) ?? null
        : null,
    [sourceType, selectedSourceId, workOrders],
  );

  // On step 2, determine if Next should submit (proposal) or advance (WO)
  const sourceStepIsTerminal =
    step === 'source' && sourceType !== 'workOrder';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Create Purchase Order"
        description={
          step === 'lineItems' && selectedWorkOrder
            ? `Work Order: ${workOrderLabel(selectedWorkOrder)}`
            : STEP_LABELS[step]
        }
        icon={<ShoppingCart className="h-5 w-5" />}
        preventClose={busy}
      >
        {/* Step pills */}
        <div className="border-b border-slate-200 px-12 py-3">
          <ol className="flex flex-wrap gap-2 text-xs">
            {visibleSteps.map((s, i) => (
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

        <div className="flex min-h-0 flex-1 flex-col">
          <BottomFormDrawerBody>
            {/* ========================================================== */}
            {/* Step 1 — Details                                           */}
            {/* ========================================================== */}
            {step === 'details' && (
              <div className="space-y-6">
                <FormJobPickerField
                  value={pickedJobId}
                  selectedJob={pickedJob}
                  jobs={jobs}
                  onJobSelect={handleJobPicked}
                />

                {/* Contact (PO To) */}
                <div className="space-y-2">
                  <Label>
                    Purchase Order To{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      (contact / vendor)
                    </span>
                  </Label>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <ContactSearchField
                        selectedIds={
                          selectedContact ? [selectedContact.id] : []
                        }
                        onSelect={(hit) => selectContact(contactFromHit(hit))}
                        defaultTypeRefs={['contact-type-vendor']}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setContactDrawerOpen(true)}
                      className="h-9 shrink-0 gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create Contact
                    </Button>
                  </div>
                  {selectedContact && (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">
                          {selectedContact.name}
                        </span>
                        {selectedContact.email && (
                          <span className="ml-2 text-muted-foreground">
                            {selectedContact.email}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={clearContact}
                        className="rounded p-1 hover:bg-destructive/10"
                        aria-label="Clear contact"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>

                {/* PO fields */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="po-name">Name</Label>
                    <Input
                      id="po-name"
                      {...form.register('name')}
                      placeholder="Purchase order name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="po-startDate">Start Date</Label>
                    <Input
                      id="po-startDate"
                      type="date"
                      {...form.register('startDate')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="po-endDate">End Date</Label>
                    <Input
                      id="po-endDate"
                      type="date"
                      {...form.register('endDate')}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="po-note">Note</Label>
                    <Textarea
                      id="po-note"
                      {...form.register('note')}
                      rows={3}
                      placeholder="Add a note..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* Step 2 — Select Source                                      */}
            {/* ========================================================== */}
            {step === 'source' && (
              <div className="space-y-6">
                {sourceLoading ? (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    <p className="text-sm text-muted-foreground">
                      Loading available sources for this job…
                    </p>
                  </div>
                ) : !hasAnySources ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-6 text-center">
                    <p className="text-sm font-medium text-amber-900">
                      No sources available
                    </p>
                    <p className="mt-1 text-sm text-amber-800/70">
                      There are no work orders or proposals from the selected
                      contact for this job. You can still create a purchase
                      order without linking a source.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Select a source to create this purchase order from.
                      Optionally, you may proceed without selecting a source.
                    </p>

                    {/* Work Orders */}
                    {workOrders.length > 0 && (
                      <SourceSection
                        title="Work Orders"
                        description="Create the purchase order from an existing work order. You will choose which line items to include."
                        icon={<ClipboardList className="h-4 w-4" />}
                      >
                        {workOrders.map((wo) => (
                          <SourceCard
                            key={wo.id}
                            selected={
                              sourceType === 'workOrder' &&
                              selectedSourceId === wo.id
                            }
                            onSelect={() =>
                              selectSource('workOrder', wo.id)
                            }
                            title={workOrderLabel(wo)}
                            subtitle={
                              wo.status?.name
                                ? `Status: ${wo.status.name}`
                                : undefined
                            }
                            amount={wo.totalAmount}
                            icon={<Package className="h-4 w-4" />}
                          />
                        ))}
                      </SourceSection>
                    )}

                    {/* Proposals from contact */}
                    {selectedContact && contactProposals.length > 0 && (
                      <SourceSection
                        title={`Proposals from ${selectedContact.name}`}
                        description="Create the purchase order from a received proposal. All line items will be copied."
                        icon={<FileText className="h-4 w-4" />}
                      >
                        {contactProposals.map((p) => (
                          <SourceCard
                            key={p.id}
                            selected={
                              sourceType === 'proposal' &&
                              selectedSourceId === p.id
                            }
                            onSelect={() =>
                              selectSource('proposal', p.id)
                            }
                            title={proposalLabel(p)}
                            subtitle={
                              p.proposalFromName
                                ? `From: ${p.proposalFromName}`
                                : p.status?.name
                                  ? `Status: ${p.status.name}`
                                  : undefined
                            }
                            amount={p.totalAmount}
                            icon={<FileText className="h-4 w-4" />}
                          />
                        ))}
                      </SourceSection>
                    )}

                    {selectedContact && contactProposals.length === 0 && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                        No proposals received from{' '}
                        <span className="font-medium">
                          {selectedContact.name}
                        </span>{' '}
                        for this job.
                      </div>
                    )}

                    {!selectedContact && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                        Select a contact in Step 1 to see proposals received
                        from them.
                      </div>
                    )}

                    {/* Clear selection link */}
                    {sourceType && (
                      <button
                        type="button"
                        onClick={() => {
                          setSourceType(null);
                          setSelectedSourceId(null);
                        }}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Clear source selection
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ========================================================== */}
            {/* Step 3 — Select Line Items (work order source)             */}
            {/* ========================================================== */}
            {step === 'lineItems' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select the line items to include in this purchase order.
                  Groups and assemblies can be toggled to select/deselect all
                  children.
                </p>

                {woLineItemsLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading line items…
                  </div>
                ) : woGroups.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    This work order has no line items.
                  </div>
                ) : (
                  <LineItemsProvider
                    groups={woGroups}
                    mode="selection"
                    compact
                    selection={{
                      selectedIds: selectedItemIds,
                      onChange: (ids) =>
                        setSelectedItemIds(
                          syncLineItemSelectionAncestors(woGroups, ids),
                        ),
                    }}
                  >
                    <LineItemsTable />
                  </LineItemsProvider>
                )}
              </div>
            )}

            <BottomFormDrawerError error={error} />
          </BottomFormDrawerBody>

          {/* Footer */}
          <BottomFormDrawerFooter>
            {/* Back button */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() =>
                step === 'details' ? onOpenChange(false) : goBack()
              }
            >
              {step === 'details' ? 'Cancel' : 'Back'}
            </Button>

            {/* Line-items step: show count + Create */}
            {step === 'lineItems' ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {selectedItemIds.size} item
                  {selectedItemIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  type="button"
                  size="lg"
                  disabled={busy || selectedItemIds.size === 0}
                  onClick={() => void onCreate()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {phase === 'opening' ? 'Opening…' : 'Creating…'}
                    </>
                  ) : (
                    'Create Purchase Order'
                  )}
                </Button>
              </>
            ) : /* Source step with proposal or no source → terminal */
            sourceStepIsTerminal && step === 'source' ? (
              <Button
                type="button"
                size="lg"
                disabled={busy || sourceLoading}
                onClick={() => void onCreate()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {phase === 'opening' ? 'Opening…' : 'Creating…'}
                  </>
                ) : (
                  'Create Purchase Order'
                )}
              </Button>
            ) : (
              /* Details step or source step with WO selected → Next */
              <Button
                type="button"
                size="lg"
                disabled={
                  busy ||
                  (step === 'source' && sourceLoading) ||
                  (step === 'source' &&
                    sourceType === 'workOrder' &&
                    !selectedSourceId)
                }
                onClick={goNext}
              >
                {step === 'source' && sourceType === 'workOrder'
                  ? 'Next: Select Line Items'
                  : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </BottomFormDrawerFooter>
        </div>
      </BottomFormDrawer>

      {/* Nested contact drawer */}
      <ContactFormDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        onSuccess={(contact) => {
          const created = contactFromCreated(contact);
          selectContact({
            id: contact.id,
            name: [created.firstName, created.lastName]
              .filter(Boolean)
              .join(' '),
            email: created.email,
          });
        }}
        defaultTypeRef="contact-type-vendor"
      />

      <CreateSubmitOverlay phase={phase} entityLabel="purchase order" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Source section group
// ---------------------------------------------------------------------------

function SourceSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual source card
// ---------------------------------------------------------------------------

function SourceCard({
  selected,
  onSelect,
  title,
  subtitle,
  amount,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  amount?: string | number | null;
  icon: ReactNode;
}) {
  const displayAmount = useMemo(() => {
    if (amount == null) return null;
    return formatCurrency(amount);
  }, [amount]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          selected
            ? 'bg-blue-100 text-blue-600'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${selected ? 'text-blue-900' : 'text-slate-900'}`}
        >
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
        {displayAmount && (
          <p
            className={`mt-1 text-xs font-semibold ${selected ? 'text-blue-700' : 'text-slate-700'}`}
          >
            {displayAmount}
          </p>
        )}
      </div>
      {selected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}
