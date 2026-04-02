Yes — I’d rewrite it as a **hybrid relational + JSONB schema**.

That fits the API much better because the spec has:

* stable top-level entities and IDs,
* lots of nested objects,
* many `externalReference`-driven lookups,
* optional/job-type-specific fields,
* hierarchical quote / purchase-order line structures,
* webhook events,
* attachments with polymorphic parent records,
* tenant scoping via `active-tenant-id`. 

It also explicitly supports querying claims by `claimNumber` and `externalReference`, vendor allocation by `jobType/account/postcode/lossType/totalLoss`, and child resources like jobs, quotes, invoices, purchase orders, reports, tasks, messages, appointments, and attachments. 

## Design approach

I would use this rule:

* keep **identity, tenancy, foreign keys, numbers, statuses, dates, totals, and frequently queried fields** as columns
* store **nested API objects** in JSONB
* store **repeating child collections** in child tables
* keep **quote/PO line hierarchy relational**, because those are edited, ordered, recalculated, and queried as sub-entities
* keep **lookup/reference data** normalized around `external_reference`, because the API relies heavily on it and has defined handling rules for unknown values.

---

# Rewritten schema

## 1. Extensions

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
```

---

## 2. Tenancy and users

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  client_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  external_reference text,
  email citext,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_reference),
  unique (tenant_id, email)
);
```

---

## 3. Lookup / reference tables

The API uses many nested objects with `id`, `name`, and `externalReference`, including status, account, job type, loss type, loss subtype, CAT code, contact type, preferred contact method, assignee type, quote type, line scope status, unit type, PO type, report type, document type, and more.

```sql
create table lookup_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  domain text not null,                -- status, account, job_type, loss_type, etc.
  name text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, domain, external_reference)
);

create index idx_lookup_values_domain on lookup_values (tenant_id, domain);
create index idx_lookup_values_extref on lookup_values (tenant_id, domain, external_reference);
```

Suggested `domain` values:

* `account`
* `claim_status`
* `job_status`
* `invoice_status`
* `quote_status`
* `purchase_order_status`
* `job_type`
* `loss_type`
* `loss_subtype`
* `cat_code`
* `claim_decision`
* `priority`
* `policy_type`
* `line_of_business`
* `contact_type`
* `contact_method`
* `assignee_type`
* `task_type`
* `quote_type`
* `group_label`
* `line_scope_status`
* `unit_type`
* `purchase_order_type`
* `message_type`
* `appointment_type`
* `specialist_visit_type`
* `report_type`
* `document_type`
* `audit_type`
* `specialist_category`
* `specialist_report`
* `original_job_type`

This is cleaner than many tiny tables but still keeps lookup behavior relational.

---

## 4. External reference resolution log

Because the API has specific unknown-value behavior for many lookup types, I’d keep a mapping/audit table too. Some unknown refs should fail, some should continue, some should “add mapping value and record.” 

```sql
create table external_reference_resolution_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  domain text not null,
  external_reference text not null,
  source_entity text,
  source_entity_id uuid,
  resolution_action text not null,     -- matched | created_mapping | defaulted | ignored | failed
  matched_lookup_id uuid references lookup_values(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

---

## 5. Contacts

Claims and jobs both contain contacts with names, email, phones, type, preferred method, notes, and external reference. The API treats contacts as embedded arrays, but operationally they should be reusable rows.

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_reference text,
  first_name text,
  last_name text,
  full_name text generated always as (
    trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) stored,
  email citext,
  mobile_phone text,
  home_phone text,
  work_phone text,
  type_lookup_id uuid references lookup_values(id),
  preferred_contact_method_lookup_id uuid references lookup_values(id),
  notes text,
  contact_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_reference)
);

create index idx_contacts_email on contacts (tenant_id, email);
create index idx_contacts_mobile on contacts (tenant_id, mobile_phone);
```

---

## 6. Claims

The claim object includes:

* identity fields
* account / status / type refs
* address object
* many custom-data style business fields
* contacts
* assignees
* claim-level custom data.

I would model it like this:

```sql
create table claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  claim_number text,
  external_reference text,
  external_claim_id text,

  account_lookup_id uuid references lookup_values(id),
  status_lookup_id uuid references lookup_values(id),
  cat_code_lookup_id uuid references lookup_values(id),
  loss_type_lookup_id uuid references lookup_values(id),
  loss_subtype_lookup_id uuid references lookup_values(id),
  claim_decision_lookup_id uuid references lookup_values(id),
  priority_lookup_id uuid references lookup_values(id),
  policy_type_lookup_id uuid references lookup_values(id),
  line_of_business_lookup_id uuid references lookup_values(id),

  lodgement_date date,
  date_of_loss timestamptz,

  -- canonical nested objects
  address jsonb not null default '{}'::jsonb,
  policy_details jsonb not null default '{}'::jsonb,
  financial_details jsonb not null default '{}'::jsonb,
  vulnerability_details jsonb not null default '{}'::jsonb,
  contention_details jsonb not null default '{}'::jsonb,

  -- promoted query fields
  address_postcode text,
  address_suburb text,
  address_state text,
  address_country text,
  address_latitude numeric(10,7),
  address_longitude numeric(10,7),
  policy_number text,
  policy_name text,
  abn text,

  vulnerable_customer boolean,
  total_loss boolean,
  contentious_claim boolean,
  contentious_activity_flag boolean,
  auto_approval_applies boolean,
  contents_damaged boolean,

  incident_description text,
  postal_address text,

  custom_data jsonb not null default '{}'::jsonb,
  api_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (tenant_id, claim_number),
  unique (tenant_id, external_reference)
);

create index idx_claims_extref on claims (tenant_id, external_reference);
create index idx_claims_status on claims (tenant_id, status_lookup_id);
create index idx_claims_account on claims (tenant_id, account_lookup_id);
create index idx_claims_postcode on claims (tenant_id, address_postcode);
create index idx_claims_policy_number on claims (tenant_id, policy_number);
create index idx_claims_custom_data on claims using gin (custom_data);
create index idx_claims_address_json on claims using gin (address);
```

### Claim contacts

```sql
create table claim_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  sort_index integer not null default 0,
  source_payload jsonb not null default '{}'::jsonb,
  unique (claim_id, contact_id)
);
```

### Claim assignees

```sql
create table claim_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  assignee_type_lookup_id uuid references lookup_values(id),
  user_id uuid references users(id),
  external_reference text,
  display_name text,
  email citext,
  assignee_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 7. Vendors

Vendor allocation depends on `jobType`, `account`, `postcode`, `lossType`, and `totalLoss`. Vendor records include address, phone, after-hours phone, and external reference.

```sql
create table vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  name text not null,
  external_reference text,

  address jsonb not null default '{}'::jsonb,
  contact_details jsonb not null default '{}'::jsonb,
  vendor_payload jsonb not null default '{}'::jsonb,

  postcode text,
  state text,
  city text,
  country text,
  phone text,
  after_hours_phone text,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, external_reference)
);

create index idx_vendors_postcode on vendors (tenant_id, postcode);
create index idx_vendors_name on vendors (tenant_id, name);
```

### Optional vendor allocation rules

```sql
create table vendor_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  account_lookup_id uuid references lookup_values(id),
  job_type_lookup_id uuid references lookup_values(id),
  loss_type_lookup_id uuid references lookup_values(id),
  postcode text,
  total_loss boolean,
  return_priority integer not null default 0,
  rule_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 8. Jobs

The API’s `Job` is where JSONB helps most. It contains:

* core top-level fields
* address
* contacts
* vendor reference
* optional appointment array
* several job-type-specific subdomains:

  * temporary accommodation
  * specialist
  * rectification
  * audit
  * mobility considerations.

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  claim_id uuid not null references claims(id) on delete cascade,
  parent_claim_id uuid references claims(id),
  vendor_id uuid references vendors(id),

  external_reference text,

  job_type_lookup_id uuid not null references lookup_values(id),
  status_lookup_id uuid references lookup_values(id),

  request_date date,
  collect_excess boolean,
  excess numeric(14,2),
  make_safe_required boolean,

  -- canonical nested objects
  address jsonb not null default '{}'::jsonb,
  vendor_snapshot jsonb not null default '{}'::jsonb,
  temporary_accommodation_details jsonb not null default '{}'::jsonb,
  specialist_details jsonb not null default '{}'::jsonb,
  rectification_details jsonb not null default '{}'::jsonb,
  audit_details jsonb not null default '{}'::jsonb,
  mobility_considerations jsonb not null default '[]'::jsonb,

  -- promoted query fields
  address_postcode text,
  address_suburb text,
  address_state text,
  address_country text,
  address_latitude numeric(10,7),
  address_longitude numeric(10,7),

  job_instructions text,
  api_payload jsonb not null default '{}'::jsonb,
  custom_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (tenant_id, external_reference)
);

create index idx_jobs_claim on jobs (tenant_id, claim_id);
create index idx_jobs_type on jobs (tenant_id, job_type_lookup_id);
create index idx_jobs_status on jobs (tenant_id, status_lookup_id);
create index idx_jobs_vendor on jobs (tenant_id, vendor_id);
create index idx_jobs_postcode on jobs (tenant_id, address_postcode);
create index idx_jobs_custom on jobs using gin (custom_data);
```

### Job contacts

```sql
create table job_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  sort_index integer not null default 0,
  source_payload jsonb not null default '{}'::jsonb,
  unique (job_id, contact_id)
);
```

---

## 9. Tasks

Tasks have:

* task type
* either claim or job
* name, description, due date
* priority and status enums
* assignee/recipient behavior. 

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  task_type_lookup_id uuid references lookup_values(id),
  claim_id uuid references claims(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,

  name text not null,
  description text,
  due_date timestamptz,
  priority text not null default 'Low',
  status text not null default 'Open',
  task_payload jsonb not null default '{}'::jsonb,

  assigned_to_user_id uuid references users(id),
  assigned_to_external_reference text,
  created_by_user_id uuid references users(id),

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_task_parent check (claim_id is not null or job_id is not null),
  constraint chk_task_priority check (priority in ('Low','Medium','High','Critical')),
  constraint chk_task_status check (status in ('Open','Completed','Failed'))
);

create index idx_tasks_claim on tasks (tenant_id, claim_id);
create index idx_tasks_job on tasks (tenant_id, job_id);
create index idx_tasks_status on tasks (tenant_id, status);
```

---

## 10. Quotes

Quotes contain:

* top-level quote data
* nested `to`, `for`, `from`
* optional status/type
* totals
* claim/job parent
* groups, combos, items. 

Top-level quote table:

```sql
create table quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  claim_id uuid references claims(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,

  external_reference text,
  quote_number text,
  name text,
  reference text,
  note text,

  status_lookup_id uuid references lookup_values(id),
  quote_type_lookup_id uuid references lookup_values(id),

  quote_date timestamptz,
  expires_in_days integer,

  sub_total numeric(14,2),
  total_tax numeric(14,2),
  total_amount numeric(14,2),

  quote_to jsonb not null default '{}'::jsonb,
  quote_for jsonb not null default '{}'::jsonb,
  quote_from jsonb not null default '{}'::jsonb,
  schedule_info jsonb not null default '{}'::jsonb,
  approval_info jsonb not null default '{}'::jsonb,

  quote_to_email citext,
  quote_to_name text,
  quote_for_name text,
  estimated_start_date date,
  estimated_completion_date date,
  is_auto_approved boolean,

  custom_data jsonb not null default '{}'::jsonb,
  api_payload jsonb not null default '{}'::jsonb,

  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_quote_parent check (claim_id is not null or job_id is not null)
);

create index idx_quotes_job on quotes (tenant_id, job_id);
create index idx_quotes_claim on quotes (tenant_id, claim_id);
create index idx_quotes_status on quotes (tenant_id, status_lookup_id);
create index idx_quotes_number on quotes (tenant_id, quote_number);
create index idx_quotes_to_email on quotes (tenant_id, quote_to_email);
```

### Quote groups / combos / items

These should stay relational.

```sql
create table quote_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  group_label_lookup_id uuid references lookup_values(id),
  description text,
  dimensions jsonb not null default '{}'::jsonb,
  sort_index integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  group_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quote_combos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  quote_group_id uuid not null references quote_groups(id) on delete cascade,
  catalog_combo_id uuid,
  line_scope_status_lookup_id uuid references lookup_values(id),
  name text,
  description text,
  category text,
  sub_category text,
  quantity numeric(14,4),
  sort_index integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  combo_payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  quote_group_id uuid references quote_groups(id) on delete cascade,
  quote_combo_id uuid references quote_combos(id) on delete cascade,
  catalog_item_id uuid,
  line_scope_status_lookup_id uuid references lookup_values(id),
  unit_type_lookup_id uuid references lookup_values(id),
  name text,
  description text,
  category text,
  sub_category text,
  item_type text,
  quantity numeric(14,4),
  tax numeric(14,4),
  unit_cost numeric(14,4),
  buy_cost numeric(14,4),
  markup_type text,
  markup_value numeric(14,4),
  allocated_cost numeric(14,4),
  committed_cost numeric(14,4),
  sort_index integer not null default 0,
  internal boolean,
  note text,
  tags jsonb not null default '[]'::jsonb,
  mismatches jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  item_payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  constraint chk_quote_item_parent check (
    (quote_group_id is not null and quote_combo_id is null) or
    (quote_group_id is null and quote_combo_id is not null)
  )
);
```

---

## 11. Invoices

Invoices belong to purchase orders, have invoice number, dates, totals, status, comments, declined reason, and delete flag behavior. The API also distinguishes new invoices vs updates on existing PO trade invoices.

```sql
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  purchase_order_id uuid not null,
  claim_id uuid references claims(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,

  invoice_number text,
  issue_date timestamptz,
  received_date timestamptz,

  comments text,
  declined_reason text,

  status_lookup_id uuid references lookup_values(id),

  sub_total numeric(14,2),
  total_tax numeric(14,2),
  total_amount numeric(14,2),
  excess_amount numeric(14,2),

  is_deleted boolean not null default false,
  invoice_payload jsonb not null default '{}'::jsonb,

  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, purchase_order_id, invoice_number)
);
```

---

## 12. Purchase orders

POs mirror quotes in many ways and include:

* status
* PO number
* start/end dates and times
* vendor and quote linkage
* type
* note
* party blocks
* totals
* group / combo / item hierarchy. 

```sql
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  claim_id uuid references claims(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  vendor_id uuid references vendors(id),
  quote_id uuid references quotes(id),

  external_id text,
  purchase_order_number text,
  name text,

  status_lookup_id uuid references lookup_values(id),
  purchase_order_type_lookup_id uuid references lookup_values(id),

  start_date date,
  end_date date,
  start_time time,
  end_time time,

  note text,

  po_to jsonb not null default '{}'::jsonb,
  po_for jsonb not null default '{}'::jsonb,
  po_from jsonb not null default '{}'::jsonb,
  service_window jsonb not null default '{}'::jsonb,
  adjustment_info jsonb not null default '{}'::jsonb,
  allocation_context jsonb not null default '{}'::jsonb,

  po_to_email citext,
  po_for_name text,

  total_amount numeric(14,2),
  adjusted_total numeric(14,2),
  adjusted_total_adjustment_amount numeric(14,2),

  purchase_order_payload jsonb not null default '{}'::jsonb,

  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_po_parent check (claim_id is not null or job_id is not null)
);

create index idx_po_job on purchase_orders (tenant_id, job_id);
create index idx_po_claim on purchase_orders (tenant_id, claim_id);
create index idx_po_vendor on purchase_orders (tenant_id, vendor_id);
create index idx_po_number on purchase_orders (tenant_id, purchase_order_number);
```

### PO groups / combos / items

```sql
create table purchase_order_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  group_label_lookup_id uuid references lookup_values(id),
  description text,
  dimensions jsonb not null default '{}'::jsonb,
  sort_index integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  group_payload jsonb not null default '{}'::jsonb
);

create table purchase_order_combos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  purchase_order_group_id uuid not null references purchase_order_groups(id) on delete cascade,
  catalog_combo_id uuid,
  quote_combo_id uuid,
  name text,
  description text,
  category text,
  sub_category text,
  quantity numeric(14,4),
  sort_index integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  combo_payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  purchase_order_group_id uuid references purchase_order_groups(id) on delete cascade,
  purchase_order_combo_id uuid references purchase_order_combos(id) on delete cascade,
  catalog_item_id uuid,
  quote_line_item_id uuid,
  unit_type_lookup_id uuid references lookup_values(id),
  name text,
  description text,
  category text,
  sub_category text,
  item_type text,
  quantity numeric(14,4),
  tax numeric(14,4),
  unit_cost numeric(14,4),
  buy_cost numeric(14,4),
  markup_type text,
  markup_value numeric(14,4),
  reconciliation numeric(14,4),
  manual_allocation boolean,
  sort_index integer not null default 0,
  note text,
  tags jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  item_payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  constraint chk_po_item_parent check (
    (purchase_order_group_id is not null and purchase_order_combo_id is null) or
    (purchase_order_group_id is null and purchase_order_combo_id is not null)
  )
);
```

---

## 13. Messages

Messages are their own entity, can target either a claim or job recipient, may be acknowledgeable, and webhooks only send recipient-visible messages. The API also has `/messages/{id}/acknowledge`. 

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  message_type_lookup_id uuid references lookup_values(id),

  from_claim_id uuid references claims(id),
  from_job_id uuid references jobs(id),
  to_claim_id uuid references claims(id),
  to_job_id uuid references jobs(id),

  to_assignee_type_lookup_id uuid references lookup_values(id),
  to_user_id uuid references users(id),

  subject text,
  body text,
  acknowledgement_required boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid references users(id),

  message_payload jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_message_from check (from_claim_id is not null or from_job_id is not null),
  constraint chk_message_to check (to_claim_id is not null or to_job_id is not null)
);
```

---

## 14. Appointments

Appointments have:

* job parent
* name
* location
* dates
* attendees
* later cancel endpoint
* separate create / update JSON bodies
* attendee objects. 

```sql
create table appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,

  appointment_type_lookup_id uuid references lookup_values(id),
  specialist_visit_type_lookup_id uuid references lookup_values(id),

  name text not null,
  location text not null,              -- ONSITE / DIGITAL
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text,

  cancellation_details jsonb not null default '{}'::jsonb,
  appointment_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_appt_location check (location in ('ONSITE', 'DIGITAL'))
);

create table appointment_attendees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  attendee_type text not null,         -- CONTACT / USER
  user_id uuid references users(id),
  contact_id uuid references contacts(id),
  email citext,
  attendee_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chk_attendee_type check (attendee_type in ('CONTACT','USER'))
);
```

---

## 15. Reports

Reports are highly JSONB-friendly. The API clearly treats them as structured but variable bodies with report type and status around them. 

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  claim_id uuid references claims(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,

  report_type_lookup_id uuid references lookup_values(id),
  status_lookup_id uuid references lookup_values(id),

  title text,
  reference text,

  report_data jsonb not null default '{}'::jsonb,
  report_meta jsonb not null default '{}'::jsonb,
  api_payload jsonb not null default '{}'::jsonb,

  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_reports_job on reports (tenant_id, job_id);
create index idx_reports_claim on reports (tenant_id, claim_id);
create index idx_reports_type on reports (tenant_id, report_type_lookup_id);
create index idx_reports_data on reports using gin (report_data);
```

---

## 16. Attachments

Attachments are polymorphic and support create/update/read/download. They attach to a `relatedRecordType` and `relatedRecordId`, and only some record types allow document type / description / title. 

```sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  related_record_type text not null,
  related_record_id uuid not null,

  document_type_lookup_id uuid references lookup_values(id),

  title text,
  description text,

  file_name text,
  mime_type text,
  file_size bigint,
  storage_provider text,
  storage_key text,
  file_url text,

  attachment_meta jsonb not null default '{}'::jsonb,
  api_payload jsonb not null default '{}'::jsonb,

  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_attachment_record_type check (
    related_record_type in (
      'Claim','Job','PurchaseOrder','Quote','Report','Tender','Invoice','Contact','Vendor','PulseJob'
    )
  )
);

create index idx_attachments_related on attachments (tenant_id, related_record_type, related_record_id);
```

---

## 17. Webhook ingestion

The webhook contract includes:

* `id`
* `type`
* `timestamp`
* `payload.id`
* `payload.teamIds`
* `payload.tenantId`
* `payload.client`
* `payload.projectExternalReference`
* HMAC signature over raw body. 

```sql
create table inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text not null unique,
  tenant_id uuid references tenants(id) on delete set null,

  event_type text not null,
  event_timestamp timestamptz not null,

  payload_entity_id uuid,
  payload_team_ids jsonb not null default '[]'::jsonb,
  payload_tenant_id uuid,
  payload_client text,
  payload_project_external_reference text,

  signature_header text,
  hmac_verified boolean,
  raw_headers jsonb not null default '{}'::jsonb,
  raw_body_text text not null,
  raw_body_json jsonb,
  processing_status text not null default 'pending',
  processing_error text,
  processed_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_webhooks_status on inbound_webhook_events (processing_status, created_at);
create index idx_webhooks_type on inbound_webhook_events (event_type, event_timestamp);
```

---

# What this schema intentionally changes from the earlier version

The big change is that I moved many brittle flattened objects into JSONB:

## Moved to JSONB

* claim `address`
* claim `policy_details`
* claim `financial_details`
* claim `vulnerability_details`
* claim `contention_details`
* job `address`
* job `vendor_snapshot`
* job `temporary_accommodation_details`
* job `specialist_details`
* job `rectification_details`
* job `audit_details`
* quote `quote_to`
* quote `quote_for`
* quote `quote_from`
* quote `schedule_info`
* quote `approval_info`
* purchase order `po_to`
* purchase order `po_for`
* purchase order `po_from`
* purchase order `service_window`
* purchase order `adjustment_info`
* purchase order `allocation_context`
* report `report_data`
* attachment `attachment_meta`

## Kept as columns for performance / integrity

* tenant_id
* claim_id / job_id / vendor_id / quote_id / purchase_order_id
* claim_number
* external_reference
* quote_number
* purchase_order_number
* invoice_number
* status IDs
* type IDs
* dates used operationally
* totals
* postcode / suburb / state where useful
* promoted emails / names where useful

That is the balance you were pointing toward.

---

# Important implementation note

For the JSONB-backed objects, I would treat the JSONB column as the **canonical API-shaped storage**, and populate the promoted columns in application code during upsert.

Example:

* save full `quote_to`
* also extract `quote_to_email` and `quote_to_name`

Same for:

* `claims.address -> address_postcode`
* `jobs.address -> address_postcode`
* `po_to -> po_to_email`

That gives you resilience and performance.

---

# Final recommendation

This is the schema direction I’d use in production for this API:

* **lookup_values** for the many `externalReference`-driven dictionaries
* **JSONB for nested objects**
* **child tables for arrays and hierarchical lines**
* **promoted relational columns for hot query fields**
* **raw webhook + payload retention**
* **full tenant scoping on every operational row**

If you want, next I’ll turn this into a **single runnable PostgreSQL migration file** with indexes, comments, and trigger stubs for syncing promoted columns from JSONB.
