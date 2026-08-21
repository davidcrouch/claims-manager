# 55g — Builder Works E2E Tests

**Depends on:** Steps 55a–55f

## Scope

End-to-end test scenarios that validate the complete Builder Works workflow from job creation to job completion, exercising the works ASL and all claims-manager event wiring.

## Test Scenarios

### Scenario 1: Happy Path (No Excess)

```
1. Create Builder Works job (collectExcess=false)
   → Verify: workflow invoked with collectExcess=false
   → Verify: "Send Scope / Contract" task created
   → Verify: "Repair Update" task created

2. Complete "Send Scope / Contract" task
   → Verify: scopeSentDate set
   → Verify: workflowPhase = awaiting_scope
   → Verify: "Signed Scope / Contract" task created

3. Complete "Signed Scope / Contract" task
   → Verify: scopeSignedDate set
   → Verify: workflowPhase = scope_signed
   → Verify: "Schedule Repairs" task created (no excess gate)

4. Set estimatedStartDate + estimatedCompletionDate
   → Verify: estimatedDatesSet auto-set
   → Verify: worksScheduledDate set
   → Verify: workflowPhase = scheduled
   → Verify: "Commence Repairs" task created

5. Complete "Commence Repairs" task
   → Verify: worksCommencementDate set
   → Verify: workflowPhase = repairs_in_progress
   → Verify: "Upload Completion Certificate" task created

6. Set workflowPhase = repairs_complete
   → Verify: worksCompletionDate set

7. Upload document with category "Completion Certificate"
   → Verify: document.uploaded event emitted
   → Verify: completionCertificateUploadDate set
   → Verify: workflowPhase = certificate_uploaded

8. Complete PO
   → Verify: purchase_order.completed event
   → Verify: workflowPhase = complete
```

### Scenario 2: Happy Path (With Excess)

```
1. Create Builder Works job (collectExcess=true, excess="500")
   → Verify: "Send Scope / Contract" task created
   → Verify: "Send Excess" task created
   → Verify: "Repair Update" task created

2. Complete "Send Scope / Contract" task
   → Verify: scopeSentDate set
   → Verify: "Signed Scope / Contract" task created

3. Complete "Send Excess" task
   → Verify: excessSentDate set
   → Verify: "Collect Excess" task created

4. Complete "Signed Scope / Contract" task
   → Verify: scopeSignedDate set
   → Verify: gate NOT yet met (excess not collected)

5. Complete "Collect Excess" task
   → Verify: excessCollectedDate set
   → Verify: gate met → "Schedule Repairs" task created

6–10. Continue as Scenario 1 steps 4–8
```

### Scenario 3: Variation During Repairs

```
1–5. Follow Scenario 1 steps 1–5

6. Publish variation quote (quoteType=variation)
   → Verify: workflow enters OnVariationSubmitted

7a. Approve variation
   → Verify: workflow returns to WaitForRepairsComplete

7b. Decline variation
   → Verify: workflow returns to WaitForRepairsComplete

8. Continue with repairs complete + certificate + PO
```

### Scenario 4: Late Variation After Certificate

```
1–7. Follow Scenario 1 steps 1–7

8. Publish variation quote after certificate
   → Verify: workflow enters OnLateVariation

9. Approve/decline → returns to WaitForPOCompletion
10. PO completed → job complete
```

### Scenario 5: Verbal Completion (No Certificate Upload)

```
1–6. Follow Scenario 1 steps 1–6

7. Set dateCustomerConfirmedCompletion
   → Verify: field.updated event
   → Verify: workflow transitions via OnVerbalConfirmation
   → Verify: workflowPhase = completion_confirmed

8. PO completed → job complete
```

### Scenario 6: Repair Update Recurrence

```
1. Verify "Repair Update" task created at workflow start
2. Complete it → verify new "Repair Update" created
3. Complete again → verify another new one created
4. Continue through workflow phases → verify Repair Update tasks keep regenerating
```

### Scenario 7: Assessment → Works Spawn (With Excess)

```
1. Create assessment job with collectExcess=true, excess="500"
2. Auto-approve assessment quote
   → Verify: works job created with collectExcess=true, excess="500"
3. Verify works workflow starts with excess branch enabled
```

## Status: Implemented

`more0-ensure/test/works-full-e2e.ts` implements scenarios 1–3 and 5 using the same in-process test harness as `assessment-full-e2e.ts` (mocked MCP tool invoker, lightweight tick-loop engine). All 4 scenarios pass.

Run: `npx tsx test/works-full-e2e.ts` from the `more0-ensure` directory.

### Bug fix during implementation

The gate accumulation logic in `asl.json` had a bug: `MarkScopeSigned` and `MarkExcessCollectedGate` read `$.excessCollected` / `$.scopeSigned` from the root context (always false from `SetupWorksJob`), so the gate could never be met when scope and excess completed in different events. Fixed by:
1. Initializing `$.gate = { scopeSigned: false, excessCollected: false }` in `SetupWorksJob`
2. Changing both Pass states to reference `$.gate.excessCollected` / `$.gate.scopeSigned` respectively

## Test Harness

Follow the pattern established in `apps/api/test-e2e-trigger.mjs` and `test/assessment-full-e2e.ts`:
- Direct-provider jobs (no Crunchwork dependency)
- Programmatic event simulation via REST API
- Workflow state verification via job customData polling

## Files

| File | Repo | Purpose |
|------|------|---------|
| `more0-ensure/test/works-full-e2e.ts` | more0-ensure | Full E2E test runner (scenarios 1–4) |
| `apps/api/test-e2e-works.mjs` | claims-manager | Optional trigger script |
