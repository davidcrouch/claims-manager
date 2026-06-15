export const CATALOG_DRAG_MIME = 'application/x-claims-catalog-item';

export interface CatalogDragPayload {
  id: string;
  kind: 'primitive' | 'assembly';
  code: string;
  name: string;
}

export function setCatalogDragData(
  dataTransfer: DataTransfer,
  payload: CatalogDragPayload,
): void {
  const encoded = JSON.stringify(payload);
  dataTransfer.setData(CATALOG_DRAG_MIME, encoded);
  dataTransfer.setData('text/plain', encoded);
  dataTransfer.effectAllowed = 'copy';
}

export function getCatalogDragData(
  dataTransfer: DataTransfer,
): CatalogDragPayload | null {
  const raw =
    dataTransfer.getData(CATALOG_DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CatalogDragPayload;
  } catch {
    return null;
  }
}
