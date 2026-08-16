# 50 — RFQ Send Requests: Multi-Recipient Email Dispatch

**Phase:** 4  
**Dependencies:** Document generation pipeline (existing), Contacts module (existing), Resend email infrastructure (auth-server pattern)  
**Accent colour:** Violet (inherits from RFQ)

---

## 0. Purpose

Enable users to send an RFQ (Request for Quotation) PDF to multiple vendor/sub-contractor recipients via email directly from the RFQ detail page. This replaces the manual workflow of generating a PDF, opening an email client, and sending individually.

The feature introduces:
1. A **Communications module** in the API — a reusable email-sending service leveraging Resend (same provider as auth-server)
2. A **"Requests" tab** on the RFQ detail page showing send history
3. A **multi-step wizard drawer** for selecting recipients, previewing the PDF, customising the email, and dispatching

---

## 1. Data Model

### 1.1 New Table: `rfq_send_requests`

Represents a single "send batch" — one user action that sends the RFQ to N recipients.

```sql
CREATE TABLE rfq_send_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES organizations(id),
  rfq_id          UUID NOT NULL REFERENCES rfqs(id),
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | partial | success | failed
  initiated_by    TEXT,                              -- user ID who triggered the send
  generated_doc_id UUID,                            -- FK to generated_documents (the PDF used)
  email_subject   TEXT NOT NULL,
  email_body_html TEXT NOT NULL,
  email_body_text TEXT,
  reply_to        TEXT,                              -- reply-to address used
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_send_requests_rfq ON rfq_send_requests(tenant_id, rfq_id);
```

### 1.2 New Table: `rfq_send_recipients`

Per-recipient delivery tracking within a batch.

```sql
CREATE TABLE rfq_send_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_request_id UUID NOT NULL REFERENCES rfq_send_requests(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  recipient_name  TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  error_message   TEXT,
  resend_message_id TEXT,                           -- Resend API response ID
  sent_at         TIMESTAMPTZ,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_send_recipients_request ON rfq_send_recipients(send_request_id);
```

### 1.3 Migration

File: `apps/api/src/database/migrations-drizzle/0062_rfq_send_requests.sql`

---

## 2. Backend: Communications Module

### 2.1 Module Structure

```
apps/api/src/modules/communications/
├── communications.module.ts
├── communications.service.ts        -- Orchestrates email sending
├── email/
│   ├── email.service.ts             -- Provider-agnostic send interface
│   ├── providers/
│   │   ├── resend.provider.ts       -- Resend SDK (with attachments)
│   │   ├── smtp.provider.ts         -- Nodemailer fallback
│   │   └── console.provider.ts      -- Dev/test logger
│   └── email.types.ts               -- SendEmailParams, SendEmailResult
├── templates/
│   ├── email-template.service.ts    -- Resolves email templates from DB
│   └── default-rfq-email.ts         -- Fallback HTML/text template
└── communications.controller.ts     -- Admin endpoints for email settings
```

### 2.2 Email Service Interface

```typescript
interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  tags?: Array<{ name: string; value: string }>;
}

interface SendEmailResult {
  id?: string;
  provider: 'resend' | 'smtp' | 'console';
  success: boolean;
  error?: string;
}
```

### 2.3 Configuration

- Reuses same env vars as auth-server: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SMTP_*`
- New org-level settings (stored in `organization_settings` JSONB):
  - `communications.defaultReplyTo` — org-level reply-to override (falls back to user's email)
  - `communications.defaultFromName` — display name for outbound email
  - `communications.rfqEmailTemplateId` — references a configurable email template

### 2.4 Email Template Storage

Extend the existing `document_templates` or create a parallel `email_templates` table:

```sql
CREATE TABLE email_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES organizations(id),
  template_type   TEXT NOT NULL,          -- 'rfq_send', 'po_send', etc.
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  body_text       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_type)
);
```

Default RFQ email template merge fields: `{{rfq_number}}`, `{{rfq_name}}`, `{{recipient_name}}`, `{{sender_name}}`, `{{company_name}}`, `{{due_date}}`, `{{reply_to_email}}`.

---

## 3. Backend: RFQ Send Requests Module

### 3.1 Module Structure

```
apps/api/src/modules/rfq-requests/
├── rfq-requests.module.ts
├── rfq-requests.controller.ts
├── rfq-requests.service.ts
└── rfq-requests.types.ts
```

### 3.2 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/rfqs/:rfqId/send-requests` | List all send batches for an RFQ |
| `GET` | `/rfqs/:rfqId/send-requests/:id` | Get batch detail (with per-recipient status) |
| `POST` | `/rfqs/:rfqId/send-requests` | Create and dispatch a new send batch |
| `POST` | `/rfqs/:rfqId/send-requests/:id/retry` | Retry failed recipients (with optional email overrides) |

### 3.3 Send Flow (Service)

```
POST /rfqs/:rfqId/send-requests
Body: {
  recipients: [{ contactId, email? }],     // email override optional
  generatedDocumentId: string,             // PDF already generated by frontend
  emailSubject?: string,                   // override template subject
  emailBodyHtml?: string,                  // override template body
}
```

1. Validate RFQ exists and belongs to tenant
2. Resolve email template (admin-configured or default)
3. Fetch the generated PDF from GCS (via `generatedDocumentId`) — PDF was generated for preview **without** filing to a job folder
4. Create `rfq_send_requests` row with `status: pending`
5. Create `rfq_send_recipients` rows for each recipient
6. **Save PDF to job folder (on Send only, best-effort)** — resolve the job project filesystem + preferred category (project artifact-export default slug, else a "Reports"-like category). Call `DocumentsService.createFromBuffer()`. If no job / filesystem / category is configured (settings may still be stubs), **log and skip** — do not fail the send
7. Return the batch record immediately (HTTP 201)
8. **Background (`setImmediate`)**: For each recipient:
   a. Merge template with recipient-specific fields
   b. Call `EmailService.send()` with PDF attachment
   c. Update `rfq_send_recipients.status` to `sent` or `failed`
   d. After all recipients processed, update batch `status` to `success` | `partial` | `failed`

### 3.4 Retry Flow

```
POST /rfqs/:rfqId/send-requests/:id/retry
Body: {
  recipients: [{ recipientId, email? }]    // optional new email address
}
```

1. Load failed recipients from the batch
2. Update email if override provided
3. Re-attempt sending to each
4. Update statuses

---

## 4. Frontend: Requests Tab

### 4.1 Tab Addition

Add to `RfqDetail.tsx` tab array:

```typescript
{ id: 'requests', label: 'Requests', icon: Send }
```

Position: after "Proposals", before "Activities".

### 4.2 Requests List View

| Element | Description |
|---------|-------------|
| "Send Request" button | Top-right of tab content; opens wizard drawer |
| Request cards/rows | Each send batch as a row |
| Recipients display | Chip/tag style, truncated to 2 lines with "+N more" overflow |
| Status badge | `success` (green), `partial` (amber), `failed` (red), `pending` (gray spinner) |
| Click action | Opens batch detail (per-recipient breakdown) |

### 4.3 Batch Detail View (Expanded/Modal)

When a batch with failures is clicked:

| Column | Description |
|--------|-------------|
| Recipient name | Contact name |
| Email | Email address sent to |
| Status | Sent / Failed badge |
| Error | Error message (if failed) |
| Action | "Retry" button + optional email edit field |

---

## 5. Frontend: Send Request Wizard Drawer

Multi-step drawer using `BottomFormDrawer` pattern. Three steps with forward/back navigation.

### 5.1 Step 1: Select Recipients

- Reuses `JobContactsPicker` component (same as Job Parties → Add Contact)
- Shows type-ahead search of contacts
- "Create New Contact" button opens nested `ContactFormDrawer`
- Selected contacts displayed as removable chips
- Must select at least one recipient with a valid email
- **On drawer open**: Immediately triggers background PDF generation via `POST /api/generated-documents/generate` with `documentType: 'rfq'` and **no** `destinationCategoryId`. The PDF stays in generated-documents storage for preview/attachment only — it is **not** filed into the job folder until the user clicks Send.

### 5.2 Step 2: Preview PDF

- Polls `/api/generated-documents/:id` for completion (reuses `generateAndDownloadDocument` polling pattern)
- Once ready, displays PDF inline via `<iframe>` or `<embed>` pointing to presigned URL
- Loading state while PDF generates (spinner + "Generating RFQ document...")
- If generation fails: show error + "Retry" button to re-trigger
- "Next" button enabled only when PDF is `completed`

### 5.3 Step 3: Email Preview

- Displays the email template rendered with merge fields:
  - Subject line (editable input)
  - Body (rich-text preview, read-only unless admin template allows editing)
  - From / Reply-to display
  - Attachment indicator (shows PDF filename)
  - Recipient list summary
- "Submit" button dispatches `POST /rfqs/:rfqId/send-requests`

### 5.4 Submit Behaviour

- Calls API to create the send batch
- Shows toast: "Sending RFQ to N recipients..."
- Closes drawer immediately
- Requests tab auto-refreshes to show the new pending batch
- Batch status transitions from `pending` → `success`/`partial`/`failed` (polled or via page refresh)

---

## 6. Admin Configuration

### 6.1 Email Settings (Organisation Settings)

Under Admin → Settings (or a new "Communications" section):

| Setting | Description | Default |
|---------|-------------|---------|
| Default reply-to email | Where recipients reply | User's email |
| Default from name | Display name on outbound | Organisation name |
| RFQ email template | Configurable subject + body | System default |

### 6.2 Email Template Editor

In Admin → Document Templates (extend existing template management):

- New template type: "Email — RFQ Send"
- Subject field (text, supports merge tags)
- Body field (rich text / HTML editor, supports merge tags)
- Available merge tags listed in sidebar: `{{rfq_number}}`, `{{recipient_name}}`, `{{sender_name}}`, `{{company_name}}`, `{{due_date}}`, `{{reply_to_email}}`
- Preview button renders with sample data

---

## 7. Detailed Implementation Sequence

### Phase A: Infrastructure (Backend)

| # | Task | Files |
|---|------|-------|
| A1 | Create DB migration for `rfq_send_requests` + `rfq_send_recipients` + `email_templates` | `migrations-drizzle/0062_rfq_send_requests.sql` |
| A2 | Add Drizzle schema definitions | `database/schema/rfq-send-requests.ts`, `database/schema/email-templates.ts` |
| A3 | Create repositories | `database/repositories/rfq-send-requests.repository.ts`, `database/repositories/email-templates.repository.ts` |
| A4 | Create Communications module with EmailService (Resend provider + attachments) | `modules/communications/` |
| A5 | Create email template service with default RFQ template | `modules/communications/templates/` |
| A6 | Add `RESEND_API_KEY` / `EMAIL_PROVIDER` to API server env config | `config/`, `.env.example` |

### Phase B: RFQ Send Requests (Backend)

| # | Task | Files |
|---|------|-------|
| B1 | Create RfqRequests module, controller, service | `modules/rfq-requests/` |
| B2 | Implement `POST /rfqs/:rfqId/send-requests` — batch creation + async dispatch | `rfq-requests.service.ts` |
| B3 | Implement `GET /rfqs/:rfqId/send-requests` — list batches | `rfq-requests.controller.ts` |
| B4 | Implement `GET /rfqs/:rfqId/send-requests/:id` — batch detail with recipients | `rfq-requests.controller.ts` |
| B5 | Implement `POST /rfqs/:rfqId/send-requests/:id/retry` — retry failed | `rfq-requests.service.ts` |
| B6 | Wire into `RfqsModule` imports | `rfqs.module.ts` |

### Phase C: Frontend — Requests Tab

| # | Task | Files |
|---|------|-------|
| C1 | Add API client methods: `listRfqSendRequests`, `getRfqSendRequest`, `createRfqSendRequest`, `retryRfqSendRequest` | `lib/api-client.ts` |
| C2 | Add Next.js API proxy routes | `app/api/rfqs/[rfqId]/send-requests/` |
| C3 | Add server actions for RFQ send requests | `app/(app)/rfqs/[id]/actions.ts` |
| C4 | Create `RequestsTab` component with batch list | `components/rfqs/RequestsTab.tsx` |
| C5 | Create `RequestBatchDetail` component (per-recipient view + retry) | `components/rfqs/RequestBatchDetail.tsx` |
| C6 | Add "Requests" tab to `RfqDetail.tsx` tab array | `components/rfqs/RfqDetail.tsx` |

### Phase D: Frontend — Send Request Wizard

| # | Task | Files |
|---|------|-------|
| D1 | Create `SendRfqRequestDrawer` shell (3-step state machine) | `components/rfqs/SendRfqRequestDrawer.tsx` |
| D2 | Step 1: Recipient picker (reuse `JobContactsPicker` + `ContactFormDrawer`) | Same file or extracted |
| D3 | Step 2: PDF preview (trigger generation on open, poll, display iframe) | Same file |
| D4 | Step 3: Email preview (template rendering, subject display, submit) | Same file |
| D5 | Wire "Send Request" button in `RequestsTab` → opens wizard | `RequestsTab.tsx` |
| D6 | Handle submit: call API, toast, close, refresh tab | `SendRfqRequestDrawer.tsx` |

### Phase E: Admin UI

| # | Task | Files |
|---|------|-------|
| E1 | Add email template CRUD endpoints to Communications controller | `communications.controller.ts` |
| E2 | Add Admin → Communications settings page (reply-to, from name) | `app/(app)/admin/communications/` |
| E3 | Add email template editor (subject + body + merge tags) | `components/admin/EmailTemplateEditor.tsx` |

---

## 8. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RFQ Detail Page                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  [Requests Tab]                                             │    │
│  │  ┌───────────────────┐                                     │    │
│  │  │ [Send Request] btn │ ──→ Opens SendRfqRequestDrawer      │    │
│  │  └───────────────────┘                                     │    │
│  │                                                             │    │
│  │  ┌─── Batch List ─────────────────────────────────────┐    │    │
│  │  │  📨 3 recipients  ✅ Success     12 Aug 2026       │    │    │
│  │  │  📨 2 recipients  ⚠️ Partial     10 Aug 2026       │ ←click  │
│  │  └────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─── SendRfqRequestDrawer ─────────────────────────────────────────────┐
│                                                                       │
│  Step 1: Recipients          Step 2: PDF Preview     Step 3: Email    │
│  ┌──────────────────┐       ┌──────────────────┐   ┌──────────────┐  │
│  │ [Search contacts]│       │ ┌──────────────┐ │   │ Subject: ... │  │
│  │ + Create new     │       │ │   PDF        │ │   │ Body: ...    │  │
│  │                  │       │ │  iframe      │ │   │ Reply-to:... │  │
│  │ [Alice] [Bob] ×  │  →    │ │  preview     │ │ → │ Attach: ✓   │  │
│  │ [Charlie] ×      │       │ │              │ │   │              │  │
│  └──────────────────┘       │ └──────────────┘ │   │ [Submit]     │  │
│                             └──────────────────┘   └──────────────┘  │
│  ← Back    [Next →]          ← Back   [Next →]     ← Back  [Send]   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 9. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| No email on selected contact | Validation error on Step 1 — "Email required for all recipients" |
| PDF generation fails | Step 2 shows error with "Retry" button; user cannot proceed |
| PDF generation times out (>3 min) | Show timeout message; allow "Retry" |
| Email send fails for some recipients | Batch marked `partial`; failed recipients shown with error + retry |
| Email send fails for all | Batch marked `failed` |
| User closes drawer mid-generation | Generation continues in background; batch not created (no side effects) |
| RFQ has no scope items | Allow send but warn: "This RFQ has no scope items. Continue anyway?" |
| Resend API key not configured | `POST send-requests` returns 503 with helpful message; UI shows configuration prompt |
| Retry with alternate email | Updates `rfq_send_recipients.recipient_email` before re-sending |

---

## 10. Security & Permissions

- Send requests require authenticated user with RFQ write permission
- Email templates editable only by Admin role
- Reply-to address restricted to verified domains (Resend requirement) or user's org email
- PDF attachment served from existing GCS presigned URLs (short-lived)
- Rate limiting: max 50 recipients per batch, max 10 batches per RFQ per hour

---

## 11. Future Extensions

- **Generalised document send**: Same pattern for PO, Invoice, Quote sends (Communications module is reusable)
- **Email tracking**: Resend webhooks for delivery/open/bounce status
- **Communications tab**: Wire the existing stub tab to show all email comms for the RFQ
- **SMS notifications**: Communications module designed to support SMS channel via additional provider
- **Scheduled send**: Add `scheduledAt` to batch for delayed dispatch
