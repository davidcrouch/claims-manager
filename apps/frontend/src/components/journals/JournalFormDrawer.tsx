'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { JobSelectField } from '@/components/forms/JobSelectField';
import type { JobOption } from '@/components/shared/job-label';
import type { Journal } from '@/types/api';

export interface JournalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  createJournal: (data: { name: string; description?: string }) => Promise<Journal | null>;
  linkJournal?: (journalId: string) => Promise<boolean>;
  /** Link the new journal to a Job entity (used when a job is selected). */
  linkToJob?: (journalId: string, jobId: string) => Promise<boolean>;
  onCreated?: (journal: Journal) => void;
  jobId?: string | null;
  jobs?: JobOption[];
}

export function JournalFormDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  createJournal,
  linkJournal,
  linkToJob,
  onCreated,
  jobId,
  jobs = [],
}: JournalFormDrawerProps) {
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobRequired = jobs.length > 0 || Boolean(jobId);

  useEffect(() => {
    if (open) {
      setSelectedJobId(jobId ?? '');
    }
  }, [open, jobId]);

  const resetForm = () => {
    setSelectedJobId(jobId ?? '');
    setName('');
    setDescription('');
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const canSubmit =
    Boolean(name.trim()) &&
    (!jobRequired || Boolean(selectedJobId.trim())) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (jobRequired && !selectedJobId.trim()) {
      setError('Job is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const journal = await createJournal({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (!journal) {
        setError('Failed to create journal');
        return;
      }

      if (selectedJobId && linkToJob) {
        await linkToJob(journal.id, selectedJobId);
      }

      const alreadyLinkedToSelectedJob =
        entityType === 'Job' && entityId === selectedJobId;
      if (journal && entityType && entityId && linkJournal && !alreadyLinkedToSelectedJob) {
        await linkJournal(journal.id);
      }

      resetForm();
      onCreated?.(journal);
    } catch (err) {
      console.error('JournalFormDrawer.handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create journal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Journal"
      description={
        entityType
          ? `Create a new journal and link it to this ${entityType.toLowerCase()}.`
          : 'Create a new journal for a job.'
      }
      icon={<BookOpen className="h-5 w-5" />}
      widthClassName="w-[60%]"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {(jobs.length > 0 || jobId) && (
              <JobSelectField
                jobs={jobs}
                value={selectedJobId}
                onValueChange={setSelectedJobId}
              />
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journal-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="journal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Site Visit Notes"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journal-description">Description</Label>
              <Textarea
                id="journal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
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
            size="lg"
            className="min-w-36 px-8"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="min-w-36 px-8"
            disabled={!canSubmit}
          >
            {submitting ? 'Creating…' : 'Create Journal'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
