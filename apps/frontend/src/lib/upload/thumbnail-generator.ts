import { getFileCategory } from './validation';

const THUMBNAIL_WIDTH = 400;

/**
 * Generates a PNG thumbnail Blob from a File (images and PDFs only).
 * Word (.docx/.doc) thumbnails are generated server-side on upload-complete via LibreOffice.
 * Returns null for unsupported file types or if generation fails.
 */
export async function generateThumbnailBlob(file: File): Promise<Blob | null> {
  const category = getFileCategory(file.type);

  try {
    if (category === 'image') {
      return await renderImageThumbnail(file);
    }
    if (category === 'pdf') {
      return await renderPdfThumbnail(file);
    }
  } catch {
    return null;
  }

  return null;
}

/** @deprecated Use generateThumbnailBlob for upload; kept for any callers expecting a data URL. */
export async function generateThumbnail(file: File): Promise<string | null> {
  const blob = await generateThumbnailBlob(file);
  if (!blob) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function renderImageThumbnail(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const scale = THUMBNAIL_WIDTH / bitmap.width;
  const width = THUMBNAIL_WIDTH;
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/png' });
}

async function renderPdfThumbnail(file: File): Promise<Blob | null> {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = THUMBNAIL_WIDTH / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scaledViewport.width);
  canvas.height = Math.round(scaledViewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    await pdf.cleanup();
    return null;
  }

  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas,
  } as Parameters<typeof page.render>[0]).promise;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  await pdf.cleanup();
  return blob;
}
