Great — this is exactly the kind of system where a **strong PRD upfront will save you months later**, especially given:

* external API dependency
* multi-tenant behaviour (via `active-tenant-id`)
* event/webhook-driven flows
* fairly rich domain (claims → jobs → quotes → POs → invoices)

I’ve reviewed your API doc and incorporated its structure (claims, jobs, appointments, invoices, purchase orders, messages, reports, attachments, webhooks, etc.) into this PRD.

---

# 📘 Product Requirements Document (PRD)

## Insurance Claims Management Application

---

# 1. 🧭 Overview

## 1.1 Purpose

Build a modern, multi-tenant insurance claims management application that integrates with a third-party REST API to manage the full lifecycle of insurance repair jobs—from claim intake through estimation, approval, procurement, and completion.

---

## 1.2 Goals

* Provide **end-to-end visibility** of claims and jobs
* Enable **contractors/vendors** to manage work efficiently
* Integrate seamlessly with insurer systems via:

  * REST API
  * Webhooks
* Deliver a **modern, fast, AI-ready UI**
* Support **multi-tenant architecture**

---

## 1.3 Tech Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | Next.js (App Router)         |
| UI       | React + Tailwind + shadcn/ui |
| Auth     | Kinde.com                    |
| Backend  | 3rd-party REST API           |
| Local DB | Supabase (Postgres)          |
| State    | React Query / Server Actions |
| Realtime | Webhooks → Supabase / queues |

---

# 2. 🏗️ System Architecture

## 2.1 High-Level Architecture

```
[ Browser (Next.js UI) ]
        ↓
[ Next.js Server / API Layer ]
        ↓
[ External Insurance REST API ]
        ↑
[ Webhooks → Ingestion Service → Supabase ]
```

---

## 2.2 Key Concepts from API

From your API:

### Core Entities

* Claim
* Job
* Appointment
* Quote
* Invoice
* Purchase Order
* Message
* Report
* Attachment 

### Key Relationships

```
Claim
  └── Jobs
        ├── Quotes
        ├── Purchase Orders
        ├── Invoices
        ├── Reports
        ├── Messages
        └── Tasks
```

### Multi-tenancy

* All API calls require:

```
active-tenant-id: UUID
```



---

## 2.3 Webhook Model (Critical)

* Events include:

  * NEW_JOB
  * NEW_QUOTE
  * NEW_REPORT
  * NEW_INVOICE 

* Security:

  * HMAC signature validation required 

👉 This implies:

* Your system is **event-driven**, not just request-driven

---

# 3. 👤 User Roles

| Role           | Description          |
| -------------- | -------------------- |
| Admin          | Full system control  |
| Claims Manager | Oversees claims/jobs |
| Assessor       | Captures site data   |
| Vendor         | Executes work        |
| Finance        | Handles invoices/POs |

---

# 4. 🧩 Core Features

---

## 4.1 Public Website

### Features

* Landing page
* Login / Register buttons
* Marketing content
* Pricing (future)

### Auth

* Kinde hosted login/signup

---

## 4.2 Authenticated App Layout

### Layout Structure

```
--------------------------------------------------
| Top Bar (Tenant, User, Notifications)         |
--------------------------------------------------
| Sidebar | Main Content                        |
|         |                                     |
| Dashboard                                     |
| Claims                                       |
| Jobs                                         |
| Quotes                                       |
| Purchase Orders                              |
| Invoices                                     |
| Reports                                      |
| Messages                                     |
--------------------------------------------------
```

---

## 4.3 Navigation Model (IMPORTANT)

### Level 1: Global Navigation

* Dashboard
* Claims
* Jobs
* Quotes
* Invoices
* Reports
* Vendors

---

### Level 2: Entity Context Navigation

When inside a Job:

```
Job Detail Page
----------------------------------
| Overview | Quotes | POs | Tasks |
| Messages | Reports | Status     |
----------------------------------
```

👉 Derived directly from API endpoints like:

* `/jobs/{id}/quotes`
* `/jobs/{id}/purchase-orders`
* `/jobs/{id}/tasks`


---

# 5. 📊 Feature Breakdown by Module

---

## 5.1 Dashboard

### Features

* Claim/job stats
* Recent activity
* Alerts (new jobs, approvals needed)
* KPI widgets

---

## 5.2 Claims Module

### Features

* List claims
* Filter/search
* View claim details
* Link to jobs

### API

* `GET /claims`
* `GET /claims/{id}` 

---

## 5.3 Jobs Module (Core)

### Features

* Job list (table)
* Job detail view
* Status updates
* Linked entities:

  * Quotes
  * POs
  * Reports
  * Messages

### API

* `POST /jobs`
* `GET /jobs/{id}`
* `POST /jobs/{id}` 

---

## 5.4 Quotes / Estimates

### Features

* Create estimate
* View estimate
* Submit for approval

### API

* `POST /quotes`
* `GET /quotes/{id}` 

---

## 5.5 Purchase Orders

### Features

* Generate from quote
* Track vendor allocation
* Status tracking

### API

* `/purchase-orders/{id}` 

---

## 5.6 Invoices

### Features

* Submit invoice
* View invoice
* Status tracking

### API

* `POST /invoices`
* `GET /invoices/{id}` 

---

## 5.7 Reports

### Features

* Assessment reports
* Completion reports

---

## 5.8 Messages

### Features

* Job-level communication
* Acknowledge messages

### API

* `/messages`
* `/messages/{id}/acknowledge` 

---

## 5.9 Attachments

### Features

* Upload photos
* Download documents

### API

* `POST /attachments`
* `GET /attachments/{id}` 

---

# 6. 🔄 Webhook Processing System

## 6.1 Flow

```
Webhook → Verify HMAC → Persist → Trigger UI update
```

## 6.2 Responsibilities

* Validate signature
* Store raw event
* Update local cache (Supabase)
* Trigger UI refresh

---

## 6.3 Event Types

* NEW_JOB
* NEW_QUOTE
* NEW_REPORT
* NEW_INVOICE 

---

# 7. 🗄️ Supabase Database (Supporting Layer)

Even though API is source of truth, DB is needed for:

### Tables

| Table            | Purpose              |
| ---------------- | -------------------- |
| tenants          | Multi-tenant mapping |
| users            | Auth mapping (Kinde) |
| claims_cache     | Cached claims        |
| jobs_cache       | Cached jobs          |
| webhook_events   | Event log            |
| attachments_meta | File metadata        |
| audit_logs       | User actions         |

---

# 8. 🔐 Authentication & Authorization

## 8.1 Auth

* Kinde OAuth (OIDC)

## 8.2 API Auth

* Client Credentials (external API)


## 8.3 Multi-tenancy

* Map user → tenant → API header

---

# 9. 🎨 UI/UX Requirements

## Design Principles

* Clean, minimal (Linear / Stripe style)
* Fast navigation
* Data-heavy tables
* Inline editing

## Components (shadcn)

* DataTable
* Tabs
* Dialogs
* Sheets (side panels)
* Command palette

---

# 10. ⚙️ Non-Functional Requirements

| Area          | Requirement              |
| ------------- | ------------------------ |
| Performance   | <200ms UI interactions   |
| Scalability   | Multi-tenant ready       |
| Security      | HMAC + OAuth             |
| Reliability   | Retry webhook processing |
| Observability | Logging + tracing        |

---

# 11. 🚀 Future Enhancements (VERY IMPORTANT FOR YOU)

This is where **More0 fits in strongly**:

### AI Capabilities

* Auto-generate estimates from photos
* Recommend vendors
* Fraud detection
* Document parsing

### Workflow Automation

* Claim → Job → Quote → Approval pipeline
* SLA tracking

### OPA (More0)

* Loan/claim approval rules
* Vendor selection rules
* Compliance validation

---

# 12. 📦 Deliverables

* Next.js frontend
* API integration layer
* Supabase schema
* Webhook ingestion service
* Deployment pipelines

---

# 13. 🧠 Key Architectural Risks

| Risk                    | Mitigation              |
| ----------------------- | ----------------------- |
| External API latency    | Caching layer           |
| Webhook ordering issues | Idempotency keys        |
| Multi-tenant bugs       | Strict tenant isolation |
| API changes             | Adapter layer           |

---

# 14. 🔥 Key Insight (Important for Architect)

This is NOT just CRUD.

It is:

> **An event-driven workflow system with UI on top**

Because:

* Jobs are created via webhooks
* State changes happen externally
* Your system mirrors + enhances

---


