import type { ChatPart } from '@/lib/ai/chat-types';
import { shouldShowToolCallInTimeline } from '@/lib/ai/tool-result-error';

export type ChatDisplayMode = 'normal' | 'verbose';

export interface DisplayPartEntry {
  part: ChatPart;
  originalIndex: number;
}

export interface ResolveDisplayPartsParams {
  parts: ChatPart[];
  displayMode: ChatDisplayMode;
  /** True while this assistant message is still being generated. */
  isLive: boolean;
  processTerminated: boolean;
  isAssistant: boolean;
}

export interface ResolvedDisplayParts {
  parts: DisplayPartEntry[];
  showThinkingPlaceholder: boolean;
}

const ACTIVITY_PART_TYPES = new Set([
  'reasoning',
  'tool-call',
  'canvas-action',
  'canvas-component',
]);

function isOutputPart(part: ChatPart): boolean {
  return part.type === 'text' && !!part.text;
}

function isPersistentPart(part: ChatPart): boolean {
  return isOutputPart(part) || part.type === 'file' || part.type === 'citation';
}

function isActivityPart(part: ChatPart): boolean {
  return ACTIVITY_PART_TYPES.has(part.type);
}

function findLatestActivityPart(
  parts: ChatPart[],
  processTerminated: boolean,
): DisplayPartEntry | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part.type === 'reasoning') {
      return { part, originalIndex: i };
    }
    if (part.type === 'tool-call') {
      if (shouldShowToolCallInTimeline(part, parts, processTerminated)) {
        return { part, originalIndex: i };
      }
      continue;
    }
    if (part.type === 'canvas-action' || part.type === 'canvas-component') {
      return { part, originalIndex: i };
    }
  }
  return null;
}

function findLatestOutputPart(parts: ChatPart[]): DisplayPartEntry | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (isOutputPart(part)) {
      return { part, originalIndex: i };
    }
  }
  return null;
}

function findPersistentParts(parts: ChatPart[]): DisplayPartEntry[] {
  return parts
    .map((part, originalIndex) => ({ part, originalIndex }))
    .filter(({ part }) => isPersistentPart(part));
}

/** Resolve which message parts to render for normal vs verbose chat display. */
export function resolveDisplayParts({
  parts,
  displayMode,
  isLive,
  processTerminated,
  isAssistant,
}: ResolveDisplayPartsParams): ResolvedDisplayParts {
  if (!isAssistant || displayMode === 'verbose') {
    const hasOutput = parts.some(isOutputPart);
    return {
      parts: parts.map((part, originalIndex) => ({ part, originalIndex })),
      showThinkingPlaceholder: isAssistant && isLive && !hasOutput && !parts.some(isActivityPart),
    };
  }

  // --- Normal mode (in-place replacement) ---

  const latestOutput = findLatestOutputPart(parts);
  const persistentParts = findPersistentParts(parts);

  if (isLive) {
    if (latestOutput) {
      return { parts: [latestOutput], showThinkingPlaceholder: false };
    }

    const activity = findLatestActivityPart(parts, processTerminated);
    if (activity) {
      return { parts: [activity], showThinkingPlaceholder: false };
    }

    return { parts: [], showThinkingPlaceholder: true };
  }

  // Completed message — show final text + trailing persistent parts
  if (latestOutput) {
    const trailingPersistent = persistentParts.filter(
      ({ originalIndex }) => originalIndex >= latestOutput.originalIndex,
    );
    return {
      parts: trailingPersistent.length > 0 ? trailingPersistent : [latestOutput],
      showThinkingPlaceholder: false,
    };
  }

  return { parts: persistentParts, showThinkingPlaceholder: false };
}

// ---------------------------------------------------------------------------
// Global Shift-key tracker — lets ChatDrawer detect verbose mode on open
// without any caller having to forward the event.
// ---------------------------------------------------------------------------
let _shiftHeld = false;

function initShiftTracker(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', (e) => { _shiftHeld = e.shiftKey; }, true);
  document.addEventListener('keyup',   (e) => { _shiftHeld = e.shiftKey; }, true);
}

initShiftTracker();

/** Returns true while the Shift key is physically held down. */
export function isShiftHeld(): boolean {
  return _shiftHeld;
}
