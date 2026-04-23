'use client';

import Link from 'next/link';
import {
  FileSpreadsheet,
  ExternalLink,
  FileSignature,
  Calculator,
  CalendarClock,
  ShieldCheck,
  Users,
  Building2,
  Package,
  Layers,
  StickyNote,
  Tag,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  BoolPill,
  formatDate,
  formatDateTime,
  formatCurrency,
  pick,
  asString,
  asBool,
  type Dict,
} from '@/components/shared/detail';
import type {
  Quote,
  QuotePartyPayload,
  QuoteScheduleInfo,
  QuoteApprovalInfo,
} from '@/types/api';

const PREFIX = 'frontend:QuoteDetail';

// ---------------------------------------------------------------------------
// Helpers — extract JSONB buckets and CW api_payload safely.
// ---------------------------------------------------------------------------

function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

function getParty(
  quote: Quote,
  bucket: 'quoteTo' | 'quoteFor' | 'quoteFrom',
): QuotePartyPayload {
  const base = (quote[bucket] as Dict | undefined) ?? {};
  const api = getApi(quote);
  const prefix = bucket === 'quoteTo' ? 'to' : bucket === 'quoteFor' ? 'for' : 'from';
  const prefixed = (key: string): unknown =>
    api[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`];
  const fromApi = (k: string): string | undefined => asString(prefixed(k));
  const fromBucket = (k: string): string | undefined => asString(base[k]);
  return {
    name: fromBucket('name') ?? fromApi('name'),
    companyRegistrationNumber:
      fromBucket('companyRegistrationNumber') ??
      fromApi('companyRegistrationNumber'),
    contactName: fromBucket('contactName') ?? fromApi('contactName'),
    clientReference:
      fromBucket('clientReference') ?? fromApi('clientReference'),
    phoneNumber: fromBucket('phoneNumber') ?? fromApi('phoneNumber'),
    email: fromBucket('email') ?? fromApi('email'),
    unitNumber: fromBucket('unitNumber') ?? fromApi('unitNumber'),
    streetNumber: fromBucket('streetNumber') ?? fromApi('streetNumber'),
    streetName: fromBucket('streetName') ?? fromApi('streetName'),
    suburb: fromBucket('suburb') ?? fromApi('suburb'),
    postCode: fromBucket('postCode') ?? fromApi('postCode'),
    state: fromBucket('state') ?? fromApi('state'),
    country: fromBucket('country') ?? fromApi('country'),
  };
}

function formatPartyAddress(p: QuotePartyPayload): string {
  const parts = [
    p.unitNumber,
    p.streetNumber,
    p.streetName,
    p.suburb,
    p.state,
    p.postCode,
    p.country,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : x))
    .filter(Boolean);
  return parts.join(', ');
}

function getScheduleInfo(quote: Quote): QuoteScheduleInfo {
  const bucket = (quote.scheduleInfo as Dict | undefined) ?? {};
  const api = getApi(quote);
  return {
    estimatedStartDate:
      asString(bucket.estimatedStartDate) ?? asString(api.estimatedStartDate),
    estimatedCompletionDate:
      asString(bucket.estimatedCompletionDate) ??
      asString(api.estimatedCompletionDate),
    reasonForVariation:
      asString(bucket.reasonForVariation) ?? asString(api.reasonForVariation),
  };
}

function getApprovalInfo(quote: Quote): QuoteApprovalInfo {
  const bucket = (quote.approvalInfo as Dict | undefined) ?? {};
  const api = getApi(quote);
  const apiStatus = (api.status as Dict | undefined) ?? {};
  const apiQuoteType =
    ((api.quoteType as Dict | undefined) ??
      (api.quoteTypeId as Dict | undefined)) ??
    {};
  const apiCreatedBy = (api.createdBy as Dict | undefined) ?? {};
  const apiUpdatedBy = (api.updatedBy as Dict | undefined) ?? {};
  return {
    isAutoApproved:
      asBool(bucket.isAutoApproved) ?? asBool(api.isAutoApproved),
    statusType: asString(bucket.statusType) ?? asString(apiStatus.type),
    statusName: asString(bucket.statusName) ?? asString(apiStatus.name),
    quoteTypeName:
      asString(bucket.quoteTypeName) ?? asString(apiQuoteType.name),
    createdByName:
      asString(bucket.createdByName) ?? asString(apiCreatedBy.name),
    createdByExternalReference:
      asString(bucket.createdByExternalReference) ??
      asString(apiCreatedBy.externalReference),
    updatedByName:
      asString(bucket.updatedByName) ?? asString(apiUpdatedBy.name),
    updatedByExternalReference:
      asString(bucket.updatedByExternalReference) ??
      asString(apiUpdatedBy.externalReference),
  };
}

function getCustomData(quote: Quote): Dict {
  return (quote.customData as Dict | undefined) ?? {};
}

// ---------------------------------------------------------------------------
// CW groups / combos / items — read from api_payload until the mapper
// promotes them into quote_groups / quote_combos / quote_items.
// Shapes match Insurance REST API v17 §3.3.6.
// ---------------------------------------------------------------------------

interface ApiLookup {
  id?: string;
  name?: string;
  externalReference?: string;
}

interface ApiItem {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  tax?: number;
  unitCost?: number;
  buyCost?: number;
  markupType?: string;
  markupValue?: number;
  unitType?: ApiLookup;
  pcps?: string | null;
  note?: string | null;
  catalogItemId?: string;
  internal?: boolean;
  mismatches?: Array<{ property?: string; catalogValue?: string }>;
  tags?: string[];
  lineScopeStatus?: ApiLookup;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

interface ApiCombo {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  catalogComboId?: string;
  lineScopeStatus?: ApiLookup;
  items?: ApiItem[];
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

interface ApiGroup {
  id?: string;
  groupLabel?: ApiLookup;
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  index?: number;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  items?: ApiItem[];
  combos?: ApiCombo[];
}

function getGroups(quote: Quote): ApiGroup[] {
  const api = getApi(quote);
  const groups = api.groups;
  return Array.isArray(groups) ? (groups as ApiGroup[]) : [];
}

function lookupDisplay(l?: ApiLookup): string {
  if (!l) return '—';
  return l.name ?? l.externalReference ?? '—';
}

function dimensionSummary(g: ApiGroup): string {
  const dims = [g.length, g.width, g.height]
    .map((v) => (typeof v === 'number' ? v : undefined))
    .filter((v): v is number => typeof v === 'number');
  if (dims.length === 0) return '—';
  return dims.map((v) => String(v)).join(' × ');
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

export function QuotePageHeader({ quote }: { quote: Quote }) {
  const approval = getApprovalInfo(quote);
  const title =
    quote.quoteNumber ??
    quote.name ??
    quote.externalReference ??
    quote.id;
  const statusName =
    quote.status?.name ?? approval.statusName ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/quotes" label="Back to quotes" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <FileSpreadsheet className="h-4 w-4 text-amber-600" />
      </span>
      <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
      <StatusBadge status={statusName} />
      {approval.statusType && approval.statusType !== statusName && (
        <span className="text-xs text-muted-foreground">
          ({approval.statusType})
        </span>
      )}
      {quote.jobId && (
        <Link
          href={`/jobs/${quote.jobId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View job
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {!quote.jobId && quote.claimId && (
        <Link
          href={`/claims/${quote.claimId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View claim
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function SummaryCards({ quote }: { quote: Quote }) {
  const approval = getApprovalInfo(quote);
  const statusName = quote.status?.name ?? approval.statusName ?? 'Unknown';
  const quoteTypeName = quote.quoteType?.name ?? approval.quoteTypeName ?? '—';

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card size="sm">
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{statusName}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">Quote type</p>
          <p className="mt-1 text-sm font-medium">{quoteTypeName}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(quote.totalAmount)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">Quote date</p>
          <p className="mt-1 text-sm font-medium">
            {formatDate(quote.quoteDate)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function IdentifiersSection({ quote }: { quote: Quote }) {
  const custom = getCustomData(quote);
  const insurerRef = asString(pick(custom, 'cwExternalReference'));
  const cwCreated = asString(pick(custom, 'cwCreatedAtDate'));
  const cwUpdated = asString(pick(custom, 'cwUpdatedAtDate'));
  const approval = getApprovalInfo(quote);

  return (
    <SectionCard
      title="Quote Identifiers"
      icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow label="Name" value={quote.name ?? '—'} />
      <DefRow label="Quote number" value={quote.quoteNumber ?? '—'} />
      <DefRow label="Reference" value={quote.reference ?? '—'} />
      <DefRow
        label="Crunchwork ID"
        value={
          quote.externalReference ? (
            <span className="font-mono text-xs">{quote.externalReference}</span>
          ) : (
            '—'
          )
        }
      />
      <DefRow label="Insurer reference" value={insurerRef ?? '—'} />
      <DefRow
        label="Status type"
        value={approval.statusType ?? '—'}
      />
      <DefRow label="Created" value={formatDateTime(quote.createdAt)} />
      <DefRow label="Updated" value={formatDateTime(quote.updatedAt)} />
      {cwCreated && (
        <DefRow label="Crunchwork created" value={formatDateTime(cwCreated)} />
      )}
      {cwUpdated && (
        <DefRow label="Crunchwork updated" value={formatDateTime(cwUpdated)} />
      )}
    </SectionCard>
  );
}

function FinancialsSection({ quote }: { quote: Quote }) {
  return (
    <SectionCard
      title="Financials"
      icon={<Calculator className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow label="Sub total" value={formatCurrency(quote.subTotal)} />
      <DefRow label="Total tax" value={formatCurrency(quote.totalTax)} />
      <DefRow label="Total" value={formatCurrency(quote.totalAmount)} />
      <DefRow
        label="Expires in"
        value={
          typeof quote.expiresInDays === 'number'
            ? `${quote.expiresInDays} day${quote.expiresInDays === 1 ? '' : 's'}`
            : '—'
        }
      />
    </SectionCard>
  );
}

function ScheduleSection({ quote }: { quote: Quote }) {
  const schedule = getScheduleInfo(quote);
  return (
    <SectionCard
      title="Schedule"
      icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow
        label="Estimated start"
        value={formatDate(
          quote.estimatedStartDate ?? schedule.estimatedStartDate ?? null,
        )}
      />
      <DefRow
        label="Estimated completion"
        value={formatDate(
          quote.estimatedCompletionDate ??
            schedule.estimatedCompletionDate ??
            null,
        )}
      />
      <DefRow
        label="Reason for variation"
        value={schedule.reasonForVariation ?? '—'}
      />
    </SectionCard>
  );
}

function ApprovalSection({ quote }: { quote: Quote }) {
  const approval = getApprovalInfo(quote);
  const autoApproved = asBool(quote.isAutoApproved) ?? approval.isAutoApproved;
  return (
    <SectionCard
      title="Approval"
      icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow
        label="Auto-approved"
        value={<BoolPill value={autoApproved} />}
      />
      <DefRow label="Status name" value={approval.statusName ?? '—'} />
      <DefRow label="Status type" value={approval.statusType ?? '—'} />
      <DefRow label="Quote type" value={approval.quoteTypeName ?? '—'} />
      <DefRow
        label="Created by"
        value={
          approval.createdByName
            ? `${approval.createdByName}${
                approval.createdByExternalReference
                  ? ` (${approval.createdByExternalReference})`
                  : ''
              }`
            : (quote.createdByUserId ?? '—')
        }
      />
      <DefRow
        label="Updated by"
        value={
          approval.updatedByName
            ? `${approval.updatedByName}${
                approval.updatedByExternalReference
                  ? ` (${approval.updatedByExternalReference})`
                  : ''
              }`
            : (quote.updatedByUserId ?? '—')
        }
      />
    </SectionCard>
  );
}

function NoteSection({ quote }: { quote: Quote }) {
  if (!quote.note) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Note
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm">{quote.note}</p>
      </CardContent>
    </Card>
  );
}

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: QuotePartyPayload;
  icon: React.ReactNode;
}) {
  const address = formatPartyAddress(party);
  const hasAny =
    party.name ??
    party.contactName ??
    party.email ??
    party.phoneNumber ??
    party.companyRegistrationNumber ??
    party.clientReference ??
    address;
  if (!hasAny) return null;
  return (
    <SectionCard title={title} icon={icon}>
      <DefRow label="Name" value={party.name ?? '—'} />
      <DefRow label="Contact" value={party.contactName ?? '—'} />
      <DefRow label="Email" value={party.email ?? '—'} />
      <DefRow label="Phone" value={party.phoneNumber ?? '—'} />
      <DefRow
        label="Company registration"
        value={party.companyRegistrationNumber ?? '—'}
      />
      <DefRow label="Client reference" value={party.clientReference ?? '—'} />
      <DefRow label="Address" value={address || '—'} />
      <DefRow label="Suburb" value={party.suburb ?? '—'} />
      <DefRow label="State" value={party.state ?? '—'} />
      <DefRow label="Postcode" value={party.postCode ?? '—'} />
      <DefRow label="Country" value={party.country ?? '—'} />
    </SectionCard>
  );
}

function PartiesSection({ quote }: { quote: Quote }) {
  const to = getParty(quote, 'quoteTo');
  const forParty = getParty(quote, 'quoteFor');
  const from = getParty(quote, 'quoteFrom');
  const anyTo = to.name || to.email || to.phoneNumber;
  const anyFor = forParty.name || forParty.email || forParty.phoneNumber;
  const anyFrom = from.name || from.email || from.phoneNumber;
  if (!anyTo && !anyFor && !anyFrom) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {anyTo && (
        <PartyCard
          title="Quote To (recipient)"
          party={to}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
      )}
      {anyFor && (
        <PartyCard
          title="Quote For (customer)"
          party={forParty}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
      )}
      {anyFrom && (
        <PartyCard
          title="Quote From (vendor)"
          party={from}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
      )}
    </div>
  );
}

function ItemRow({ item }: { item: ApiItem }) {
  const tags = item.tags ?? [];
  const mismatches = item.mismatches ?? [];
  return (
    <div className="border-t border-border/60 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-medium">
            {item.name ?? '—'}
            {item.type && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {item.type}
              </span>
            )}
            {item.internal && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                internal
              </span>
            )}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {item.category && <span>{item.category}</span>}
            {item.subCategory && <span>/ {item.subCategory}</span>}
            {item.pcps && <span>• PCPS: {item.pcps}</span>}
            {item.unitType && (
              <span>• Unit: {lookupDisplay(item.unitType)}</span>
            )}
            {item.lineScopeStatus && (
              <span>• Scope: {lookupDisplay(item.lineScopeStatus)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>
            Qty: <span className="font-mono">{item.quantity ?? 0}</span>
            {typeof item.tax === 'number' && (
              <> • Tax: <span className="font-mono">{item.tax}%</span></>
            )}
          </p>
          <p>
            Unit:{' '}
            <span className="font-mono">{formatCurrency(item.unitCost)}</span>
            {typeof item.buyCost === 'number' && (
              <>
                {' '}
                • Buy:{' '}
                <span className="font-mono">
                  {formatCurrency(item.buyCost)}
                </span>
              </>
            )}
          </p>
          {(item.markupType || typeof item.markupValue === 'number') && (
            <p>
              Markup:{' '}
              <span className="font-mono">
                {item.markupValue ?? 0}
                {item.markupType === 'Percentage' ? '%' : ''}
              </span>{' '}
              {item.markupType && (
                <span className="text-[10px] uppercase tracking-wide">
                  ({item.markupType})
                </span>
              )}
            </p>
          )}
          <p className="font-medium text-foreground">
            Total: {formatCurrency(item.total)}
          </p>
          {typeof item.totalTax === 'number' && (
            <p>of which tax {formatCurrency(item.totalTax)}</p>
          )}
          {(typeof item.allocatedCost === 'number' ||
            typeof item.committedCost === 'number') && (
            <p className="text-[11px]">
              Allocated {formatCurrency(item.allocatedCost)} · Committed{' '}
              {formatCurrency(item.committedCost)}
            </p>
          )}
        </div>
      </div>
      {(tags.length > 0 || mismatches.length > 0 || item.note) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
            >
              <Tag className="h-3 w-3" />
              {t}
            </span>
          ))}
          {mismatches.map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-amber-700"
              title={`Catalog value: ${m.catalogValue ?? ''}`}
            >
              Catalog mismatch: {m.property}
            </span>
          ))}
          {item.note && (
            <span className="text-muted-foreground">Note: {item.note}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ComboBlock({ combo }: { combo: ApiCombo }) {
  const items = combo.items ?? [];
  return (
    <div className="rounded border border-border/60 bg-muted/20">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 px-4 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <Package className="mr-1 inline h-3 w-3 text-muted-foreground" />
            {combo.name ?? 'Combo'}
            {typeof combo.quantity === 'number' && (
              <span className="ml-2 text-xs text-muted-foreground">
                × {combo.quantity}
              </span>
            )}
          </p>
          {combo.description && (
            <p className="text-xs text-muted-foreground">{combo.description}</p>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {combo.category && <span>{combo.category}</span>}
            {combo.subCategory && <span>/ {combo.subCategory}</span>}
            {combo.lineScopeStatus && (
              <span>Scope: {lookupDisplay(combo.lineScopeStatus)}</span>
            )}
            {combo.catalogComboId && (
              <span className="font-mono text-[10px]">
                catalog: {combo.catalogComboId}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            Total: {formatCurrency(combo.total)}
          </p>
          {typeof combo.subTotal === 'number' && (
            <p>Sub: {formatCurrency(combo.subTotal)}</p>
          )}
          {typeof combo.totalTax === 'number' && (
            <p>Tax: {formatCurrency(combo.totalTax)}</p>
          )}
          {(typeof combo.allocatedCost === 'number' ||
            typeof combo.committedCost === 'number') && (
            <p className="text-[11px]">
              Alloc {formatCurrency(combo.allocatedCost)} · Comm{' '}
              {formatCurrency(combo.committedCost)}
            </p>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-2 text-xs text-muted-foreground">
          No line items in this combo.
        </p>
      ) : (
        items.map((it, i) => <ItemRow key={it.id ?? i} item={it} />)
      )}
    </div>
  );
}

function GroupBlock({ group, index }: { group: ApiGroup; index: number }) {
  const combos = group.combos ?? [];
  const items = group.items ?? [];
  const label =
    group.groupLabel?.name ??
    group.groupLabel?.externalReference ??
    `Group ${index + 1}`;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {label}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {typeof group.subTotal === 'number' && (
              <>Sub {formatCurrency(group.subTotal)} · </>
            )}
            {typeof group.totalTax === 'number' && (
              <>Tax {formatCurrency(group.totalTax)} · </>
            )}
            Total{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(group.total)}
            </span>
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {group.description && <span>{group.description}</span>}
          <span>Dimensions (L × W × H): {dimensionSummary(group)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && (
          <div className="rounded border border-border/60">
            <p className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Direct items
            </p>
            {items.map((it, i) => (
              <ItemRow key={it.id ?? i} item={it} />
            ))}
          </div>
        )}
        {combos.map((c, i) => (
          <ComboBlock key={c.id ?? i} combo={c} />
        ))}
        {items.length === 0 && combos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No items or combos in this group.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LineItemsSection({ quote }: { quote: Quote }) {
  const groups = getGroups(quote);

  if (groups.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `${PREFIX}.LineItemsSection — no groups on quote ${quote.id}`,
      );
    }
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Line items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No groups, combos, or items on this quote yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <GroupBlock key={g.id ?? i} group={g} index={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function QuoteDetail({ quote }: { quote: Quote }) {
  return (
    <div className="space-y-4">
      <SummaryCards quote={quote} />

      <div className="grid gap-4 md:grid-cols-2">
        <IdentifiersSection quote={quote} />
        <FinancialsSection quote={quote} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScheduleSection quote={quote} />
        <ApprovalSection quote={quote} />
      </div>

      <PartiesSection quote={quote} />

      <NoteSection quote={quote} />

      <LineItemsSection quote={quote} />
    </div>
  );
}
