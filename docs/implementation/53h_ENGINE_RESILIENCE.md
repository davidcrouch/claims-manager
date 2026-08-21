# 53h — Engine Resilience (Checkpoints & Retry)

**Gaps addressed:** G10 (checkpoints unused), G11 (Retry not implemented)

## Problem

1. **Checkpoints:** The `checkpoints` table exists in more0-ensure's database schema but is never written. If the process crashes while a run is in `running` status (mid tick-loop), the run cannot recover. Runs in `waiting` status are safe (they resume on the next matching event).

2. **Retry:** The ASL spec supports `Retry` blocks on Task states for transient error handling, but the engine ignores them. MCP tool calls to claims-mcp can fail due to network issues, and without retry the workflow fails permanently.

## Priority

These are resilience improvements, not functional gaps. The workflow can run end-to-end without them. Implement after the critical event and context gaps are closed.

## Solution: Checkpoints

### 1. Write checkpoint before each state execution

**File:** `more0-ensure/src/engine/workflow-engine.service.ts`

In the `tickLoop`, before executing each state, write a checkpoint:

```typescript
private async tickLoop(run: WorkflowRun, asl: AslDefinition): Promise<void> {
  let ticks = 0;
  const MAX_TICKS = 100;

  while (run.status === 'running' && ticks < MAX_TICKS) {
    ticks++;

    // Write checkpoint before execution
    await this.runStore.writeCheckpoint({
      runId: run.id,
      stateName: run.currentState,
      context: run.context,
      tickCount: ticks,
    });

    const state = asl.States[run.currentState];
    if (!state) {
      run.status = 'failed';
      run.error = `Unknown state: ${run.currentState}`;
      break;
    }

    await this.executeState(run, state, asl);
  }

  await this.runStore.updateRun(run.id, {
    status: run.status,
    currentState: run.currentState,
    context: run.context,
    output: run.output,
    tickCount: ticks,
    stateHistory: run.stateHistory,
    ...(run.status === 'completed' || run.status === 'failed'
      ? { completedAt: new Date() }
      : {}),
    ...(run.error ? { error: run.error } : {}),
  });
}
```

### 2. Add `writeCheckpoint` to `RunStoreService`

**File:** `more0-ensure/src/engine/state/run-store.service.ts`

```typescript
async writeCheckpoint(params: {
  runId: string;
  stateName: string;
  context: Record<string, unknown>;
  tickCount: number;
}): Promise<void> {
  await this.db.insert(checkpoints).values({
    workflowRunId: params.runId,
    stateName: params.stateName,
    context: params.context,
    tickCount: params.tickCount,
    createdAt: new Date(),
  });
}
```

### 3. Recovery on startup

**File:** `more0-ensure/src/engine/workflow-engine.service.ts`

On module init, find runs that are stuck in `running` status (orphaned by a crash) and either:
- Resume them from their last checkpoint
- Mark them as `failed` with an error indicating crash recovery

```typescript
async onModuleInit(): Promise<void> {
  const orphanedRuns = await this.runStore.findRunsByStatus('running');
  for (const run of orphanedRuns) {
    this.logger.warn(
      `WorkflowEngine.onModuleInit — recovering orphaned run ${run.id} at state ${run.currentState}`,
    );

    const checkpoint = await this.runStore.getLatestCheckpoint(run.id);
    if (checkpoint) {
      run.currentState = checkpoint.stateName;
      run.context = checkpoint.context;
    }

    // Re-enter the tick loop from the checkpointed state
    try {
      const asl = this.definitionLoader.getAsl(run.workflowName);
      if (asl) {
        await this.tickLoop(run, asl);
      } else {
        await this.runStore.updateRun(run.id, {
          status: 'failed',
          error: `Crash recovery failed: workflow definition not found for ${run.workflowName}`,
          completedAt: new Date(),
        });
      }
    } catch (err) {
      await this.runStore.updateRun(run.id, {
        status: 'failed',
        error: `Crash recovery failed: ${(err as Error).message}`,
        completedAt: new Date(),
      });
    }
  }
}
```

## Solution: Retry

### 1. Add retry support to TaskHandler

**File:** `more0-ensure/src/engine/handlers/task.handler.ts`

When a Task state has a `Retry` block, wrap the tool invocation in retry logic:

```typescript
async execute(run: WorkflowRun, state: TaskState): Promise<void> {
  const retriers = state.Retry ?? [];
  let lastError: Error | undefined;
  let attempts = 0;

  const maxAttempts = retriers.length > 0
    ? (retriers[0].MaxAttempts ?? 3)
    : 1;

  const backoffRate = retriers.length > 0
    ? (retriers[0].BackoffRate ?? 2)
    : 1;

  const intervalSeconds = retriers.length > 0
    ? (retriers[0].IntervalSeconds ?? 1)
    : 0;

  while (attempts < maxAttempts) {
    try {
      const result = await this.toolInvoker.invoke(state.Resource, resolvedParams);
      // Apply ResultPath, transition to Next
      this.applyResult(run, state, result);
      return;
    } catch (err) {
      lastError = err as Error;
      attempts++;

      if (attempts >= maxAttempts) break;

      // Check if error matches any Retry.ErrorEquals
      const matchesRetry = retriers.some((r) =>
        r.ErrorEquals.includes('States.ALL') ||
        r.ErrorEquals.includes(lastError!.name) ||
        r.ErrorEquals.includes('States.TaskFailed'),
      );

      if (!matchesRetry) break;

      // Exponential backoff
      const delay = intervalSeconds * Math.pow(backoffRate, attempts - 1) * 1000;
      this.logger.warn(
        `TaskHandler — retrying ${state.Resource} attempt ${attempts}/${maxAttempts} after ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted — fall through to Catch or fail
  if (state.Catch) {
    this.handleCatch(run, state, lastError!);
  } else {
    run.status = 'failed';
    run.error = `Task ${state.Resource} failed after ${attempts} attempts: ${lastError?.message}`;
  }
}
```

### 2. ASL Retry block format (for reference)

```json
"Retry": [
  {
    "ErrorEquals": ["States.TaskFailed"],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  }
]
```

No ASL changes are needed immediately — the existing assessment ASL doesn't use Retry. This implementation enables adding Retry blocks to individual Task states in the future without engine changes.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/engine/workflow-engine.service.ts` | more0-ensure | Checkpoint writes + crash recovery on init |
| `src/engine/state/run-store.service.ts` | more0-ensure | writeCheckpoint, getLatestCheckpoint, findRunsByStatus |
| `src/engine/handlers/task.handler.ts` | more0-ensure | Retry support with backoff |

## Testing

### Checkpoints
1. Start a workflow, crash the process mid-execution → restart → verify run resumes from checkpoint.
2. Verify checkpoint rows are written for each state transition.

### Retry
1. Add a `Retry` block to a test ASL Task state.
2. Mock the MCP tool to fail twice, then succeed → verify 3 attempts with backoff.
3. Mock the MCP tool to fail 3 times → verify fallthrough to Catch or failure.
4. Verify states without Retry blocks behave as before (single attempt, fail on error).
