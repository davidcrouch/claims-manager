---
title: "Completing an Assessment"
slug: completing-an-assessment
description: "How to complete every assessment tab — Attendance through Recommendation — including field labels, autosave, and lock behaviour."
section: operations
area: assessments
routes:
  - /assessments
  - /assessments/[id]
audience: member
permissions_discussed:
  - assessments.read
  - assessments.manage
tags:
  - assessments
  - attendance
  - building
  - habitability
  - hazards
  - damage
  - make safe
  - recommendation
related_guides:
  - assessments-overview
  - assessment-reports
  - completing-a-builder-assessment-job
  - builder-make-safe-workflow
  - creating-an-estimate
version: 1
last_updated: 2026-08-31
---

# Completing an Assessment

Use this page on site or immediately after the visit. Work the tabs in strip order. Each section below matches a live tab and uses the labels you see on the form.

This is the assessment *record*. The Builder Assessment *job* checklist is [Completing a Builder Assessment Job](../jobs/completing-a-builder-assessment-job.md).

## Key Concepts

- **One record, nine tabs** — you are editing sections of the same assessment. Autosave writes the whole form.
- **Recommended order** — Attendance → Building → Habitability → Hazards → Damage & Cause → Make Safe → Temp Accommodation → Specialists → Recommendation.
- **Locked** — status **published** or **archived** disables every control. The banner reads that the assessment has been published and can no longer be edited.

## Accessing the Form

1. Under **Customers**, click **Assessments**.
2. Open the assessment, or click **Create Assessment** first (job + name required).
3. Confirm you are not seeing the locked banner.

> **Required permission:** `assessments.manage` to edit. `assessments.read` is view-only.

## Suggested Order

1. Complete **Attendance** so the visit is dated and named.
2. Describe the **Building** as it stands.
3. Decide **Habitability** before you write temporary accommodation.
4. Flag **Hazards** that affect safety or the repair method.
5. Write **Damage & Cause** in plain language the insurer can quote.
6. Set **Make Safe** if temporary works are required — then create the Make Safe job from the parent job header.
7. Fill **Temp Accommodation** only when occupants cannot stay, or loss of rent applies.
8. Note **Specialists** if you cannot sign off without one.
9. Finish **Recommendation** last so it agrees with everything above.

> **Tip:** If you only have ten minutes on the kerb, capture Attendance, Damage & Cause, and Recommendation first. Return to Building and Hazards before you leave the job.

## Attendance

Purpose: prove who was on site, when, and whether you attended the risk address.

| Field | What to enter |
|-------|----------------|
| **Risk address attended** | Tick if you attended the claim risk address |
| **Other address** | Search or type an address if you attended somewhere else |
| **Site attendance date** | Date and time of the visit (datetime) |
| **Persons attending** | Everyone on site for your company (and customer if relevant) |
| **Builder / estimator name** | Prefills from the job assignee when empty; correct if someone else attended |
| **Builder / estimator phone** | Direct number for follow-up |
| **Insurance assessor attended** | Tick if the insurer’s assessor was present |
| **Insurance assessor name** / **Insurance assessor phone** | Their details when they attended |
| **Occupancy type** | **Vacant**, **Occupied**, or **Partially Occupied** |

> **Note:** Align **Site attendance date** with the job appointment and Overview **Attendance date**. Mismatched dates cause insurer queries.

> **Tip:** If you did not attend the risk address, leave the tick off and fill **Other address** so the report does not imply you were at the claim site.

## Building

Purpose: describe the structure so repairs and estimates are priced against the right construction.

| Field | What to enter |
|-------|----------------|
| **House m²** | Approximate floor area |
| **Estimated build year** | Best estimate if the year is unknown |
| **Building type** | House, Unit, Townhouse, Duplex, Commercial, Other |
| **Design type** | Standard, Custom, Heritage, Multi-storey |
| **Construction** | Brick Veneer, Double Brick, Weatherboard, Fibro, Concrete, Steel Frame, Other |
| **Roof type** | Tile, Metal, Slate, Flat, Colorbond, Other |
| **Additional structures** | Garages, sheds, and similar — free text |
| **Other structures** | Anything not covered above |
| **Main house roof damage** | Tick if the main roof is damaged |
| **Overall condition acceptable** | Tick if pre-existing condition is generally acceptable |
| **Furniture removal / storage** | Tick if contents must be moved or stored for repairs |

> **Note:** These dropdowns match the optional fields on **Create Assessment**. Values you set at create appear here.

## Habitability

Purpose: state whether people can stay, and why not if they cannot.

| Field | What to enter |
|-------|----------------|
| **Habitable** | Tick if the property can be occupied safely |
| **Uninhabitable reason** | Main reason it cannot be occupied (multiline) |
| **Other uninhabitable reason** | Extra detail that does not fit the first box |

> **Warning:** If **Habitable** is off, complete **Temp Accommodation** and say so in **Recommendation**. Do not leave displacement implied.

This tab is short on purpose. Be specific (“no working kitchen; ceiling collapse in bedroom 2”), not generic (“unlivable”).

## Hazards

Purpose: flag safety issues that change how trades attend or whether make-safe is urgent.

Each of the first four groups is a tick plus a comment:

| Tick label | Comment label |
|------------|----------------|
| **Pool fencing** | What is the pool fencing hazard? |
| **Electrical / Gas** | What is the electrical / gas hazard? |
| **Sewerage** | What is the sewerage hazard? |
| **Structural** | What is the structural hazard? |

Then two summaries:

| Field | What to enter |
|-------|----------------|
| **Safety hazards (summary for NRMA)** | Plain-language summary the insurer can read without opening every comment |
| **Environmental hazards** | Asbestos risk, contamination, flood residue, and similar |

> **Tip:** Tick the group *and* write the comment. A tick with an empty comment is hard to act on.

> **Warning:** If a hazard makes the site unsafe for a full assessment, say so here and on **Make Safe**. Do not invent a complete scope from the street.

## Damage & Cause

Purpose: what you saw, what caused it, and what is pre-existing versus event-related.

| Field | What to enter |
|-------|----------------|
| **Damage observed** | Rooms and elements damaged (multiline) |
| **Cause of damage** | Your opinion of cause (multiline) |
| **Damage caused by listed event** | **Yes**, **No**, or **Partial** |
| **Pre-existing maintenance issues** | Tick if maintenance defects are present |
| **Pre-existing related damage** | Damage that was already there and relates to this claim |
| **Maintenance defect issues** | Describe the maintenance defects |
| **Works required to address related damage** | What must be done about related / pre-existing damage |

> **Note:** **Partial** on the listed-event field is for mixed cause (for example storm damage plus long-term leak). Explain the split in **Cause of damage**.

Write as if the estimator who prices the job will never visit. Name rooms the same way you will on the estimate.

## Make Safe

Purpose: record whether temporary works are required. This tab does **not** create the Make Safe job — the job header does.

| Field | What to enter |
|-------|----------------|
| **Make safe required (site finding)** | Tick if temporary works are needed |
| **Make safe type** | Tarp, Board Up, Temporary Fence, Other |
| **Make-safe completion date** | Date temporary works were finished (if already done) |
| **Date main roof repaired** | Date the main roof was repaired, if applicable |

After you tick make-safe required:

1. Save (wait for **Saved**).
2. Open the parent **job**.
3. Click **Create Make-Safe** (or **Go to Make-Safe**).

See [Builder Make Safe Workflow](../jobs/builder-make-safe-workflow.md).

> **Warning:** Ticking this box is a finding. It does not allocate the Make Safe job by itself.

## Temp Accommodation

Purpose: record displacement or loss of rent when occupants cannot stay.

| Field | What to enter |
|-------|----------------|
| **Temporary accommodation / loss of rent required** | **No**; **Yes, Temporary Accommodation**; or **Yes, Loss of Rent** |
| **Estimated amount** | Dollar estimate |
| **Estimated duration** | Free text (placeholder example: `14 Days`) |
| **Required immediately** | Tick if they cannot stay tonight |
| **Immediate estimate (days)** | Days of immediate accommodation |
| **Required during repairs** | Tick if they must leave while works proceed |
| **During-repairs estimate (days)** | Days during the repair programme |
| **Temporary repairs to make livable** | What would make the property occupiable again |
| **Work while in accommodation** | What will be done while they are out |

> **Note:** If the dropdown is **No**, you can leave the rest blank. If it starts with **Yes**, fill duration and whether it is immediate, during repairs, or both.

## Specialists

Purpose: flag a referral. This tab is brief — two controls.

| Field | What to enter |
|-------|----------------|
| **Specialist required** | Tick if you cannot complete findings without another discipline |
| **Specialist type** | For example engineer, hygienist, electrician — free text |

Upload any specialist PDF with an appropriate document type on the **job** (see [Assessment Reports](assessment-reports.md)). There is no specialist-report upload on this tab.

## Recommendation

Purpose: the outcome the insurer reads first. Complete this last.

| Field | What to enter |
|-------|----------------|
| **Claim recommendation** | **Approve**, **Decline**, **Refer**, or **Pending** |
| **Cost estimate for repairs** | Numeric indication (the formal price is still the estimate on `/quotes`) |
| **Estimated repair time** | Number |
| **Estimated repair duration unit** | Days, Weeks, or Months |
| **Insured has been advised** | Tick if you have told the customer your recommendation |
| **Client willing to proceed** | Tick if they want to go ahead with repairs |
| **Customer arranged repairs** | Tick if they are arranging their own trades |
| **Arranged repair comments** | Detail if they arranged their own repairs |
| **Client discussions** | What you agreed or disputed on site |
| **Special notes** | Anything that does not fit elsewhere (create-drawer **Comments** land here as special notes) |
| **Conclusion** | Short closing paragraph for the report |
| **Builder licences** | Licence numbers relevant to the recommended work |

> **Warning:** Do not leave **Claim recommendation** empty if you are about to print or submit the report. Insurer workflows treat it as required.

> **Note:** **Approve** here is your recommendation, not insurer approval of an estimate. Price the job separately on **Create Estimate**.

## Autosave

There is no Save button on the tabs.

1. Edit a field — header shows **Unsaved changes**.
2. After a short pause — **Saving…** then **Saved**.
3. On failure — an error is shown; change a field to retry.

You can move between tabs while dirty; persist still runs against the full record.

## Printing and Locking

- **Print PDF** generates the report from the assessment template. It does not lock the record by itself.
- When status becomes **published** or **archived**, every tab disables and the published banner appears.
- **Archive** in the header archives this assessment and returns you to the list.

> **Warning:** Once published, you cannot edit this assessment. Do not publish (or request publish) with an empty recommendation or unfinished Damage & Cause. For a later visit, create a **new** assessment on the same job.

Print and upload steps: [Assessment Reports](assessment-reports.md).

## Best Practices

1. **Write rooms the same way on Damage, the journal, and the estimate** so nobody has to translate “rear bed” into “Bedroom 3”.
2. **Fill Attendance before you leave the driveway** so the datetime is true.
3. **Use Habitable honestly.** An unsafe kitchen is not habitable even if bedrooms are dry.
4. **Put the insurer-facing story in Recommendation → Conclusion**, not only in chat notes.
5. **Create the Make Safe job from the job header** after you tick the site finding — the tab is not the allocation.
6. **Keep the cost on Recommendation indicative**; the published estimate is the figure that can be approved.
7. **Photos belong in Journals.** Assessment fields are for structured answers, not twenty image captions.
