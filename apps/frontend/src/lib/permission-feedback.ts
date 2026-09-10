/**
 * Shared permission-denied copy and a small event bus so API 403s and
 * client-side guards can open the same informational dialog.
 */

export const PERMISSION_DENIED_CODE = 'PERMISSION_DENIED';

export const PERMISSION_DENIED_MESSAGE =
  'You do not have permission to perform this action.';

export type PermissionDeniedOptions = {
  /** Optional activity, e.g. "approve this invoice". */
  action?: string;
};

type PermissionDeniedHandler = (options?: PermissionDeniedOptions) => void;

let handler: PermissionDeniedHandler | null = null;

export function registerPermissionDeniedHandler(
  next: PermissionDeniedHandler | null,
): void {
  handler = next;
}

export function notifyPermissionDenied(options?: PermissionDeniedOptions): void {
  if (typeof window === 'undefined') return;
  if (handler) {
    handler(options);
    return;
  }
  window.dispatchEvent(
    new CustomEvent('ensureos:permission-denied', { detail: options }),
  );
}

export function isPermissionDeniedMessage(message: unknown): boolean {
  if (typeof message !== 'string' || message.length === 0) return false;
  const normalised = message.trim();
  if (normalised === PERMISSION_DENIED_MESSAGE) return true;
  if (normalised === 'Forbidden') return true;
  const lower = normalised.toLowerCase();
  if (lower.includes('do not have permission')) return true;
  if (lower.includes('insufficient permissions')) return true;
  if (lower.includes('[permissionsguard')) return true;
  if (lower.includes('[rolesguard')) return true;
  if (lower.includes('[assertpermission')) return true;
  return false;
}

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return isPermissionDeniedMessage(error);
  }
  const record = error as {
    status?: number;
    code?: string;
    message?: string;
    body?: { code?: string; message?: string };
  };
  if (record.code === PERMISSION_DENIED_CODE) return true;
  if (record.body?.code === PERMISSION_DENIED_CODE) return true;
  if (isPermissionDeniedMessage(record.message)) return true;
  if (isPermissionDeniedMessage(record.body?.message)) return true;
  return false;
}

/** Shows the permission dialog when `error` is a permission denial. */
export function consumePermissionDeniedError(
  error: unknown,
  options?: PermissionDeniedOptions,
): boolean {
  if (isPermissionDeniedError(error) || isPermissionDeniedMessage(error)) {
    notifyPermissionDenied(options);
    return true;
  }
  return false;
}
