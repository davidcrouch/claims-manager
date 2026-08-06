'use client';

import { useState, useCallback } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateAndDownloadDocument } from '@/lib/generate-document';

interface Props {
  entityId: string;
  documentType: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'xs';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export function GenerateDocumentButton({
  entityId,
  documentType,
  className,
  size = 'sm',
  variant = 'outline',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      await generateAndDownloadDocument({ documentType, entityId });
      toast.success('Document generated successfully');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Document generation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [entityId, documentType]);

  return (
    <Button
      size={size}
      variant={variant}
      disabled={loading}
      onClick={handleGenerate}
      className={cn(className)}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
      )}
      {loading ? 'Generating…' : 'Generate PDF'}
    </Button>
  );
}
