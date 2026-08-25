export const CATALOG_DRAG_MIME = 'application/x-claims-catalog-item';
export const GROUP_LABEL_DRAG_MIME = 'application/x-claims-group-label';

export interface CatalogDragPayload {
  id: string;
  kind: 'primitive' | 'assembly' | 'scope';
  code: string;
  name: string;
}

export interface GroupLabelDragPayload {
  id: string;
  name: string;
}

type ActiveDrag =
  | { type: 'catalog'; payload: CatalogDragPayload }
  | { type: 'group-label'; payload: GroupLabelDragPayload };

/** In-memory drag session — MIME types alone are unreliable across browsers during dragover. */
let activeDrag: ActiveDrag | null = null;

function setCatalogDraggingAttr(on: boolean): void {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.catalogDragging = '1';
  else delete document.documentElement.dataset.catalogDragging;
}

function dataTransferHasType(dataTransfer: DataTransfer, mime: string): boolean {
  const types = dataTransfer.types;
  if (!types) return false;
  if (typeof (types as { includes?: (v: string) => boolean }).includes === 'function') {
    return (types as unknown as string[]).includes(mime);
  }
  const withContains = types as unknown as { contains?: (v: string) => boolean };
  if (typeof withContains.contains === 'function') {
    return Boolean(withContains.contains(mime));
  }
  return Array.from(types as ArrayLike<string>).includes(mime);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isCatalogPayload(value: unknown): value is CatalogDragPayload {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.name === 'string' &&
    (rec.kind === 'primitive' || rec.kind === 'assembly' || rec.kind === 'scope')
  );
}

function isGroupLabelPayload(value: unknown): value is GroupLabelDragPayload {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.name === 'string' &&
    rec.kind === undefined
  );
}

export function clearCatalogDrag(): void {
  activeDrag = null;
  setCatalogDraggingAttr(false);
}

export function setCatalogDragData(
  dataTransfer: DataTransfer,
  payload: CatalogDragPayload,
): void {
  activeDrag = { type: 'catalog', payload };
  setCatalogDraggingAttr(true);
  const encoded = JSON.stringify(payload);
  dataTransfer.setData(CATALOG_DRAG_MIME, encoded);
  dataTransfer.setData('text/plain', encoded);
  dataTransfer.effectAllowed = 'copy';
}

export function getCatalogDragData(
  dataTransfer: DataTransfer,
): CatalogDragPayload | null {
  if (activeDrag?.type === 'catalog') return activeDrag.payload;

  const raw =
    dataTransfer.getData(CATALOG_DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;
  const parsed = parseJson(raw);
  return isCatalogPayload(parsed) ? parsed : null;
}

export function setGroupLabelDragData(
  dataTransfer: DataTransfer,
  payload: GroupLabelDragPayload,
): void {
  activeDrag = { type: 'group-label', payload };
  setCatalogDraggingAttr(true);
  const encoded = JSON.stringify(payload);
  dataTransfer.setData(GROUP_LABEL_DRAG_MIME, encoded);
  dataTransfer.setData('text/plain', encoded);
  dataTransfer.effectAllowed = 'copy';
}

export function getGroupLabelDragData(
  dataTransfer: DataTransfer,
): GroupLabelDragPayload | null {
  if (activeDrag?.type === 'group-label') return activeDrag.payload;

  const raw =
    dataTransfer.getData(GROUP_LABEL_DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;
  const parsed = parseJson(raw);
  return isGroupLabelPayload(parsed) ? parsed : null;
}

export function hasGroupLabelDrag(dataTransfer: DataTransfer): boolean {
  if (activeDrag?.type === 'group-label') return true;
  return dataTransferHasType(dataTransfer, GROUP_LABEL_DRAG_MIME);
}

export function hasCatalogDrag(dataTransfer: DataTransfer): boolean {
  if (activeDrag?.type === 'catalog') return true;
  return dataTransferHasType(dataTransfer, CATALOG_DRAG_MIME);
}

/** Drop surfaces on the Take Off table. */
export type CatalogDropTarget = 'table' | 'group' | 'scope' | 'assembly';

/**
 * Hierarchy rules:
 * - group labels → table (top level) only
 * - scopes → groups only (a drop on a nested scope/assembly retargets to that parent group)
 * - assemblies → groups or scopes
 * - primitives → groups, scopes, or assemblies
 */
export function isValidCatalogDropTarget(
  kind: CatalogDragPayload['kind'],
  target: CatalogDropTarget,
): boolean {
  switch (target) {
    case 'table':
      return false;
    case 'group':
      return kind === 'scope' || kind === 'assembly' || kind === 'primitive';
    case 'scope':
      return kind === 'assembly' || kind === 'primitive';
    case 'assembly':
      return kind === 'primitive';
    default:
      return false;
  }
}

/**
 * Where a catalogue item actually lands after remapping.
 * Scopes cannot nest, so any accepted drop of a scope becomes a group drop.
 */
export function resolveCatalogDropDestination(
  kind: CatalogDragPayload['kind'],
  target: CatalogDropTarget,
): Exclude<CatalogDropTarget, 'table'> | null {
  if (kind === 'scope') {
    if (target === 'table') return null;
    return 'group';
  }
  if (!isValidCatalogDropTarget(kind, target) || target === 'table') return null;
  return target;
}

export function isValidGroupLabelDropTarget(target: CatalogDropTarget): boolean {
  return target === 'table';
}

/** Kind of the in-flight catalogue drag (reliable during dragover). */
export function peekCatalogDragKind(
  _dataTransfer?: DataTransfer | null,
): CatalogDragPayload['kind'] | null {
  if (activeDrag?.type === 'catalog') return activeDrag.payload.kind;
  return null;
}

export function peekActiveDragType(): 'group-label' | 'catalog' | null {
  return activeDrag?.type ?? null;
}

/**
 * Returns true when this target should accept the current drag (and the caller
 * should preventDefault / highlight). False means leave the event alone so a
 * parent zone can accept it instead.
 */
export function shouldAcceptCatalogDragOver(
  dataTransfer: DataTransfer,
  target: CatalogDropTarget,
): boolean {
  if (hasGroupLabelDrag(dataTransfer)) {
    return isValidGroupLabelDropTarget(target);
  }
  if (!hasCatalogDrag(dataTransfer)) return false;
  const kind = peekCatalogDragKind(dataTransfer);
  if (!kind) return false;
  return resolveCatalogDropDestination(kind, target) !== null;
}
