'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { generateAndDownloadDocument } from '@/lib/generate-document';

export const JOB_REPORT_TYPES = [
  {
    documentType: 'job_details',
    label: 'Job Details',
    description: 'Summary of job status, address, claim, and key dates.',
  },
  {
    documentType: 'scope_of_work',
    label: 'Scope of Work',
    description: 'Job instructions and scope details for the works.',
  },
] as const;

export type JobReportDocumentType = (typeof JOB_REPORT_TYPES)[number]['documentType'];

export interface JobReportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function JobReportWizard({ open, onOpenChange, jobId }: JobReportWizardProps) {
  const [selected, setSelected] = useState<JobReportDocumentType>('job_details');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected('job_details');
      setGenerating(false);
    }
  }, [open]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateAndDownloadDocument({
        documentType: selected,
        entityId: jobId,
      });
      toast.success('Report PDF downloaded');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!generating}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Report
          </DialogTitle>
          <DialogDescription>
            Choose a report type. A PDF will be generated from the assigned document template.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1" role="radiogroup" aria-label="Report type">
          {JOB_REPORT_TYPES.map((option) => {
            const active = selected === option.documentType;
            return (
              <button
                key={option.documentType}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={generating}
                onClick={() => setSelected(option.documentType)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                  active
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-border bg-background hover:bg-muted/50',
                  generating && 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    active ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-3.5 w-3.5" />
            )}
            {generating ? 'Generating…' : 'Generate PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
