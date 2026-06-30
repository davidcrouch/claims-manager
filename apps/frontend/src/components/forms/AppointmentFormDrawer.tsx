'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  CalendarClock,
  Search,
  X,
  UserPlus,
  Users,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { createAppointmentAction, updateAppointmentAction, searchContactsAction } from '@/app/(app)/mutations';
import type { Appointment } from '@/types/api';

const APPOINTMENT_TYPES = [
  { value: 'Inspection', label: 'Inspection' },
  { value: 'Appointment', label: 'Appointment' },
  { value: 'Specialist', label: 'Specialist' },
  { value: 'Re-inspection', label: 'Re-inspection' },
] as const;

const TIMEZONES = [
  { value: 'Australia/Brisbane', label: '(UTC+10:00) Australia/Brisbane' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Australia/Sydney' },
  { value: 'Australia/Melbourne', label: '(UTC+10:00) Australia/Melbourne' },
  { value: 'Australia/Adelaide', label: '(UTC+09:30) Australia/Adelaide' },
  { value: 'Australia/Perth', label: '(UTC+08:00) Australia/Perth' },
  { value: 'Australia/Darwin', label: '(UTC+09:30) Australia/Darwin' },
  { value: 'Australia/Hobart', label: '(UTC+10:00) Australia/Hobart' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Pacific/Auckland' },
] as const;

const LOCATION_TYPES = [
  { value: 'ONSITE', label: 'On-site' },
  { value: 'DIGITAL', label: 'Digital' },
] as const;

function todayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function oneHourLater(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const appointmentFormSchema = z
  .object({
    jobId: z.string().min(1, 'Job is required'),
    name: z.string().min(1, 'Title is required'),
    appointmentType: z.string().min(1, 'Appointment type is required'),
    location: z.string().min(1, 'Appointment location is required'),
    timezone: z.string().min(1, 'Timezone is required'),
    startDate: z.string().min(1, 'Start date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endDate: z.string().min(1, 'End date is required'),
    endTime: z.string().min(1, 'End time is required'),
    address: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T${data.startTime}`);
      const end = new Date(`${data.endDate}T${data.endTime}`);
      return end > start;
    },
    { message: 'End time must be after start time', path: ['endTime'] },
  );

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface PersonRef {
  id: string;
  type: 'USER' | 'CONTACT';
  name: string;
  email?: string;
}

export interface JobParty {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
  type?: string | { name?: string; externalReference?: string };
}

export interface AppointmentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobParties?: JobParty[];
  defaultAddress?: string;
  appointment?: Appointment;
  onSuccess?: (startDate: string) => void;
}

function PersonSearchField({
  label,
  placeholder,
  icon: Icon,
  selected,
  onAdd,
  onRemove,
  searchFn,
}: {
  label: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: PersonRef[];
  onAdd: (person: PersonRef) => void;
  onRemove: (id: string) => void;
  searchFn: (q: string) => Promise<PersonRef[]>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await searchFn(value.trim());
          const selectedIds = new Set(selected.map((s) => s.id));
          setResults(res.filter((r) => !selectedIds.has(r.id)));
          setShowDropdown(true);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [searchFn, selected],
  );

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
            >
              <span className="font-medium">{p.name}</span>
              {p.email && (
                <span className="text-muted-foreground">({p.email})</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="ml-0.5 rounded hover:bg-destructive/10"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="pl-8"
        />
        {searching && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Searching...
          </span>
        )}

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  onAdd(r);
                  setQuery('');
                  setResults([]);
                  setShowDropdown(false);
                }}
              >
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{r.name}</span>
                {r.email && (
                  <span className="text-muted-foreground">({r.email})</span>
                )}
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {r.type}
                </span>
              </button>
            ))}
          </div>
        )}
        {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}

function partyName(p: JobParty): string {
  if (p.name) return p.name;
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.join(' ').trim() || p.email || 'Unknown';
}

function partyType(p: JobParty): string {
  if (!p.type) return '';
  if (typeof p.type === 'string') return p.type;
  return p.type.name ?? '';
}

function extractDateParts(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function resolveAppointmentType(a: Appointment): string {
  const t = a.appointmentType;
  if (!t) return 'Inspection';
  if (typeof t === 'string') return t;
  return t.name ?? 'Inspection';
}

export function AppointmentFormDrawer({
  open,
  onOpenChange,
  jobId,
  jobParties = [],
  defaultAddress,
  appointment,
  onSuccess,
}: AppointmentFormDrawerProps) {
  const router = useRouter();
  const isEdit = !!appointment;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<PersonRef[]>([]);
  const [selectedParties, setSelectedParties] = useState<JobParty[]>([]);

  const now = todayDateString();
  const defaultTime = '19:15';

  const form = useForm<AppointmentFormValues>({
    resolver: standardSchemaResolver(appointmentFormSchema),
    defaultValues: {
      jobId,
      name: '',
      appointmentType: 'Inspection',
      location: 'ONSITE',
      timezone: 'Australia/Brisbane',
      startDate: now,
      startTime: defaultTime,
      endDate: now,
      endTime: oneHourLater(defaultTime),
      address: defaultAddress ?? '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (appointment) {
        const start = extractDateParts(appointment.startDate);
        const end = extractDateParts(appointment.endDate);
        form.reset({
          jobId: appointment.jobId,
          name: appointment.name ?? '',
          appointmentType: resolveAppointmentType(appointment),
          location: appointment.location ?? 'ONSITE',
          timezone: 'Australia/Brisbane',
          startDate: start?.date ?? todayDateString(),
          startTime: start?.time ?? '19:15',
          endDate: end?.date ?? todayDateString(),
          endTime: end?.time ?? '20:15',
          address: defaultAddress ?? '',
          description: '',
        });
        setAssignees([]);
        setSelectedParties([]);
      } else {
        const today = todayDateString();
        form.reset({
          jobId,
          name: '',
          appointmentType: 'Inspection',
          location: 'ONSITE',
          timezone: 'Australia/Brisbane',
          startDate: today,
          startTime: '19:15',
          endDate: today,
          endTime: '20:15',
          address: defaultAddress ?? '',
          description: '',
        });
        setAssignees([]);
        setSelectedParties([]);
      }
      setError(null);
    }
  }, [open, jobId, defaultAddress, form, appointment]);

  const searchContacts = useCallback(
    async (q: string): Promise<PersonRef[]> => {
      try {
        return await searchContactsAction(q);
      } catch {
        return [];
      }
    },
    [],
  );

  async function onSubmit(values: AppointmentFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const startDate = new Date(`${values.startDate}T${values.startTime}`);
      const endDate = new Date(`${values.endDate}T${values.endTime}`);

      const attendees = [
        ...assignees.map((a) => ({
          attendeeType: 'CONTACT' as const,
          contactId: a.id,
          name: a.name,
          email: a.email,
        })),
        ...selectedParties.map((p) => ({
          attendeeType: 'CONTACT' as const,
          ...(p.id ? { contactId: p.id } : {}),
          name: partyName(p),
          email: p.email,
        })),
      ];

      const payload = {
        jobId: values.jobId,
        name: values.name,
        appointmentType: values.appointmentType,
        location: values.location,
        timezone: values.timezone,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        address: values.address || undefined,
        description: values.description || undefined,
        attendees,
      };

      const result = isEdit
        ? await updateAppointmentAction(appointment!.id, payload)
        : await createAppointmentAction(payload);

      if (result.success) {
        onSuccess?.(values.startDate);
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? (isEdit ? 'Failed to update appointment' : 'Failed to create appointment'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : (isEdit ? 'Failed to update appointment' : 'Failed to create appointment'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Appointment' : 'Create Appointment'}
      description={isEdit ? 'Update the appointment details below.' : 'Schedule a new appointment for this job. Fill in the details below.'}
      icon={<CalendarClock className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {/* Title */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="appt-name">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="appt-name"
                {...form.register('name')}
                placeholder="e.g. Initial Site Inspection"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Appointment Type */}
            <div className="space-y-2">
              <Label htmlFor="appt-type">
                Appointment Type <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="appointmentType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? '')}
                  >
                    <SelectTrigger id="appt-type" className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Appointment Location */}
            <div className="space-y-2">
              <Label htmlFor="appt-location">
                Appointment Location <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="location"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? '')}
                  >
                    <SelectTrigger id="appt-location" className="w-full">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_TYPES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.location && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.location.message}
                </p>
              )}
            </div>

            {/* Contacts (job parties dropdown) */}
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Contacts
              </Label>

              {selectedParties.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedParties.map((p, i) => {
                    const key = p.id ?? `party-${i}`;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
                      >
                        <span className="font-medium">{partyName(p)}</span>
                        {partyType(p) && (
                          <span className="text-muted-foreground">· {partyType(p)}</span>
                        )}
                        {p.email && (
                          <span className="text-muted-foreground">({p.email})</span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedParties((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="ml-0.5 rounded hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {jobParties.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parties linked to this job.</p>
              ) : (
                <Select
                  value=""
                  onValueChange={(idx) => {
                    const party = jobParties[Number(idx)];
                    if (party) {
                      setSelectedParties((prev) => [...prev, party]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a party..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobParties.map((p, i) => {
                      const name = partyName(p);
                      const type = partyType(p);
                      return (
                        <SelectItem key={p.id ?? `p-${i}`} value={String(i)}>
                          {name}
                          {type ? ` · ${type}` : ''}
                          {p.email ? ` (${p.email})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Assigned To (search contacts table) */}
            <div className="md:col-span-2">
              <PersonSearchField
                label="Assigned To"
                placeholder="Search contacts by name..."
                icon={UserPlus}
                selected={assignees}
                onAdd={(p) => setAssignees((prev) => [...prev, p])}
                onRemove={(id) =>
                  setAssignees((prev) => prev.filter((a) => a.id !== id))
                }
                searchFn={searchContacts}
              />
            </div>

            {/* Timezone */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="appt-timezone">
                <Globe className="inline h-3.5 w-3.5 text-muted-foreground mr-1" />
                Timezone <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? '')}
                  >
                    <SelectTrigger id="appt-timezone" className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.timezone && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.timezone.message}
                </p>
              )}
            </div>

            {/* Start date and time */}
            <div className="space-y-2">
              <Label htmlFor="appt-start-date">
                Start date and time <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="appt-start-date"
                  type="date"
                  {...form.register('startDate')}
                  className="flex-1"
                />
                <Input
                  id="appt-start-time"
                  type="time"
                  {...form.register('startTime')}
                  className="w-32"
                />
              </div>
              {form.formState.errors.startDate && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              )}
            </div>

            {/* End date and time */}
            <div className="space-y-2">
              <Label htmlFor="appt-end-date">
                End date and time <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="appt-end-date"
                  type="date"
                  {...form.register('endDate')}
                  className="flex-1"
                />
                <Input
                  id="appt-end-time"
                  type="time"
                  {...form.register('endTime')}
                  className="w-32"
                />
              </div>
              {(form.formState.errors.endDate ||
                form.formState.errors.endTime) && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.endDate?.message ??
                    form.formState.errors.endTime?.message}
                </p>
              )}
            </div>

            {/* Check Availability */}
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Availability checking coming soon"
              >
                Check Availability
              </Button>
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="appt-address">Address</Label>
              <Input
                id="appt-address"
                {...form.register('address')}
                placeholder="e.g. 123 Nicholson Parade, Cronulla, NSW 2230, Australia"
              />
            </div>

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="appt-description">Description</Label>
              <Textarea
                id="appt-description"
                {...form.register('description')}
                placeholder="Optional description or notes..."
                rows={3}
              />
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save Changes' : 'Create Appointment')}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
