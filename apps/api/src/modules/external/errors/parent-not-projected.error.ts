/**
 * Thrown by entity mappers when a projection cannot complete because one or
 * more required parent entities have not yet been projected.
 *
 * This is a recoverable error class — the WebhookOrchestrator treats it as a
 * transient condition: it attempts an inline parent fetch-and-project (see
 * ParentRecoveryService) and, failing that, schedules a deferred retry via
 * WebhookRetryService. Callers should therefore only throw this error when
 * the failure is genuinely caused by event arrival order (webhook for child
 * arrived before webhook for parent), not when the data itself is malformed.
 */
export interface MissingParentRef {
  /** Internal entity type of the parent, e.g. 'job', 'claim'. */
  internalEntityType: string;
  /** Provider entity type of the parent, e.g. 'job', 'claim'. */
  providerEntityType: string;
  /** Provider-side id of the parent, or undefined when the payload did not
   *  include a reference to that parent at all. */
  providerEntityId: string | undefined;
}

export class ParentNotProjectedError extends Error {
  public readonly kind = 'ParentNotProjectedError' as const;

  constructor(
    public readonly childEntityType: string,
    public readonly childExternalObjectId: string,
    public readonly missingParents: MissingParentRef[],
    message: string,
  ) {
    super(message);
    this.name = 'ParentNotProjectedError';
  }

  /**
   * Returns only the parents that have a concrete providerEntityId (i.e. are
   * candidates for inline recovery via a CW fetch). Parents referenced only
   * as "missing" with no id cannot be recovered without more data.
   */
  public resolvableParents(): Array<
    MissingParentRef & { providerEntityId: string }
  > {
    return this.missingParents.filter(
      (p): p is MissingParentRef & { providerEntityId: string } =>
        typeof p.providerEntityId === 'string' && p.providerEntityId.length > 0,
    );
  }

  public static isInstance(err: unknown): err is ParentNotProjectedError {
    return (
      err instanceof ParentNotProjectedError ||
      (typeof err === 'object' &&
        err !== null &&
        (err as { kind?: string }).kind === 'ParentNotProjectedError')
    );
  }
}
