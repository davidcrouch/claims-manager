'use client';

import { useEffect, useState } from 'react';
import { getFileCategory } from './validation';

export function useFileThumbnail(file: File | null): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setThumbnail(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const category = getFileCategory(file.type);

    if (category === 'image') {
      objectUrl = URL.createObjectURL(file);
      setThumbnail(objectUrl);
    } else if (category === 'pdf') {
      renderPdfThumbnail(file)
        .then((url) => {
          if (!cancelled) setThumbnail(url);
        })
        .catch(() => {
          if (!cancelled) setThumbnail(null);
        });
    } else {
      setThumbnail(null);
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return thumbnail;
}

async function renderPdfThumbnail(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const targetWidth = 200;
  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas,
  } as Parameters<typeof page.render>[0]).promise;

  const dataUrl = canvas.toDataURL('image/png');
  await pdf.cleanup();
  return dataUrl;
}
