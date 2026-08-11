'use client';

import { useEffect, useState, useImperativeHandle, forwardRef, type Ref } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2, MapPin, FileSignature, Briefcase, ExternalLink,
  ScrollText, FileText, Phone, Clock, CalendarPlus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DefRow, SectionCard, BoolPill, formatDate, formatDateTime,
  formatCurrency, formatAddress, pick, asString,
} from '@/components/shared/detail';
import { LocationMap } from '@/components/shared/LocationMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppointmentFormDrawer, type JobParty } from '@/components/forms/AppointmentFormDrawer';
import {
  EditLookupSelect,
  EditSwitch,
  EditText,
  EditTextarea,
} from '@/components/jobs/JobEditControls';
import type { JobEditPending, LookupOption } from '@/components/jobs/job-edit.types';
import type { Job, Claim } from '@/types/api';

type Dict = Record<string, unknown>;

export interface JobOverviewTabHandle {
  getPendingUpdate: () => JobEditPending | null;
  /** @deprecated use getPendingUpdate */
  getPendingDates: () => JobEditPending | null;
  reset: () => void;
  resetDates: () => void;
}

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function jobAddressSource(job: Job): Dict {
  const addr = (job.address as Dict | undefined) ?? {};
  const apiAddr =
    ((job.apiPayload as Dict | undefined)?.address as Dict | undefined) ?? {};
  return Object.keys(addr).length > 0 ? addr : apiAddr;
}

function jobAddress(job: Job, full = false): string {
  return formatAddress(jobAddressSource(job), {
    full,
    fallback: {
      suburb: job.addressSuburb ?? asString(jobAddressSource(job).suburb),
      state: job.addressState ?? asString(jobAddressSource(job).state),
      postcode: job.addressPostcode ?? asString(jobAddressSource(job).postcode),
      country: job.addressCountry ?? asString(jobAddressSource(job).country),
    },
  });
}

function parseCoord(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function jobCoords(job: Job): { latitude?: number; longitude?: number } {
  const addr = jobAddressSource(job);
  return {
    latitude: parseCoord(addr.latitude) ?? parseCoord(addr.lat),
    longitude:
      parseCoord(addr.longitude) ??
      parseCoord(addr.lng) ??
      parseCoord(addr.long),
  };
}

function toInputDate(val: string | undefined | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const JobOverviewTab = forwardRef(function JobOverviewTab(
  {
    job,
    parentClaim,
    saving,
    editing = false,
    statusOptions = [],
  }: {
    job: Job;
    parentClaim?: Claim | null;
    saving?: boolean;
    editing?: boolean;
    statusOptions?: LookupOption[];
  },
  ref: Ref<JobOverviewTabHandle>,
) {
  const isCrunchwork = job.provider === 'crunchwork';
  const cwEditing = editing && isCrunchwork;
  const api = getApi(job);
  const address = jobAddress(job);
  const mapAddress = jobAddress(job, true).trim() || null;
  const { latitude: mapLat, longitude: mapLng } = jobCoords(job);
  const hasMapTarget =
    (mapLat != null && mapLng != null) || Boolean(mapAddress);
  const statusName = job.status?.name ?? ((api.status as Dict | undefined)?.name as string | undefined) ?? 'Unknown';
  const jobTypeName = job.jobType?.name ?? ((api.jobType as Dict | undefined)?.name as string | undefined);
  const addr = jobAddressSource(job);
  const latitude = asString(pick(addr, 'latitude', 'lat'));
  const longitude = asString(pick(addr, 'longitude', 'lng', 'long'));
  const apiVendor = (api.vendor as Dict | undefined) ?? {};
  const snapshot = (job.vendorSnapshot as Dict | undefined) ?? {};
  const vendorName = job.vendor?.name ?? (apiVendor.name as string | undefined) ?? (snapshot.name as string | undefined);
  const vendorExtRefInitial = job.vendor?.externalReference ?? (apiVendor.externalReference as string | undefined) ?? (snapshot.externalReference as string | undefined);
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

  const [statusLookupId, setStatusLookupId] = useState(job.statusLookupId ?? job.status?.id ?? '');
  const [statusExternalReference, setStatusExternalReference] = useState(
    job.status?.externalReference ?? '',
  );
  const [externalReference, setExternalReference] = useState(job.externalReference ?? '');
  const [makeSafeRequired, setMakeSafeRequired] = useState(!!job.makeSafeRequired);
  const [collectExcess, setCollectExcess] = useState(!!job.collectExcess);
  const [excess, setExcess] = useState(job.excess != null ? String(job.excess) : '');
  const [jobInstructions, setJobInstructions] = useState(job.jobInstructions ?? '');
  const [vendorExtRef, setVendorExtRef] = useState(vendorExtRefInitial ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const jobParties = ((job.apiPayload as Record<string, unknown>)?.contacts as JobParty[]) ?? [];

  useEffect(() => {
    if (editing) return;
    setBookedDate(bookedDateRaw ?? '');
    setAttendanceDate(attendanceDateRaw ?? '');
    setStatusLookupId(job.statusLookupId ?? job.status?.id ?? '');
    setStatusExternalReference(job.status?.externalReference ?? '');
    setExternalReference(job.externalReference ?? '');
    setMakeSafeRequired(!!job.makeSafeRequired);
    setCollectExcess(!!job.collectExcess);
    setExcess(job.excess != null ? String(job.excess) : '');
    setJobInstructions(job.jobInstructions ?? '');
    setVendorExtRef(vendorExtRefInitial ?? '');
  }, [
    editing,
    bookedDateRaw,
    attendanceDateRaw,
    job.statusLookupId,
    job.status?.id,
    job.status?.externalReference,
    job.externalReference,
    job.makeSafeRequired,
    job.collectExcess,
    job.excess,
    job.jobInstructions,
    vendorExtRefInitial,
  ]);

  const isDirty =
    bookedDate !== (bookedDateRaw ?? '') ||
    attendanceDate !== (attendanceDateRaw ?? '') ||
    (isCrunchwork && (
      statusLookupId !== (job.statusLookupId ?? job.status?.id ?? '') ||
      externalReference !== (job.externalReference ?? '') ||
      makeSafeRequired !== !!job.makeSafeRequired ||
      collectExcess !== !!job.collectExcess ||
      excess !== (job.excess != null ? String(job.excess) : '') ||
      jobInstructions !== (job.jobInstructions ?? '') ||
      vendorExtRef !== (vendorExtRefInitial ?? '')
    ));

  const buildPending = (): JobEditPending | null => {
    if (!isDirty) return null;
    const pending: JobEditPending = {
      bookedDate: bookedDate || null,
      attendanceDate: attendanceDate || null,
    };
    if (isCrunchwork) {
      pending.statusLookupId = statusLookupId || null;
      pending.statusExternalReference = statusExternalReference || null;
      pending.externalReference = externalReference || null;
      pending.makeSafeRequired = makeSafeRequired;
      pending.collectExcess = collectExcess;
      pending.excess = excess;
      pending.jobInstructions = jobInstructions;
      pending.vendorExternalReference = vendorExtRef || null;
    }
    return pending;
  };

  const reset = () => {
    setBookedDate(bookedDateRaw ?? '');
    setAttendanceDate(attendanceDateRaw ?? '');
    setScheduleTarget(null);
    setStatusLookupId(job.statusLookupId ?? job.status?.id ?? '');
    setStatusExternalReference(job.status?.externalReference ?? '');
    setExternalReference(job.externalReference ?? '');
    setMakeSafeRequired(!!job.makeSafeRequired);
    setCollectExcess(!!job.collectExcess);
    setExcess(job.excess != null ? String(job.excess) : '');
    setJobInstructions(job.jobInstructions ?? '');
    setVendorExtRef(vendorExtRefInitial ?? '');
  };

  useImperativeHandle(ref, () => ({
    getPendingUpdate: buildPending,
    getPendingDates: buildPending,
    reset,
    resetDates: reset,
  }), [
    isDirty,
    bookedDate,
    attendanceDate,
    statusLookupId,
    statusExternalReference,
    externalReference,
    makeSafeRequired,
    collectExcess,
    excess,
    jobInstructions,
    vendorExtRef,
    isCrunchwork,
  ]);

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

  const statusSelectOptions: LookupOption[] = (() => {
    const opts = [...statusOptions];
    const currentId = job.statusLookupId ?? job.status?.id;
    if (
      currentId &&
      !opts.some((o) => o.id === currentId)
    ) {
      opts.unshift({
        id: currentId,
        name: job.status?.name ?? statusName,
        externalReference: job.status?.externalReference,
      });
    }
    return opts;
  })();

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
        <SectionCard
          title="Core Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
          action={
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-expanded={showAdvanced || cwEditing}
              aria-label={showAdvanced || cwEditing ? 'Hide advanced details' : 'Show advanced details'}
              title={showAdvanced || cwEditing ? 'Hide advanced details' : 'Show advanced details'}
            >
              {showAdvanced || cwEditing ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          }
        >
          <DefRow label="Name" value={job.name ?? '—'} />
          <DefRow label="Job type" value={<TypeBadge type={jobTypeName} />} />
          <DefRow
            label="Status"
            value={
              cwEditing ? (
                <EditLookupSelect
                  valueId={statusLookupId}
                  options={statusSelectOptions}
                  disabled={saving}
                  onChange={(opt) => {
                    setStatusLookupId(opt?.id ?? '');
                    setStatusExternalReference(opt?.externalReference ?? '');
                  }}
                />
              ) : (
                <StatusBadge status={statusName} />
              )
            }
          />
          {insurerRef && insurerRef !== job.externalReference && (
            <DefRow label="Insurer reference" value={insurerRef} />
          )}
          <DefRow label="Parent claim" value={job.claimId ? (<Link href={`/claims/${job.claimId}`} className="inline-flex items-center gap-1 text-primary hover:underline">{parentClaimNumber ?? job.claimId}<ExternalLink className="h-3 w-3" /></Link>) : '—'} />
          {parentJobId && <DefRow label="Parent job" value={<Link href={`/jobs/${parentJobId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open master job<ExternalLink className="h-3 w-3" /></Link>} />}
          <DefRow label="Request date" value={formatDate(job.requestDate)} />
          <DefRow
            label="Make-safe required"
            value={
              cwEditing ? (
                <EditSwitch
                  checked={makeSafeRequired}
                  onChange={setMakeSafeRequired}
                  disabled={saving}
                />
              ) : (
                <BoolPill value={job.makeSafeRequired} />
              )
            }
          />
          <DefRow
            label="Collect excess"
            value={
              cwEditing ? (
                <EditSwitch
                  checked={collectExcess}
                  onChange={setCollectExcess}
                  disabled={saving}
                />
              ) : (
                <BoolPill value={job.collectExcess} />
              )
            }
          />
          <DefRow
            label="Excess"
            value={
              cwEditing ? (
                <EditText
                  type="number"
                  step="0.01"
                  min={0}
                  value={excess}
                  onChange={setExcess}
                  disabled={saving || !collectExcess}
                />
              ) : (
                formatCurrency(job.excess)
              )
            }
          />
          <AnimatePresence initial={false}>
            {(showAdvanced || cwEditing) && (
              <motion.div
                key="core-details-advanced"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <DefRow
                  label="External reference"
                  value={
                    cwEditing ? (
                      <EditText
                        value={externalReference}
                        onChange={setExternalReference}
                        disabled={saving}
                      />
                    ) : (
                      job.externalReference ?? '—'
                    )
                  }
                />
                <DefRow label="Provider" value={
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.provider === 'crunchwork'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {job.provider === 'crunchwork' ? 'Crunchwork' : 'Internal'}
                  </span>
                } />
                {parentClaimCw && parentClaimCw !== job.claimId && (
                  <DefRow label="Parent claim (Crunchwork)" value={<span className="font-mono text-xs">{parentClaimCw}</span>} />
                )}
                <DefRow label="Created" value={formatDateTime(job.createdAt)} />
                <DefRow label="Updated" value={formatDateTime(job.updatedAt)} />
                {cwUpdatedAt && <DefRow label="Crunchwork updated" value={formatDateTime(cwUpdatedAt)} />}
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>
        <SectionCard title="Job Dates &amp; Approval" icon={<Clock className="h-4 w-4 text-muted-foreground" />}>
          <DefRow label="Auto approval applies" value={<BoolPill value={autoApproval} />} />
          {vendorJobNumber && <DefRow label="Vendor job number" value={vendorJobNumber} />}
          <DefRow label="Contact date" value={formatDate(contactDate)} />
          <DefRow label="Booked date" value={
            editing ? (
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
            ) : (
              formatDate(bookedDate || bookedDateRaw)
            )
          } />
          <DefRow label="Attendance due date" value={formatDate(attendanceDueDate)} />
          <DefRow label="Attendance date" value={
            editing ? (
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
            ) : (
              formatDate(attendanceDate || attendanceDateRaw)
            )
          } />
          <DefRow label="Completed date" value={formatDate(completedDate)} />
        </SectionCard>
        {(vendorName || vendorExtRefInitial || vendorPhone || vendorEmail || cwEditing) && (
          <SectionCard title="Vendor" icon={<Building2 className="h-4 w-4 text-muted-foreground" />}>
            <DefRow label="Name" value={vendorName ?? '—'} />
            <DefRow
              label="External reference"
              value={
                cwEditing ? (
                  <EditText
                    value={vendorExtRef}
                    onChange={setVendorExtRef}
                    disabled={saving}
                  />
                ) : (
                  vendorExtRefInitial ?? '—'
                )
              }
            />
            <DefRow label="Phone" value={vendorPhone ? (<a href={`tel:${vendorPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{vendorPhone}</a>) : '—'} />
            <DefRow label="After-hours phone" value={vendorAfterHours ? (<a href={`tel:${vendorAfterHours}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Clock className="h-3 w-3" />{vendorAfterHours}</a>) : '—'} />
            <DefRow label="Email" value={vendorEmail ?? '—'} />
          </SectionCard>
        )}
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Risk Location" icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>
            <DefRow label="Address" value={address || '—'} />
            <DefRow
              label="Suburb"
              value={job.addressSuburb ?? asString(addr.suburb) ?? '—'}
            />
            <DefRow
              label="State"
              value={job.addressState ?? asString(addr.state) ?? '—'}
            />
            <DefRow
              label="Postcode"
              value={job.addressPostcode ?? asString(addr.postcode) ?? '—'}
            />
            <DefRow
              label="Country"
              value={job.addressCountry ?? asString(addr.country) ?? '—'}
            />
            {(latitude || longitude) && (
              <DefRow
                label="Coordinates"
                value={
                  latitude && longitude
                    ? `${latitude}, ${longitude}`
                    : (latitude ?? longitude ?? '—')
                }
              />
            )}
          </SectionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Location map
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasMapTarget ? (
                <LocationMap
                  title="Job location map"
                  latitude={mapLat}
                  longitude={mapLng}
                  address={mapAddress}
                  mapClassName="h-64 w-full border-0"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No map location available
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ScrollText className="h-4 w-4 text-muted-foreground" />Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              {cwEditing ? (
                <EditTextarea
                  value={jobInstructions}
                  onChange={setJobInstructions}
                  disabled={saving}
                  rows={5}
                />
              ) : instructionsHtml ? (
                <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: instructionsHtml }} />
              ) : (
                <p className="text-sm text-muted-foreground"><FileText className="mr-1 inline h-3 w-3" />No job instructions provided.</p>
              )}
            </CardContent>
          </Card>
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
      </div>

      <AppointmentFormDrawer
        open={scheduleTarget !== null}
        onOpenChange={(open) => { if (!open) setScheduleTarget(null); }}
        jobId={job.id}
        jobParties={jobParties}
        onSuccess={handleAppointmentSuccess}
      />

    </div>
  );
});
