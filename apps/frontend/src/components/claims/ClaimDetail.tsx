'use client';

import { useState } from 'react';
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
import type { Claim } from '@/types/api';

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
  return (claim.policyDetails as Dict | undefined) ?? {};
}

function getFinancial(claim: Claim): Dict {
  return (claim.financialDetails as Dict | undefined) ?? {};
}

function getVulnerability(claim: Claim): Dict {
  return (claim.vulnerabilityDetails as Dict | undefined) ?? {};
}

function getContention(claim: Claim): Dict {
  return (claim.contentionDetails as Dict | undefined) ?? {};
}

function getCustomData(claim: Claim): Dict {
  return (claim.customData as Dict | undefined) ?? {};
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
    asString(pick(policy, 'policyTypeName', 'policyType'));

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
            label="Insurer reference"
            value={claim.externalClaimId ?? '—'}
          />
          <DefRow
            label="Crunchwork ID"
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
  const financial = getFinancial(claim);
  const custom = getCustomData(claim);

  const policyType =
    asString((api.policyType as Dict | undefined)?.name) ??
    asString(api.policyType) ??
    asString(pick(policy, 'policyTypeName', 'policyType'));
  const lineOfBusiness =
    asString((api.lineOfBusiness as Dict | undefined)?.name) ??
    asString(api.lineOfBusiness) ??
    asString(pick(policy, 'lineOfBusinessName', 'lineOfBusiness'));
  const inceptionDate =
    asString(api.policyInceptionDate) ??
    asString(pick(policy, 'policyInceptionDate'));
  const buildingSumInsured =
    pick(api, 'buildingSumInsured') ?? pick(financial, 'buildingSumInsured');
  const contentsSumInsured =
    pick(api, 'contentsSumInsured') ?? pick(financial, 'contentsSumInsured');
  const excess = pick(api, 'excess') ?? pick(financial, 'excess');
  const collectExcess =
    asBool(pick(api, 'collectExcess')) ??
    asBool(pick(financial, 'collectExcess'));
  const autoApproval =
    asBool(claim.autoApprovalApplies as unknown) ??
    asBool(pick(api, 'autoApprovalApplies'));
  const accommodationBenefit =
    pick(api, 'accommodationBenefitLimit') ??
    pick(financial, 'accommodationBenefitLimit');
  const accommodationDuration = asString(
    pick(
      api,
      'maximumAccomodationDurationLimit',
      'maximumAccommodationDurationLimit',
    ) ??
      pick(
        custom,
        'maximumAccommodationDurationLimit',
        'maximumAccomodationDurationLimit',
      ),
  );
  const abn = asString(pick(api, 'abn')) ?? claim.abn ?? undefined;

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
  externalReference?: string;
  type?: string | { name?: string; externalReference?: string };
  preferredMethodOfContact?:
    | string
    | { name?: string; externalReference?: string };
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

function contactPreferredMethod(c: ContactRow): string {
  const m = c.preferredMethodOfContact;
  if (!m) return '—';
  if (typeof m === 'string') return m;
  return m.name ?? m.externalReference ?? '—';
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
                    <th className="px-4 py-2">Preferred</th>
                    <th className="px-4 py-2">External ref</th>
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
                        {contactPreferredMethod(c)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {c.externalReference ?? '—'}
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
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-primary hover:underline"
                        >
                          {job.externalReference ?? job.id}
                        </Link>
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
  const vulnerability = getVulnerability(claim);
  const contention = getContention(claim);
  const custom = getCustomData(claim);

  const vulnerableCustomer =
    asBool(claim.vulnerableCustomer as unknown) ??
    asBool(pick(api, 'vulnerableCustomer'));
  const vulnerabilityCategory =
    asString(pick(api, 'vulnerabilityCategory')) ??
    asString(pick(vulnerability, 'category'));

  const contentiousClaim =
    asBool(claim.contentiousClaim as unknown) ??
    asBool(pick(api, 'contentiousClaim'));
  const contentiousActivityFlag =
    asBool(claim.contentiousActivityFlag as unknown) ??
    asBool(pick(api, 'contentiousActivityFlag'));
  const contentiousActivityDetails =
    asString(pick(api, 'contentiousActivityDetails')) ??
    asString(pick(contention, 'activityDetails'));

  const cwUpdatedAt =
    asString(pick(custom, 'cwUpdatedAtDate')) ??
    asString(pick(api, 'updatedAtDate'));

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
            <DefRow
              label="Last Crunchwork update"
              value={cwUpdatedAt ? formatDateTime(cwUpdatedAt) : '—'}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClaimPageHeader({ claim }: { claim: Claim }) {
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
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/claims" label="Back to claims" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <FileText className="h-4 w-4 text-blue-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        {claim.externalReference && (
          <span className="font-mono text-xs text-muted-foreground">
            · {claim.externalReference}
          </span>
        )}
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
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Lodged:</span>
          <span className="font-medium">{formatDate(claim.lodgementDate)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">DOL:</span>
          <span className="font-medium">{formatDate(claim.dateOfLoss)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Jobs:</span>
          <span className="font-medium">{jobs.length}</span>
        </div>
      </div>
    </div>
  );
}

type ClaimTab =
  | 'overview'
  | 'policy'
  | 'loss'
  | 'parties'
  | 'jobs'
  | 'compliance';

export function ClaimDetail({ claim }: { claim: Claim }) {
  const jobs = claim.jobs ?? [];
  const [tab, setTab] = useState<ClaimTab>('overview');

  const tabs: Array<{
    id: ClaimTab;
    label: string;
    icon: typeof Calendar;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'policy', label: 'Policy & Financial', icon: Building2 },
    { id: 'loss', label: 'Loss Details', icon: Droplets },
    { id: 'parties', label: 'Parties', icon: Users },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: Briefcase,
      count: jobs.length > 0 ? jobs.length : undefined,
    },
    { id: 'compliance', label: 'Compliance', icon: ShieldAlert },
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
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    active
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tab === 'overview' && <OverviewTab claim={claim} />}
        {tab === 'policy' && <PolicyTab claim={claim} />}
        {tab === 'loss' && <LossTab claim={claim} />}
        {tab === 'parties' && <PartiesTab claim={claim} />}
        {tab === 'jobs' && <JobsTab claim={claim} />}
        {tab === 'compliance' && <ComplianceTab claim={claim} />}
      </div>
    </div>
  );
}
