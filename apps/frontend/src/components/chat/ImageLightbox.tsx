'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  filename?: string;
}

export function ImageLightbox({ open, onClose, src, alt, filename }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename ?? alt ?? 'image';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  }, [src, alt, filename]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div
        className="relative flex max-h-full max-w-full flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Download image"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn('overflow-auto rounded-lg bg-black/40 p-2', zoom > 1 && 'cursor-grab')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[80vh] w-auto object-contain transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          />
        </div>
        {filename && (
          <p className="mt-2 text-center text-xs text-white/70">{filename}</p>
        )}
      </div>
    </div>
  );
}
