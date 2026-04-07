/**
 * Signed cookie helpers for OIDC state/verifier (HMAC-SHA256).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const SEP = '.';

export function signCookie(value: string, secret: string): string {
  const mac = createHmac('sha256', secret);
  mac.update(value);
  const sig = mac.digest('hex');
  return value + SEP + sig;
}

export function verifyCookie(
  signed: string,
  secret: string,
): string | null {
  const idx = signed.lastIndexOf(SEP);
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const mac = createHmac('sha256', secret);
  mac.update(value);
  const expected = mac.digest('hex');
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(
        Buffer.from(sig, 'utf8'),
        Buffer.from(expected, 'utf8'),
      )
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}
