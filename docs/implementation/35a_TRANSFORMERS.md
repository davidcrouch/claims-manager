# 35a — Transformers: Pure Data Mapping Layer

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 1

---

## 0. Purpose

Transformers convert external (Crunchwork) payloads into typed internal entity shapes **without any side effects**. They declare what needs resolving (lookups, parents, contacts) but do not perform the resolution. This makes them unit-testable with plain objects and completely decoupled from the database.

---

## 1. Interface

```typescript
// apps/api/src/modules/domain/transformers/transformer.interface.ts

import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

/**
 * A lookup reference extracted from the payload that needs resolution
 * before the entity can be persisted.
 */
export interface LookupRequest {
  field: string;          // Target field on the entity (e.g. 'statusLookupId')
  domain: string;         // Lookup domain (e.g. 'claim_status', 'job_type')
  externalReference: string; // Value from the CW payload to resolve
}

/**
 * A parent entity reference that must be resolved to an internal ID.
 */
export interface ParentRef {
  entityType: string;     // e.g. 'claim', 'job'
  externalId: string;     // CW external ID of the parent
  required: boolean;      // If true, projection fails without this parent
  nestedPayload?: Record<string, unknown>; // Inline parent snapshot (if present)
}

/**
 * A raw contact extracted from the payload for sync.
 */
export interface RawContact {
  externalReference: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  typeDomain?: string;
  typeExternalReference?: string;
  preferredMethodDomain?: string;
  preferredMethodExternalReference?: string;
  sourcePayload: Record<string, unknown>;
}

/**
 * A raw assignee extracted from the payload for sync.
 */
export interface RawAssignee {
  externalReference: string;
  displayName?: string;
  email?: string;
  assigneeTypeDomain?: string;
  assigneeTypeExternalReference?: string;
  sourcePayload: Record<string, unknown>;
}

/**
 * Raw line item hierarchy extracted from a payload.
 */
export interface RawLineItems {
  groups: RawGroup[];
}

export interface RawGroup {
  externalReference?: string;
  description?: string;
  groupLabelDomain?: string;
  groupLabelExternalReference?: string;
  dimensions?: Record<string, unknown>;
  sortIndex: number;
  totals?: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  combos: RawCombo[];
  items: RawItem[];  // Direct items (not in a combo)
}

export interface RawCombo {
  externalReference?: string;
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  quantity?: number;
  sortIndex: number;
  totals?: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  items: RawItem[];
}

export interface RawItem {
  externalReference?: string;
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  itemType?: string;
  quantity?: number;
  tax?: number;
  unitCost?: number;
  buyCost?: number;
  markupType?: string;
  markupValue?: number;
  sortIndex: number;
  note?: string;
  tags?: unknown[];
  totals?: Record<string, unknown>;
  unitTypeDomain?: string;
  unitTypeExternalReference?: string;
  sourcePayload: Record<string, unknown>;
}

/**
 * The result of a transformer's work.
 * Contains the entity shape plus declarations of what needs external resolution.
 */
export interface TransformResult<TEntity> {
  /** Partial entity ready to upsert (minus unresolved FK fields) */
  entity: Partial<TEntity>;

  /** Lookup references to resolve before persist */
  lookups: LookupRequest[];

  /** Parent entity references to resolve */
  parentRefs: ParentRef[];

  /** Contacts extracted for sync (optional — not all entities have contacts) */
  contacts?: RawContact[];

  /** Assignees extracted for sync (optional) */
  assignees?: RawAssignee[];

  /** Line items extracted for sync (optional — quotes, POs, WOs, etc.) */
  lineItems?: RawLineItems;

  /** If set, this entity should be skipped (reason string) */
  skip?: string;
}

/**
 * Core transformer interface. Implementations are pure — no DB, no IO.
 */
export interface EntityTransformer<TEntity = Record<string, unknown>> {
  /**
   * Transform a raw external payload into a typed internal entity shape.
   *
   * @param payload - The raw JSON payload from the external system
   * @param tenantId - Tenant context (for building the entity shape)
   * @param existingEntity - If updating, the current entity state (for merge decisions)
   * @returns TransformResult with entity shape and declared dependencies
   */
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: TEntity;
  }): TransformResult<TEntity>;
}
```

---

## 2. Design Rules

1. **No constructor injection of repositories or services.** Transformers may inject utility classes (date parsers, value extractors) but never anything that performs IO.

2. **Declare, don't resolve.** If a field requires a lookup ID, the transformer returns a `LookupRequest` in the `lookups` array with the external reference. The use case resolves it and merges the result into the entity before persisting.

3. **Idempotent.** Same payload + same existing entity → same result. No randomness, no timestamps (those are set by the use case/repository).

4. **Handle missing/malformed data gracefully.** CW payloads may have missing fields, unexpected types, or empty strings. Transformers coerce defensively and skip unresolvable fields rather than throwing.

5. **`skip` for known no-ops.** If the payload represents a state the system doesn't need to project (e.g., a "deleted" marker on a test entity), set `skip` with a reason string. The use case will record this and exit cleanly.

---

## 3. Example: ClaimTransformer

```typescript
// apps/api/src/modules/domain/transformers/claim.transformer.ts

import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef, RawContact, RawAssignee } from './transformer.interface';
import type { ClaimInsert } from '../../../database/repositories/claims.repository';

@Injectable()
export class ClaimTransformer implements EntityTransformer<ClaimInsert> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: ClaimInsert;
  }): TransformResult<ClaimInsert> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const contacts: RawContact[] = [];
    const assignees: RawAssignee[] = [];

    // --- Scalar field extraction ---
    const entity: Partial<ClaimInsert> = {
      tenantId,
      claimNumber: asString(payload.claimNumber) ?? asString(payload.referenceNumber),
      externalReference: asString(payload.id),
      externalClaimId: asString(payload.externalClaimId),
      lodgementDate: asDateString(payload.lodgementDate),
      dateOfLoss: asTimestamp(payload.dateOfLoss),
      incidentDescription: asString(payload.incidentDescription),
      postalAddress: asString(payload.postalAddress),
      policyNumber: asString(payload.policyNumber),
      policyName: asString(payload.policyName),
      abn: asString(payload.abn),
      vulnerableCustomer: asBool(payload.vulnerableCustomer),
      totalLoss: asBool(payload.totalLoss),
      contentiousClaim: asBool(payload.contentiousClaim),
      contentiousActivityFlag: asBool(payload.contentiousActivityFlag),
      autoApprovalApplies: asBool(payload.autoApprovalApplies),
      contentsDamaged: asBool(payload.contentsDamaged),
      apiPayload: payload,
    };

    // --- Address extraction ---
    const address = payload.address ?? payload.siteAddress;
    if (isPlainObject(address)) {
      entity.address = address;
      entity.addressPostcode = asString(address.postcode);
      entity.addressSuburb = asString(address.suburb);
      entity.addressState = asString(address.state);
      entity.addressCountry = asString(address.country);
      entity.addressLatitude = asString(address.latitude);
      entity.addressLongitude = asString(address.longitude);
    }

    // --- JSONB block extraction ---
    entity.policyDetails = extractObject(payload, 'policyDetails') ?? {};
    entity.financialDetails = extractObject(payload, 'financialDetails') ?? {};
    entity.vulnerabilityDetails = extractObject(payload, 'vulnerabilityDetails') ?? {};
    entity.contentionDetails = extractObject(payload, 'contentionDetails') ?? {};
    entity.customData = extractObject(payload, 'customData') ?? {};

    // --- Lookup declarations (resolved by use case) ---
    if (payload.account?.id) {
      lookups.push({ field: 'accountLookupId', domain: 'account', externalReference: asString(payload.account.id)! });
    }
    if (payload.status?.id) {
      lookups.push({ field: 'statusLookupId', domain: 'claim_status', externalReference: asString(payload.status.id)! });
    }
    if (payload.catCode?.id) {
      lookups.push({ field: 'catCodeLookupId', domain: 'cat_code', externalReference: asString(payload.catCode.id)! });
    }
    if (payload.lossType?.id) {
      lookups.push({ field: 'lossTypeLookupId', domain: 'loss_type', externalReference: asString(payload.lossType.id)! });
    }
    if (payload.lossSubtype?.id) {
      lookups.push({ field: 'lossSubtypeLookupId', domain: 'loss_subtype', externalReference: asString(payload.lossSubtype.id)! });
    }
    // ... additional lookups (priority, policyType, lineOfBusiness, claimDecision)

    // --- Contact extraction ---
    const rawContacts = payload.contacts;
    if (Array.isArray(rawContacts)) {
      for (const entry of rawContacts) {
        if (!isPlainObject(entry) || !entry.externalReference) continue;
        contacts.push({
          externalReference: asString(entry.externalReference)!,
          firstName: asString(entry.firstName),
          lastName: asString(entry.lastName),
          email: asString(entry.email),
          mobilePhone: asString(entry.mobilePhone),
          homePhone: asString(entry.homePhone),
          workPhone: asString(entry.workPhone),
          typeDomain: 'contact_type',
          typeExternalReference: asString(entry.type?.id),
          preferredMethodDomain: 'preferred_contact_method',
          preferredMethodExternalReference: asString(entry.preferredContactMethod?.id),
          sourcePayload: entry,
        });
      }
    }

    // --- Assignee extraction ---
    const rawAssignees = payload.assignees;
    if (Array.isArray(rawAssignees)) {
      for (const entry of rawAssignees) {
        if (!isPlainObject(entry)) continue;
        assignees.push({
          externalReference: asString(entry.externalReference) ?? asString(entry.id) ?? '',
          displayName: asString(entry.displayName) ?? asString(entry.name),
          email: asString(entry.email),
          assigneeTypeDomain: 'assignee_type',
          assigneeTypeExternalReference: asString(entry.type?.id),
          sourcePayload: entry,
        });
      }
    }

    return {
      entity,
      lookups,
      parentRefs: [],  // Claims have no parent
      contacts: contacts.length > 0 ? contacts : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
    };
  }
}
```

---

## 4. Example: JobTransformer

```typescript
// apps/api/src/modules/domain/transformers/job.transformer.ts

import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef, RawContact } from './transformer.interface';
import type { JobInsert } from '../../../database/repositories/jobs.repository';

@Injectable()
export class JobTransformer implements EntityTransformer<JobInsert> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: JobInsert;
  }): TransformResult<JobInsert> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];
    const contacts: RawContact[] = [];

    // --- Scalar fields ---
    const entity: Partial<JobInsert> = {
      tenantId,
      externalReference: asString(payload.id),
      requestDate: asDateString(payload.requestDate),
      collectExcess: asBool(payload.collectExcess),
      excess: asString(payload.excess),
      makeSafeRequired: asBool(payload.makeSafeRequired),
      jobInstructions: asString(payload.instructions),
      apiPayload: payload,
      customData: extractObject(payload, 'customData') ?? {},
    };

    // --- Address ---
    const address = payload.address ?? payload.siteAddress;
    if (isPlainObject(address)) {
      entity.address = address;
      entity.addressPostcode = asString(address.postcode);
      entity.addressSuburb = asString(address.suburb);
      entity.addressState = asString(address.state);
      entity.addressCountry = asString(address.country);
    }

    // --- Parent: Claim (required) ---
    const nestedClaim = isPlainObject(payload.claim) ? payload.claim : undefined;
    const cwClaimId = asString(payload.claimId) ?? asString(nestedClaim?.id);
    if (cwClaimId) {
      parentRefs.push({
        entityType: 'claim',
        externalId: cwClaimId,
        required: true,
        nestedPayload: nestedClaim as Record<string, unknown> | undefined,
      });
    }

    // --- Parent: Vendor (optional) ---
    const cwVendor = isPlainObject(payload.vendor) ? payload.vendor : undefined;
    if (cwVendor?.id) {
      parentRefs.push({
        entityType: 'vendor',
        externalId: asString(cwVendor.id)!,
        required: false,
      });
    }

    // --- Lookups ---
    const jobType = payload.jobType ?? payload.type;
    if (isPlainObject(jobType) && jobType.id) {
      lookups.push({ field: 'jobTypeLookupId', domain: 'job_type', externalReference: asString(jobType.id)! });
    }
    if (isPlainObject(payload.status) && payload.status.id) {
      lookups.push({ field: 'statusLookupId', domain: 'job_status', externalReference: asString(payload.status.id)! });
    }

    // --- Contacts ---
    const rawContacts = payload.contacts;
    if (Array.isArray(rawContacts)) {
      for (const entry of rawContacts) {
        if (!isPlainObject(entry) || !entry.externalReference) continue;
        contacts.push({
          externalReference: asString(entry.externalReference)!,
          firstName: asString(entry.firstName),
          lastName: asString(entry.lastName),
          email: asString(entry.email),
          mobilePhone: asString(entry.mobilePhone),
          homePhone: asString(entry.homePhone),
          workPhone: asString(entry.workPhone),
          typeDomain: 'contact_type',
          typeExternalReference: asString(entry.type?.id),
          preferredMethodDomain: 'preferred_contact_method',
          preferredMethodExternalReference: asString(entry.preferredContactMethod?.id),
          sourcePayload: entry,
        });
      }
    }

    // --- JSONB blocks ---
    entity.vendorSnapshot = extractObject(payload, 'vendor') ?? {};
    entity.temporaryAccommodationDetails = extractObject(payload, 'temporaryAccommodation') ?? {};
    entity.specialistDetails = extractObject(payload, 'specialist') ?? {};
    entity.rectificationDetails = extractObject(payload, 'rectification') ?? {};
    entity.auditDetails = extractObject(payload, 'audit') ?? {};
    entity.mobilityConsiderations = payload.mobilityConsiderations ?? [];

    return {
      entity,
      lookups,
      parentRefs,
      contacts: contacts.length > 0 ? contacts : undefined,
    };
  }
}
```

---

## 5. Helper Utilities

Transformers share a set of defensive extraction helpers:

```typescript
// apps/api/src/modules/domain/transformers/transform-utils.ts

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function asTimestamp(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? undefined : d;
}

export function asDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value);
  // Accept ISO date (YYYY-MM-DD) or parse from ISO datetime
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractObject(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const val = source[key];
  return isPlainObject(val) ? val : undefined;
}
```

---

## 6. Transformer Registry

Transformers are registered in the domain module and looked up by entity type:

```typescript
// apps/api/src/modules/domain/transformers/transformer.registry.ts

import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { EntityTransformer } from './transformer.interface';
import { ClaimTransformer } from './claim.transformer';
import { JobTransformer } from './job.transformer';
// ... imports for other transformers

@Injectable()
export class TransformerRegistry implements OnModuleInit {
  private transformers: Record<string, EntityTransformer> = {};

  constructor(
    @Optional() private readonly claimTransformer?: ClaimTransformer,
    @Optional() private readonly jobTransformer?: JobTransformer,
    // ... other transformers
  ) {}

  onModuleInit(): void {
    if (this.claimTransformer) this.transformers['claim'] = this.claimTransformer;
    if (this.jobTransformer) this.transformers['job'] = this.jobTransformer;
    // ...
  }

  get(entityType: string): EntityTransformer | undefined {
    return this.transformers[entityType];
  }
}
```

---

## 7. Testing Strategy

Transformers are tested with **zero infrastructure** — no database, no NestJS test module:

```typescript
describe('ClaimTransformer', () => {
  const transformer = new ClaimTransformer();

  it('extracts scalar fields from a full CW claim payload', () => {
    const payload = loadFixture('crunchwork-claim-full.json');
    const result = transformer.transform({ payload, tenantId: 'tenant-1' });

    expect(result.entity.claimNumber).toBe('CLM-2024-001');
    expect(result.entity.addressPostcode).toBe('2000');
    expect(result.skip).toBeUndefined();
  });

  it('declares lookup requests for status and account', () => {
    const payload = { id: '123', status: { id: 'st-1' }, account: { id: 'acc-1' } };
    const result = transformer.transform({ payload, tenantId: 'tenant-1' });

    expect(result.lookups).toContainEqual({
      field: 'statusLookupId', domain: 'claim_status', externalReference: 'st-1',
    });
    expect(result.lookups).toContainEqual({
      field: 'accountLookupId', domain: 'account', externalReference: 'acc-1',
    });
  });

  it('extracts contacts with external references', () => {
    const payload = {
      id: '123',
      contacts: [
        { externalReference: 'c-1', firstName: 'Jane', email: 'jane@example.com' },
        { firstName: 'NoRef' },  // skipped — no externalReference
      ],
    };
    const result = transformer.transform({ payload, tenantId: 'tenant-1' });

    expect(result.contacts).toHaveLength(1);
    expect(result.contacts![0].externalReference).toBe('c-1');
  });

  it('handles missing/malformed fields gracefully', () => {
    const payload = { id: '123', address: 'not-an-object', status: null };
    const result = transformer.transform({ payload, tenantId: 'tenant-1' });

    expect(result.entity.address).toBeUndefined();
    expect(result.lookups).toHaveLength(0);
  });
});
```

---

## 8. Migration Path From Existing Mappers

Each existing `CrunchworkXxxMapper` is split into:

1. **Transformation logic** → moves to `XxxTransformer` (pure, no repos)
2. **Orchestration logic** → moves to `ProjectXxxUseCase` (see 35b)
3. **Contact sync** → moves to `ContactSyncService` (see 35c)
4. **Lookup resolution** → delegated to `LookupResolutionService` (see 35c)
5. **Parent resolution** → delegated to `EntityRelationshipService` (see 35c)

The old mapper files can be deleted once their use case replacement is registered and tested.
