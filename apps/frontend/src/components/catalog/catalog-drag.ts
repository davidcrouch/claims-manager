export const CATALOG_DRAG_MIME = 'application/x-claims-catalog-item';
export const GROUP_LABEL_DRAG_MIME = 'application/x-claims-group-label';

export interface CatalogDragPayload {
  id: string;
  kind: 'primitive' | 'assembly';
  code: string;
  name: string;
}

export interface GroupLabelDragPayload {
  id: string;
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

export function setGroupLabelDragData(
  dataTransfer: DataTransfer,
  payload: GroupLabelDragPayload,
): void {
  const encoded = JSON.stringify(payload);
  dataTransfer.setData(GROUP_LABEL_DRAG_MIME, encoded);
  dataTransfer.setData('text/plain', encoded);
  dataTransfer.effectAllowed = 'copy';
}

export function getGroupLabelDragData(
  dataTransfer: DataTransfer,
): GroupLabelDragPayload | null {
  const raw = dataTransfer.getData(GROUP_LABEL_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GroupLabelDragPayload;
  } catch {
    return null;
  }
}

export function hasGroupLabelDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(GROUP_LABEL_DRAG_MIME);
}
