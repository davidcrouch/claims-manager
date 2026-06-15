# 35b — Use Cases: Projection & Command Orchestration

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 1–2

---

## 0. Purpose

Use cases are the **orchestration layer** — they own the transaction boundary, call transformers for data mapping, invoke domain services for cross-cutting concerns, and coordinate persistence. Each use case represents a single cohesive operation: projecting an inbound entity, issuing a document, or executing a domain command.

---

## 1. Interface

```typescript
// apps/api/src/modules/domain/use-cases/use-case.interface.ts

import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export interface ProjectionResult {
  status: 'completed' | 'skipped';
  internalEntityId: string;
  internalEntityType: string;
  reason?: string;  // If skipped, why
}

/**
 * A projection use case handles inbound entity materialization.
 * Called by InProcessProjectionService when a webhook delivers an external object.
 */
export interface ProjectionUseCase {
  execute(params: {
    externalObject: Record<string, unknown>;  // Row from external_objects table
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult>;
}

/**
 * A command use case handles user-initiated domain operations
 * (e.g., issue document, create entity, allocate items).
 */
export interface CommandUseCase<TInput, TOutput> {
  execute(params: {
    input: TInput;
    tenantId: string;
    userId: string;
    tx: DrizzleDbOrTx;
  }): Promise<TOutput>;
}
```

---

## 2. Canonical Projection Flow

Every `ProjectXxxUseCase` follows the same sequence:

```
1. Extract payload from externalObject
2. Check for existing internal entity (via external link)
3. Call transformer.transform(payload, existingEntity?)
4. If transformer returns skip → record reason, return early
5. Resolve parent refs via EntityRelationshipService
6. Resolve lookups via LookupResolutionService
7. Merge resolved IDs into entity shape
8. Upsert entity via repository
9. Upsert external link (external_object → internal entity)
10. Sync contacts via ContactSyncService (if declared)
11. Sync assignees via AssigneeSyncService (if declared)
12. Sync line items via LineItemSyncService (if declared)
13. Return { internalEntityId, internalEntityType }
```

Steps 5–11 are each a domain service call. The use case is ~50–80 lines of sequential orchestration.

---

## 3. Example: ProjectJobUseCase

```typescript
// apps/api/src/modules/domain/use-cases/project-job.use-case.ts

import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { JobTransformer } from '../transformers/job.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ContactSyncService } from '../services/contact-sync.service';
import { ExternalLinksRepository, JobsRepository } from '../../../database/repositories';

@Injectable()
export class ProjectJobUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectJobUseCase');

  constructor(
    private readonly transformer: JobTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly contactSync: ContactSyncService,
    private readonly jobsRepo: JobsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = params.externalObject.latestPayload as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    // 1. Check for existing entity
    const existingLink = await this.externalLinksRepo.findByExternalObject({
      externalObjectId,
      internalEntityType: 'job',
      tx,
    });
    const existingEntity = existingLink
      ? await this.jobsRepo.findByIdAndTenant({ id: existingLink.internalEntityId, tenantId, tx })
      : null;

    // 2. Transform
    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: existingEntity ?? undefined,
    });

    if (result.skip) {
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'job', reason: result.skip };
    }

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    // Merge parent IDs: claim → claimId, vendor → vendorId
    if (resolvedParents.claim) result.entity.claimId = resolvedParents.claim;
    if (resolvedParents.vendor) result.entity.vendorId = resolvedParents.vendor;

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'job',
      sourceEntityId: existingEntity?.id,
      tx,
    });
    // Merge resolved lookup IDs into entity
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 5. Upsert job
    let jobId: string;
    if (existingEntity) {
      await this.jobsRepo.update({ id: existingEntity.id, data: result.entity, tx });
      jobId = existingEntity.id;
    } else {
      const created = await this.jobsRepo.createIfNotExists({ data: result.entity as any, tx });
      if (!created) {
        // Race condition — re-read
        const existing = await this.jobsRepo.findByExternalReference({
          tenantId,
          externalReference: result.entity.externalReference!,
          tx,
        });
        jobId = existing!.id;
        await this.jobsRepo.update({ id: jobId, data: result.entity, tx });
      } else {
        jobId = created.id;
      }
    }

    // 6. Upsert external link
    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: jobId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    // 7. Sync contacts
    if (result.contacts && result.contacts.length > 0) {
      await this.contactSync.syncForEntity({
        entityType: 'job',
        entityId: jobId,
        tenantId,
        contacts: result.contacts,
        strategy: 'additive',
        tx,
      });
    }

    return { status: 'completed', internalEntityId: jobId, internalEntityType: 'job' };
  }
}
```

---

## 4. Use Case Registry

```typescript
// apps/api/src/modules/domain/use-cases/use-case.registry.ts

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import type { ProjectionUseCase } from './use-case.interface';
import { ProjectClaimUseCase } from './project-claim.use-case';
import { ProjectJobUseCase } from './project-job.use-case';
// ... other use cases

@Injectable()
export class UseCaseRegistry implements OnModuleInit {
  private readonly logger = new Logger('UseCaseRegistry');
  private useCases: Record<string, ProjectionUseCase> = {};

  constructor(
    @Optional() private readonly projectClaim?: ProjectClaimUseCase,
    @Optional() private readonly projectJob?: ProjectJobUseCase,
    // ... other use cases
  ) {}

  onModuleInit(): void {
    if (this.projectClaim) this.useCases['claim'] = this.projectClaim;
    if (this.projectJob) this.useCases['job'] = this.projectJob;
    // ...
    this.logger.log(
      `UseCaseRegistry.onModuleInit — registered: ${Object.keys(this.useCases).join(', ')}`,
    );
  }

  get(entityType: string): ProjectionUseCase | undefined {
    return this.useCases[entityType];
  }
}
```

---

## 5. Integration With InProcessProjectionService

The projection service tries the use case registry first, then falls back to the legacy mapper registry:

```typescript
// In InProcessProjectionService.run() — modified section:

const useCase = this.useCaseRegistry.get(params.providerEntityType);
if (useCase) {
  const result = await useCase.execute({
    externalObject: externalObject as unknown as Record<string, unknown>,
    tenantId: params.tenantId,
    connectionId: params.connectionId,
    tx,
  });
  // ... update processing log based on result
  return result;
}

// Fallback to legacy mapper
const mapper = this.mapperRegistry.get({ entityType: params.providerEntityType });
// ... existing mapper logic
```

---

## 6. Command Use Cases (Phase 3+)

Beyond projection, use cases also handle **user-initiated commands**:

### IssueDocumentUseCase

```typescript
export interface IssueDocumentInput {
  documentType: 'purchase_order' | 'quote' | 'invoice' | 'rfq';
  documentId: string;
  recipientTenantId?: string;   // On-platform recipient
  recipientConnectionId?: string; // Off-platform external system
}

export interface IssueDocumentOutput {
  versionNumber: number;
  recipientEntityId?: string;    // Created WO/Proposal/Bill ID (if on-platform)
  outboundQueueId?: string;      // Queue entry ID (if off-platform)
}
```

This use case calls:
1. `VersioningService.createSnapshot()`
2. `DocumentIssuanceService.execute()` (line item copy, association copy, recipient entity creation)
3. `OutboundSyncService.enqueue()` (if external recipient)
4. `WorkflowEngine.advance()` (transition to "Issued" step)

### AllocateItemsUseCase

```typescript
export interface AllocateItemsInput {
  sourceWorkOrderId: string;
  targetPurchaseOrderId: string;
  allocations: Array<{
    sourceItemId: string;
    targetItemId: string;
    quantity?: number;
    amount?: number;
  }>;
}
```

This use case calls `ItemLineageService.createAllocations()`.

---

## 7. Error Handling

Use cases define three error categories:

| Error Type | Behaviour |
|---|---|
| **Validation error** (bad data) | Return `skipped` with reason; don't retry |
| **Transient error** (DB timeout, lock) | Let TX fail; webhook retry handles it |
| **Parent not projected** | Throw `ParentNotProjectedError`; retry service recovers parent then re-attempts |

The `ParentNotProjectedError` pattern is preserved from the current architecture — the webhook retry system already handles it.

---

## 8. Entity Coverage (Full List)

| Entity Type | Use Case | Phase | Key Domain Services Used |
|---|---|---|---|
| `claim` | `ProjectClaimUseCase` | 1 | ContactSync, AssigneeSync, LookupResolution |
| `job` | `ProjectJobUseCase` | 1 | ContactSync, EntityRelationship, LookupResolution |
| `quote` | `ProjectQuoteUseCase` | 2 | LineItemSync, LookupResolution, EntityRelationship |
| `purchase_order` | `ProjectPurchaseOrderUseCase` | 2 | LineItemSync, LookupResolution, EntityRelationship |
| `work_order` | `ProjectWorkOrderUseCase` | 2 | LineItemSync, LookupResolution, EntityRelationship |
| `invoice` | `ProjectInvoiceUseCase` | 2 | LookupResolution, EntityRelationship |
| `bill` | `ProjectBillUseCase` | 2 | LookupResolution, EntityRelationship |
| `rfq` | `ProjectRfqUseCase` | 2 | LineItemSync, LookupResolution, EntityRelationship |
| `proposal` | `ProjectProposalUseCase` | 2 | LineItemSync, LookupResolution, EntityRelationship |
| `task` | `ProjectTaskUseCase` | 2 | EntityRelationship (ancestor denorm) |
| `message` | `ProjectMessageUseCase` | 2 | EntityRelationship |
| `appointment` | `ProjectAppointmentUseCase` | 2 | LookupResolution, EntityRelationship |
| `report` | `ProjectReportUseCase` | 2 | LookupResolution, EntityRelationship |
| `attachment` | `ProjectAttachmentUseCase` | 2 | EntityRelationship |
| (issue) | `IssueDocumentUseCase` | 3 | Versioning, Issuance, OutboundSync, Workflow |
| (allocate) | `AllocateItemsUseCase` | 3 | ItemLineage |
