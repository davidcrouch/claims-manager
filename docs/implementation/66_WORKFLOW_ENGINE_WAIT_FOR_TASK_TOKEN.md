# Context: Implement ASL waitForTaskToken (external callback) in more0 workflow engine

**Audience:** Cursor agent working in the `capabilities` repo  
**Related consumer ASL:** `claims-manager` → `apps/api/more0/ensure/definitions/workflows/job/{assessment,make-safe,works}/asl.json`  
**Status:** Engine gap — ASL shape exists in consumer; runtime pause/resume incomplete

---

## Goal

Make the Go workflow engine in `packages/engines/workflow/` support **AWS Step Functions–style callback waits** so Ensure job workflows (assessment / make-safe / works) can pause for external domain events and resume later.

`more0-ensure` is **deprecated**. Do **not** reintroduce custom ASL types like `WaitForEvent`. Stay ASL-compatible.

## Why

Ensure workflows were written for more0-ensure’s proprietary:

```json
{ "Type": "WaitForEvent", "EventPatterns": [ { "eventType": "...", "filter": {...}, "Next": "..." } ] }
```

That type is **invalid** in the capabilities engine (only: Task, Pass, Choice, Parallel, Map, Wait, Succeed, Fail).

Claims-manager has already rewritten Ensure ASL to the legal shape:

```json
{
  "Type": "Task",
  "Resource": "states.waitForTaskToken",
  "Parameters": {
    "eventPatterns": [
      { "eventType": "task.completed", "filter": { "taskName": "Send Scope / Contract" } }
    ]
  },
  "ResultPath": "$.event",
  "Next": "WaitForScopeActions__Route"
}
```

followed by a `Choice` that routes on `$.event.eventType` / `$.event.payload.*`.

**Problem:** `TaskHandler` always **invokes** `Resource` via the task executor and then advances. It does **not** park the run as waiting for an external callback. So these waits are ASL-valid JSON but **not runtime-complete**.

Consumer ASL lives in sibling repo:

`../claims-manager/apps/api/more0/ensure/definitions/workflows/job/{assessment,make-safe,works}/asl.json`

Reference examples already in the capabilities repo:

- `apps/more0ai/definitions/workflows/code-execution/asl.json` (`Resource: "states.waitForTaskToken"`)
- `apps/more0ai/definitions/workflows/release-pipeline/asl.json` (ARN-style `.waitForTaskToken`)

Docs: `docs/user-guide/14-architecture/workflow-engine.md`

## Existing building blocks (use them)

| Piece | Location | Notes |
|-------|----------|--------|
| `StatusWaiting` | `contracts/run_status.go` | “waiting for external input” — exists but unused by Task |
| `Engine.Resume` | `workflow/engine/engine.go` | Merges input into context, sets Running, dispatches tick |
| Time `Wait` | `workflow/handlers/wait_handler.go` | Parks as `StatusWaitingTimer`, sets `NextNodeID` **before** wait so resume executes **Next** |
| Task invoke | `workflow/handlers/task_handler.go` | Always ExecuteResource → ResultPath → Next |
| ASL extensions already allowed | `Method`, `NextTargets`, `FailurePolicy`, `MaxConcurrencyPath` | Do not add `WaitForEvent` |

## Required behavior (ASL callback pattern)

### Detect wait-token Tasks

Treat Resource as wait-token when it equals / ends with:

- `states.waitForTaskToken`
- `*.waitForTaskToken` (incl. `arn:aws:states:::lambda:invoke.waitForTaskToken`)

Do **not** call the normal capability executor for these.

### On enter (first tick)

1. Resolve `Parameters` (may include `eventPatterns`, message, etc.).
2. Persist wait metadata (token / runID / state name / patterns) somewhere durable on the run (context Output metadata pattern like Wait’s `_waitUntil`, or explicit run fields — pick one consistent approach).
3. Return `HandlerResult` with:
   - `Status: contracts.StatusWaiting` (external wait, **not** `WaitingTimer`)
   - `NextNodeID` set to the Task’s `Next` (mirror time-Wait: advance current state pointer so resume ticks the **following** state, typically a Choice)
   - Do **not** dispatch another tick while waiting
4. Optionally emit a task token (e.g. `$$.Task.Token` / opaque resume token) for callers.

### On resume

External system calls something equivalent to `Engine.Resume(runID, input)` where `input` includes the event payload.

Expected consumer contract (claims-manager ASL):

```json
{
  "event": {
    "eventType": "task.completed",
    "payload": { "taskName": "Send Scope / Contract", "completedAt": "..." }
  }
}
```

Because Task uses `"ResultPath": "$.event"`, resume must place the callback payload where ResultPath expects it **or** merge so Choice sees `$.event.eventType` and `$.event.payload.*`.

Match time-Wait semantics: after Resume, the next tick should execute the state already pointed to by `Next` (the `__Route` Choice), **not** re-enter the wait Task.

### Optional event filtering

`Parameters.eventPatterns` is advisory metadata from Ensure migrations. Prefer:

1. **MVP:** any Resume completes the wait; Choice does routing/filtering.
2. **Better:** Resume accepts an event; if no pattern matches, stay `StatusWaiting` (Ensure’s old behavior).

Document which you implement.

### Timeouts

If Task has `TimeoutSeconds` + `Catch` on `States.Timeout`, schedule a durable wake that fails/catches like ASL. Time Wait already has `TimerScheduler` — reuse if possible.

## Non-goals

- Do **not** add `Type: "WaitForEvent"` or `EventPatterns` as top-level ASL state fields.
- Do **not** require AWS ARNs for `Resource` (capabilities use FQCNs like `tool.claims.create_task`).
- Do **not** change claims-manager in this task unless a tiny contract doc is needed; fix the engine first.
- Keep existing extensions (`Method`, etc.).

## Acceptance tests (add Go tests)

1. Task with `Resource: "states.waitForTaskToken"` → run status `waiting`, no capability invoke.
2. `Resume` with `{ "event": { "eventType": "x", "payload": {...} } }` → run continues into `Next` Choice/Task with `$.event` populated per ResultPath.
3. Unmatched event: either stays waiting (if filtering implemented) or advances (if MVP) — assert documented behavior.
4. Normal Task (`tool.foo`) still invokes executor unchanged.
5. Time-based `Wait` still works (`StatusWaitingTimer`).
6. Parser/validator still reject unknown types like `WaitForEvent`.

## Suggested implementation order

1. Special-case wait-token in `TaskHandler` (or thin wrapper) returning `StatusWaiting` + `NextNodeID`.
2. Confirm engine tick path does not auto-dispatch while `StatusWaiting` (same as other waiting statuses).
3. Align `Resume` with ResultPath / current-state semantics (may need: apply resume payload via ResultPath of the wait node, or document that callers pass already-shaped context).
4. Wire optional timeout via existing timer scheduler.
5. Tests + short note in `docs/user-guide/14-architecture/workflow-engine.md` under ASL Compatibility / callbacks.

## Success criteria

Ensure-style ASL using only standard state types + `Resource: "states.waitForTaskToken"` can:

1. Start a run
2. Park on wait-token Tasks
3. Resume from an external event
4. Route via Choice on `$.event.*`
5. Continue to tool Tasks (`tool.claims.*`)

Without any `WaitForEvent` type.
