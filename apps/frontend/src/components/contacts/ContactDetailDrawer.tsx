'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Mail, MapPin, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { DefRow, SectionCard, formatDateTime } from '@/components/shared/detail';
import {
  fetchContactAction,
  fetchContactRelatedJobsAction,
} from '@/app/(app)/contacts/actions';
import type { Contact, ContactRelatedJob } from '@/types/api';

/** Snapshot shape from job.apiPayload.contacts, or a DB Contact row. */
export type ContactDetail = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  homePhone?: string | null;
  workPhone?: string | null;
  type?: string | { name?: string; externalReference?: string } | null;
  typeLookupId?: string | null;
  preferredMethodOfContact?: string | { name?: string } | null;
  preferredContactMethodLookupId?: string | null;
  notes?: string | null;
  externalReference?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function displayName(c: ContactDetail): string {
  if (c.name?.trim()) return c.name.trim();
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || 'Contact';
}

function displayRole(c: ContactDetail): string {
  if (!c.type) return '';
  if (typeof c.type === 'string') return c.type;
  return c.type.name ?? c.type.externalReference ?? '';
}

function displayPreferred(c: ContactDetail): string {
  if (!c.preferredMethodOfContact) return '';
  if (typeof c.preferredMethodOfContact === 'string') {
    return c.preferredMethodOfContact;
  }
  return c.preferredMethodOfContact.name ?? '';
}

function mergeContact(snapshot: ContactDetail, fetched: Contact | null): ContactDetail {
  if (!fetched) return snapshot;
  return {
    ...snapshot,
    firstName: fetched.firstName ?? snapshot.firstName,
    lastName: fetched.lastName ?? snapshot.lastName,
    email: fetched.email ?? snapshot.email,
    mobilePhone: fetched.mobilePhone ?? snapshot.mobilePhone,
    homePhone: fetched.homePhone ?? snapshot.homePhone,
    workPhone: fetched.workPhone ?? snapshot.workPhone,
    notes: fetched.notes ?? snapshot.notes,
    externalReference: fetched.externalReference ?? snapshot.externalReference,
    typeLookupId: fetched.typeLookupId ?? snapshot.typeLookupId,
    preferredContactMethodLookupId:
      fetched.preferredContactMethodLookupId ??
      snapshot.preferredContactMethodLookupId,
    createdAt: fetched.createdAt ?? snapshot.createdAt,
    updatedAt: fetched.updatedAt ?? snapshot.updatedAt,
  };
}

function jobLabel(job: ContactRelatedJob): string {
  return (
    job.externalReference?.trim() ||
    job.name?.trim() ||
    job.id
  );
}

function jobLocation(job: ContactRelatedJob): string {
  return [job.addressSuburb, job.addressState].filter(Boolean).join(', ');
}

export interface ContactDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactDetail | null;
  /** When opened from a job Parties tab, highlight that job in related jobs. */
  currentJobId?: string | null;
}

export function ContactDetailDrawer({
  open,
  onOpenChange,
  contact,
  currentJobId,
}: ContactDetailDrawerProps) {
  const [detail, setDetail] = useState<ContactDetail | null>(contact);
  const [relatedJobs, setRelatedJobs] = useState<ContactRelatedJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contact) {
      setDetail(contact);
      setRelatedJobs([]);
      return;
    }

    setDetail(contact);
    if (!contact.id) {
      setRelatedJobs([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchContactAction(contact.id),
      fetchContactRelatedJobsAction(contact.id),
    ])
      .then(([fetched, jobs]) => {
        if (cancelled) return;
        setDetail(mergeContact(contact, fetched));
        setRelatedJobs(jobs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, contact]);

  const title = detail ? displayName(detail) : 'Contact';
  const roleFromContact = detail ? displayRole(detail) : '';
  const role =
    roleFromContact ||
    relatedJobs.find((j) => j.role)?.role ||
    '';
  const preferred = detail ? displayPreferred(detail) : '';
  const description = role
    ? `${role}${relatedJobs.length ? ` · ${relatedJobs.length} related job${relatedJobs.length === 1 ? '' : 's'}` : ''}`
    : 'Contact details';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={<User className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        {!detail ? (
          <p className="text-sm text-slate-500">No contact selected.</p>
        ) : (
          <div className="space-y-4">
            {loading && (
              <p className="text-xs text-slate-400">Loading contact details…</p>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Role & identity" icon={<User className="h-4 w-4" />}>
                <DefRow
                  label="Role"
                  value={
                    role ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        {role}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DefRow label="Name" value={displayName(detail)} />
                <DefRow label="First name" value={detail.firstName} />
                <DefRow label="Last name" value={detail.lastName} />
                <DefRow label="External ref" value={detail.externalReference} />
              </SectionCard>

              <SectionCard title="Contact" icon={<Mail className="h-4 w-4" />}>
                <DefRow
                  label="Email"
                  value={
                    detail.email ? (
                      <a
                        href={`mailto:${detail.email}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {detail.email}
                      </a>
                    ) : null
                  }
                />
                <DefRow label="Preferred method" value={preferred || '—'} />
                <DefRow
                  label="Mobile"
                  value={
                    detail.mobilePhone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {detail.mobilePhone}
                      </span>
                    ) : null
                  }
                />
                <DefRow
                  label="Home"
                  value={
                    detail.homePhone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {detail.homePhone}
                      </span>
                    ) : null
                  }
                />
                <DefRow
                  label="Work"
                  value={
                    detail.workPhone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {detail.workPhone}
                      </span>
                    ) : null
                  }
                />
              </SectionCard>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4" />
                  <span>Roles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2 sm:px-0">
                {relatedJobs.length === 0 ? (
                  <p className="px-6 py-1.5 text-sm text-muted-foreground">
                    {loading ? 'Loading roles…' : 'No related jobs.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50/80">
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <th scope="col" className="px-6 py-2.5">Job</th>
                          <th scope="col" className="px-4 py-2.5">Role</th>
                          <th scope="col" className="px-4 py-2.5">Type</th>
                          <th scope="col" className="px-4 py-2.5">Status</th>
                          <th scope="col" className="px-4 py-2.5">Location</th>
                          <th scope="col" className="px-6 py-2.5">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {relatedJobs.map((job) => {
                          const isCurrent =
                            currentJobId != null && job.id === currentJobId;
                          const location = jobLocation(job);
                          return (
                            <tr
                              key={job.id}
                              className={
                                isCurrent
                                  ? 'bg-blue-50/60'
                                  : 'transition-colors hover:bg-slate-50'
                              }
                            >
                              <td className="whitespace-nowrap px-6 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/jobs/${job.id}`}
                                    className="font-medium text-primary hover:underline"
                                    onClick={() => onOpenChange(false)}
                                  >
                                    {jobLabel(job)}
                                  </Link>
                                  {isCurrent && (
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                                      Current
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                {job.role ? (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                    {job.role}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                {job.jobTypeName ? (
                                  <TypeBadge type={job.jobTypeName} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                {job.statusName ? (
                                  <StatusBadge status={job.statusName} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {location ? (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                    {location}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-6 py-2.5 text-slate-500">
                                {job.updatedAt
                                  ? formatDateTime(job.updatedAt)
                                  : '—'}
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

            <SectionCard title="Notes">
              <DefRow
                label="Notes"
                value={
                  detail.notes ? (
                    <span className="whitespace-pre-wrap">{detail.notes}</span>
                  ) : null
                }
              />
            </SectionCard>

            {(detail.createdAt || detail.updatedAt) && (
              <SectionCard title="Record">
                <DefRow
                  label="Created"
                  value={
                    detail.createdAt ? formatDateTime(detail.createdAt) : null
                  }
                />
                <DefRow
                  label="Updated"
                  value={
                    detail.updatedAt ? formatDateTime(detail.updatedAt) : null
                  }
                />
              </SectionCard>
            )}
          </div>
        )}
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
