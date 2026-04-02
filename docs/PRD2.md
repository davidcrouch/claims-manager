
# Context Prompt: Claims-Manager System Design

You are designing a **multi-tenant web application** for property insurance builders. The system is called **claims-manager**.

The purpose of this document is to explain the required system design in full, assuming no prior knowledge of the business, the integrations, or the database model.

## 1. What this system is

Claims-manager is a web-based operational platform used by a **builder** who performs repair work for **property insurance claims**.

The system serves **two major purposes** at the same time:

### Purpose A: Builder ERP / operational system

Claims-manager is the builder’s internal business system for managing operational work such as:

* insurance claims
* repair jobs
* quotes
* purchase orders
* tasks
* messages
* reports
* attachments
* scheduling and workflow state
* insurer and customer interactions

This means claims-manager is not just an integration layer. It is the **builder’s primary operational application**.

### Purpose B: External gateway / integration layer

Claims-manager also acts as the gateway between:

* external insurer-side systems, and
* the builder’s internal operational system

The first external provider to support is **Crunchwork**, but the system must be designed so that **additional providers / insurers can be added later** without redesigning the database from scratch.

---

## 2. High-level technology stack

The intended stack is:

* **Frontend:** Next.js
* **Backend API:** NestJS
* **Database:** PostgreSQL
* **Workflow / orchestration:** More0
* **File storage:** Amazon S3

The database design must support this stack and must be suitable for:

* API-first backend development
* workflow-driven orchestration
* auditability
* multi-tenant support
* provider-specific integration logic
* future expansion to more insurers/providers

---

## 3. Key domain concept that drives the design

The most important design principle is:

> The builder’s internal business model is not the same as any external provider’s model.

This means an external provider such as Crunchwork may represent work one way, but claims-manager may need to represent it differently.

### Example

A single job in Crunchwork might need to map to:

* one job in claims-manager, or
* two separate jobs in claims-manager, or
* one parent job with multiple child jobs in claims-manager

Therefore:

* the external model must be stored faithfully
* the internal model must be designed for the builder’s real operational needs
* mappings between external and internal records must support **1:1, 1:many, many:1, and many:many** relationships where needed

This is one of the most important reasons not to collapse everything into one shared table model.

---

## 4. Design philosophy

The system should be split into **two distinct data layers**:

### Layer 1: Internal normalized operational layer

This is the builder-facing system of record for business operations.

It contains normalized business tables such as:

* claims
* jobs
* tasks
* messages
* quotes
* purchase orders
* reports
* attachments
* workflow state

This layer should reflect **how the builder wants to operate**, not how any external insurer/provider happens to structure its API.

### Layer 2: External integration layer

This stores:

* external webhook receipts
* external provider object identities
* raw external payloads
* fetch/sync state
* history of external objects
* links between external records and internal records

This layer exists to:

* preserve exact provider data
* support auditability
* support replay/reprocessing
* support multiple providers
* decouple provider schemas from the builder’s internal schema

---

## 5. Critical design rule

Do **not** create a complete duplicated business schema per provider.

Do **not** create long-term architecture like:

* `crunchwork_claims`
* `crunchwork_jobs`
* `insurer2_claims`
* `insurer2_jobs`

for every entity and provider as the main model.

That approach causes:

* schema redundancy
* repeated sync logic
* provider lock-in
* difficult reporting
* difficult multi-provider support
* painful migrations later

Instead, use:

1. a **single internal normalized business model**
2. a **single generic external integration model**
3. explicit **mapping/link tables** between external and internal objects

---

## 6. Internal normalized operational model

The following internal entities should exist as the builder’s normalized business layer.

These are not provider-specific. These are the entities claims-manager uses to run the business.

## 6.1 Core internal entities

### claims

Represents the overall insurance claim context being managed by the builder.

Typical examples of data:

* internal claim ID
* tenant ID
* insurer ID
* policyholder/customer
* property/site address
* claim reference numbers
* claim status
* loss date
* event type / claim type
* assigned staff
* important dates
* summary notes
* internal workflow status

A claim is the business case/context within which work is performed.

### jobs

Represents operational work packages or work units performed by the builder.

A claim may have:

* one job
* multiple jobs
* parent/child jobs
* split jobs for different workstreams

Examples:

* make-safe work
* demolition
* restoration
* electrical
* plumbing
* supervisor inspection
* variations / supplemental work

A job should be an internal operational entity, not just a copy of an external provider’s job object.

Typical data:

* internal job ID
* claim ID
* parent job ID nullable
* job type
* operational status
* priority
* assigned team
* assigned staff
* scheduling fields
* workflow state
* cost tracking / status
* location / site context

### tasks

Represents actionable units of work.
Tasks may belong to:

* a claim
* a job
* a quote
* a purchase order
* a workflow stage

Typical data:

* task title
* task description
* task type
* due date
* assignee
* priority
* status
* completion date
* source / manually created / workflow generated

### quotes

Represents estimates or pricing proposals.

A quote may be:

* received from an external system
* produced internally
* revised multiple times
* associated with a claim or a job

Typical data:

* quote number/reference
* job ID / claim ID
* quote status
* amount fields
* approval state
* approval dates
* notes
* revision number

### purchase_orders

Represents purchasing activity for materials, subcontractors, or services.

Typical data:

* PO number
* supplier/subcontractor
* related claim/job
* status
* amount
* issue date
* approval fields
* external references

### messages

Represents structured communication items.

These may originate from:

* provider systems
* insurer communications
* internal users
* workflow-generated actions

Typical data:

* subject
* body
* message direction
* sender
* recipients
* related claim/job
* timestamps
* read/unread / processed state

### reports

Represents assessment reports, site reports, progress reports, completion reports, and similar documents.

Typical data:

* report type
* related claim/job
* created by
* status
* generation date
* submission date
* content or file reference
* summary fields

### attachments

Represents files associated with claims, jobs, quotes, reports, messages, etc.

Files themselves should live in S3. The database stores metadata.

Typical data:

* attachment ID
* file key/path in S3
* file name
* MIME type
* file size
* related entity type/id
* uploaded by
* source type
* provider reference if external
* created timestamp

### contacts / parties

Represents people or organizations involved in the claim/job ecosystem.

Examples:

* insurer
* assessor
* customer / policyholder
* tenant
* site contact
* subcontractor
* supplier
* internal staff

### workflow / orchestration entities

Since More0 is used for workflow/orchestration, there should be internal tables or references that track:

* workflow instance IDs
* related claim/job IDs
* stage/state
* pending actions
* escalations
* workflow audit references

The exact structure may vary depending on More0 integration strategy, but the internal model must allow internal business entities to be linked to orchestration state.

---

## 6.2 Internal modeling rules

### Internal tables should represent builder operations

Do not let provider naming dictate internal schema design.

### Internal IDs are authoritative

Every internal business record must have its own internal ID.

### Internal statuses are independent

Claims-manager should define its own workflow statuses and business states.
External statuses should not directly control internal statuses without explicit mapping rules.

### Support hierarchical jobs

Because one external object may become multiple operational work packages internally, jobs should support parent/child or split relationships.

### Avoid provider-specific nullable columns in core tables

Do not fill the main business tables with many provider-only columns.
Use extension patterns for provider-specific values.

---

## 6.3 Internal extensibility for proprietary fields

Because claims-manager may need proprietary or builder-specific columns that external providers do not have, there should be an extensibility strategy.

Possible patterns:

* JSONB extension columns on key internal tables
* separate `entity_attributes` or `custom_fields` tables
* typed extension tables for performance-critical proprietary fields

Recommended principle:

* put frequently-used, stable business fields into normal typed columns
* put provider-specific or rarely queried fields into extension storage

---

## 7. External integration model

This layer stores all provider-facing data in a generic, provider-agnostic way.

The external model must support:

* multiple providers
* webhooks
* polling/fetching full external objects
* raw payload storage
* history/versioning
* replay
* mapping to internal objects

This layer should not assume Crunchwork is the only provider, even though Crunchwork is the first one being implemented.

## 7.1 Core external entities

### integration_provider

Represents the kind of provider/integration.

Examples:

* Crunchwork
* Provider B
* Provider C

This table defines the provider type.

Typical fields:

* provider ID
* provider code
* provider name
* active flag
* metadata/configuration

### integration_connection

Represents one configured connection between claims-manager and one provider context for a tenant.

Examples:

* Tenant A’s Crunchwork connection
* Tenant B’s Crunchwork connection
* Tenant A’s future insurer-provider connection

Typical fields:

* connection ID
* tenant ID
* provider ID
* environment
* provider credentials/config
* provider tenant/client identifiers
* base URL
* auth configuration
* active flag

This table isolates provider credentials and tenancy-specific configuration.

### external_event

Represents an incoming external event, usually from a webhook.

This table stores:

* the exact raw event received
* provider event identifiers
* provider event type
* provider entity ID referenced by the event
* verification result
* processing state

This is the first persisted record when a webhook is received.

### external_event_attempt

Represents processing attempts for an external event.

This supports:

* retries
* audit history
* worker tracking
* failure diagnostics

### external_object

Represents the latest known state of an object fetched from an external provider.

Examples of external objects:

* external claim
* external job
* external quote
* external purchase order
* external message
* external task
* external report
* external attachment

This table stores the latest version of the external object, including:

* provider ID
* connection ID
* provider entity type
* provider entity ID
* normalized external object type
* latest payload JSON
* fetch status
* timestamps
* hash/checksum

### external_object_version

Represents historical versions/snapshots of an external object.

Used for:

* audit trail
* replay
* troubleshooting
* comparing changes over time
* remapping after new rules are introduced

### external_sync_job

Represents work queued to fetch, refresh, or reconcile external data.

Examples:

* fetch full object after webhook receipt
* retry failed fetch
* scheduled refresh
* backfill sync

### external_link

Represents mapping between external objects and internal objects.

This table is extremely important.

It allows:

* one external object to link to multiple internal objects
* multiple external objects to link to one internal object
* link roles such as “source”, “split_from”, “derived_from”, etc.

This is the key to supporting cases where provider and internal data models differ.

### external_event_type_map

Optional but recommended lookup table to map provider event types to normalized external entity types and/or handler strategies.

Example:

* `NEW_JOB` → entity type `job`
* `UPDATE_JOB` → entity type `job`
* `NEW_TASK` → entity type `task`

This is especially useful when a provider’s webhook type needs to be translated into an internal fetch/action strategy.

---

## 7.2 Why raw external payloads must be stored

Raw payloads must be stored because they are needed for:

* auditability
* HMAC/webhook verification evidence
* debugging mapping failures
* replaying sync logic later
* supporting future changes to mapping rules
* proving exactly what the provider sent

Never rely only on transformed or normalized records. Keep the original event payload and the fetched external object payload.

---

## 7.3 Provider-agnostic naming

The external tables must be generic.

Use names like:

* `external_event`
* `external_object`
* `external_link`

Do not hardcode provider names in the table names unless the system is intentionally being built as a one-provider-only product.

Crunchwork should be represented as:

* a row in `integration_provider`
* provider-specific adapter code in the application layer
* provider-specific metadata in JSONB/config fields where necessary

---

## 8. Crunchwork-specific behavior within the generic external model

Crunchwork is the first provider to be integrated.

Crunchwork sends webhook events that contain a small amount of event data, including:

* event ID
* event type
* timestamp
* payload data including the external entity ID

The webhook event is not the full business object. It is a **trigger**.

The intended processing pattern is:

1. receive webhook
2. verify signature
3. store raw event
4. extract event type and external object ID
5. determine which external entity type is being referenced
6. call Crunchwork API to fetch the full entity
7. upsert the full external object into `external_object`
8. create/update links between the external object and internal business records
9. trigger downstream workflows if needed

This means the external schema should be designed around:

* event receipt
* external object fetch
* object version history
* object-to-internal linking

not around duplicating Crunchwork’s whole API object set into many provider-specific relational tables.

---

## 9. Mapping strategy between provider records and internal records

The mapping layer must be explicit.

Do not assume every external record maps directly to one internal record.

### Required mapping capabilities

The design must support:

* 1 external record → 1 internal record
* 1 external record → many internal records
* many external records → 1 internal record
* many external records → many internal records if needed

### Link roles

Each external-to-internal relationship should support a semantic role, such as:

* source
* corresponds_to
* split_from
* merged_into
* derived_from
* attachment_of

This allows the system to explain why a link exists.

### Example

One Crunchwork job may create:

* internal job A for make-safe
* internal job B for restoration

Both internal jobs should link back to the same external object through `external_link`.

---

## 10. Recommended processing lifecycle

The expected lifecycle for external provider processing is as follows.

## 10.1 Webhook ingestion

The NestJS API receives the webhook request.

At this stage the system should:

* capture raw request body exactly as received
* capture headers exactly as received
* verify HMAC/signature if applicable
* parse the request body
* determine the provider/connection context
* insert a new `external_event` row
* ensure idempotency using provider event ID + connection ID
* create a processing attempt record if desired
* queue an `external_sync_job`

## 10.2 External fetch

A worker or workflow processes the sync job.

At this stage the system should:

* determine entity type from provider event type
* call the provider’s API using the extracted provider entity ID
* fetch the full external object
* calculate a payload hash
* upsert `external_object`
* append a new `external_object_version` if the payload changed

## 10.3 Internal projection / mapping

A mapping component or workflow then decides how to project the external object into the internal model.

It may:

* create a new internal claim
* update an existing internal claim
* create one or more internal jobs
* update tasks
* create messages
* attach files
* trigger quote workflows
* split a single external job into multiple internal jobs

The mapping logic must not be hidden inside the raw webhook ingest. It should be explicit and replayable.

## 10.4 Workflow orchestration

More0 workflows should then drive downstream business actions such as:

* task assignment
* approval steps
* quote review
* site inspection workflow
* purchase order workflow
* message routing
* escalation/reminders

---

## 11. Multi-tenant design requirements

Claims-manager must support multiple tenants/builders.

Therefore every major internal and external entity must be tenant-aware, directly or indirectly.

At minimum:

* internal business records must be scoped to a tenant
* integration connections must be tenant-scoped
* provider records must be linked to the correct connection/tenant
* workflows must operate within tenant boundaries
* file storage paths in S3 should also be tenant-aware

---

## 12. File and attachment strategy

Files themselves should be stored in S3.

The database should store attachment metadata and relationships.

An attachment may originate from:

* user upload
* external provider payload
* generated report
* imported document
* system-generated artifact

The attachment metadata should record:

* S3 key/path
* original filename
* MIME type
* file size
* uploader/source
* related internal entity
* optionally related external object
* timestamps
* status and visibility if needed

---

## 13. What belongs in the internal schema vs external schema

Use the following rule.

### Put data into the internal normalized schema if:

* it is needed for day-to-day builder operations
* it drives workflows
* it is commonly queried in the UI
* it is part of the builder’s stable business vocabulary
* it should exist regardless of which provider supplied the original data

### Put data into the external integration schema if:

* it is provider-specific
* it came from a webhook or provider API
* it is needed for audit/replay/debugging
* it is part of external identity or transport state
* it may differ across providers
* it should be preserved even if not all of it is operationally needed internally

---

## 14. Provider-specific logic placement

Provider-specific logic should live in the application layer, not in generic table names.

Recommended structure in the codebase:

* provider-specific client module
* provider-specific webhook controller
* provider-specific entity fetch handlers
* provider-specific mapping rules
* provider-specific event type translation

For example, Crunchwork-specific logic might live in a module such as:

* webhook controller for Crunchwork
* Crunchwork API client
* Crunchwork event/entity translator
* Crunchwork mapper into internal claims-manager entities

But the database tables remain generic.

---

## 15. Recommended implementation pattern

The implementation should follow this architecture:

### A. Generic database schema

One internal operational model plus one generic external integration model.

### B. Provider adapter modules

Each provider has its own code adapter.

### C. Mapping layer

A dedicated translation/mapping layer converts external objects into internal business objects.

### D. Workflow layer

More0 orchestrates business actions after internal projection.

### E. Raw data preservation

Always keep raw provider events and external object snapshots.

---

## 16. Non-goals / anti-patterns

Avoid these designs:

### Anti-pattern 1: one full provider schema per insurer

Do not create fully duplicated per-provider relational business models as the core design.

### Anti-pattern 2: collapsing provider and internal models together

Do not let the internal business tables directly become the provider API schema.

### Anti-pattern 3: no historical versioning

Do not overwrite external data without keeping historical snapshots where changes matter.

### Anti-pattern 4: direct foreign key assumption

Do not assume one external record maps to exactly one internal record.

### Anti-pattern 5: storing only normalized data

Do not discard raw webhook and raw external payload data.

---

## 17. Final design summary

The system should be designed with:

### Internal normalized business tables

Used by claims-manager to run the builder’s operations:

* claims
* jobs
* tasks
* quotes
* purchase_orders
* messages
* reports
* attachments
* contacts/parties
* workflow references/state

### Generic external provider tables

Used to support all external providers, including Crunchwork:

* integration_provider
* integration_connection
* external_event
* external_event_attempt
* external_object
* external_object_version
* external_sync_job
* external_link
* external_event_type_map

### Key architectural principle

The internal builder model and the external provider model are separate but linked.

This is necessary because the provider’s representation of work may differ significantly from the builder’s required operational representation.

### Key business requirement

The design must support one external record mapping to multiple internal records and similar non-1:1 scenarios.

### Key operational requirement

All provider events and external objects must be stored in a way that supports audit, replay, and reprocessing.

---

# Short handoff instruction

Design the claims-manager database and service architecture using:

1. a normalized internal business model for builder operations,
2. a generic provider-agnostic external integration model,
3. an explicit mapping/link layer between external and internal entities,
4. workflow-driven orchestration for downstream business processes,
5. raw payload preservation and version history for audit/replay.

Do not assume the provider model and internal model are the same. Do not hardcode Crunchwork into the schema design, even though it is the first provider.

