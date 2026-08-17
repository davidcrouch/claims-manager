# Webhook Event Types Coverage Review

**Spec:** `docs/Insurance REST API-v17-20260304_100318.pdf` — Section 2.2.2 Event Types  
**Date:** 2026-08-17  
**Scope:** Verify all documented CW event types are covered in the codebase

---

## 1. Documented Event Types (Section 2.2.2)

| # | Mutation Name | Event Alias | Teams | Description |
|---|--------------|-------------|-------|-------------|
| 1 | `createPulseJob` | `NEW_JOB` | Insurance | Internal jobs (assessors, audit) |
| 2 | `createPulseChildJob` | `NEW_JOB` | Insurance, Vendor | External jobs allocated to vendor |
| 3 | `UpdateJob` | `UPDATE_JOB` | Insurance, Vendor | Job details/status changes |
| 4 | `createPurchaseOrder` | `NEW_PURCHASE_ORDER` | Insurance, Vendor | Create single PO |
| 5 | `createPurchaseOrders` | `NEW_PURCHASE_ORDER` | Insurance, Vendor | Create multiple POs |
| 6 | `updatePurchaseOrder` | `UPDATE_PURCHASE_ORDER` | Insurance, Vendor | PO details/status changes (excludes progress invoices) |
| 7 | `upsertPurchaseOrderTradeInvoices` | `NEW_INVOICE` | Insurance, Vendor | New progress invoices on a PO |
| 8 | `updatePurchaseOrderTradeInvoice` | `UPDATE_INVOICE` | Insurance, Vendor | Updates to existing PO invoices |
| 9 | `createMessagesMessage` | `NEW_MESSAGE` | Insurance, Vendor | Messages sent to recipient |
| 10 | `createPulseTask` | `NEW_TASK` | Insurance, Vendor | Tasks allocated to recipient |
| 11 | `updatePulseTask` | `UPDATE_TASK` | Insurance, Vendor | Task updates |
| 12 | _(unnamed)_ | `NEW_ATTACHMENT` | Vendor | Attachment creation |
| 13 | _(unnamed)_ | `UPDATE_ATTACHMENT` | Vendor | Attachment updates |

Section 2.2.1 also references `NEW_QUOTE` and `NEW_REPORT` as example alias values in the contract table, implying they are valid event types even without explicit rows in 2.2.2.

---

## 2. Code Coverage Summary

### 2.1 Event Type Resolver (`EVENT_TYPE_TO_ENTITY`)

**Files:**
- `apps/api/src/modules/webhooks/event-type-resolver.ts`
- `apps/provider/src/modules/webhooks/event-type-resolver.ts`

| Event Alias | Resolved Entity | In PDF 2.2.2? | Status |
|-------------|-----------------|---------------|--------|
| `NEW_JOB` | `job` | Yes | **Covered** |
| `UPDATE_JOB` | `job` | Yes | **Covered** |
| `NEW_CLAIM` | `claim` | No | Extra (see §3.2) |
| `UPDATE_CLAIM` | `claim` | No | Extra (see §3.2) |
| `NEW_PURCHASE_ORDER` | `purchase_order` | Yes | **Covered** |
| `UPDATE_PURCHASE_ORDER` | `purchase_order` | Yes | **Covered** |
| `NEW_INVOICE` | `invoice` | Yes | **Covered** |
| `UPDATE_INVOICE` | `invoice` | Yes | **Covered** |
| `NEW_MESSAGE` | `message` | Yes | **Covered** |
| `NEW_TASK` | `task` | Yes | **Covered** |
| `UPDATE_TASK` | `task` | Yes | **Covered** |
| `NEW_ATTACHMENT` | `attachment` | Yes | **Covered** |
| `UPDATE_ATTACHMENT` | `attachment` | Yes | **Covered** |
| `NEW_QUOTE` | `quote` | Implied (2.2.1) | **Covered** |
| `UPDATE_QUOTE` | `quote` | No | Extra (see §3.3) |
| `NEW_REPORT` | `report` | Implied (2.2.1) | **Covered** |
| `UPDATE_REPORT` | `report` | No | Extra (see §3.3) |
| `NEW_APPOINTMENT` | `appointment` | No | Extra (see §3.3) |
| `UPDATE_APPOINTMENT` | `appointment` | No | Extra (see §3.3) |

### 2.2 Full Pipeline Verification

Each resolved entity type has all three pipeline layers:

| Entity Type | CW Fetch Method | Mapper (fallback) | Domain Use Case (preferred) |
|-------------|-----------------|-------------------|----------------------------|
| `job` | `getJob` | `CrunchworkJobMapper` | `ProjectJobUseCase` |
| `claim` | `getClaim` | `CrunchworkClaimMapper` | `ProjectClaimUseCase` |
| `purchase_order` | `getPurchaseOrder` | `CrunchworkPurchaseOrderMapper` | `ProjectPurchaseOrderUseCase` |
| `invoice` | `getInvoice` | `CrunchworkInvoiceMapper` | `ProjectInvoiceUseCase` |
| `message` | `getMessage` | `CrunchworkMessageMapper` | `ProjectMessageUseCase` |
| `task` | `getTask` | `CrunchworkTaskMapper` | `ProjectTaskUseCase` |
| `attachment` | `getAttachment` | `CrunchworkAttachmentMapper` | `ProjectAttachmentUseCase` |
| `quote` | `getQuote` | `CrunchworkQuoteMapper` | `ProjectQuoteUseCase` |
| `report` | `getReport` | `CrunchworkReportMapper` | `ProjectReportUseCase` |
| `appointment` | `getAppointment` | `CrunchworkAppointmentMapper` | `ProjectAppointmentUseCase` |

> **Note:** `InProcessProjectionService` tries the domain use case first; mappers only run if no use case is registered for that entity type. Both registries currently cover all 10 types, so mappers are effectively a fallback safety net.

---

## 3. Findings

### 3.1 Gaps — Documented but Missing/Weak

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| G-1 | **No mutation-name awareness** | Low | The code routes purely on the alias (`NEW_JOB`, etc.). It cannot distinguish `createPulseJob` (internal) from `createPulseChildJob` (external), nor `createPurchaseOrder` (single) from `createPurchaseOrders` (batch). If CW sends the mutation name instead of — or alongside — the alias, it would be silently dropped. |
| G-2 | **No `UPDATE_MESSAGE` handling** | Low | The code does not define `UPDATE_MESSAGE`. The PDF also omits it, so no gap vs. spec, but messages are the only entity without an UPDATE alias. |
| G-3 | **Invoice PO-context not enforced** | Medium | The spec distinguishes `upsertPurchaseOrderTradeInvoices` (new progress invoices on a PO) from standalone invoices. The code treats all `NEW_INVOICE` identically — it fetches by invoice ID with no knowledge of which PO triggered it. If the invoice mapper requires the parent PO context to build correct relationships, this is a gap. |
| G-4 | **Webhook sweep service not implemented** | Medium | `docs/implementation/27b_WEBHOOK_SWEEP_SERVICE.md` describes a sweep mechanism for catching missed events. No runtime code exists — only retry service with exponential backoff for parent-not-found errors. |
| G-5 | **Team/recipient filtering absent** | Low | The spec states `NEW_TASK` fires "only for tasks allocated to the recipient" and `NEW_MESSAGE` only for "messages sent to the recipient." The pipeline ingests all events without filtering by team membership or recipient scope. This is likely correct (our system is the recipient), but no validation exists. |

### 3.2 Extra — In Code but Not in Section 2.2.2

| Event | Rationale | Risk |
|-------|-----------|------|
| `NEW_CLAIM` / `UPDATE_CLAIM` | CW does **not** emit standalone claim webhooks (confirmed in `NestedEntityExtractor` — claims arrive nested inside job payloads). These aliases exist as defensive entries. | None — they will never fire; the extractor handles claim projection from job payloads. |

### 3.3 Extra — In Code, Implied by Spec but No Formal Row

| Event | Rationale | Risk |
|-------|-----------|------|
| `NEW_QUOTE` / `UPDATE_QUOTE` | Referenced in 2.2.1 contract example. Likely a Phase 2 event (quote endpoints are documented in Phase 2). | Low — mapped and projected; may not fire yet from CW. |
| `NEW_REPORT` / `UPDATE_REPORT` | Referenced in 2.2.1 contract example. Same Phase 2 reasoning. | Low |
| `NEW_APPOINTMENT` / `UPDATE_APPOINTMENT` | Not referenced anywhere in the PDF event sections. Appointment endpoints are documented in Phase 1/Phase 3. | Low — proactive future-proofing. If CW starts sending these, the system handles them. |

### 3.4 Architecture Observations

| # | Observation | Impact |
|---|-------------|--------|
| A-1 | **Generic routing — no per-event-type handlers** | The design is intentionally flat: event alias → entity type → fetch → project. This is clean but means event-specific business rules (e.g., "PO update should NOT include progress invoice changes") must be enforced inside mappers, not at the routing layer. |
| A-2 | **Provider server cannot run in-process projection** | If More0 is unavailable, events on the provider path stay `pending` indefinitely. Documented in pipeline docs but remains a single point of failure. |
| A-3 | **Duplicate resolver code** | `event-type-resolver.ts` is copy-pasted between `apps/api` and `apps/provider` with no shared package. Drift risk if one is updated without the other. |
| A-4 | **Unknown events silently dropped** | If CW sends a new event type not in `EVENT_TYPE_TO_ENTITY`, the event is logged and skipped. No alerting or dead-letter mechanism. |
| A-5 | **Frontend webhook route is a stub** | `apps/frontend/src/app/api/webhook/route.ts` logs and returns `{ received: true }`. Not part of the production pipeline. |

---

## 4. Coverage Verdict

| Category | Count | Assessment |
|----------|-------|------------|
| Spec event aliases (2.2.2 table) | 13 | **All 13 covered** in resolver, fetch, mapper, and use-case layers |
| Implied event aliases (2.2.1 examples) | 2 (`NEW_QUOTE`, `NEW_REPORT`) | **Covered** |
| Extra defensive aliases in code | 7 (`*_CLAIM`, `UPDATE_QUOTE`, `UPDATE_REPORT`, `*_APPOINTMENT`) | Present and harmless |
| Mutation-name routing | 0/13 | **Not implemented** (routes on alias only) |

**Overall: All documented event type aliases from Section 2.2.2 are handled end-to-end.** The pipeline resolves the event alias → entity type → CW REST fetch → internal projection for every type listed in the spec.

---

## 5. Recommendations

| Priority | Action |
|----------|--------|
| **P1** | Validate that `NEW_INVOICE` / `UPDATE_INVOICE` events carry enough context to identify the parent PO when they originate from `upsertPurchaseOrderTradeInvoices`. If the invoice entity returned by `GET /invoices/{id}` already contains PO linkage, no change needed. Otherwise, consider enriching the invoice mapper with PO context from the webhook payload. |
| **P2** | Add monitoring/alerting for unknown event types landing in the webhook ingestion table. Currently these are logged but could be missed in high-volume environments. |
| **P2** | Extract `event-type-resolver.ts` into a shared package (or use a single source in the monorepo) to prevent drift between `apps/api` and `apps/provider`. |
| **P3** | Document the decision on mutation-name-level differentiation. If `createPulseJob` vs `createPulseChildJob` distinction is important (internal vs external jobs), the resolver could map both mutation names to additional metadata (e.g., `{ entityType: 'job', isExternal: true }`). |
| **P3** | Consider implementing the webhook sweep service from doc 27b as a background cron to catch missed/dropped events, especially during More0 outages. |
| **P3** | Verify with CW whether `NEW_APPOINTMENT` / `UPDATE_APPOINTMENT` webhooks will be emitted (not listed in spec 2.2.2). If not, the resolver entries are harmless forward-compatibility. |

---

## 6. File References

| Layer | Key Files |
|-------|-----------|
| Event resolver | `apps/api/src/modules/webhooks/event-type-resolver.ts`, `apps/provider/src/modules/webhooks/event-type-resolver.ts` |
| Webhook controllers | `apps/provider/src/modules/webhooks/webhooks.controller.ts`, `apps/api/src/modules/webhooks/webhooks.controller.ts` |
| Orchestrator | `apps/api/src/modules/webhooks/webhook-orchestrator.service.ts` |
| CW fetch | `apps/api/src/crunchwork/crunchwork.service.ts` (ENTITY_FETCH_MAP) |
| Entity mappers | `apps/api/src/modules/external/mappers/crunchwork-*.mapper.ts` (10 files) |
| Domain use cases | `apps/api/src/modules/domain/use-cases/project-*.use-case.ts` (10 files) |
| Nested entity extraction | `apps/api/src/modules/external/nested-entity-extractor.service.ts` |
| More0 workflow | `apps/api/more0/definitions/workflows/process-inbound-event/asl.json` |
| CF proxy | `workers/crunchwork-webhook-proxy/src/index.ts` |
