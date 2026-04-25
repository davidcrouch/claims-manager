'use client';

/**
 * Purchase Order detail view.
 *
 * Field coverage and section layout track `docs/mapping/purchase_orders.md`
 * (§2 identity / §3 parents / §4 lookups / §5 service window / §6 parties /
 * §7 scalars / §8 adjustment+allocation / §10 payload fallback). §9 line items
 * and §9.4 inline invoices require API changes (see the Line Items tab).
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  ExternalLink,
  Building2,
  Calendar,
  ClipboardList,
  DollarSign,
  FileSignature,
  Hash,
  Layers,
  MapPin,
  Package,
  Phone,
  User,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import type { PurchaseOrder } from '@/types/api';

// ---------- helpers ---------------------------------------------------------

function getPayload(po: PurchaseOrder): Dict {
  return (po.purchaseOrderPayload as Dict | undefined) ?? {};
}

function getParty(po: PurchaseOrder, key: 'poTo' | 'poFor' | 'poFrom'): Dict {
  return (po[key] as Dict | undefined) ?? {};
}

function getServiceWindow(po: PurchaseOrder): Dict {
  return (po.serviceWindow as Dict | undefined) ?? {};
}

function getAdjustmentInfo(po: PurchaseOrder): Dict {
  return (po.adjustmentInfo as Dict | undefined) ?? {};
}

function getAllocationContext(po: PurchaseOrder): Dict {
  return (po.allocationContext as Dict | undefined) ?? {};
}

/**
 * Pull a displayable lookup name, preferring the joined lookup ref when
 * present and falling back to the `name` key inside the verbatim CW payload.
 */
function lookupName(
  po: PurchaseOrder,
  joined: PurchaseOrder['status'] | PurchaseOrder['vendor'] | PurchaseOrder['purchaseOrderType'],
  payloadKey: string,
): string | undefined {
  const fromJoin = joined?.name;
  if (fromJoin) return fromJoin;
  const payload = getPayload(po);
  const block = payload[payloadKey] as Dict | undefined;
  return asString(block?.name) ?? asString(payload[payloadKey]);
}

function partyAddress(party: Dict): string {
  const parts = [
    pick(party, 'unitNumber'),
    pick(party, 'streetNumber'),
    pick(party, 'streetName'),
    pick(party, 'suburb'),
    pick(party, 'state'),
    pick(party, 'postCode', 'postcode'),
    pick(party, 'country'),
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : x))
    .filter(Boolean);
  return parts.join(', ');
}

// ---------- header ----------------------------------------------------------

export function PurchaseOrderPageHeader({ po }: { po: PurchaseOrder }) {
  const title = po.purchaseOrderNumber ?? po.externalId ?? po.id;
  const status = lookupName(po, po.status, 'status') ?? 'Unknown';
  const poType = lookupName(po, po.purchaseOrderType, 'purchaseOrderType');
  const vendor = lookupName(po, po.vendor, 'vendor');
  const total = formatCurrency(po.totalAmount);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/purchase-orders" label="Back to purchase orders" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100">
          <ShoppingCart className="h-4 w-4 text-orange-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        {po.externalId && po.externalId !== title && (
          <span className="font-mono text-xs text-muted-foreground">· {po.externalId}</span>
        )}
        <StatusBadge status={status} />
        {poType && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            {poType}
          </span>
        )}
        {vendor && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {vendor}
          </span>
        )}
        {po.jobId && (
          <Link
            href={`/jobs/${po.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View job
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {po.claimId && (
          <Link
            href={`/claims/${po.claimId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View claim
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium">{total}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Start:</span>
          <span className="font-medium">{formatDate(po.startDate)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">End:</span>
          <span className="font-medium">{formatDate(po.endDate)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ po }: { po: PurchaseOrder }) {
  const status = lookupName(po, po.status, 'status') ?? 'Unknown';
  const poType = lookupName(po, po.purchaseOrderType, 'purchaseOrderType') ?? '—';
  const vendor = lookupName(po, po.vendor, 'vendor') ?? '—';
  const service = getServiceWindow(po);
  const expiresInDays = asString(
    pick(service, 'expiresInDays') ?? pick(getAllocationContext(po), 'expiresInDays'),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">{status}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium">{poType}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(po.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Adjusted total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(po.adjustedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Purchase Order Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="PO number" value={po.purchaseOrderNumber ?? '—'} />
          <DefRow label="External ID" value={po.externalId ?? '—'} />
          <DefRow label="Name" value={po.name ?? '—'} />
          <DefRow label="Status" value={status} />
          <DefRow label="Type" value={poType} />
          <DefRow label="Vendor" value={vendor} />
        </SectionCard>

        <SectionCard
          title="Linked Entities"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Job"
            value={
              po.jobId ? (
                <Link
                  href={`/jobs/${po.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Claim"
            value={
              po.claimId ? (
                <Link
                  href={`/claims/${po.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Vendor"
            value={
              po.vendorId ? (
                <Link
                  href={`/vendors/${po.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow label="Quote" value={po.quoteId ?? '—'} />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Service Window"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Start date" value={formatDate(po.startDate)} />
          <DefRow label="End date" value={formatDate(po.endDate)} />
          <DefRow label="Start time" value={po.startTime ?? '—'} />
          <DefRow label="End time" value={po.endTime ?? '—'} />
          <DefRow label="Expires in (days)" value={expiresInDays ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Financial"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Total" value={formatCurrency(po.totalAmount)} />
          <DefRow label="Adjusted total" value={formatCurrency(po.adjustedTotal)} />
          <DefRow
            label="Adjustment amount"
            value={formatCurrency(po.adjustedTotalAdjustmentAmount)}
          />
        </SectionCard>
      </div>

      {po.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{po.note}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: Dict;
  icon: React.ReactNode;
}) {
  const address = partyAddress(party);
  return (
    <SectionCard title={title} icon={icon}>
      <DefRow label="Name" value={asString(pick(party, 'name')) ?? '—'} />
      <DefRow
        label="Contact name"
        value={asString(pick(party, 'contactName')) ?? '—'}
      />
      <DefRow
        label="Company reg. #"
        value={asString(pick(party, 'companyRegistrationNumber')) ?? '—'}
      />
      <DefRow
        label="Invoice number"
        value={asString(pick(party, 'invoiceNumber')) ?? '—'}
      />
      <DefRow
        label="Phone"
        value={asString(pick(party, 'phoneNumber')) ?? '—'}
      />
      <DefRow label="Email" value={asString(pick(party, 'email')) ?? '—'} />
      <DefRow label="Address" value={address || '—'} />
    </SectionCard>
  );
}

function PartiesTab({ po }: { po: PurchaseOrder }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PartyCard
        title="PO To (vendor / recipient)"
        party={getParty(po, 'poTo')}
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="PO For (insured / customer)"
        party={getParty(po, 'poFor')}
        icon={<User className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="PO From (issuing / insurer)"
        party={getParty(po, 'poFrom')}
        icon={<Phone className="h-4 w-4 text-muted-foreground" />}
      />
      <SectionCard
        title="Promoted party columns"
        icon={<Hash className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="PO to email" value={po.poToEmail ?? '—'} />
        <DefRow label="PO for name" value={po.poForName ?? '—'} />
      </SectionCard>
    </div>
  );
}

function AllocationTab({ po }: { po: PurchaseOrder }) {
  const adjustment = getAdjustmentInfo(po);
  const allocation = getAllocationContext(po);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Adjustment"
        icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Adjusted total (bucket)"
          value={formatCurrency(pick(adjustment, 'adjustedTotal'))}
        />
        <DefRow
          label="Adjustment amount (bucket)"
          value={formatCurrency(pick(adjustment, 'adjustedTotalAdjustmentAmount'))}
        />
        <DefRow
          label="Adjusted total (column)"
          value={formatCurrency(po.adjustedTotal)}
        />
        <DefRow
          label="Adjustment amount (column)"
          value={formatCurrency(po.adjustedTotalAdjustmentAmount)}
        />
      </SectionCard>

      <SectionCard
        title="Vendor Allocation"
        icon={<Layers className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Vendor allocation job type ID"
          value={asString(pick(allocation, 'vendorAllocationJobTypeId')) ?? '—'}
        />
        <DefRow
          label="Vendor allocation report type ID"
          value={asString(pick(allocation, 'vendorAllocationReportTypeId')) ?? '—'}
        />
        <DefRow
          label="Quote revision ID"
          value={asString(pick(allocation, 'quoteRevisionId')) ?? '—'}
        />
        <DefRow
          label="Expires in (days)"
          value={asString(pick(allocation, 'expiresInDays')) ?? '—'}
        />
      </SectionCard>
    </div>
  );
}

function LineItemsTab() {
  // §9 groups → combos → items and §9.4 inline invoices are not yet returned
  // by `GET /purchase-orders/:id`. See docs/mapping/purchase_orders.md §9 and
  // docs/implementation/11_PURCHASE_ORDERS_MODULE.md acceptance criteria.
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Line items</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Groups, combos, items and inline invoices (mapping doc §9) are not yet
          included in the <code className="font-mono">GET /purchase-orders/:id</code>{' '}
          response. Once the API is extended to hydrate{' '}
          <code className="font-mono">purchase_order_groups</code>,{' '}
          <code className="font-mono">purchase_order_combos</code> and{' '}
          <code className="font-mono">purchase_order_items</code>, they will be
          rendered here.
        </p>
      </CardContent>
    </Card>
  );
}

function AuditTab({ po }: { po: PurchaseOrder }) {
  const payload = getPayload(po);
  const cwCreatedAt = asString(pick(payload, 'createdAtDate'));
  const cwUpdatedAt = asString(pick(payload, 'updatedAtDate'));
  const createdBy = payload.createdBy as Dict | undefined;
  const updatedBy = payload.updatedBy as Dict | undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(po.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(po.updatedAt)} />
        <DefRow label="Deleted" value={po.deletedAt ? formatDateTime(po.deletedAt) : '—'} />
        <DefRow label="Created by (user id)" value={po.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={po.updatedByUserId ?? '—'} />
      </SectionCard>

      <SectionCard
        title="Crunchwork audit"
        icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="CW created"
          value={cwCreatedAt ? formatDateTime(cwCreatedAt) : '—'}
        />
        <DefRow
          label="CW updated"
          value={cwUpdatedAt ? formatDateTime(cwUpdatedAt) : '—'}
        />
        <DefRow label="CW created by" value={asString(pick(createdBy ?? {}, 'name')) ?? '—'} />
        <DefRow label="CW updated by" value={asString(pick(updatedBy ?? {}, 'name')) ?? '—'} />
      </SectionCard>
    </div>
  );
}

// ---------- container -------------------------------------------------------

type PoTab = 'overview' | 'parties' | 'allocation' | 'lineItems' | 'audit';

export function PurchaseOrderDetail({ po }: { po: PurchaseOrder }) {
  const [tab, setTab] = useState<PoTab>('overview');

  const tabs: Array<{ id: PoTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'allocation', label: 'Allocation', icon: Layers },
    { id: 'lineItems', label: 'Line Items', icon: Package },
    { id: 'audit', label: 'Audit', icon: MapPin },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                active
                  ? 'border-orange-600 bg-orange-50 text-orange-600'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tab === 'overview' && <OverviewTab po={po} />}
        {tab === 'parties' && <PartiesTab po={po} />}
        {tab === 'allocation' && <AllocationTab po={po} />}
        {tab === 'lineItems' && <LineItemsTab />}
        {tab === 'audit' && <AuditTab po={po} />}
      </div>
    </div>
  );
}
