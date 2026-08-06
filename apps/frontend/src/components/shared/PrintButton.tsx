'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Printer, Loader2, AlertTriangle } from 'lucide-react';
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

const NO_TEMPLATE_PATTERNS = [
  'No template assigned',
  'configure it under Admin',
  'No filesystem .docx linked',
];

function isNoTemplateError(message: string): boolean {
  return NO_TEMPLATE_PATTERNS.some((p) => message.includes(p));
}

interface PrintButtonProps {
  documentType: string;
  entityId: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
}

export function PrintButton({
  documentType,
  entityId,
  className,
  size = 'default',
}: PrintButtonProps) {
  const [loading, setLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const handlePrint = useCallback(async () => {
    setLoading(true);
    try {
      await generateAndDownloadDocument({ documentType, entityId });
      toast.success('PDF generated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF generation failed';
      if (isNoTemplateError(message)) {
        setTemplateError(message);
        setTemplateDialogOpen(true);
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [documentType, entityId]);

  return (
    <>
      <Button
        size={size}
        onClick={handlePrint}
        disabled={loading}
        className={cn(
          'h-9 w-9 px-0 bg-blue-600 text-white hover:bg-blue-500',
          className,
        )}
        title="Print PDF"
        aria-label="Print PDF"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Document Template Required
            </DialogTitle>
            <DialogDescription>
              A Word (.docx) template must be assigned for this report type before a PDF can be
              generated. Please configure it in Document Template settings.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {templateError}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Close
            </Button>
            <Link href="/admin/document-templates">
              <Button className="bg-blue-600 text-white hover:bg-blue-500">
                Go to Document Templates
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
