# 51 — Webhook Projection Unification

**Date:** 2026-08-17  
**Status:** Implemented  
**Depends on:** [35b — Use Cases](./35b_USE_CASES.md), [27d — Entity Mapper Service](./27d_ENTITY_MAPPER_SERVICE.md), [29 — Temporary Webhook Orchestrator](./29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md)  
**Spec reference:** `docs/Insurance REST API-v17-20260304_100318.pdf` §2.2.2  
**Review:** `docs/reviews/webhook-event-types-coverage.md`

---

## 0. Context

The webhook pipeline currently has **two projection layers** that do the same job (transform external CW payloads into internal DB records):

| Layer | Location | Used By |
|-------|----------|---------|
| **Mappers** (`EntityMapperRegistry`) | `apps/api/src/modules/external/mappers/crunchwork-*.mapper.ts` | `EntityMapperController` (More0 route), `InProcessProjectionService` (fallback only) |
| **Use Cases** (`UseCaseRegistry`) | `apps/api/src/modules/domain/use-cases/project-*.use-case.ts` | `InProcessProjectionService` (preferred) |

Both registries cover all 10 entity types. On the `inproc` route the use cases always win, making mappers dead code there. However, `EntityMapperController` (the HTTP endpoint backing More0's workflow) calls mappers directly — it has no path to the use case registry.

**Goal:** Unify to a single projection path (use cases), remove the mapper layer, and update More0's tool endpoint to call use cases directly.

---

## 1. Architecture After

```
Webhook event arrives
  ├─ inproc route: InProcessProjectionService → UseCaseRegistry.get(entityType) → ProjectXxxUseCase
  └─ more0 route:  More0 workflow → POST /api/v1/webhook-tools/mappers/:entityType
                                       └── EntityProjectionController → UseCaseRegistry.get(entityType) → ProjectXxxUseCase
```

The `EntityMapperRegistry`, `EntityMapper` interface, and all 10 `Crunchwork*Mapper` classes are deleted.

---

## 2. Pre-conditions

- [ ] Confirm More0 is not active in any deployed environment (user confirmed: More0 is future, not in use)
- [ ] Ensure all 10 use cases exist and pass existing tests
- [ ] Ensure the `InProcessProjectionService` (current `inproc` path) is exercised in production with no mapper fallback hits

---

## 3. Implementation Steps

### 3.1 Update `EntityMapperController` to Use `UseCaseRegistry`

Replace the mapper registry call with the use case registry. This makes the More0 tool endpoint call the same code path as `inproc`.

**File:** `apps/api/src/modules/webhook-tools/controllers/entity-mapper.controller.ts`

```typescript
import { UseCaseRegistry } from '../../domain/use-cases/use-case.registry';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { Inject } from '@nestjs/common';

@Controller('api/v1/webhook-tools/mappers')
@Public()
@UseGuards(ToolAuthGuard)
export class EntityMapperController {
  private readonly logger = new Logger('EntityMapperController');

  constructor(
    private readonly useCaseRegistry: UseCaseRegistry,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Post(':entityType')
  @HttpCode(HttpStatus.OK)
  async map(
    @Param('entityType') entityType: string,
    @Body() body: {
      externalObjectId: string;
      tenantId: string;
      connectionId: string;
      processingLogId?: string;
    },
  ): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    const logPrefix = 'EntityMapperController.map';
    this.logger.log(
      `${logPrefix} — entityType=${entityType} externalObjectId=${body.externalObjectId}`,
    );

    const useCase = this.useCaseRegistry.get(entityType);
    if (!useCase) {
      throw new BadRequestException(
        `${logPrefix} — no use case registered for entity type: ${entityType}`,
      );
    }

    const externalObject = await this.externalObjectsRepo.findById({
      id: body.externalObjectId,
    });
    if (!externalObject) {
      throw new BadRequestException(
        `${logPrefix} — external object not found: ${body.externalObjectId}`,
      );
    }

    const result = await this.db.transaction(async (tx) => {
      return useCase.execute({
        externalObject: externalObject as unknown as Record<string, unknown>,
        tenantId: body.tenantId,
        connectionId: body.connectionId,
        tx,
      });
    });

    if (body.processingLogId && result.status === 'completed') {
      await this.processingLogRepo.updateStatus({
        id: body.processingLogId,
        status: 'completed',
        completedAt: new Date(),
        externalObjectId: body.externalObjectId,
      });
    }

    return {
      internalEntityId: result.internalEntityId,
      internalEntityType: result.internalEntityType,
      skipped: result.status === 'skipped' ? result.reason : undefined,
    };
  }
}
```

### 3.2 Remove `EntityMapperRegistry` from `InProcessProjectionService`

The fallback path is no longer needed — the use case registry is the only source.

**File:** `apps/api/src/modules/external/in-process-projection.service.ts`

Changes:
- Remove `EntityMapperRegistry` import and constructor injection
- Remove the fallback logic; if `useCaseRegistry.get()` returns nothing, report `skipped_no_mapper`
- Make `UseCaseRegistry` a required (not `@Optional()`) dependency

### 3.3 Remove Mapper Files

Delete all mapper-layer files:

| File | Action |
|------|--------|
| `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-invoice.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-task.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-message.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-attachment.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-report.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/mappers/crunchwork-appointment.mapper.ts` | **Delete** |
| `apps/api/src/modules/external/entity-mapper.registry.ts` | **Delete** |
| `apps/api/src/modules/external/entity-mapper.interface.ts` | **Delete** |

### 3.4 Remove Mapper References from Module Wiring

**File:** `apps/api/src/modules/external/external.module.ts`

- Remove all `Crunchwork*Mapper` provider registrations
- Remove `EntityMapperRegistry` provider
- Remove corresponding imports

**File:** `apps/api/src/modules/webhook-tools/webhook-tools.module.ts`

- Remove `EntityMapperRegistry` from imports/providers if referenced

### 3.5 Update `InProcessProjectionService` Tests

**File:** `apps/api/src/modules/webhooks/webhook-orchestrator.service.spec.ts`

- Remove any mocks of `EntityMapperRegistry`
- Ensure test scenarios cover the `useCaseRegistry.get()` → `null` path (returns `skipped_no_mapper`)

### 3.6 Verify `LookupResolver` Can Be Removed

The mapper layer used a custom `LookupResolver` class (`apps/api/src/modules/external/lookup-resolver.service.ts`). The use case layer uses `LookupResolutionService` from the domain layer. Confirm nothing else imports `LookupResolver`, then delete it.

### 3.7 Verify `NestedEntityExtractor` Consumers

`NestedEntityExtractor` was called from `CrunchworkJobMapper`. Confirm it is also called from `EntityRelationshipService` (or `ProjectJobUseCase`) so that removing the mapper doesn't lose the claim/vendor cascade. Looking at the use case code, parent resolution is handled by `EntityRelationshipService.resolveParents()` — verify this includes the same nested-claim extraction logic.

---

## 4. Behavioral Parity Check

The mapper and use case for each entity type must produce identical DB outcomes. Key differences to audit:

| Concern | Mapper Approach | Use Case Approach | Parity Risk |
|---------|----------------|-------------------|-------------|
| Field mapping | Inline in mapper (`buildJobFields`) | Delegated to `JobTransformer.transform()` | Medium — field-by-field audit needed |
| Lookup resolution | `LookupResolver.resolve()` with inline fallbacks | `LookupResolutionService.resolveAll()` | Low — same DB queries, different wiring |
| Parent resolution | `NestedEntityExtractor` called directly | `EntityRelationshipService.resolveParents()` | Medium — verify claim + vendor both covered |
| Contact sync | Inline loop in mapper | `ContactSyncService.syncForEntity()` | Low — same result, cleaner code |
| Race condition handling | `createIfNotExists` + fallback re-read | Same pattern | Low |
| Transaction boundary | Receives optional `tx` | Receives required `tx` | None |

**Action:** For each of the 10 entity types, run a single webhook payload through both paths and compare the resulting DB rows. This can be done via an integration test or manual comparison in dev.

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Transformer produces different field values than mapper `buildXxxFields` | Run parity tests (§4) before deleting mappers |
| `EntityRelationshipService` doesn't replicate `NestedEntityExtractor` for jobs | Audit the service; if missing, inject extractor into the service or use case |
| More0 workflow (when enabled in future) calls the endpoint expecting mapper behavior | The endpoint keeps the same URL and response shape; use case is a drop-in replacement |
| Mapper had inline error messages that are useful for debugging | Transformers should produce equivalent diagnostics |

---

## 6. File Changes Summary (Actual)

| File | Change |
|------|--------|
| `apps/api/src/modules/webhook-tools/controllers/entity-mapper.controller.ts` | Replaced `EntityMapperRegistry` with `UseCaseRegistry` + `DRIZZLE` TX |
| `apps/api/src/modules/external/in-process-projection.service.ts` | Removed mapper fallback, made `UseCaseRegistry` required (not `@Optional`) |
| `apps/api/src/modules/external/parent-recovery.service.ts` | Replaced `EntityMapperRegistry` with `UseCaseRegistry` |
| `apps/api/src/modules/external/external.module.ts` | Removed all mapper providers/imports/exports, removed `NestedEntityExtractor` |
| `apps/api/src/modules/webhook-tools/webhook-tools.module.ts` | Added `DomainModule` import (provides `UseCaseRegistry`) |
| `apps/api/src/modules/external/mappers/*.mapper.ts` (10 files) | **Deleted** |
| `apps/api/src/modules/external/mappers/` (directory) | **Deleted** |
| `apps/api/src/modules/external/entity-mapper.registry.ts` | **Deleted** |
| `apps/api/src/modules/external/entity-mapper.interface.ts` | **Deleted** |
| `apps/api/src/modules/external/nested-entity-extractor.service.ts` | **Deleted** (no remaining consumers; `EntityRelationshipService` covers same logic) |
| `apps/api/src/modules/external/lookup-resolver.service.ts` | **Retained** — used by `invoices.service.ts`, `jobs.service.ts`, `quotes.service.ts` |
| `apps/api/src/modules/webhooks/webhook-orchestrator.service.spec.ts` | No changes needed (mocks `InProcessProjectionService` as opaque) |

---

## 7. Acceptance Criteria

- [x] `EntityMapperController` calls `UseCaseRegistry` instead of `EntityMapperRegistry`
- [x] `InProcessProjectionService` has no fallback to mappers; `UseCaseRegistry` is the sole projection path
- [x] `ParentRecoveryService` calls `UseCaseRegistry` instead of `EntityMapperRegistry`
- [x] All 10 `Crunchwork*Mapper` files deleted
- [x] `EntityMapperRegistry` and `EntityMapper` interface deleted
- [x] `NestedEntityExtractor` deleted (no consumers; `EntityRelationshipService` handles nested parents)
- [x] Module wiring compiles with no mapper references
- [x] Existing webhook orchestrator spec passes (7/7 tests)
- [x] `apps/api` and `apps/provider` compile cleanly (`tsc --noEmit`)
- [x] No runtime imports reference deleted files
- [x] `LookupResolver` retained (has non-mapper consumers)
- [ ] Parity test: for each entity type, a sample webhook payload produces identical internal DB state via use case as it did via mapper (use existing DB webhook data to replay)

---

## 8. Future: Event-Specific Enhancements (Not In Scope)

These were identified in the coverage review but are **not blocking** this unification:

- G-1: Mutation-name differentiation (`createPulseJob` vs `createPulseChildJob`)
- G-3: Invoice PO-context enrichment
- G-4: Webhook sweep service
- A-2: Provider-server in-process projection support
- A-4: Unknown event type alerting

Each of these can be addressed as follow-on work once the projection layer is unified.
