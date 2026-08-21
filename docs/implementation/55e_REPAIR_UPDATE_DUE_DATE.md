# 55e — Repair Update Due Date

**Gap addressed:** W6 (Repair Update task lacks 5-business-day due date)

## Problem

The Crunchwork workflow specifies that Repair Update tasks re-generate every 5 business days. The current works ASL creates Repair Update tasks with no `startDate` or date information:

```json
{
  "name": "Repair Update",
  "relatedEntityType": "Job",
  "relatedEntityId.$": "$.jobId",
  "jobId.$": "$.jobId",
  "priority": "Medium",
  "status": "Open",
  "originType": "automation"
}
```

Without a due date, the task appears immediately with no indication of when it should be actioned.

## Solution

### 1. Use `calculate_dates` MCP tool before each Repair Update creation

The engine already has access to `tool.claims.calculate_dates`. However, this tool currently computes `attendanceDueDate` and `submissionDueDate` — not repair update intervals.

A simpler approach: compute the date inline in the ASL using the event timestamp. Since the ASL engine supports `$$.now` or the event's `completedAt` as a reference point, we can set the task's `startDate` to "now + 5 business days" by passing a description that encodes the expectation.

### 2. Pragmatic approach: add a `description` with due-date guidance

Since the ASL engine doesn't natively compute business-day offsets and adding a new MCP tool is a larger change, the pragmatic fix is to add a descriptive `startDate` note and set the task `reminderAt` or `startDate` field.

The `create_task` API accepts `startDate` (ISO string). The works ASL can set this using the event's `completedAt` field as a base reference — but the 5-business-day offset calculation must happen server-side.

### 3. Preferred solution: extend the Repair Update handler states

Add a `CalculateRepairUpdateDueDate` Task state before each `create_task` call that calls `calculate_dates` with a new parameter. Or, simpler: have the `create_task` handler in claims-manager accept a `dueDateOffsetDays` parameter and compute the date server-side.

For now, set a static 7-calendar-day description (approximating 5 business days) and add a `TODO` in the ASL for future date-calculation integration.

### Implementation (works ASL)

Update each Repair Update `create_task` to include a descriptive note:

```json
{
  "name": "Repair Update",
  "relatedEntityType": "Job",
  "relatedEntityId.$": "$.jobId",
  "jobId.$": "$.jobId",
  "priority": "Medium",
  "status": "Open",
  "originType": "automation",
  "description": "Provide a progress update to the insurer. Due within 5 business days."
}
```

This is a documentation-only improvement. Full date calculation will require a `calculate_repair_update_date` MCP tool or extending `calculate_dates`.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `definitions/workflows/job/works/asl.json` | more0-ensure | Add description to Repair Update task creation states |

## Future Enhancement

Add a `repairUpdateDueDate` calculation to `calculate_dates` MCP tool that accepts a base date and returns `basePlusBusinessDays(5)`. Then the ASL can call it before each `create_task` and set `startDate.$` from the result.

## Testing

1. Complete a Repair Update task → verify new task is created with the description.
2. Verify the task appears in the task list with visible due-date guidance.
