'use client';

import Link from 'next/link';
import {
  FileText,
  MapPin,
  Calendar,
  Building2,
  Users,
  Briefcase,
  ShieldAlert,
  FileSignature,
  CircleCheck,
  CircleX,
  Phone,
  Mail,
  Home,
  Droplets,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { Claim } from '@/types/api';

type Dict = Record<string, unknown>;

function pick(obj: Dict | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v || undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function asBool(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatCurrency(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatAddress(claim: Claim): string {
  const addr = claim.address as Dict | undefined;
  if (addr) {
    const parts = [
      pick(addr, 'unitNumber', 'unit_number'),
      pick(addr, 'streetNumber', 'street_number'),
      pick(addr, 'streetName', 'street_name'),
      pick(addr, 'suburb'),
      pick(addr, 'state'),
      pick(addr, 'postcode'),
      pick(addr, 'country'),
    ]
      .map((x) => (typeof x === 'string' ? x.trim() : x))
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  const fallback = [
    claim.addressSuburb,
    claim.addressState,
    claim.addressPostcode,
    claim.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
  return fallback || '';
}

function getApi(claim: Claim): Dict {
  return (claim.apiPayload as Dict | undefined) ?? {};
}

function getPolicy(claim: Claim): Dict {
  const fromClaim = (claim.policyDetails as Dict | undefined) ?? {};
  return fromClaim;
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 py-1.5 text-sm border-b border-border/40 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground wrap-break-word">
        {value == null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl>{children}</dl>
      </CardContent>
    </Card>
  );
}

function BoolPill({ value }: { value: unknown }) {
  const b = asBool(value);
  if (b === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ' +
        (b
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')
      }
    >
      {b ? <CircleCheck className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}
      {b ? 'Yes' : 'No'}
    </span>
  );
}

function OverviewTab({ claim }: { claim: Claim }) {
  const api = getApi(claim);
  const address = formatAddress(claim);
  const policy = getPolicy(claim);
  const status =
    (claim.status as { name?: string })?.name ??
    ((api.status as Dict | undefined)?.name as string | undefined) ??
    'Unknown';

  const account =
    (claim.account as { name?: string })?.name ??
    ((api.account as Dict | undefined)?.name as string | undefined);

  const catCode =
    ((api.catCode as Dict | undefined)?.name as string | undefined) ??
    ((api.catCode as Dict | undefined)?.Name as string | undefined);

  const lossType = (api.lossType as Dict | undefined)?.name as
    | string
    | undefined;

  const priority =
    asString((api.priority as Dict | undefined)?.name) ??
    asString(api.priority);
  const decision =
    asString((api.claimDecision as Dict | undefined)?.name) ??
    asString(api.claimDecision);

  const policyType =
    asString((api.policyType as Dict | undefined)?.name) ??
    asString(api.policyType) ??
    asString(policy.policyType);

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
            <p className="text-xs text-muted-foreground">Account</p>
            <p className="mt-1 text-sm font-medium">{account ?? '—'}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Lodged</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(claim.lodgementDate)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Date of loss</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(claim.dateOfLoss)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Claim Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Claim number" value={claim.claimNumber ?? '—'} />
          <DefRow
            label="External reference"
            value={claim.externalReference ?? '—'}
          />
          <DefRow
            label="Account"
            value={account ?? '—'}
          />
          <DefRow label="Status" value={status} />
          <DefRow label="Priority" value={priority ?? '—'} />
          <DefRow label="Claim decision" value={decision ?? '—'} />
          <DefRow label="CAT code" value={catCode ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Risk Location"
          icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Address" value={address || '—'} />
          <DefRow label="Suburb" value={claim.addressSuburb ?? '—'} />
          <DefRow label="State" value={claim.addressState ?? '—'} />
          <DefRow label="Postcode" value={claim.addressPostcode ?? '—'} />
          <DefRow label="Country" value={claim.addressCountry ?? '—'} />
          <DefRow
            label="Postal address"
            value={asString(api.postalAddress) ?? '—'}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Loss Summary"
          icon={<Droplets className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Date of loss" value={formatDate(claim.dateOfLoss)} />
          <DefRow label="Loss type" value={lossType ?? '—'} />
          <DefRow label="Total loss" value={<BoolPill value={claim.totalLoss} />} />
          <DefRow
            label="Contents damaged"
            value={<BoolPill value={claim.contentsDamaged} />}
          />
        </SectionCard>

        <SectionCard
          title="Policy Summary"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Policy name" value={claim.policyName ?? '—'} />
          <DefRow label="Policy number" value={claim.policyNumber ?? '—'} />
          <DefRow label="Policy type" value={policyType ?? '—'} />
          <DefRow
            label="Inception date"
            value={formatDate(asString(pick(policy, 'policyInceptionDate')) ?? null)}
          />
        </SectionCard>
      </div>

      {asString(api.incidentDescription) || claim.incidentDescription ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incident description</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{
                __html:
                  (asString(api.incidentDescription) ??
                    claim.incidentDescription ??
                    '') as string,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PolicyTab({ claim }: { claim: Claim }) {
  const api = getApi(claim);
  const policy = getPolicy(claim);

  const policyType =
    asString((api.policyType as Dict | undefined)?.name) ??
    asString(api.policyType) ??
    asString(pick(policy, 'policyType'));
  const lineOfBusiness =
    asString((api.lineOfBusiness as Dict | undefined)?.name) ??
    asString(api.lineOfBusiness) ??
    asString(pick(policy, 'lineOfBusiness'));
  const inceptionDate =
    asString(api.policyInceptionDate) ??
    asString(pick(policy, 'policyInceptionDate'));
  const buildingSumInsured =
    pick(api, 'buildingSumInsured') ?? pick(policy, 'buildingSumInsured');
  const contentsSumInsured =
    pick(api, 'contentsSumInsured') ?? pick(policy, 'contentsSumInsured');
  const excess = pick(api, 'excess') ?? pick(policy, 'excess');
  const collectExcess =
    asBool(pick(api, 'collectExcess')) ?? asBool(pick(policy, 'collectExcess'));
  const autoApproval =
    asBool(claim.autoApprovalApplies as unknown) ??
    asBool(pick(api, 'autoApprovalApplies'));
  const accommodationBenefit = pick(api, 'accommodationBenefitLimit');
  const accommodationDuration = asString(
    pick(api, 'maximumAccomodationDurationLimit', 'maximumAccommodationDurationLimit'),
  );
  const abn = asString(pick(api, 'abn'));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Policy"
        icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Policy name" value={claim.policyName ?? '—'} />
        <DefRow label="Policy number" value={claim.policyNumber ?? '—'} />
        <DefRow label="Policy type" value={policyType ?? '—'} />
        <DefRow label="Line of business" value={lineOfBusiness ?? '—'} />
        <DefRow label="Inception date" value={formatDate(inceptionDate ?? null)} />
        <DefRow label="ABN" value={abn ?? '—'} />
      </SectionCard>

      <SectionCard
        title="Financial"
        icon={<Home className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Building sum insured"
          value={formatCurrency(buildingSumInsured)}
        />
        <DefRow
          label="Contents sum insured"
          value={formatCurrency(contentsSumInsured)}
        />
        <DefRow label="Excess" value={formatCurrency(excess)} />
        <DefRow
          label="Collect excess"
          value={<BoolPill value={collectExcess} />}
        />
        <DefRow
          label="Auto-approval applies"
          value={<BoolPill value={autoApproval} />}
        />
        <DefRow
          label="Accommodation benefit limit"
          value={formatCurrency(accommodationBenefit)}
        />
        <DefRow
          label="Max accommodation duration"
          value={accommodationDuration ?? '—'}
        />
      </SectionCard>
    </div>
  );
}

function LossTab({ claim }: { claim: Claim }) {
  const api = getApi(claim);

  const lossType =
    asString((api.lossType as Dict | undefined)?.name) ??
    asString(api.lossType);
  const lossTypeExtRef = asString(
    (api.lossType as Dict | undefined)?.externalReference,
  );
  const lossSubType =
    asString((api.lossSubType as Dict | undefined)?.name) ??
    asString(api.lossSubType);
  const catCode =
    asString((api.catCode as Dict | undefined)?.name) ??
    asString((api.catCode as Dict | undefined)?.Name);
  const catCodeExtRef = asString(
    (api.catCode as Dict | undefined)?.externalReference,
  );
  const decision =
    asString((api.claimDecision as Dict | undefined)?.name) ??
    asString(api.claimDecision);
  const priority =
    asString((api.priority as Dict | undefined)?.name) ??
    asString(api.priority);

  const incidentHtml = asString(api.incidentDescription) ?? claim.incidentDescription ?? '';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Loss Classification"
          icon={<Droplets className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Date of loss" value={formatDate(claim.dateOfLoss)} />
          <DefRow label="Loss type" value={lossType ?? '—'} />
          <DefRow label="Loss sub-type" value={lossSubType ?? '—'} />
          <DefRow label="Loss type ref" value={lossTypeExtRef ?? '—'} />
          <DefRow label="CAT code" value={catCode ?? '—'} />
          <DefRow label="CAT code ref" value={catCodeExtRef ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Decision & Priority"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Claim decision" value={decision ?? '—'} />
          <DefRow label="Priority" value={priority ?? '—'} />
          <DefRow label="Total loss" value={<BoolPill value={claim.totalLoss} />} />
          <DefRow
            label="Contents damaged"
            value={<BoolPill value={claim.contentsDamaged} />}
          />
        </SectionCard>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Incident description</CardTitle>
        </CardHeader>
        <CardContent>
          {incidentHtml ? (
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: incidentHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No incident description provided.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ContactRow {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  type?: string | { name?: string; externalReference?: string };
  preferredMethodOfContact?: string | { name?: string };
  notes?: string;
}

interface AssigneeRow {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  type?: string | { name?: string; externalReference?: string };
  externalReference?: string;
}

function contactName(c: ContactRow): string {
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

function contactType(c: ContactRow): string {
  if (!c.type) return '—';
  if (typeof c.type === 'string') return c.type;
  return c.type.name ?? c.type.externalReference ?? '—';
}

function assigneeType(a: AssigneeRow): string {
  if (!a.type) return '—';
  if (typeof a.type === 'string') return a.type;
  return a.type.name ?? a.type.externalReference ?? '—';
}

function PartiesTab({ claim }: { claim: Claim }) {
  const api = getApi(claim);
  const contacts = (api.contacts as ContactRow[] | undefined) ?? [];
  const assignees = (api.assignees as AssigneeRow[] | undefined) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            Contacts ({contacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {contacts.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No contacts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Phones</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {contacts.map((c, i) => (
                    <tr key={c.id ?? i}>
                      <td className="px-4 py-2 font-medium">{contactName(c)}</td>
                      <td className="px-4 py-2">{contactType(c)}</td>
                      <td className="px-4 py-2">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          {c.mobilePhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {c.mobilePhone}{' '}
                              <span className="text-muted-foreground">(M)</span>
                            </span>
                          )}
                          {c.homePhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {c.homePhone}{' '}
                              <span className="text-muted-foreground">(H)</span>
                            </span>
                          )}
                          {c.workPhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {c.workPhone}{' '}
                              <span className="text-muted-foreground">(W)</span>
                            </span>
                          )}
                          {!c.mobilePhone && !c.homePhone && !c.workPhone && '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {c.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            Assignees ({assignees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {assignees.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No assignees.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">External Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {assignees.map((a, i) => (
                    <tr key={a.id ?? i}>
                      <td className="px-4 py-2 font-medium">
                        {a.name ?? a.displayName ?? '—'}
                      </td>
                      <td className="px-4 py-2">{assigneeType(a)}</td>
                      <td className="px-4 py-2">
                        {a.email ? (
                          <a
                            href={`mailto:${a.email}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {a.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {a.externalReference ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobsTab({ claim }: { claim: Claim }) {
  const jobs = claim.jobs ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          Linked jobs ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {jobs.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No jobs linked to this claim.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2">Job type</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Request date</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {jobs.map((job) => {
                  const statusName =
                    (job.status as { name?: string })?.name ?? 'Unknown';
                  const typeName =
                    (job.jobType as { name?: string })?.name ?? '—';
                  return (
                    <tr key={job.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {job.externalReference ?? job.id}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {typeName}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(job.requestDate)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(job.updatedAt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComplianceTab({ claim }: { claim: Claim }) {
  const api = getApi(claim);
  const vulnerableCustomer =
    asBool(claim.vulnerableCustomer as unknown) ??
    asBool(pick(api, 'vulnerableCustomer'));
  const vulnerabilityCategory = asString(pick(api, 'vulnerabilityCategory'));

  const contentiousClaim =
    asBool(claim.contentiousClaim as unknown) ??
    asBool(pick(api, 'contentiousClaim'));
  const contentiousActivityFlag =
    asBool(claim.contentiousActivityFlag as unknown) ??
    asBool(pick(api, 'contentiousActivityFlag'));
  const contentiousActivityDetails = asString(
    pick(api, 'contentiousActivityDetails'),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Vulnerability"
        icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Vulnerable customer"
          value={<BoolPill value={vulnerableCustomer} />}
        />
        <DefRow
          label="Vulnerability category"
          value={vulnerabilityCategory ?? '—'}
        />
      </SectionCard>

      <SectionCard
        title="Contention"
        icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Contentious claim"
          value={<BoolPill value={contentiousClaim} />}
        />
        <DefRow
          label="Contentious activity flag"
          value={<BoolPill value={contentiousActivityFlag} />}
        />
      </SectionCard>

      {contentiousActivityDetails ? (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contentious activity details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {contentiousActivityDetails}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <DefRow label="Created" value={formatDateTime(claim.createdAt)} />
            <DefRow label="Updated" value={formatDateTime(claim.updatedAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClaimDetail({ claim }: { claim: Claim }) {
  const title = claim.claimNumber ?? claim.externalReference ?? claim.id;
  const api = getApi(claim);
  const statusName =
    (claim.status as { name?: string })?.name ??
    ((api.status as Dict | undefined)?.name as string | undefined) ??
    'Unknown';
  const account =
    (claim.account as { name?: string })?.name ??
    ((api.account as Dict | undefined)?.name as string | undefined);
  const address = formatAddress(claim);
  const jobs = claim.jobs ?? [];

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Claim</span>
              {claim.externalReference && (
                <>
                  <span>·</span>
                  <span className="font-mono">{claim.externalReference}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={statusName} />
              {account && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {account}
                </span>
              )}
              {address && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {address}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Lodged</p>
              <p className="text-sm font-medium">
                {formatDate(claim.lodgementDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date of loss</p>
              <p className="text-sm font-medium">
                {formatDate(claim.dateOfLoss)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jobs</p>
              <p className="text-sm font-medium">{jobs.length}</p>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Calendar className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="policy">
            <Building2 className="h-3.5 w-3.5" /> Policy &amp; Financial
          </TabsTrigger>
          <TabsTrigger value="loss">
            <Droplets className="h-3.5 w-3.5" /> Loss Details
          </TabsTrigger>
          <TabsTrigger value="parties">
            <Users className="h-3.5 w-3.5" /> Parties
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Briefcase className="h-3.5 w-3.5" /> Jobs
            {jobs.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {jobs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <ShieldAlert className="h-3.5 w-3.5" /> Compliance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab claim={claim} />
        </TabsContent>
        <TabsContent value="policy" className="pt-4">
          <PolicyTab claim={claim} />
        </TabsContent>
        <TabsContent value="loss" className="pt-4">
          <LossTab claim={claim} />
        </TabsContent>
        <TabsContent value="parties" className="pt-4">
          <PartiesTab claim={claim} />
        </TabsContent>
        <TabsContent value="jobs" className="pt-4">
          <JobsTab claim={claim} />
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <ComplianceTab claim={claim} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
