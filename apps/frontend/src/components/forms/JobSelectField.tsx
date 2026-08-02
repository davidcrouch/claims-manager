'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { JobOption } from '@/components/shared/job-label';

export type { JobOption };

export function JobSelectField({
  jobs,
  value,
  onValueChange,
  id = 'jobId',
}: {
  jobs: JobOption[];
  value: string;
  onValueChange: (jobId: string) => void;
  id?: string;
}) {
  const items = Object.fromEntries(jobs.map((j) => [j.id, j.label]));

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor={id}>
        Job <span className="text-destructive">*</span>
      </Label>
      <Select
        value={value || null}
        onValueChange={(v) => onValueChange(v ?? '')}
        items={items}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select job" />
        </SelectTrigger>
        <SelectContent>
          {jobs.map((job) => (
            <SelectItem key={job.id} value={job.id}>
              {job.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
