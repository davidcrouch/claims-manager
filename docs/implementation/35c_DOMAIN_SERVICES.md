# 35c — Domain Services: Cross-Cutting Business Logic

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 1–2

---

## 0. Purpose

Domain services encapsulate reusable business logic that applies across multiple entity types. They are injected into use cases via NestJS DI and always receive `tx` (the transaction handle) from the calling use case. They do not own transaction boundaries.

---

## 1. Service Inventory

| Service | Responsibility | Phase |
|---|---|---|
| `EntityRelationshipService` | Resolve parent entities, trigger nested projection, denormalize ancestor IDs | 1 |
| `LookupResolutionService` | Resolve external references to lookup_values IDs (auto-create stubs) | 1 (migrate) |
| `ContactSyncService` | Upsert contacts + entity join tables, generic over entity type | 1 |
| `AssigneeSyncService` | Upsert assignees with additive or replace strategy | 1 |
| `LineItemSyncService` | Sync hierarchical line items (groups → combos → items) | 2 |
| `VisibilityService` | Filter associations by visibility level on read; copy on issue | 3 |
| `ItemLineageService` | Manage M2M links between WO items and PO items | 3 |
| `VersioningService` | Create version snapshots, detect newer versions | 3 |

---

## 2. EntityRelationshipService

Resolves parent entity references declared by transformers. If a parent entity has a nested payload snapshot and no existing internal entity, it triggers nested projection (the same pattern as `NestedEntityExtractor` today, but generalized).

```typescript
// apps/api/src/modules/domain/services/entity-relationship.service.ts

import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type { ParentRef } from '../transformers/transformer.interface';
import { ExternalObjectService } from '../../external/external-object.service';
import { ExternalLinksRepository } from '../../../database/repositories';

export class ParentNotProjectedError extends Error {
  constructor(public readonly entityType: string, public readonly externalId: string) {
    super(`Parent ${entityType}:${externalId} not projected`);
    this.name = 'ParentNotProjectedError';
  }
}

@Injectable()
export class EntityRelationshipService {
  private readonly logger = new Logger('EntityRelationshipService');

  constructor(
    private readonly externalObjectService: ExternalObjectService,
    private readonly externalLinksRepo: ExternalLinksRepository,
    // UseCaseRegistry is injected lazily to avoid circular dependency
    // (use cases depend on this service, and this service may call use cases for nested projection)
  ) {}

  /**
   * Resolve all parent references to internal entity IDs.
   * Returns a map: { entityType: internalId }
   *
   * For parents with nested payloads, triggers nested projection if no
   * existing link exists.
   */
  async resolveParents(params: {
    parentRefs: ParentRef[];
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};

    for (const ref of params.parentRefs) {
      // 1. Check if already linked
      const existingId = await this.externalObjectService.resolveInternalEntityId({
        connectionId: params.connectionId,
        providerEntityType: ref.entityType,
        providerEntityId: ref.externalId,
        internalEntityType: ref.entityType,
        tx: params.tx,
      });

      if (existingId) {
        resolved[ref.entityType] = existingId;
        continue;
      }

      // 2. If nested payload available, project it
      if (ref.nestedPayload) {
        const projectedId = await this.projectNestedParent({
          entityType: ref.entityType,
          externalId: ref.externalId,
          payload: ref.nestedPayload,
          tenantId: params.tenantId,
          connectionId: params.connectionId,
          tx: params.tx,
        });
        if (projectedId) {
          resolved[ref.entityType] = projectedId;
          continue;
        }
      }

      // 3. Parent not available
      if (ref.required) {
        throw new ParentNotProjectedError(ref.entityType, ref.externalId);
      }
      // Optional parent: leave unresolved
    }

    return resolved;
  }

  /**
   * Resolve ancestor chain for polymorphic attachables (tasks, messages, etc.).
   * Given an entity type + ID, walks up the parent chain and returns
   * denormalized ancestor IDs for claim and job.
   */
  async resolveAncestors(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ claimId?: string; jobId?: string }> {
    const ancestors: { claimId?: string; jobId?: string } = {};

    // Direct claim or job
    if (params.entityType === 'claim') {
      ancestors.claimId = params.entityId;
      return ancestors;
    }
    if (params.entityType === 'job') {
      ancestors.jobId = params.entityId;
      // Walk up: job → claim
      const job = await this.findEntityParent('job', params.entityId, params.tx);
      if (job?.claimId) ancestors.claimId = job.claimId;
      return ancestors;
    }

    // Child entities: quote, PO, WO, invoice, etc. — resolve jobId and claimId
    const entity = await this.findEntityParent(params.entityType, params.entityId, params.tx);
    if (entity?.jobId) {
      ancestors.jobId = entity.jobId;
      const job = await this.findEntityParent('job', entity.jobId, params.tx);
      if (job?.claimId) ancestors.claimId = job.claimId;
    } else if (entity?.claimId) {
      ancestors.claimId = entity.claimId;
    }

    return ancestors;
  }

  private async projectNestedParent(params: {
    entityType: string;
    externalId: string;
    payload: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | undefined> {
    // Upsert external object for the nested parent
    const { externalObject } = await this.externalObjectService.upsertFromFetch({
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      providerCode: 'crunchwork',
      providerEntityType: params.entityType,
      providerEntityId: params.externalId,
      normalizedEntityType: params.entityType,
      payload: { ...params.payload, id: params.payload.id ?? params.externalId },
      tx: params.tx,
    });

    // Resolve use case for nested parent and execute
    // (lazy import to avoid circular DI)
    const useCaseRegistry = await this.getUseCaseRegistry();
    const useCase = useCaseRegistry?.get(params.entityType);
    if (!useCase) {
      this.logger.warn(
        `EntityRelationshipService — no use case for nested parent type=${params.entityType}`,
      );
      return undefined;
    }

    const result = await useCase.execute({
      externalObject: externalObject as unknown as Record<string, unknown>,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      tx: params.tx,
    });

    return result.status === 'completed' ? result.internalEntityId : undefined;
  }

  private async findEntityParent(
    entityType: string,
    entityId: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ claimId?: string; jobId?: string } | null> {
    // Queries the appropriate table for parent FK columns
    // Implementation uses a switch on entityType to query the correct table
    // Returns { claimId, jobId } if present on the entity row
    // ...
  }

  private async getUseCaseRegistry() {
    // Lazy resolution via ModuleRef to avoid circular DI
    // ...
  }
}
```

---

## 3. ContactSyncService

Generic contact upsert + entity join table population. Works for any entity type that has contacts.

```typescript
// apps/api/src/modules/domain/services/contact-sync.service.ts

import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type { RawContact } from '../transformers/transformer.interface';
import { ContactsRepository } from '../../../database/repositories/contacts.repository';
import { LookupResolutionService } from './lookup-resolution.service';

type EntityJoinRepo = {
  upsert(params: { data: Record<string, unknown>; tx?: DrizzleDbOrTx }): Promise<unknown>;
};

@Injectable()
export class ContactSyncService {
  private readonly logger = new Logger('ContactSyncService');
  private joinRepos: Record<string, EntityJoinRepo> = {};

  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly lookupResolution: LookupResolutionService,
    // Join repos injected and registered:
    // ClaimContactsRepository, JobContactsRepository, etc.
  ) {}

  /**
   * Register a join table repository for an entity type.
   * Called during module init.
   */
  registerJoinRepo(entityType: string, repo: EntityJoinRepo): void {
    this.joinRepos[entityType] = repo;
  }

  /**
   * Sync contacts for an entity. Upserts each contact row, then upserts
   * the join table entry linking the contact to the entity.
   */
  async syncForEntity(params: {
    entityType: string;       // 'claim', 'job', 'quote', etc.
    entityId: string;
    tenantId: string;
    contacts: RawContact[];
    strategy: 'additive' | 'replace';
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const joinRepo = this.joinRepos[params.entityType];
    if (!joinRepo) {
      this.logger.warn(
        `ContactSyncService.syncForEntity — no join repo registered for entityType=${params.entityType}`,
      );
      return;
    }

    // If replace strategy, delete existing join entries not in the new set
    // (for additive, we just upsert without deletion)

    let sortIndex = 0;
    for (const raw of params.contacts) {
      if (!raw.externalReference) continue;

      // Resolve contact type lookup
      let typeLookupId: string | undefined;
      if (raw.typeExternalReference) {
        const resolved = await this.lookupResolution.resolve({
          domain: raw.typeDomain ?? 'contact_type',
          externalReference: raw.typeExternalReference,
          tenantId: params.tenantId,
          sourceEntity: params.entityType,
          tx: params.tx,
        });
        typeLookupId = resolved ?? undefined;
      }

      // Resolve preferred contact method lookup
      let preferredMethodLookupId: string | undefined;
      if (raw.preferredMethodExternalReference) {
        const resolved = await this.lookupResolution.resolve({
          domain: raw.preferredMethodDomain ?? 'preferred_contact_method',
          externalReference: raw.preferredMethodExternalReference,
          tenantId: params.tenantId,
          sourceEntity: params.entityType,
          tx: params.tx,
        });
        preferredMethodLookupId = resolved ?? undefined;
      }

      // Upsert contact row
      const contact = await this.contactsRepo.upsertByExternalReference({
        data: {
          tenantId: params.tenantId,
          externalReference: raw.externalReference,
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email,
          mobilePhone: raw.mobilePhone,
          homePhone: raw.homePhone,
          workPhone: raw.workPhone,
          typeLookupId,
          preferredContactMethodLookupId: preferredMethodLookupId,
          contactPayload: raw.sourcePayload,
        },
        tx: params.tx,
      });

      // Upsert join table entry
      const entityIdField = `${params.entityType}Id`;  // e.g. 'claimId', 'jobId'
      await joinRepo.upsert({
        data: {
          tenantId: params.tenantId,
          [entityIdField]: params.entityId,
          contactId: contact.id,
          sortIndex,
          sourcePayload: raw.sourcePayload,
        },
        tx: params.tx,
      });

      sortIndex += 1;
    }
  }
}
```

### Join Table Repository Pattern

Each entity type with contacts needs a repository that implements the `upsert` pattern:

```typescript
// apps/api/src/database/repositories/job-contacts.repository.ts (NEW)

import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { jobContacts } from '../schema';

export type JobContactRow = typeof jobContacts.$inferSelect;
export type JobContactInsert = typeof jobContacts.$inferInsert;

@Injectable()
export class JobContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByJob(params: { jobId: string; tx?: DrizzleDbOrTx }): Promise<JobContactRow[]> {
    const db = params.tx ?? this.db;
    return db.select().from(jobContacts).where(eq(jobContacts.jobId, params.jobId));
  }

  async upsert(params: { data: JobContactInsert; tx?: DrizzleDbOrTx }): Promise<JobContactRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(jobContacts)
      .values(params.data)
      .onConflictDoUpdate({
        target: [jobContacts.jobId, jobContacts.contactId],
        set: {
          sortIndex: params.data.sortIndex ?? 0,
          sourcePayload: params.data.sourcePayload ?? {},
        },
      })
      .returning();
    return row;
  }

  async deleteByJobAndContact(params: {
    jobId: string;
    contactId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db.delete(jobContacts).where(
      and(eq(jobContacts.jobId, params.jobId), eq(jobContacts.contactId, params.contactId)),
    );
  }
}
```

---

## 4. AssigneeSyncService

Manages assignees for entities. Currently only claims have assignees, but the service is generic for future use on jobs and tasks.

```typescript
// apps/api/src/modules/domain/services/assignee-sync.service.ts

@Injectable()
export class AssigneeSyncService {
  /**
   * Sync assignees for an entity.
   * Strategy 'replace': delete stale assignees not in the new payload, upsert current ones.
   * Strategy 'additive': only add/update, never remove.
   */
  async syncForEntity(params: {
    entityType: string;     // 'claim', 'job', 'task'
    entityId: string;
    tenantId: string;
    assignees: RawAssignee[];
    strategy: 'additive' | 'replace';
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // Similar pattern to ContactSyncService:
    // 1. Resolve assignee type lookups
    // 2. Upsert assignee rows
    // 3. If replace: delete rows where externalReference not in new set
  }
}
```

---

## 5. LookupResolutionService

Migrated from the existing `lookup-resolver.service.ts`. Resolves external references to `lookup_values.id` UUIDs. Auto-creates stub entries when no match exists.

```typescript
// apps/api/src/modules/domain/services/lookup-resolution.service.ts

@Injectable()
export class LookupResolutionService {
  /**
   * Resolve a single lookup by domain + external reference.
   * Returns the lookup_values.id UUID, or creates a stub and returns its ID.
   */
  async resolve(params: {
    domain: string;
    externalReference: string;
    tenantId: string;
    sourceEntity?: string;
    sourceEntityId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    // ... existing logic from lookup-resolver.service.ts
  }

  /**
   * Resolve all lookups declared by a transformer in batch.
   * Returns a map: { fieldName: resolvedLookupId }
   */
  async resolveAll(params: {
    lookups: LookupRequest[];
    tenantId: string;
    sourceEntity?: string;
    sourceEntityId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};
    for (const lookup of params.lookups) {
      const id = await this.resolve({
        domain: lookup.domain,
        externalReference: lookup.externalReference,
        tenantId: params.tenantId,
        sourceEntity: params.sourceEntity,
        sourceEntityId: params.sourceEntityId,
        tx: params.tx,
      });
      if (id) resolved[lookup.field] = id;
    }
    return resolved;
  }
}
```

---

## 6. LineItemSyncService

Handles the 3-level hierarchy (groups → combos → items) shared by quotes, POs, WOs, RFQs, and proposals.

```typescript
// apps/api/src/modules/domain/services/line-item-sync.service.ts

@Injectable()
export class LineItemSyncService {
  private groupRepos: Record<string, GroupRepository> = {};
  private comboRepos: Record<string, ComboRepository> = {};
  private itemRepos: Record<string, ItemRepository> = {};

  /**
   * Register repositories for an entity type's line item hierarchy.
   */
  registerForEntity(entityType: string, repos: {
    groups: GroupRepository;
    combos: ComboRepository;
    items: ItemRepository;
  }): void {
    this.groupRepos[entityType] = repos.groups;
    this.comboRepos[entityType] = repos.combos;
    this.itemRepos[entityType] = repos.items;
  }

  /**
   * Sync a full line item hierarchy for a parent entity.
   * Upserts groups, then combos within groups, then items within groups/combos.
   * Uses external_reference as the idempotency key at each level.
   */
  async syncHierarchy(params: {
    parentType: string;    // 'quote', 'purchase_order', 'work_order', 'rfq', 'proposal'
    parentId: string;
    tenantId: string;
    lineItems: RawLineItems;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const groupRepo = this.groupRepos[params.parentType];
    const comboRepo = this.comboRepos[params.parentType];
    const itemRepo = this.itemRepos[params.parentType];

    if (!groupRepo || !comboRepo || !itemRepo) {
      throw new Error(`LineItemSyncService — no repos registered for ${params.parentType}`);
    }

    for (const rawGroup of params.lineItems.groups) {
      // Upsert group
      const group = await groupRepo.upsert({
        parentId: params.parentId,
        tenantId: params.tenantId,
        data: {
          externalReference: rawGroup.externalReference,
          description: rawGroup.description,
          dimensions: rawGroup.dimensions ?? {},
          sortIndex: rawGroup.sortIndex,
          totals: rawGroup.totals ?? {},
          groupPayload: rawGroup.sourcePayload,
        },
        tx: params.tx,
      });

      // Upsert combos within group
      for (const rawCombo of rawGroup.combos) {
        const combo = await comboRepo.upsert({
          groupId: group.id,
          tenantId: params.tenantId,
          data: {
            externalReference: rawCombo.externalReference,
            name: rawCombo.name,
            description: rawCombo.description,
            category: rawCombo.category,
            subCategory: rawCombo.subCategory,
            quantity: rawCombo.quantity,
            sortIndex: rawCombo.sortIndex,
            totals: rawCombo.totals ?? {},
            comboPayload: rawCombo.sourcePayload,
          },
          tx: params.tx,
        });

        // Items within combo
        for (const rawItem of rawCombo.items) {
          await itemRepo.upsert({
            parentType: 'combo',
            parentId: combo.id,
            tenantId: params.tenantId,
            data: this.buildItemData(rawItem),
            tx: params.tx,
          });
        }
      }

      // Direct items (not in a combo)
      for (const rawItem of rawGroup.items) {
        await itemRepo.upsert({
          parentType: 'group',
          parentId: group.id,
          tenantId: params.tenantId,
          data: this.buildItemData(rawItem),
          tx: params.tx,
        });
      }
    }
  }

  private buildItemData(raw: RawItem): Record<string, unknown> {
    return {
      externalReference: raw.externalReference,
      name: raw.name,
      description: raw.description,
      category: raw.category,
      subCategory: raw.subCategory,
      itemType: raw.itemType,
      quantity: raw.quantity,
      tax: raw.tax,
      unitCost: raw.unitCost,
      buyCost: raw.buyCost,
      markupType: raw.markupType,
      markupValue: raw.markupValue,
      sortIndex: raw.sortIndex,
      note: raw.note,
      tags: raw.tags ?? [],
      totals: raw.totals ?? {},
      itemPayload: raw.sourcePayload,
    };
  }
}
```

---

## 7. VisibilityService (Phase 3)

Manages the three-level visibility model for associations.

```typescript
// apps/api/src/modules/domain/services/visibility.service.ts

export type VisibilityLevel = 'private' | 'org' | 'parties';

@Injectable()
export class VisibilityService {
  /**
   * Build a WHERE clause fragment for visibility filtering.
   * Used by repositories when reading associations.
   */
  buildVisibilityFilter(params: {
    tenantId: string;
    userId: string;
    includeParties?: boolean;  // true when viewing a document shared with counterparty
  }): SQL {
    // Returns:
    // (visibility = 'org' AND tenant_id = :tenantId)
    // OR (visibility = 'private' AND created_by_user_id = :userId)
    // OR (visibility = 'parties' AND <counterparty logic>)
  }

  /**
   * Copy 'parties'-visible associations from a source entity to a recipient entity.
   * Called during document issuance.
   * Copied associations become 'org' visibility in the recipient's context.
   */
  async copyPartiesAssociations(params: {
    sourceEntityType: string;
    sourceEntityId: string;
    targetEntityType: string;
    targetEntityId: string;
    targetTenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // 1. Query associations on source entity WHERE visibility = 'parties'
    // 2. Copy each to target entity with visibility = 'org'
  }
}
```

---

## 8. ItemLineageService (Phase 3)

Manages the many-to-many relationship between work order items and purchase order items when a contractor outsources work.

```typescript
// apps/api/src/modules/domain/services/item-lineage.service.ts

@Injectable()
export class ItemLineageService {
  /**
   * Create allocation links between WO items and PO items.
   * Called when a contractor creates a PO from selected WO items.
   */
  async createAllocations(params: {
    tenantId: string;
    allocations: Array<{
      sourceWorkOrderItemId: string;
      targetPurchaseOrderItemId: string;
      allocatedQuantity?: number;
      allocatedAmount?: number;
      allocationType: 'full' | 'partial' | 'split';
    }>;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // Upsert into item_allocations table
  }

  /**
   * Find all PO items allocated from a given WO item.
   */
  async findAllocationsForWorkOrderItem(params: {
    workOrderItemId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<AllocationRow[]> { /* ... */ }

  /**
   * Find the source WO items for a given PO item.
   */
  async findSourcesForPurchaseOrderItem(params: {
    purchaseOrderItemId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<AllocationRow[]> { /* ... */ }

  /**
   * Check coverage: which WO items have no allocations (retained in-house).
   */
  async findUnallocatedItems(params: {
    workOrderId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string[]> { /* ... */ }
}
```

---

## 9. Module Wiring

All domain services are provided in `DomainModule` and exported for use by the external/webhook module:

```typescript
// apps/api/src/modules/domain/domain.module.ts

@Module({
  imports: [DatabaseModule],
  providers: [
    // Services
    EntityRelationshipService,
    LookupResolutionService,
    ContactSyncService,
    AssigneeSyncService,
    LineItemSyncService,
    VisibilityService,
    ItemLineageService,
    VersioningService,
    // Transformers
    ClaimTransformer,
    JobTransformer,
    // ... other transformers
    TransformerRegistry,
    // Use Cases
    ProjectClaimUseCase,
    ProjectJobUseCase,
    // ... other use cases
    UseCaseRegistry,
  ],
  exports: [
    UseCaseRegistry,
    ContactSyncService,
    EntityRelationshipService,
    LookupResolutionService,
    // ... other services needed externally
  ],
})
export class DomainModule {}
```
