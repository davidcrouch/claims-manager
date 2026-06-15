/**
 * Transformer layer — pure data mapping interfaces.
 *
 * Transformers convert external (Crunchwork) payloads into typed internal
 * entity shapes without any side effects.  They declare what needs resolving
 * (lookups, parents, contacts) but do not perform the resolution.
 */

// ── Lookup resolution ───────────────────────────────────────────────

export interface LookupRequest {
  /** Target field on the entity (e.g. 'statusLookupId') */
  field: string;
  /** Lookup domain (e.g. 'claim_status', 'job_type') */
  domain: string;
  /** Value from the CW payload to resolve */
  externalReference: string;
  /** Display name hint for auto-creation */
  name?: string;
  /** Whether to auto-create a stub lookup on miss */
  autoCreate?: boolean;
}

// ── Parent resolution ───────────────────────────────────────────────

export interface ParentRef {
  /** e.g. 'claim', 'job' */
  entityType: string;
  /** CW external ID of the parent */
  externalId: string;
  /** If true, projection fails without this parent */
  required: boolean;
  /** Inline parent snapshot (if present in payload) */
  nestedPayload?: Record<string, unknown>;
}

// ── Contact extraction ──────────────────────────────────────────────

export interface RawContact {
  externalReference: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  notes?: string;
  typeDomain?: string;
  typeExternalReference?: string;
  typeField?: unknown;
  preferredMethodDomain?: string;
  preferredMethodExternalReference?: string;
  preferredMethodField?: unknown;
  sourcePayload: Record<string, unknown>;
}

// ── Assignee extraction ─────────────────────────────────────────────

export interface RawAssignee {
  externalReference: string;
  displayName?: string;
  email?: string;
  assigneeTypeDomain?: string;
  assigneeTypeExternalReference?: string;
  assigneeTypeField?: unknown;
  sourcePayload: Record<string, unknown>;
}

// ── Transform result ────────────────────────────────────────────────

export interface TransformResult<TEntity> {
  /** Partial entity ready to upsert (minus unresolved FK fields) */
  entity: Partial<TEntity>;

  /** Lookup references to resolve before persist */
  lookups: LookupRequest[];

  /** Parent entity references to resolve */
  parentRefs: ParentRef[];

  /** Contacts extracted for sync (optional) */
  contacts?: RawContact[];

  /** Assignees extracted for sync (optional) */
  assignees?: RawAssignee[];

  /** If set, this entity should be skipped (reason string) */
  skip?: string;
}

// ── Transformer contract ────────────────────────────────────────────

export interface EntityTransformer<TEntity = Record<string, unknown>> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: TEntity;
  }): TransformResult<TEntity>;
}
