# 8cdc8988 — Cannot select multiple specialist options

| Field | Value |
|-------|-------|
| ID | `8cdc8988-1912-411b-918d-34c4a68e0065` |
| Type / priority / status | bug / medium / open |
| Reporter | Mitchell Turnbull |
| Created | 2026-09-14T01:22:24Z |
| Page context | Contacts Detail (likely wrong); tags: `assessment` |

## User report

Cannot select multiple specialist options in the assessment section — only one, no secondary field.

## Root cause

**Product gap**, not a transient bug. `SpecialistsTabForm` is boolean + **single** text `specialistType`. Design schema treats `specialistType` as String. Job Specialist type panel is also single-select.

## Key files

- `apps/frontend/src/components/assessments/tabs/SpecialistsTabForm.tsx`
- `apps/frontend/src/components/assessments/AssessmentDetailClient.tsx`
- `docs/design/03_REPORT_TYPE_SCHEMAS.md` — `specialistType`
- Optional: `SpecialistPanel.tsx` / `SPECIALIST_CATEGORY_OPTIONS`

## Proposed solution

**Recommended:** Multi-select specialist types with backward-compatible storage.

1. Store `specialistTypes: string[]` (or multi lookup refs); migrate single `specialistType` string on read.
2. Checkbox / multi-select UI from the agreed option list in Specialists tab.
3. Update publish mapping to CW so all selected types are included.

## Acceptance criteria

- [ ] ≥2 specialist types selectable and persisted after reload/publish.
- [ ] Publish/report mapping includes all selected types.

## Repro

Assessment → Specialists → pick one type → no multi-select / second field.
