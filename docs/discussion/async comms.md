> **Note:** This document is an early discussion reference focused on the PO/WO pair.
> The authoritative cross-tenant supply chain architecture — covering all document pairs
> (PO/WO, Invoice/Bill, RFQ/Job, Estimate/Proposal) — is now maintained in
> [`docs/implementation/41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md`](../implementation/41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md).

# How Purchase Orders, Work Orders, Ghost Organisations, and Pub/Sub Work in Claims Manager

Claims Manager supports organisations that buy work from other organisations and organisations that receive and perform that work.

For example, a prime contractor may issue a Purchase Order to a repairer, trade contractor, supplier, or other vendor. From the prime contractor’s perspective, this is a Purchase Order. From the receiving vendor’s perspective, the same instruction is a Work Order.

Claims Manager keeps those two perspectives separate.

The issuing organisation manages its Purchase Order, while the receiving organisation manages its Work Order. The records are linked, but each organisation retains control over its own operational view.

## When both organisations use Claims Manager

When both the issuing and receiving organisations are subscribed to Claims Manager, the process is straightforward.

The issuing organisation creates and approves a Purchase Order in its own account. Once the Purchase Order is issued, Claims Manager publishes an event indicating that the order has been issued.

A background subscriber receives that event and creates the corresponding Work Order in the receiving organisation’s account.

The result is:

```text
Issuing organisation
    → Purchase Order

Receiving organisation
    → Work Order
```

The Purchase Order and Work Order refer to the same commercial instruction, but they are not the same record.

This allows each organisation to manage its own responsibilities.

The issuer may track whether the order has been issued, acknowledged, fulfilled, amended, or cancelled.

The receiver may track whether the Work Order has been received, accepted, scheduled, started, completed, or declined.

Changes can also flow back in the other direction. For example, when the vendor accepts the Work Order, Claims Manager can notify the issuer and update the Purchase Order to show that it has been acknowledged.

## When the issuing organisation does not use Claims Manager

Claims Manager must also support organisations that are not yet subscribed.

For example, a builder may email a Purchase Order to a vendor. The vendor uses Claims Manager, but the builder does not.

The vendor manually enters the Purchase Order into Claims Manager.

Claims Manager creates a record for the builder as an external, non-subscribed organisation. This is referred to as a ghost organisation.

A ghost organisation is not a fake tenant account. It is simply a record representing a real organisation that exists commercially but does not yet have an active Claims Manager subscription.

The ghost organisation may contain identifying information such as:

```text
Legal or trading name
ABN
Email address
Email domain
Phone number
Contact details
```

This allows Claims Manager to recognise the organisation and associate future records with it.

## Who owns a manually entered Purchase Order?

A manually entered Purchase Order must not exist without a tenant owner.

Because the issuing organisation is not subscribed, it has no tenant account capable of owning the record.

The receiving tenant therefore acts as the custodian of the Purchase Order.

This means:

```text
Commercial issuer:
    Ghost organisation

Record custodian:
    Receiving subscribed tenant

Operational receiver:
    Receiving subscribed tenant
```

The receiving tenant owns and administers the captured database record, but Claims Manager still records that the ghost organisation was the real-world issuer.

This distinction prevents orphaned records while preserving the correct commercial relationship.

## What happens when the vendor manually captures the PO?

When the vendor enters the external Purchase Order, Claims Manager performs the key database actions together.

It:

```text
Resolves or creates the ghost issuing organisation
Creates the custodial Purchase Order
Creates the receiving tenant’s Work Order
Links the Purchase Order and Work Order
Records who captured the order
Creates an event for background processing
```

These records should be saved in one database transaction.

This means the user immediately sees the Work Order in Claims Manager. They do not need to wait for background messaging before the record appears.

The Purchase Order and Work Order are already safely stored before the asynchronous processing begins.

## The role of Pub/Sub

Pub/Sub is the messaging layer used to notify other parts of Claims Manager that something has happened.

It is not the main database and it is not the permanent source of truth.

The database remains authoritative.

The general pattern is:

```text
Save the business records
    ↓
Commit the database transaction
    ↓
Publish an event
    ↓
Subscribers perform additional actions
```

For example, after a Purchase Order is issued or manually captured, Claims Manager may publish:

```text
PurchaseOrderIssued
```

or:

```text
PurchaseOrderCaptured
```

Subscribers can then:

```text
Create or reconcile a Work Order
Start a More0 workflow
Send notifications
Process documents
Update reporting
Create tasks
Apply SLA rules
Update search indexes
```

This keeps the core database transaction reliable while allowing the wider system to react asynchronously.

## Why not save only through Pub/Sub?

A successful Pub/Sub publish means the message was accepted by the messaging system. It does not necessarily mean the Purchase Order or Work Order has already been written to the business database.

That can create a poor user experience. A user may submit a Purchase Order successfully but then not see it immediately.

Claims Manager therefore saves the relevant records first and uses Pub/Sub to distribute the resulting event.

This gives the user immediate confirmation while retaining the benefits of asynchronous processing.

## Preventing duplicate Work Orders

Pub/Sub messages may sometimes be delivered more than once.

Claims Manager must therefore process events idempotently. In practical terms, this means receiving the same event twice must not create two Work Orders.

The subscriber checks whether a Work Order already exists for the Purchase Order and receiving tenant.

Its behaviour is approximately:

```text
If no Work Order exists:
    Create it

If a Work Order already exists:
    Update or reconcile it

If it has already been fully processed:
    Do nothing further
```

The database should also enforce a unique relationship between the receiving tenant and source Purchase Order.

## What happens when a ghost organisation later subscribes?

A ghost organisation may later become a real Claims Manager customer.

For example, a builder whose Purchase Orders were previously entered manually by vendors may decide to subscribe.

During onboarding, Claims Manager verifies that the new tenant genuinely represents the existing ghost organisation.

This may involve checking:

```text
ABN
Legal entity name
Verified email domain
Known contacts
Existing commercial relationships
Administrative approval
```

Email addresses and domains can help locate possible matches, but they should not automatically grant access to historical records.

Once verified, the new tenant is linked to the existing organisation record.

Claims Manager can then locate the historical Purchase Orders that were commercially issued by that organisation.

## What happens to the existing Purchase Orders?

The same Purchase Order can move from custodial ownership to issuer ownership.

Before the issuer subscribes:

```text
Purchase Order owner:
    Receiving tenant acting as custodian

Commercial issuer:
    Ghost organisation
```

After the issuer is verified and subscribes:

```text
Purchase Order owner:
    Issuing tenant

Commercial issuer:
    Same organisation

Receiving tenant:
    Retains its linked Work Order
```

Claims Manager does not need to create a duplicate Purchase Order simply because the issuer has subscribed.

Instead, the existing Purchase Order is linked to the newly created issuer tenant and its ownership or custody status is updated.

The receiving tenant continues to own its Work Order.

## Protecting the receiving tenant’s private data

The receiving tenant may have added information that should never become visible to the issuing organisation.

Examples include:

```text
Internal notes
Margins
Internal costs
Staff comments
Supplier choices
Resource allocations
Internal attachments
Risk assessments
Workflow metadata
```

This information should be stored on the Work Order or another receiver-owned record, not on the transferable shared Purchase Order.

The Purchase Order should contain the commercial information that belongs to the transaction itself, such as:

```text
PO number
Scope
Line items
Rates
Quantities
Tax
Terms
Site address
Required dates
Source document
Shared attachments
```

When ownership transfers to the issuer, the receiver’s private operational data remains protected.

## Preserving history and auditability

When a ghost organisation becomes a subscriber, Claims Manager must not rewrite history.

It should continue to record:

```text
Who originally entered the PO
Which tenant captured it
When it was captured
Where the source document came from
When the organisation was claimed
How the claim was verified
When ownership changed
Who approved the change
```

The audit history should clearly tell the story:

```text
The receiving vendor manually captured a Purchase Order from an external organisation.

The external organisation later subscribed to Claims Manager.

Its identity was verified.

The Purchase Order was transferred from custodial ownership to the issuing tenant.

The receiving vendor retained its Work Order and private operational information.
```

## The role of More0 workflows

More0 may be used to coordinate more complex processing around the Purchase Order and Work Order.

For example, a More0 workflow could:

```text
Validate captured information
Read and classify a PO document
Request missing information
Start an approval process
Monitor an SLA
Send notifications
Coordinate human review
Handle exceptions
Reconcile failed events
Manage onboarding
```

More0 should not directly update arbitrary database columns.

Instead, it should call Claims Manager business capabilities such as:

```text
Issue Purchase Order
Accept Work Order
Complete PO capture
Fail Work Order processing
Claim organisation
Transfer PO custody
```

Claims Manager remains responsible for checking permissions, validating state transitions, updating the database, and creating audit records.

## The overall model

The complete process can be summarised as follows.

### Subscribed issuer and subscribed receiver

```text
Issuer creates PO
    ↓
PO is approved and issued
    ↓
Event is published through Pub/Sub
    ↓
Receiver’s WO is created
    ↓
Receiver accepts or processes WO
    ↓
Events update the issuer’s view
```

### Non-subscribed issuer and subscribed receiver

```text
Receiver manually enters external PO
    ↓
Ghost issuer organisation is created or found
    ↓
Custodial PO and receiver WO are saved together
    ↓
User sees the WO immediately
    ↓
Event is published through Pub/Sub
    ↓
Subscribers complete background processing
```

### Ghost organisation later subscribes

```text
New tenant registers
    ↓
Existing ghost organisation is identified
    ↓
Organisation ownership is verified
    ↓
Tenant is linked to the organisation
    ↓
Historical custodial POs are located
    ↓
PO ownership transfers to issuer tenant
    ↓
Receiving tenants retain their WOs
```

## Core principles

The design is based on several important principles:

```text
The database is the source of truth.

Pub/Sub distributes events but does not own business records.

POs and WOs remain separate records.

Every operational record belongs to an active tenant boundary.

Ghost organisations represent real external businesses without creating fake tenants.

Manually captured POs are held by the receiving tenant as custodian.

The receiving tenant sees its Work Order immediately.

When a ghost organisation subscribes, existing POs can be claimed rather than duplicated.

Private tenant information remains private.

Every ownership and state change is auditable.

All event processing is safe to retry without creating duplicates.
```

This architecture allows Claims Manager to support fully digital trading relationships while also handling the real-world situation where only one party currently uses the platform.


=======
# Context Prompt: Design Ghost Organisations, PO/WO Ownership, and Pub/Sub Propagation in Claims Manager

You are an expert principal software architect and senior backend engineer. You are reviewing and designing the architecture for **Claims Manager**, a multi-tenant application that supports the operational workflow of general contractors, insurers, builders, vendors, trades, product suppliers, assessors, and other upstream and downstream participants.

Your task is to analyse the existing codebase and produce a detailed implementation design for how Claims Manager should handle:

1. Purchase Orders issued by one organisation to another.
2. Work Orders received by the downstream organisation.
3. Organisations that are not yet subscribers to Claims Manager.
4. “Ghost organisations” created to represent non-subscribed commercial counterparties.
5. Manual PO capture by a receiving tenant.
6. Automated PO creation by a subscribed issuing tenant.
7. The role of Pub/Sub in propagating PO and WO state changes.
8. The later onboarding and claiming of a ghost organisation by a real subscribed tenant.
9. Record ownership, custody, tenancy isolation, audit history, idempotency, and reconciliation.

The design must be explicit, deterministic, auditable, secure, and suitable for commercial production use.

---

# 1. Core Domain Context

Claims Manager is a multi-tenant platform.

An organisation may participate in different commercial roles depending on the transaction. For example:

* Prime contractor
* Head contractor
* General contractor
* Vendor
* Subcontractor
* Product supplier
* Insurer
* Assessor
* Repairer
* Trade contractor

A tenant may issue a Purchase Order to another organisation.

From the issuing organisation’s perspective, the commercial instruction is a:

```text
Purchase Order
```

From the receiving organisation’s perspective, the same commercial instruction becomes a:

```text
Work Order
```

These are separate domain records with different ownership, permissions, lifecycle states, and tenant-specific data.

The architecture must therefore preserve the distinction:

```text
Issuer tenant:
Purchase Order

Receiving tenant:
Work Order
```

A PO and WO may refer to the same commercial transaction, but they are not the same row and must not share a single status field.

---

# 2. Fundamental Architectural Rule

Implement the following conceptual rule:

> A Purchase Order is the issuing-side representation of a commercial instruction. A Work Order is the receiving-side representation of that same commercial instruction.

When both organisations are subscribed:

```text
Issuer tenant creates and issues PO
    → PurchaseOrderIssued event
    → receiving tenant receives or creates WO
```

When the receiving tenant accepts the WO:

```text
Receiving tenant accepts WO
    → WorkOrderAccepted event
    → issuer-side PO acknowledgement state is updated
```

The PO and WO must remain distinct but linked.

---

# 3. Shared Commercial Identity

Design a stable identity that links both sides of the transaction.

Consider introducing a neutral entity such as:

```text
commercial_order
```

or an equivalent explicit relationship model.

Possible conceptual fields:

```text
commercial_order
- id
- issuer_organisation_id
- recipient_organisation_id
- issuer_purchase_order_number
- commercial_relationship_id
- created_at
- updated_at
```

Then link the records:

```text
purchase_order
- commercial_order_id
- owner_tenant_id
- issuer_organisation_id
- recipient_organisation_id

work_order
- commercial_order_id
- owner_tenant_id
- customer_organisation_id
- source_purchase_order_id
```

Do not force this exact table structure if the current codebase already has a better equivalent. However, preserve the conceptual separation between:

* Shared commercial transaction identity
* Issuer-side PO
* Receiver-side WO
* Tenant-specific private data

---

# 4. Subscribed Organisation Scenario

When both issuer and receiver are subscribed:

```text
Issuer tenant
    → creates PO
    → approves PO
    → issues PO
    → event is published
    → receiver-side subscriber creates or reconciles WO
```

The PO is owned by the issuing tenant.

The WO is owned by the receiving tenant.

Example:

```text
purchase_order.owner_tenant_id = issuer tenant
work_order.owner_tenant_id = receiving tenant
```

The receiver must never be given ownership of the issuer’s tenant-private PO record.

The issuer must never receive ownership of the receiver’s tenant-private WO record.

---

# 5. Non-Subscribed Issuer Scenario

Claims Manager must support a receiving tenant manually entering a PO that was issued by an organisation that does not yet subscribe to Claims Manager.

Example:

```text
Non-digital builder emails a PO to a subscribed vendor.

The subscribed vendor manually enters the PO into Claims Manager.
```

In this scenario:

* The issuer has no tenant or account.
* The receiving vendor is a valid subscribed tenant.
* The application must not create an orphaned PO.
* The PO must remain inside an active tenancy and security boundary.
* The commercial issuer must still be represented accurately.

Create or resolve a non-subscribed external organisation, referred to in this design as a:

```text
ghost organisation
```

A ghost organisation is a valid organisation entity without a linked Claims Manager tenant.

Conceptually:

```text
organisation
- id
- legal_name
- trading_name
- abn
- primary_email
- email_domain
- linked_tenant_id nullable
- subscription_status
- identity_status
```

Possible statuses:

```text
external
unverified
candidate
claimed
verified
```

Use the terminology already present in the codebase where appropriate.

---

# 6. Custodial PO Ownership

For a manually entered PO from a non-subscribed issuer, the receiving subscriber tenant must act as the custodian of the PO record.

The PO must not be tenantless.

Conceptually:

```text
purchase_order
- owner_tenant_id = receiving tenant
- custodian_tenant_id = receiving tenant
- issuer_organisation_id = ghost organisation
- issuer_tenant_id = null
- recipient_tenant_id = receiving tenant
- captured_by_tenant_id = receiving tenant
- captured_by_user_id
- capture_method = manual
- ownership_status = externally_captured
```

Important distinctions:

```text
owner_tenant_id
```

means the tenant that currently owns and administers the stored Claims Manager record.

```text
issuer_organisation_id
```

means the organisation that commercially issued the real-world PO.

```text
issuer_tenant_id
```

indicates whether the issuing organisation currently has a subscribed tenant.

```text
captured_by_tenant_id
```

preserves who entered the PO into Claims Manager.

The receiving tenant owns the captured system record initially, but must not be represented as the commercial issuer.

---

# 7. Avoiding Orphaned POs

Every PO record must satisfy one of the following:

```text
A. Owned by an active issuing tenant
```

or:

```text
B. Held in custody by an active receiving tenant on behalf of a ghost issuer organisation
```

Do not allow:

```text
owner_tenant_id = null
```

for operational PO records.

Do not create speculative tenant accounts for ghost organisations.

A tenant is a security, ownership, subscription, identity, and administration boundary. It must not be created solely because a manually entered PO references a company name or email address.

---

# 8. Organisation Resolution

When a manual PO is entered, resolve the issuing organisation using a controlled matching process.

Candidate identifiers may include:

```text
ABN
legal name
trading name
exact email address
verified email domain
phone number
existing commercial relationship
customer reference
historical PO issuer identity
```

ABN should generally be treated as the strongest Australian organisation identifier when available.

Email address and email domain are useful matching signals, but must not be treated as sole proof of organisation ownership.

Do not automatically expose historical data to a future tenant merely because a registering user has the same email domain.

Design organisation matching as a process with:

```text
exact matches
probable matches
ambiguous matches
new organisation creation
manual review
verified claim
```

Prevent accidental creation of duplicate ghost organisations.

---

# 9. Manual PO Capture Transaction

For a manually entered PO, the receiving tenant requires immediate UX feedback.

The user should not submit the PO and then temporarily see no corresponding record while waiting for Pub/Sub processing.

The recommended transaction is:

```text
BEGIN

1. Validate the user, tenant, and permissions.
2. Resolve or create the ghost issuer organisation.
3. Create the commercial-order identity if required.
4. Create the custodial PO.
5. Create the receiving tenant’s WO.
6. Link the WO to the PO.
7. Record audit and provenance data.
8. Insert an outbox event.

COMMIT
```

The UI should receive both identifiers immediately:

```json
{
  "purchaseOrderId": "po_123",
  "workOrderId": "wo_456"
}
```

The WO must be visible immediately after the transaction commits.

---

# 10. Initial WO State

For manually entered POs, consider separating business state from technical processing state.

Recommended:

```text
work_order.business_status = received
work_order.processing_status = pending
```

Rather than making a technical state such as `receiving` part of the main commercial lifecycle.

Example business states:

```text
received
awaiting_acceptance
accepted
declined
scheduled
in_progress
completed
cancelled
```

Example technical processing states:

```text
pending
processing
complete
failed
retrying
```

If the existing application already uses a `receiving` business state, assess whether it has genuine domain meaning. If it only means that asynchronous processing has not completed, migrate or redesign it as a processing status.

The receiving tenant should see the WO immediately even when Pub/Sub processing is still pending.

---

# 11. Pub/Sub Role

Pub/Sub must be used as an asynchronous propagation and integration mechanism, not as the primary system of record.

The database is authoritative.

The intended pattern is:

```text
Domain transaction
    → write business record
    → write outbox event
    → commit
    → outbox publisher sends event to Pub/Sub
    → subscribers react
```

Do not implement:

```text
save database row
then publish directly
```

without a recovery mechanism.

This creates a dual-write failure condition:

```text
database commit succeeds
Pub/Sub publish fails
```

Use a transactional outbox.

---

# 12. Relevant Event Types

Design event contracts for at least the following concepts:

```text
PurchaseOrderCaptured
PurchaseOrderApproved
PurchaseOrderIssued
PurchaseOrderUpdated
PurchaseOrderCancelled

WorkOrderCreated
WorkOrderReceived
WorkOrderAccepted
WorkOrderDeclined
WorkOrderStarted
WorkOrderCompleted
WorkOrderCancellationRequested

OrganisationCreated
OrganisationClaimed
OrganisationLinkedToTenant
HistoricalPurchaseOrdersLinked
PurchaseOrderCustodyTransferred
```

Do not create a separate Pub/Sub topic for every workflow step unless there is a strong operational boundary.

Prefer a small number of stable topics, for example:

```text
claims.commands
claims.events
claims.integration-events
claims.dead-letter
```

or domain-specific equivalents already used by the application.

Messages should use explicit event types.

---

# 13. Pub/Sub Behaviour for Manual PO Capture

Because the manual-capture transaction already creates the receiving WO, the PO-to-WO Pub/Sub subscriber must not blindly create a second WO.

Its behaviour must be idempotent and reconciling.

Pseudo-logic:

```text
On PurchaseOrderCaptured or PurchaseOrderIssued:

Find WO by:
- receiving tenant ID
- source purchase order ID

If WO does not exist:
    create WO

If WO exists and processing_status = pending:
    run downstream receipt processing
    update processing_status = complete

If WO is already processed:
    acknowledge event without duplicate changes

If processing fails:
    update processing_status = failed
    preserve retry details
```

The event consumer must support both:

```text
A. Manual capture path where WO already exists
B. Cross-tenant digital path where WO must be created
```

---

# 14. Pub/Sub Behaviour for Subscribed Issuer

When a subscribed issuer creates and issues a PO:

```text
Issuer tenant writes PO
    → outbox stores PurchaseOrderIssued
    → Pub/Sub publishes event
    → receiver-side handler creates WO
```

The receiver-side handler must:

1. Resolve the intended recipient tenant.
2. Validate the organisation and trading relationship.
3. Check whether a WO already exists.
4. Create the WO if missing.
5. Preserve the PO and commercial-order link.
6. Initialise receiver-side business state.
7. Record the source event ID.
8. Publish `WorkOrderCreated` or `WorkOrderReceived`.

---

# 15. Idempotency

Assume Pub/Sub uses at-least-once delivery.

Every subscriber must be idempotent.

Add a unique constraint such as:

```text
UNIQUE (
  receiving_tenant_id,
  source_purchase_order_id
)
```

or an equivalent commercial-order identity constraint.

Also persist processed event identifiers where useful:

```text
processed_event
- event_id
- handler_name
- processed_at
- result
```

A redelivered event must never create another WO.

Do not rely only on Pub/Sub message acknowledgement for duplicate prevention.

---

# 16. Event Envelope

Use a consistent event envelope.

Example:

```json
{
  "eventId": "evt_123",
  "eventType": "PurchaseOrderIssued",
  "eventVersion": 1,
  "occurredAt": "2026-07-31T10:00:00Z",
  "aggregateType": "PurchaseOrder",
  "aggregateId": "po_123",
  "commercialOrderId": "co_789",
  "recordOwnerTenantId": "tenant_vendor",
  "issuerOrganisationId": "org_builder",
  "issuerTenantId": null,
  "recipientOrganisationId": "org_vendor",
  "recipientTenantId": "tenant_vendor",
  "correlationId": "corr_456",
  "causationId": "cmd_234",
  "actor": {
    "type": "user",
    "id": "user_123"
  },
  "data": {}
}
```

For a PO issued by a subscribed tenant:

```text
recordOwnerTenantId = issuer tenant
issuerTenantId = issuer tenant
recipientTenantId = receiver tenant
```

For a manually captured ghost-issued PO:

```text
recordOwnerTenantId = receiving tenant
issuerTenantId = null
recipientTenantId = receiving tenant
captureMethod = manual
ownershipStatus = externally_captured
```

Do not treat `recordOwnerTenantId` as equivalent to `issuerTenantId`.

---

# 17. Commands Versus Events

Maintain a strict distinction.

Commands request an action:

```text
ApprovePurchaseOrder
IssuePurchaseOrder
AcceptWorkOrder
DeclineWorkOrder
ClaimOrganisation
LinkOrganisationToTenant
```

Events state that an action has succeeded:

```text
PurchaseOrderApproved
PurchaseOrderIssued
WorkOrderAccepted
OrganisationClaimed
```

Publishers should not send arbitrary database mutations such as:

```json
{
  "status": "complete"
}
```

Commands must pass through Claims Manager domain validation.

Events must only be emitted after the corresponding database transaction succeeds.

---

# 18. Ghost Organisation Becomes a Subscriber

When a ghost organisation later subscribes:

```text
1. Create the new subscribed tenant.
2. Verify the tenant represents the ghost organisation.
3. Resolve or merge duplicate organisation records.
4. Link the verified tenant to the existing organisation.
5. Identify historical custodial POs attributed to that organisation.
6. Transfer PO ownership or custody where allowed.
7. Preserve receiving tenant WO ownership.
8. Preserve capture provenance and audit history.
9. Publish organisation and PO reconciliation events.
```

The intended target model is:

```text
Before subscription:

Ghost issuer organisation
    → custodial PO owned by receiving tenant
    → linked receiving-tenant WO
```

After verified onboarding:

```text
Subscribed issuer tenant
    → same PO now linked to issuer tenant
    → receiving tenant retains its WO
```

Do not create a second issuer PO merely because the ghost organisation becomes subscribed, unless reconciliation identifies that a separate authoritative PO already exists and a merge is required.

---

# 19. PO Custody Transfer

The design should support transferring the same PO from custodial ownership to the newly subscribed issuer tenant.

Conceptually:

```text
Before:

purchase_order.owner_tenant_id = receiving tenant
purchase_order.custodian_tenant_id = receiving tenant
purchase_order.issuer_tenant_id = null
purchase_order.ownership_status = externally_captured
```

After verified organisation claim:

```text
purchase_order.owner_tenant_id = issuer tenant
purchase_order.custodian_tenant_id = null
purchase_order.issuer_tenant_id = issuer tenant
purchase_order.ownership_status = claimed
```

The receiving tenant must retain access to the relevant shared commercial information through its linked WO and commercial-order relationship.

Do not expose receiving-tenant private fields to the issuer as part of the transfer.

---

# 20. Data Classification During Custody Transfer

Separate data into categories.

## Shared commercial PO data

Potentially transferable or visible to both parties:

```text
PO number
issue date
issuer identity
recipient identity
scope
line items
quantities
rates
tax
delivery or work address
required completion date
terms
source PO document
shared attachments
```

## Receiving-tenant private data

Must remain owned by the receiving tenant:

```text
internal notes
margin
internal costs
staff comments
resource allocation
risk assessment
internal attachments
internal workflow metadata
private tags
supplier substitutions
internal pricing analysis
```

Store receiver-private information on the WO or another receiver-owned entity, not inside the transferable PO aggregate.

---

# 21. Audit and Provenance

Ownership transfer must not rewrite history.

Preserve fields such as:

```text
originally_captured_by_tenant_id
originally_captured_by_user_id
captured_at
capture_method
source_document_id
source_email_message_id
original_owner_tenant_id
custody_started_at
claimed_at
claimed_by_tenant_id
claim_verification_method
claim_approved_by
```

The audit history should be able to express:

```text
Vendor B manually captured this PO from external Builder A.

Builder A later subscribed and verified ownership of the existing ghost organisation.

The PO was transferred from custodial ownership to Builder A.

Vendor B retained its linked WO and all receiver-private operational data.
```

---

# 22. Organisation Claim Security

Do not automatically claim organisations or transfer POs solely because of an email-domain match.

A claim process should support evidence such as:

```text
ABN verification
legal entity verification
verified corporate email domain
existing invitation token
administrator approval
known commercial relationship
manual review
```

The organisation claim must be explicit, auditable, and reversible through administrative processes.

Handle ambiguous cases such as:

* shared corporate domains;
* franchises;
* subsidiaries;
* parent and child companies;
* organisations using Gmail or Outlook addresses;
* changed company names;
* duplicate ABNs entered incorrectly;
* vendors with several legal entities;
* one legal entity operating multiple brands.

---

# 23. More0 Workflow Role

Claims Manager may use More0 workflows to process PO and WO lifecycle activities.

More0 may:

```text
read PO and WO state
validate captured information
request missing information
process documents
perform enrichment
start approval workflows
monitor SLAs
handle exceptions
coordinate human review
send notifications
reconcile failed deliveries
```

More0 must not update arbitrary database fields directly.

Expose Claims Manager domain capabilities such as:

```text
claims.getPurchaseOrder
claims.getWorkOrder
claims.completePurchaseOrderCapture
claims.issuePurchaseOrder
claims.acceptWorkOrder
claims.failWorkOrderReceipt
claims.claimOrganisation
claims.transferPurchaseOrderCustody
```

More0 should request valid business transitions through these capabilities.

Claims Manager remains the authority over state transitions, tenancy, permissions, validation, and persistence.

---

# 24. State Separation

Avoid using one field to represent both technical workflow execution and business state.

Example:

```text
purchase_order.business_status
purchase_order.processing_status

work_order.business_status
work_order.processing_status
```

More0 execution state should remain separately persisted:

```text
pending
running
waiting
retrying
failed
succeeded
cancelled
```

A record may therefore be:

```text
WO business status = received
WO processing status = pending
More0 execution status = running
```

This is acceptable and expected.

---

# 25. Concurrency Control

Different publishers and workflows may attempt to update the same records.

Use optimistic concurrency.

Example:

```text
purchase_order.version
work_order.version
```

Commands may provide:

```text
expectedVersion
```

Updates should use a guarded write:

```sql
UPDATE work_order
SET business_status = :new_status,
    version = version + 1
WHERE id = :id
  AND version = :expected_version;
```

Do not allow delayed Pub/Sub events to overwrite newer state.

Event handlers must evaluate:

```text
event version
aggregate version
current business state
previously processed event ID
```

---

# 26. Cancellation and Amendments

Design for PO changes after issuance.

Examples:

```text
PurchaseOrderAmended
PurchaseOrderCancellationRequested
PurchaseOrderCancelled
WorkOrderAmendmentReceived
WorkOrderCancellationRequested
```

Do not assume that a PO cancellation can always force the WO directly to cancelled.

The receiver may already have:

```text
accepted work
ordered materials
incurred costs
started work
engaged subcontractors
```

Use explicit cancellation-request semantics where required.

---

# 27. Failure Handling

Design for failures in:

```text
outbox publishing
Pub/Sub delivery
subscriber processing
organisation resolution
WO creation
More0 workflow invocation
PO custody transfer
organisation claiming
duplicate reconciliation
```

Persist operational failure state.

Example:

```text
processing_status = failed
attempt_count
next_attempt_at
last_error_code
last_error_message
failed_at
dead_lettered_at
```

The user-facing PO and WO must remain visible even when asynchronous processing fails.

Provide administrative retry and reconciliation capabilities.

---

# 28. Required Codebase Analysis

Inspect the existing codebase and identify:

1. Current tenant and organisation entities.
2. Whether organisation and tenant are incorrectly treated as the same concept.
3. Current PO and WO schemas.
4. Existing ownership fields.
5. Existing Pub/Sub topics and subscribers.
6. Existing outbox or event-publishing mechanisms.
7. Current workflow and More0 integration points.
8. Existing status enums.
9. Current audit infrastructure.
10. Existing idempotency protections.
11. Existing organisation matching or onboarding flows.
12. Existing permissions and tenancy filters.
13. Existing document and attachment ownership rules.

Do not assume the codebase already follows this design.

Document gaps and conflicts.

---

# 29. Required Design Deliverables

Produce a detailed design document covering:

## A. Domain model

Include proposed entities, ownership rules, foreign keys, statuses, and relationships.

## B. Ghost organisation lifecycle

Cover:

```text
creation
matching
manual capture
custodial ownership
verification
claiming
tenant linking
duplicate merge
PO custody transfer
historical reconciliation
```

## C. PO/WO lifecycle

Cover both:

```text
subscribed issuer → subscribed receiver
```

and:

```text
ghost issuer → subscribed receiver
```

## D. Pub/Sub architecture

Document:

```text
topics
subscriptions
event types
event envelope
publishers
consumers
outbox
dead-letter handling
retry behaviour
idempotency
ordering
versioning
replay
observability
```

## E. Transaction boundaries

Specify exactly which records must be written atomically.

At minimum, assess:

```text
manual PO capture
PO approval and issuance
WO creation
WO acceptance
organisation claim
PO custody transfer
outbox writes
```

## F. Security and tenancy

Explain:

```text
record ownership
custody
issuer identity
recipient identity
access after custody transfer
private versus shared data
organisation claim verification
cross-tenant event validation
```

## G. More0 integration

Explain which parts should be:

```text
deterministic Claims Manager domain logic
More0 workflow orchestration
Pub/Sub propagation
human workflow
scheduled reconciliation
```

## H. Migration plan

If the existing schema differs, provide a safe phased migration plan.

---

# 30. Required Sequence Diagrams

Provide sequence diagrams for at least the following.

## Scenario 1: Both parties subscribed

```text
Issuer creates PO
→ issuer approves PO
→ PO committed
→ outbox event
→ Pub/Sub
→ receiver WO created
→ receiver accepts WO
→ event back to issuer
```

## Scenario 2: Ghost issuer, manual capture

```text
Receiving tenant manually enters external PO
→ ghost organisation resolved or created
→ custodial PO created
→ receiver WO created in same transaction
→ outbox event
→ Pub/Sub subscriber reconciles WO
```

## Scenario 3: Ghost issuer later subscribes

```text
New tenant subscribes
→ organisation identity verified
→ ghost organisation claimed
→ historical POs located
→ PO custody transferred
→ receiving WOs remain owned by receivers
→ events published
```

## Scenario 4: Duplicate event delivery

```text
PurchaseOrderIssued delivered twice
→ subscriber checks unique source identity
→ existing WO found
→ no duplicate created
```

## Scenario 5: Pub/Sub processing failure

```text
PO and WO remain visible
→ processing status failed
→ retry or dead-letter
→ administrative reconciliation
```

---

# 31. Important Invariants

The final design must enforce these invariants:

```text
1. Every operational PO belongs to an active tenant boundary.

2. A ghost organisation is an organisation without a linked tenant, not a speculative tenant.

3. A manually captured external PO is initially owned or held in custody by the receiving subscribed tenant.

4. Commercial issuer identity is separate from record ownership.

5. The receiving tenant receives a WO immediately during manual capture.

6. Manual PO capture creates the PO and WO in one database transaction.

7. Pub/Sub is not the system of record.

8. Events are written through a transactional outbox.

9. Pub/Sub consumers are idempotent.

10. A subscribed issuer and receiver retain separate PO and WO records.

11. When a ghost issuer subscribes, the same custodial PO may be transferred to the verified issuer tenant.

12. The receiver retains its WO and receiver-private data.

13. Ownership transfer does not rewrite audit history.

14. Email and domain are matching hints, not sufficient proof of ownership.

15. More0 workflows invoke domain capabilities rather than directly mutating tables.

16. Technical processing state is separate from business state.

17. Delayed or duplicated events cannot overwrite newer state.

18. Tenant-private data must not leak during PO custody transfer.
```

---

# 32. Decision Guidance

Prefer simple deterministic application logic for:

```text
creating a linked WO
enforcing uniqueness
updating approved state transitions
tenant resolution
organisation linking
custody transfer
audit creation
outbox persistence
```

Use More0 workflows for:

```text
exceptions
human approvals
document processing
long-running tasks
SLA management
missing-information requests
onboarding workflows
complex reconciliation
notifications
escalations
```

Use Pub/Sub for:

```text
cross-tenant propagation
asynchronous processing
integration events
independent subscribers
retries
buffering
decoupling
replayable event-driven reactions
```

Do not use Pub/Sub merely to avoid a direct function call when all data is being written inside the same bounded context and transaction.

---

# 33. Expected Output Quality

Do not produce only a high-level conceptual summary.

Produce an implementation-ready architecture that includes:

* Concrete schema recommendations
* Entity responsibilities
* Ownership semantics
* State models
* Event contracts
* Transaction boundaries
* Idempotency keys
* Unique constraints
* Consumer algorithms
* Failure handling
* Security rules
* Migration considerations
* Sequence diagrams
* Example payloads
* Risks and trade-offs
* Recommended phased implementation plan

Where the existing codebase conflicts with the intended architecture, explain the conflict and propose a safe refactor.

Do not implement code until the architecture and migration plan have been documented and reviewed.

Place the design document in an appropriate location such as:

```text
docs/architecture/claims-manager-po-wo-ghost-organisations-pubsub.md
```

If the repository has an established architecture-document naming convention, follow that convention instead.
