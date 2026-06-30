'use client';

import { useState, useImperativeHandle, forwardRef, type Ref } from 'react';
import Link from 'next/link';
import {
  Building2, MapPin, FileSignature, Briefcase, ExternalLink,
  ScrollText, FileText, Phone, Clock, CalendarPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DefRow, SectionCard, BoolPill, formatDate, formatDateTime,
  formatCurrency, pick, asString,
} from '@/components/shared/detail';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppointmentFormDrawer, type JobParty } from '@/components/forms/AppointmentFormDrawer';
import type { Job, Claim } from '@/types/api';

type Dict = Record<string, unknown>;

export interface JobOverviewTabHandle {
  getPendingDates: () => { bookedDate: string | null; attendanceDate: string | null } | null;
}

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function formatAddress(job: Job): string {
  const addr = job.address as Dict | undefined;
  if (addr) {
    const parts = [
      pick(addr, 'unitNumber', 'unit_number'),
      pick(addr, 'streetNumber', 'street_number'),
      pick(addr, 'streetName', 'street_name'),
      pick(addr, 'suburb'), pick(addr, 'state'),
      pick(addr, 'postcode'), pick(addr, 'country'),
    ].map((x) => (typeof x === 'string' ? x.trim() : x)).filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return [job.addressSuburb, job.addressState, job.addressPostcode, job.addressCountry]
    .filter(Boolean).join(', ');
}

function toInputDate(val: string | undefined | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const JobOverviewTab = forwardRef(function JobOverviewTab(
  { job, parentClaim, saving }: { job: Job; parentClaim?: Claim | null; saving?: boolean },
  ref: Ref<JobOverviewTabHandle>,
) {
  const api = getApi(job);
  const address = formatAddress(job);
  const statusName = job.status?.name ?? ((api.status as Dict | undefined)?.name as string | undefined) ?? 'Unknown';
  const jobTypeName = job.jobType?.name ?? ((api.jobType as Dict | undefined)?.name as string | undefined);
  const addr = (job.address as Dict | undefined) ?? {};
  const latitude = asString(pick(addr, 'latitude', 'lat'));
  const longitude = asString(pick(addr, 'longitude', 'lng', 'long'));
  const apiVendor = (api.vendor as Dict | undefined) ?? {};
  const snapshot = (job.vendorSnapshot as Dict | undefined) ?? {};
  const vendorName = job.vendor?.name ?? (apiVendor.name as string | undefined) ?? (snapshot.name as string | undefined);
  const vendorExtRef = job.vendor?.externalReference ?? (apiVendor.externalReference as string | undefined) ?? (snapshot.externalReference as string | undefined);
  const vendorPhone = asString(pick(apiVendor, 'phone', 'contactPhone') ?? pick(snapshot, 'phone', 'contactPhone'));
  const vendorAfterHours = asString(pick(apiVendor, 'afterHoursPhone') ?? pick(snapshot, 'afterHoursPhone'));
  const vendorEmail = asString(pick(apiVendor, 'email') ?? pick(snapshot, 'email'));
  const instructionsHtml = job.jobInstructions ?? '';
  const parentClaimNumber = parentClaim?.claimNumber ?? parentClaim?.externalReference ?? ((api.claim as Dict | undefined)?.claimNumber as string | undefined) ?? ((api.claim as Dict | undefined)?.externalReference as string | undefined);
  const custom = (job.customData as Dict | undefined) ?? {};
  const insurerRef = asString(pick(custom, 'insurerExternalReference') ?? pick(api, 'externalReference'));
  const cwUpdatedAt = asString(pick(custom, 'cwUpdatedAtDate') ?? pick(api, 'updatedAtDate'));
  const parentClaimCw = job.parentClaimId ?? null;
  const parentJobId = job.parentJobId ?? null;
  const claimApi = (parentClaim?.apiPayload as Dict | undefined) ?? {};
  const apiClaim = (api.claim as Dict | undefined) ?? {};
  const claimCatCode = asString((claimApi.catCode as Dict | undefined)?.name) ?? asString((apiClaim.catCode as Dict | undefined)?.name) ?? asString(claimApi.catCode) ?? asString(apiClaim.catCode);
  const claimLossType = asString((claimApi.lossType as Dict | undefined)?.name) ?? asString((apiClaim.lossType as Dict | undefined)?.name) ?? asString(claimApi.lossType) ?? asString(apiClaim.lossType);
  const claimLossSubType = asString((claimApi.lossSubType as Dict | undefined)?.name) ?? asString((apiClaim.lossSubType as Dict | undefined)?.name) ?? asString(claimApi.lossSubType) ?? asString(apiClaim.lossSubType);
  const claimPriority = asString((claimApi.priority as Dict | undefined)?.name) ?? asString((apiClaim.priority as Dict | undefined)?.name) ?? asString(claimApi.priority) ?? asString(apiClaim.priority);
  const claimPolicyName = parentClaim?.policyName ?? asString(claimApi.policyName) ?? asString(apiClaim.policyName);
  const autoApproval = (job as unknown as Dict).autoApproval ?? pick(api, 'autoApprovalApplies', 'autoApproval');
  const vendorJobNumber = asString(pick(api, 'vendorJobNumber'));
  const contactDate = asString(pick(custom, 'contactDate') ?? pick(api, 'contactDate'));
  const bookedDateRaw = asString(pick(custom, 'bookedDate') ?? pick(api, 'bookedDate'));
  const attendanceDueDate = asString(pick(custom, 'attendanceDueDate') ?? pick(api, 'attendanceDueDate'));
  const attendanceDateRaw = asString(pick(custom, 'attendanceDate') ?? pick(api, 'attendanceDate'));
  const completedDate = asString(pick(custom, 'completedDate') ?? pick(api, 'completedDate'));

  const [bookedDate, setBookedDate] = useState(bookedDateRaw ?? '');
  const [attendanceDate, setAttendanceDate] = useState(attendanceDateRaw ?? '');
  const [scheduleTarget, setScheduleTarget] = useState<'booked' | 'attendance' | null>(null);

  const jobParties = ((job.apiPayload as Record<string, unknown>)?.contacts as JobParty[]) ?? [];

  const isDirty = bookedDate !== (bookedDateRaw ?? '') || attendanceDate !== (attendanceDateRaw ?? '');

  useImperativeHandle(ref, () => ({
    getPendingDates: () => isDirty
      ? { bookedDate: bookedDate || null, attendanceDate: attendanceDate || null }
      : null,
  }), [isDirty, bookedDate, attendanceDate]);

  const handleAppointmentSuccess = (startDate: string) => {
    if (scheduleTarget === 'booked') {
      setBookedDate(startDate);
    } else if (scheduleTarget === 'attendance') {
      setAttendanceDate(startDate);
    }
    setScheduleTarget(null);
  };

  const claimFields = (
    <>
      <DefRow label="CAT code" value={claimCatCode ?? '—'} />
      <DefRow label="Loss type" value={claimLossType ?? '—'} />
      <DefRow label="Loss sub-type" value={claimLossSubType ?? '—'} />
      <DefRow label="Priority" value={claimPriority ?? '—'} />
      <DefRow label="Policy name" value={claimPolicyName ?? '—'} />
    </>
  );

  const parentClaimAction = job.claimId ? (
    <Link href={`/claims/${job.claimId}`} className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline">
      Open <ExternalLink className="h-3 w-3" />
    </Link>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm"><CardContent className="px-4"><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><StatusBadge status={statusName} /></div></CardContent></Card>
        <Card size="sm"><CardContent className="px-4"><p className="text-xs text-muted-foreground">Job type</p><div className="mt-1"><TypeBadge type={jobTypeName} /></div></CardContent></Card>
        <Card size="sm"><CardContent className="px-4"><p className="text-xs text-muted-foreground">Make safe required</p><p className="mt-1 text-sm font-medium">{job.makeSafeRequired ? 'Yes' : 'No'}</p></CardContent></Card>
        <Card size="sm"><CardContent className="px-4"><p className="text-xs text-muted-foreground">Request date</p><p className="mt-1 text-sm font-medium">{formatDate(job.requestDate)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Core Details" icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}>
          <DefRow label="External reference" value={job.externalReference ?? '—'} />
          {insurerRef && <DefRow label="Insurer reference" value={insurerRef} />}
          <DefRow label="Job type" value={<TypeBadge type={jobTypeName} />} />
          <DefRow label="Status" value={<StatusBadge status={statusName} />} />
          <DefRow label="Provider" value={
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              job.provider === 'crunchwork'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {job.provider === 'crunchwork' ? 'Crunchwork' : 'Internal'}
            </span>
          } />
          <DefRow label="Parent claim" value={job.claimId ? (<Link href={`/claims/${job.claimId}`} className="inline-flex items-center gap-1 text-primary hover:underline">{parentClaimNumber ?? job.claimId}<ExternalLink className="h-3 w-3" /></Link>) : '—'} />
          {parentClaimCw && parentClaimCw !== job.claimId && <DefRow label="Parent claim (Crunchwork)" value={<span className="font-mono text-xs">{parentClaimCw}</span>} />}
          {parentJobId && <DefRow label="Parent job" value={<Link href={`/jobs/${parentJobId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open master job<ExternalLink className="h-3 w-3" /></Link>} />}
          <DefRow label="Request date" value={formatDate(job.requestDate)} />
          <DefRow label="Make-safe required" value={<BoolPill value={job.makeSafeRequired} />} />
          <DefRow label="Collect excess" value={<BoolPill value={job.collectExcess} />} />
          <DefRow label="Excess" value={formatCurrency(job.excess)} />
          <DefRow label="Created" value={formatDateTime(job.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(job.updatedAt)} />
          {cwUpdatedAt && <DefRow label="Crunchwork updated" value={formatDateTime(cwUpdatedAt)} />}
        </SectionCard>
        <div className="flex flex-col gap-4">
          <SectionCard title="Job Dates &amp; Approval" icon={<Clock className="h-4 w-4 text-muted-foreground" />}>
            <DefRow label="Auto approval applies" value={<BoolPill value={autoApproval} />} />
            {vendorJobNumber && <DefRow label="Vendor job number" value={vendorJobNumber} />}
            <DefRow label="Contact date" value={formatDate(contactDate)} />
            <DefRow label="Booked date" value={
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={toInputDate(bookedDate)}
                  onChange={(e) => setBookedDate(e.target.value)}
                  disabled={saving}
                  className="h-7 w-40 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setScheduleTarget('booked')}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Schedule
                </Button>
              </div>
            } />
            <DefRow label="Attendance due date" value={formatDate(attendanceDueDate)} />
            <DefRow label="Attendance date" value={
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={toInputDate(attendanceDate)}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  disabled={saving}
                  className="h-7 w-40 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setScheduleTarget('attendance')}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Schedule
                </Button>
              </div>
            } />
            <DefRow label="Completed date" value={formatDate(completedDate)} />
          </SectionCard>
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ScrollText className="h-4 w-4 text-muted-foreground" />Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              {instructionsHtml ? (
                <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: instructionsHtml }} />
              ) : (
                <p className="text-sm text-muted-foreground"><FileText className="mr-1 inline h-3 w-3" />No job instructions provided.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Risk Location" icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>
          <DefRow label="Address" value={address || '—'} />
          <DefRow label="Suburb" value={job.addressSuburb ?? '—'} />
          <DefRow label="State" value={job.addressState ?? '—'} />
          <DefRow label="Postcode" value={job.addressPostcode ?? '—'} />
          <DefRow label="Country" value={job.addressCountry ?? '—'} />
          {(latitude || longitude) && <DefRow label="Coordinates" value={latitude && longitude ? `${latitude}, ${longitude}` : (latitude ?? longitude ?? '—')} />}
        </SectionCard>
        <SectionCard title="Parent Claim" icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} action={parentClaimAction}>
          <DefRow label="Claim number" value={parentClaim?.claimNumber ?? parentClaimNumber ?? '—'} />
          <DefRow label="External reference" value={parentClaim?.externalReference ?? '—'} />
          <DefRow label="Status" value={parentClaim?.status?.name ? <StatusBadge status={parentClaim.status.name} /> : '—'} />
          <DefRow label="Account" value={parentClaim?.account?.name ?? '—'} />
          <DefRow label="Lodged" value={formatDate(parentClaim?.lodgementDate)} />
          <DefRow label="Date of loss" value={formatDate(parentClaim?.dateOfLoss)} />
          {claimFields}
        </SectionCard>
      </div>

      <AppointmentFormDrawer
        open={scheduleTarget !== null}
        onOpenChange={(open) => { if (!open) setScheduleTarget(null); }}
        jobId={job.id}
        jobParties={jobParties}
        onSuccess={handleAppointmentSuccess}
      />

      {(vendorName || vendorExtRef || vendorPhone || vendorEmail) && (
        <SectionCard title="Vendor" icon={<Building2 className="h-4 w-4 text-muted-foreground" />}>
          <DefRow label="Name" value={vendorName ?? '—'} />
          <DefRow label="External reference" value={vendorExtRef ?? '—'} />
          <DefRow label="Phone" value={vendorPhone ? (<a href={`tel:${vendorPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{vendorPhone}</a>) : '—'} />
          <DefRow label="After-hours phone" value={vendorAfterHours ? (<a href={`tel:${vendorAfterHours}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Clock className="h-3 w-3" />{vendorAfterHours}</a>) : '—'} />
          <DefRow label="Email" value={vendorEmail ?? '—'} />
        </SectionCard>
      )}

    </div>
  );
});
