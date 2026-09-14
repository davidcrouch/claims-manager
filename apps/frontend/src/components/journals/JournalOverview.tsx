'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Check, ExternalLink, FileText, MapPin, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DefRow,
  SectionCard,
  formatAddress,
  formatDateTime,
  formatStreetLine,
  type AddressLike,
} from '@/components/shared/detail';
import { LocationMap } from '@/components/shared/LocationMap';
import { jobDisplayName } from '@/components/shared/job-label';
import { updateJournalAction } from '@/app/(app)/journals/actions';
import type { Job, Journal } from '@/types/api';

export interface JournalOverviewProps {
  journal: Journal;
  entryCount: number;
  job?: Job | null;
}

/** Prefer local calendar date for YYYY-MM-DD visit dates (avoid UTC shift). */
function formatVisitDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return value;
}

function journalAddressLike(journal: Journal): AddressLike {
  return (journal.address ?? {}) as AddressLike;
}

function journalAddressFallback(journal: Journal) {
  return {
    suburb: journal.addressSuburb,
    state: journal.addressState,
    postcode: journal.addressPostcode,
    country: journal.addressCountry,
  };
}

function journalAddressQuery(journal: Journal): string | null {
  const formatted = formatAddress(journalAddressLike(journal), {
    full: true,
    fallback: journalAddressFallback(journal),
  }).trim();
  return formatted || null;
}

export function JournalOverview({ journal, entryCount, job = null }: JournalOverviewProps) {
  const router = useRouter();
  const lat = journal.latitude != null ? Number(journal.latitude) : NaN;
  const lng = journal.longitude != null ? Number(journal.longitude) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const addressQuery = journalAddressQuery(journal);
  const streetLine = formatStreetLine(journalAddressLike(journal));
  const addressLine = streetLine || addressQuery;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(journal.name);
  const [editDescription, setEditDescription] = useState(journal.description ?? '');
  const [editVisitDate, setEditVisitDate] = useState(
    (typeof journal.metadata?.visitDate === 'string' ? journal.metadata.visitDate : '') ?? '',
  );

  const startEdit = useCallback(() => {
    setEditName(journal.name);
    setEditDescription(journal.description ?? '');
    setEditVisitDate(
      (typeof journal.metadata?.visitDate === 'string' ? journal.metadata.visitDate : '') ?? '',
    );
    setEditing(true);
  }, [journal]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async () => {
    setSaving(true);
    const metadata = { ...journal.metadata };
    if (editVisitDate.trim()) {
      metadata.visitDate = editVisitDate.trim();
    } else {
      delete metadata.visitDate;
    }
    const result = await updateJournalAction(journal.id, {
      name: editName.trim() || journal.name,
      description: editDescription.trim() || undefined,
      metadata,
    });
    setSaving(false);
    if (result.success) {
      toast.success('Journal updated');
      setEditing(false);
      router.refresh();
    } else {
      toast.error(result.error ?? 'Failed to update journal');
    }
  }, [journal, editName, editDescription, editVisitDate, router]);

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Journal Details"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            action={
              editing ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={saving}
                    onClick={cancelEdit}
                    title="Cancel editing"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                    disabled={saving || !editName.trim()}
                    onClick={() => void saveEdit()}
                    title="Save changes"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={startEdit}
                  title="Edit journal details"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )
            }
          >
            <DefRow
              label="Name"
              value={
                editing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={saving}
                    className="h-7 w-full max-w-md text-sm"
                  />
                ) : (
                  journal.name
                )
              }
            />
            <DefRow
              label="Job"
              value={
                job ? (
                  <Link
                    href={`/jobs/${job.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {jobDisplayName(job)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <DefRow label="Status" value={<StatusBadge status={journal.status} />} />
            <DefRow
              label="Description"
              value={
                editing ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={saving}
                    rows={3}
                    className="w-full max-w-md text-sm"
                  />
                ) : journal.description?.trim() ? (
                  <span className="whitespace-pre-wrap">{journal.description}</span>
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="Entries"
              value={`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
            />
            <DefRow
              label="Visit date"
              value={
                editing ? (
                  <Input
                    type="date"
                    value={editVisitDate}
                    onChange={(e) => setEditVisitDate(e.target.value)}
                    disabled={saving}
                    className="h-7 w-40 text-sm"
                  />
                ) : typeof journal.metadata?.visitDate === 'string' &&
                  journal.metadata.visitDate ? (
                  formatVisitDate(journal.metadata.visitDate)
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="Created"
              value={
                <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {formatDateTime(journal.createdAt)}
                </span>
              }
            />
            <DefRow
              label="Updated"
              value={<span suppressHydrationWarning>{formatDateTime(journal.updatedAt)}</span>}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Location"
            icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
          >
            <DefRow label="Address" value={addressLine ?? '—'} />
            <DefRow label="Suburb" value={journal.addressSuburb ?? '—'} />
            <DefRow label="State" value={journal.addressState ?? '—'} />
            <DefRow label="Postcode" value={journal.addressPostcode ?? '—'} />
            <DefRow label="Country" value={journal.addressCountry ?? '—'} />
            {hasCoords && (
              <DefRow label="Coordinates" value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`} />
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
              {hasCoords || addressQuery ? (
                <LocationMap
                  title="Journal location map"
                  latitude={hasCoords ? lat : undefined}
                  longitude={hasCoords ? lng : undefined}
                  address={addressQuery}
                  mapClassName="h-64 w-full border-0"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No map location available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
