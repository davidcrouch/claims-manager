# 35e — Workflow Engine: State Machines & Step Definitions

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 4 (definitions can be authored earlier; engine execution in Phase 4)

---

## 0. Purpose

The workflow engine manages entity lifecycle transitions through defined steps. It validates that transitions are legal, evaluates guard conditions, and fires `onEnter` hooks that invoke domain services (issuance, notifications, outbound sync, etc.).

Workflows are:
- **Defined in code** (TypeScript) — version-controlled, type-safe
- **Multiple per entity** — different scenarios/subtypes have different flows (e.g., `contact.onboarding`, `contact.removal`, `purchase_order.standard`, `purchase_order.emergency`)
- **More0-compatible** — structured so that when More0 integration arrives, definitions map directly to More0 workflow steps

---

## 1. Core Interfaces

```typescript
// apps/api/src/modules/domain/workflows/workflow.interface.ts

/**
 * A guard condition that must be satisfied before a transition can occur.
 */
export interface WorkflowGuard {
  name: string;
  evaluate(context: WorkflowContext): Promise<boolean>;
}

/**
 * A hook that fires when entering a step (after transition succeeds).
 */
export interface OnEnterHook {
  name: string;
  execute(context: WorkflowContext): Promise<void>;
}

/**
 * A single transition between steps.
 */
export interface WorkflowTransition {
  to: string;              // Target step ID
  action: string;          // Action name that triggers this (e.g. 'submit', 'approve', 'issue')
  guards?: string[];       // Guard names to evaluate (all must pass)
  onEnter?: string[];      // Hook names to fire on entering the target step
}

/**
 * A step in the workflow.
 */
export interface WorkflowStep {
  id: string;              // Step identifier (e.g. 'draft', 'approved', 'issued')
  label?: string;          // Human-readable label
  transitions: WorkflowTransition[];
  isFinal?: boolean;       // If true, no outbound transitions expected
}

/**
 * A complete workflow definition.
 */
export interface WorkflowDefinition {
  entity: string;          // Entity type (e.g. 'purchase_order')
  name: string;            // Workflow scenario name (e.g. 'standard', 'emergency')
  description?: string;
  initialStep: string;     // Step ID for newly created entities
  steps: WorkflowStep[];
}

/**
 * Runtime context passed to guards and hooks.
 */
export interface WorkflowContext {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  currentStep: string;
  targetStep: string;
  action: string;
  entity: Record<string, unknown>;  // Current entity state
  tx: DrizzleDbOrTx;
}

/**
 * Result of a workflow transition attempt.
 */
export interface TransitionResult {
  success: boolean;
  previousStep: string;
  currentStep: string;
  failedGuards?: string[];    // Guard names that rejected the transition
  error?: string;
}
```

---

## 2. Workflow Engine Service

```typescript
// apps/api/src/modules/domain/workflows/workflow-engine.service.ts

import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type {
  WorkflowDefinition,
  WorkflowContext,
  TransitionResult,
  WorkflowGuard,
  OnEnterHook,
} from './workflow.interface';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger('WorkflowEngine');
  private definitions: Map<string, WorkflowDefinition[]> = new Map();
  private guards: Map<string, WorkflowGuard> = new Map();
  private hooks: Map<string, OnEnterHook> = new Map();

  /**
   * Register a workflow definition.
   */
  registerDefinition(definition: WorkflowDefinition): void {
    const key = definition.entity;
    const existing = this.definitions.get(key) ?? [];
    existing.push(definition);
    this.definitions.set(key, existing);
  }

  /**
   * Register a reusable guard.
   */
  registerGuard(guard: WorkflowGuard): void {
    this.guards.set(guard.name, guard);
  }

  /**
   * Register a reusable onEnter hook.
   */
  registerHook(hook: OnEnterHook): void {
    this.hooks.set(hook.name, hook);
  }

  /**
   * Attempt a workflow transition.
   *
   * @param entityType - The entity type
   * @param workflowName - Which workflow to use (scenario)
   * @param action - The action being performed (e.g. 'submit', 'approve')
   * @param context - Runtime context with entity state
   * @returns TransitionResult indicating success or failure
   */
  async advance(params: {
    entityType: string;
    workflowName: string;
    action: string;
    entityId: string;
    tenantId: string;
    userId: string;
    entity: Record<string, unknown>;
    currentStep: string;
    tx: DrizzleDbOrTx;
  }): Promise<TransitionResult> {
    const { entityType, workflowName, action, currentStep } = params;

    // 1. Find the workflow definition
    const definition = this.findDefinition(entityType, workflowName);
    if (!definition) {
      return { success: false, previousStep: currentStep, currentStep, error: `No workflow '${workflowName}' for '${entityType}'` };
    }

    // 2. Find the current step
    const step = definition.steps.find(s => s.id === currentStep);
    if (!step) {
      return { success: false, previousStep: currentStep, currentStep, error: `Unknown step '${currentStep}'` };
    }

    // 3. Find the transition for this action
    const transition = step.transitions.find(t => t.action === action);
    if (!transition) {
      return { success: false, previousStep: currentStep, currentStep, error: `No transition for action '${action}' from step '${currentStep}'` };
    }

    // 4. Build context
    const context: WorkflowContext = {
      tenantId: params.tenantId,
      userId: params.userId,
      entityType,
      entityId: params.entityId,
      currentStep,
      targetStep: transition.to,
      action,
      entity: params.entity,
      tx: params.tx,
    };

    // 5. Evaluate guards
    if (transition.guards && transition.guards.length > 0) {
      const failedGuards: string[] = [];
      for (const guardName of transition.guards) {
        const guard = this.guards.get(guardName);
        if (!guard) {
          this.logger.warn(`WorkflowEngine — guard '${guardName}' not registered`);
          failedGuards.push(guardName);
          continue;
        }
        const passed = await guard.evaluate(context);
        if (!passed) failedGuards.push(guardName);
      }
      if (failedGuards.length > 0) {
        return { success: false, previousStep: currentStep, currentStep, failedGuards };
      }
    }

    // 6. Transition is valid — execute onEnter hooks
    if (transition.onEnter && transition.onEnter.length > 0) {
      for (const hookName of transition.onEnter) {
        const hook = this.hooks.get(hookName);
        if (!hook) {
          this.logger.warn(`WorkflowEngine — hook '${hookName}' not registered`);
          continue;
        }
        await hook.execute(context);
      }
    }

    // 7. Persist new step (via entity_workflow_state or direct status update)
    await this.persistStep({
      tenantId: params.tenantId,
      entityType,
      entityId: params.entityId,
      workflowName,
      step: transition.to,
      tx: params.tx,
    });

    this.logger.log(
      `WorkflowEngine — ${entityType}:${params.entityId} transitioned ${currentStep} → ${transition.to} via '${action}'`,
    );

    return { success: true, previousStep: currentStep, currentStep: transition.to };
  }

  /**
   * Get available actions for an entity in its current step.
   */
  getAvailableActions(params: {
    entityType: string;
    workflowName: string;
    currentStep: string;
  }): Array<{ action: string; targetStep: string }> {
    const definition = this.findDefinition(params.entityType, params.workflowName);
    if (!definition) return [];
    const step = definition.steps.find(s => s.id === params.currentStep);
    if (!step) return [];
    return step.transitions.map(t => ({ action: t.action, targetStep: t.to }));
  }

  private findDefinition(entityType: string, workflowName: string): WorkflowDefinition | undefined {
    const definitions = this.definitions.get(entityType);
    return definitions?.find(d => d.name === workflowName);
  }

  private async persistStep(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    workflowName: string;
    step: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // Upsert into entity_workflow_state table
    // This tracks the current step for each entity in each workflow
  }
}
```

---

## 3. Workflow State Schema

```sql
CREATE TABLE entity_workflow_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES organizations(id),
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  workflow_name   TEXT NOT NULL,
  current_step    TEXT NOT NULL,
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  entered_by_user_id TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, entity_type, entity_id, workflow_name)
);

CREATE INDEX idx_workflow_state_entity ON entity_workflow_state(tenant_id, entity_type, entity_id);
CREATE INDEX idx_workflow_state_step ON entity_workflow_state(tenant_id, entity_type, current_step);
```

This allows an entity to be in multiple workflows simultaneously (e.g., a PO in `standard` workflow step "issued" AND in an `approval` workflow step "fully_approved").

---

## 4. Example Workflow Definitions

### Purchase Order — Standard

```typescript
// apps/api/src/modules/domain/workflows/definitions/purchase-order.workflows.ts

import type { WorkflowDefinition } from '../workflow.interface';

export const purchaseOrderStandard: WorkflowDefinition = {
  entity: 'purchase_order',
  name: 'standard',
  description: 'Standard PO lifecycle: draft → approval → issue → acknowledgement',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        { to: 'pending_approval', action: 'submit', guards: ['hasLineItems', 'hasRecipient'] },
      ],
    },
    {
      id: 'pending_approval',
      label: 'Pending Approval',
      transitions: [
        { to: 'approved', action: 'approve' },
        { to: 'draft', action: 'reject' },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'issued', action: 'issue', onEnter: ['issueDocument'] },
      ],
    },
    {
      id: 'issued',
      label: 'Issued',
      transitions: [
        { to: 'acknowledged', action: 'acknowledge' },
        { to: 'draft', action: 'revise' },  // Back to draft for reissue
      ],
    },
    {
      id: 'acknowledged',
      label: 'Acknowledged',
      transitions: [
        { to: 'closed', action: 'close' },
        { to: 'draft', action: 'revise' },
      ],
    },
    {
      id: 'closed',
      label: 'Closed',
      isFinal: true,
      transitions: [],
    },
  ],
};
```

### Contact — Onboarding

```typescript
export const contactOnboarding: WorkflowDefinition = {
  entity: 'contact',
  name: 'onboarding',
  description: 'New contact onboarding flow',
  initialStep: 'pending',
  steps: [
    {
      id: 'pending',
      label: 'Pending Verification',
      transitions: [
        { to: 'verified', action: 'verify', guards: ['hasEmailOrPhone'] },
        { to: 'rejected', action: 'reject' },
      ],
    },
    {
      id: 'verified',
      label: 'Verified',
      transitions: [
        { to: 'active', action: 'activate', onEnter: ['notifyContactActive'] },
      ],
    },
    {
      id: 'active',
      label: 'Active',
      isFinal: true,
      transitions: [],
    },
    {
      id: 'rejected',
      label: 'Rejected',
      isFinal: true,
      transitions: [],
    },
  ],
};
```

### Contact — Removal

```typescript
export const contactRemoval: WorkflowDefinition = {
  entity: 'contact',
  name: 'removal',
  description: 'Contact removal/offboarding flow',
  initialStep: 'active',
  steps: [
    {
      id: 'active',
      label: 'Active',
      transitions: [
        { to: 'pending_removal', action: 'request_removal' },
      ],
    },
    {
      id: 'pending_removal',
      label: 'Pending Removal',
      transitions: [
        { to: 'removed', action: 'confirm_removal', onEnter: ['deactivateContact'] },
        { to: 'active', action: 'cancel' },
      ],
    },
    {
      id: 'removed',
      label: 'Removed',
      isFinal: true,
      transitions: [],
    },
  ],
};
```

### Job — Standard

```typescript
export const jobStandard: WorkflowDefinition = {
  entity: 'job',
  name: 'standard',
  description: 'Standard job lifecycle from assignment to completion',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'accepted', action: 'accept' },
        { to: 'declined', action: 'decline', onEnter: ['notifyDecline'] },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
      transitions: [
        { to: 'in_progress', action: 'start' },
      ],
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      transitions: [
        { to: 'on_hold', action: 'hold' },
        { to: 'pending_completion', action: 'complete', guards: ['allTasksClosed'] },
      ],
    },
    {
      id: 'on_hold',
      label: 'On Hold',
      transitions: [
        { to: 'in_progress', action: 'resume' },
      ],
    },
    {
      id: 'pending_completion',
      label: 'Pending Completion',
      transitions: [
        { to: 'completed', action: 'finalize', onEnter: ['notifyCompletion', 'syncOutbound'] },
        { to: 'in_progress', action: 'reopen' },
      ],
    },
    {
      id: 'completed',
      label: 'Completed',
      isFinal: true,
      transitions: [],
    },
    {
      id: 'declined',
      label: 'Declined',
      isFinal: true,
      transitions: [],
    },
  ],
};
```

---

## 5. Guards

Guards are reusable condition checks. Each guard implements the `WorkflowGuard` interface:

```typescript
// apps/api/src/modules/domain/workflows/guards/has-line-items.guard.ts

import { Injectable } from '@nestjs/common';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

@Injectable()
export class HasLineItemsGuard implements WorkflowGuard {
  name = 'hasLineItems';

  async evaluate(context: WorkflowContext): Promise<boolean> {
    // Query line items for this entity
    // Return true if at least one group with items exists
    // Implementation depends on entity type (quote_groups, po_groups, etc.)
    return true; // placeholder
  }
}
```

```typescript
// apps/api/src/modules/domain/workflows/guards/has-recipient.guard.ts

@Injectable()
export class HasRecipientGuard implements WorkflowGuard {
  name = 'hasRecipient';

  async evaluate(context: WorkflowContext): Promise<boolean> {
    // Check that the entity has a recipient (vendor, customer) assigned
    const entity = context.entity;
    return !!(entity.vendorId || entity.poTo || entity.recipientTenantId);
  }
}
```

```typescript
// apps/api/src/modules/domain/workflows/guards/has-email-or-phone.guard.ts

@Injectable()
export class HasEmailOrPhoneGuard implements WorkflowGuard {
  name = 'hasEmailOrPhone';

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const entity = context.entity;
    return !!(entity.email || entity.mobilePhone || entity.homePhone || entity.workPhone);
  }
}
```

---

## 6. onEnter Hooks

Hooks fire side effects when a step is entered. They call domain services:

```typescript
// apps/api/src/modules/domain/workflows/hooks/issue-document.hook.ts

@Injectable()
export class IssueDocumentHook implements OnEnterHook {
  name = 'issueDocument';

  constructor(private readonly issuanceService: DocumentIssuanceService) {}

  async execute(context: WorkflowContext): Promise<void> {
    await this.issuanceService.execute({
      tenantId: context.tenantId,
      userId: context.userId,
      documentType: context.entityType as any,
      documentId: context.entityId,
      // recipientTenantId / recipientConnectionId resolved from entity data
      tx: context.tx,
    });
  }
}
```

```typescript
// apps/api/src/modules/domain/workflows/hooks/sync-outbound.hook.ts

@Injectable()
export class SyncOutboundHook implements OnEnterHook {
  name = 'syncOutbound';

  constructor(private readonly outboundSync: OutboundSyncService) {}

  async execute(context: WorkflowContext): Promise<void> {
    // Only enqueue if entity has an active external connection
    await this.outboundSync.enqueueIfConnected({
      tenantId: context.tenantId,
      entityType: context.entityType,
      entityId: context.entityId,
      action: 'status_change',
      payload: { newStep: context.targetStep },
      tx: context.tx,
    });
  }
}
```

---

## 7. Engine Registration (Module Init)

```typescript
// In DomainModule or a dedicated WorkflowModule:

@Module({
  providers: [
    WorkflowEngineService,
    // Guards
    HasLineItemsGuard,
    HasRecipientGuard,
    HasEmailOrPhoneGuard,
    AllTasksClosedGuard,
    // Hooks
    IssueDocumentHook,
    SyncOutboundHook,
    NotifyCompletionHook,
    DeactivateContactHook,
  ],
})
export class WorkflowModule implements OnModuleInit {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly hasLineItems: HasLineItemsGuard,
    private readonly hasRecipient: HasRecipientGuard,
    private readonly issueDocHook: IssueDocumentHook,
    private readonly syncOutboundHook: SyncOutboundHook,
    // ... other guards and hooks
  ) {}

  onModuleInit(): void {
    // Register definitions
    this.engine.registerDefinition(purchaseOrderStandard);
    this.engine.registerDefinition(contactOnboarding);
    this.engine.registerDefinition(contactRemoval);
    this.engine.registerDefinition(jobStandard);
    // ... other definitions

    // Register guards
    this.engine.registerGuard(this.hasLineItems);
    this.engine.registerGuard(this.hasRecipient);
    // ...

    // Register hooks
    this.engine.registerHook(this.issueDocHook);
    this.engine.registerHook(this.syncOutboundHook);
    // ...
  }
}
```

---

## 8. API Integration

Controllers call the workflow engine for state transitions:

```typescript
// In a controller or command use case:

@Post(':id/actions/:action')
async performAction(
  @Param('id') id: string,
  @Param('action') action: string,
  @CurrentUser() user: AuthUser,
  @CurrentTenant() tenantId: string,
) {
  const entity = await this.entityRepo.findByIdAndTenant({ id, tenantId });
  const currentStep = await this.workflowState.getCurrentStep(tenantId, 'purchase_order', id, 'standard');

  const result = await this.workflowEngine.advance({
    entityType: 'purchase_order',
    workflowName: 'standard',
    action,
    entityId: id,
    tenantId,
    userId: user.id,
    entity: entity as Record<string, unknown>,
    currentStep,
    tx: this.db,  // or within a transaction
  });

  if (!result.success) {
    throw new BadRequestException({
      message: result.error ?? 'Transition not allowed',
      failedGuards: result.failedGuards,
    });
  }

  return { step: result.currentStep };
}
```

---

## 9. More0 Migration Path

When More0 integration arrives:

| Current (in-process) | More0 equivalent |
|---|---|
| `WorkflowDefinition` | More0 workflow YAML/JSON definition |
| `WorkflowStep` | More0 step |
| `WorkflowGuard` | More0 condition/predicate |
| `OnEnterHook` | More0 action (calls back to EnsureOS API) |
| `WorkflowEngineService.advance()` | More0 `workflow.trigger(action)` |
| `entity_workflow_state` table | More0 manages state internally |

The transition:
1. Export workflow definitions as More0-compatible format
2. Guards become HTTP-callable condition endpoints
3. Hooks become More0 action definitions that call EnsureOS API endpoints
4. `WorkflowEngineService` becomes a thin proxy to More0's API
5. `entity_workflow_state` table becomes read-only (More0 is source of truth for step)
