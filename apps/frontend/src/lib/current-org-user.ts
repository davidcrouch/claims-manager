/** Resolve the tenant org user id for the logged-in session. */
export function resolveCurrentOrgUserId(
  orgUsers: { id: string; email?: string }[],
  identity?: { email?: string; sub?: string } | null,
): string | null {
  const email = identity?.email?.trim().toLowerCase();
  const sub = identity?.sub;
  return (
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null)
  );
}
