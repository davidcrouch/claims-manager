import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { entityWorkflowState } from '../../../database/schema';
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

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  registerDefinition(definition: WorkflowDefinition): void {
    const key = definition.entity;
    const existing = this.definitions.get(key) ?? [];
    existing.push(definition);
    this.definitions.set(key, existing);
    this.logger.debug(
      `WorkflowEngine.registerDefinition — ${key}:${definition.name}`,
    );
  }

  registerGuard(guard: WorkflowGuard): void {
    this.guards.set(guard.name, guard);
  }

  registerHook(hook: OnEnterHook): void {
    this.hooks.set(hook.name, hook);
  }

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

    const definition = this.findDefinition(entityType, workflowName);
    if (!definition) {
      return {
        success: false,
        previousStep: currentStep,
        currentStep,
        error: `No workflow '${workflowName}' for '${entityType}'`,
      };
    }

    const step = definition.steps.find((s) => s.id === currentStep);
    if (!step) {
      return {
        success: false,
        previousStep: currentStep,
        currentStep,
        error: `Unknown step '${currentStep}'`,
      };
    }

    const transition = step.transitions.find((t) => t.action === action);
    if (!transition) {
      return {
        success: false,
        previousStep: currentStep,
        currentStep,
        error: `No transition for action '${action}' from step '${currentStep}'`,
      };
    }

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

    // Evaluate guards
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

    // Execute onEnter hooks
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

    // Persist new step
    await this.persistStep({
      tenantId: params.tenantId,
      entityType,
      entityId: params.entityId,
      workflowName,
      step: transition.to,
      userId: params.userId,
      tx: params.tx,
    });

    this.logger.log(
      `WorkflowEngine — ${entityType}:${params.entityId} transitioned ${currentStep} → ${transition.to} via '${action}'`,
    );

    return { success: true, previousStep: currentStep, currentStep: transition.to };
  }

  getAvailableActions(params: {
    entityType: string;
    workflowName: string;
    currentStep: string;
  }): Array<{ action: string; targetStep: string }> {
    const definition = this.findDefinition(params.entityType, params.workflowName);
    if (!definition) return [];
    const step = definition.steps.find((s) => s.id === params.currentStep);
    if (!step) return [];
    return step.transitions.map((t) => ({ action: t.action, targetStep: t.to }));
  }

  async getCurrentStep(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    workflowName: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select({ currentStep: entityWorkflowState.currentStep })
      .from(entityWorkflowState)
      .where(
        and(
          eq(entityWorkflowState.tenantId, params.tenantId),
          eq(entityWorkflowState.entityType, params.entityType),
          eq(entityWorkflowState.entityId, params.entityId),
          eq(entityWorkflowState.workflowName, params.workflowName),
        ),
      )
      .limit(1);
    return row?.currentStep ?? null;
  }

  getRegisteredDefinitions(): Array<{ entity: string; name: string }> {
    const result: Array<{ entity: string; name: string }> = [];
    for (const [, defs] of this.definitions) {
      for (const def of defs) {
        result.push({ entity: def.entity, name: def.name });
      }
    }
    return result;
  }

  private findDefinition(entityType: string, workflowName: string): WorkflowDefinition | undefined {
    const definitions = this.definitions.get(entityType);
    return definitions?.find((d) => d.name === workflowName);
  }

  private async persistStep(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    workflowName: string;
    step: string;
    userId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const now = new Date();
    await params.tx
      .insert(entityWorkflowState)
      .values({
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        workflowName: params.workflowName,
        currentStep: params.step,
        enteredAt: now,
        enteredByUserId: params.userId,
        metadata: {},
      })
      .onConflictDoUpdate({
        target: [
          entityWorkflowState.tenantId,
          entityWorkflowState.entityType,
          entityWorkflowState.entityId,
          entityWorkflowState.workflowName,
        ],
        set: {
          currentStep: params.step,
          enteredAt: now,
          enteredByUserId: params.userId,
          updatedAt: now,
        },
      });
  }
}
