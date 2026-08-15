# Document template transform layer — canonical schemas + JSONata

**Date:** 2026-08-15  
**Reference repo:** `billie-template-manager` ([github.com/davidcrouch/billie-template-manager](https://github.com/davidcrouch/billie-template-manager.git))  
**This repo:** `apps/api/src/modules/document-generation` + `apps/frontend/src/components/document-templates`  
**Companion:** `docs/reviews/estimate-cw-api-db-ui-gap.md` (quote/estimate gap analysis)

**Goal:** Define canonical JSON schemas for every document type, introduce a JSONata transformation layer between raw entity data and docx merge fields, and build an admin UI that makes it easy for non-technical users to create Word templates without needing to understand the underlying data model.

---

## 1. Executive summary

| Concern | Current state | Target state |
|---|---|---|
| **Entity data shape** | 34 untyped `DataMapper.aggregate()` methods return `TemplateData` (`Record<string, unknown>`) | Each mapper validated against a Zod "source schema" exported as JSON Schema |
| **Merge-field contract** | Mapper output keys = merge tags; any rename breaks templates | Explicit "target schema" per document type; template authors reference only target keys |
| **Transform layer** | None — mappers hard-code field names, formatting, flattening | Per-type JSONata rules (editable in admin) transform source → target |
| **Admin UI** | Detail page has stub "Transform" tab (dashed placeholder) | Three-panel editor: source schema (left), JSONata rules (center), target schema (right) |
| **Template author UX** | Must know raw mapper keys; no documentation of available fields | Target schema provides auto-generated merge-tag reference; simpler, stable field names |

---

## 2. Billie template-manager review

### What it does

Billie is a Next.js 15 / Supabase app for managing document templates, JSONata transformations, and JSON schemas. Its data model:

```
Schema ──input_schema_id──► Transformation ──transformation_id──► Template
```

| Entity | Purpose |
|---|---|
| **Schema** | JSON Schema definition for input data (`schema_definition` JSONB) |
| **Transformation** | JSONata rules + inline/linked input schema + cached output schema |
| **Template** | `.docx` file in Supabase Storage, linked to a transformation |

### JSONata usage

- Package: `jsonata@^2.0.6` (client-side only in this repo)
- Rules stored in `transformations.jsonata_rules` (TEXT column)
- Executed in `TransformationEditor.tsx` via `jsonata(rules).evaluate(inputData)` with 30s timeout
- AI-assisted editing via `TransformationsChatProvider.tsx` (tool: `setJsonataRules`)
- Built-in template library (`TransformationTemplateLibrary.tsx`) with ~6 starter patterns
- Error feedback loop: transform failures sent to AI chat for auto-fix

### docx-templates usage

- **Not embedded in this repo** — delegated to `billie-webhooks` external service
- Uses `docx-templates` (guigrpa) merge-tag syntax: `<<name>>`, `<<FOR>>`, `<<IF>>`, `<<EXEC>>`
- `.docx` preview via `mammoth` (HTML conversion, not merge)
- Template ↔ transformation link modeled in DB but **not wired in UI**

### Key gaps in billie (relevant to our adoption)

1. Template test sends **raw JSON** to webhook — does not apply JSONata in-app
2. `transformation_id` on templates is defined in DB schema but never set via UI
3. `get_output_schema` RPC is a stub (returns empty `properties`)
4. Extra components exported but not mounted: debugger, versioning, import/export
5. Billie has one entity type (Journal); we have 34 document types

### What to adopt vs build

| Billie concept | Adopt? | Notes |
|---|---|---|
| Schema → Transformation → Template chain | **Yes** | Core architecture; adapt to our `DocumentType` enum |
| Client-side JSONata with live preview | **Yes** | Import `jsonata` into frontend; same evaluate pattern |
| Three-panel transformation editor | **Yes** | Source schema ↔ JSONata rules ↔ target output |
| `TransformationEditorContext` pattern | **Yes** | Context provider with `jsonataRules` / `setJsonataRules` / error feedback |
| AI-assisted JSONata editing | **Later** | Nice-to-have; depends on existing chat infrastructure |
| Supabase storage for templates | **No** | We use GCS via `GcsStorageService` + filesystem documents |
| External webhook merge | **No** | We run `Docxtemplater` in-process (`TemplateEngineService`) |
| Billie journal-specific schemas | **No** | Replace with our entity schemas |

---

## 3. Current architecture

### Document types (34 printable + 1 default)

**Detail types (18):** `quote`, `invoice`, `purchase_order`, `work_order`, `proposal`, `report`, `bill`, `rfq`, `job_details`, `scope_of_work`, `claim`, `contact`, `task`, `appointment`, `message`, `journal`, `vendor`, `assessment`

**List types (16):** `jobs_list`, `quotes_list`, `invoices_list`, `bills_list`, `work_orders_list`, `purchase_orders_list`, `proposals_list`, `rfqs_list`, `reports_list`, `claims_list`, `contacts_list`, `tasks_list`, `appointments_list`, `messages_list`, `journals_list`, `vendors_list`

### Current print flow

```
PrintButton → PrintDocumentDrawer → generateAndDownloadDocument()
  → POST /api/generated-documents/generate
    → DocumentGenerationService.generate()
      → mapper.aggregate({ tenantId, entityId })  →  TemplateData (untyped)
      → TemplateEngineService.populate(docxBuffer, data)  →  Docxtemplater merge
      → PdfConverterService  →  PDF
      → GCS upload + download URL
```

### Data mappers

All in `apps/api/src/modules/document-generation/data-mappers/*.mapper.ts`.

Each returns `Promise<TemplateData>` where `TemplateData = { [key: string]: unknown }`. There are no compile-time or runtime guarantees on the shape.

**List mappers** share a convention (not a type):
```typescript
{
  company_name: string,
  report_title: string,
  report_date: string,
  total_count: string,
  items: Array<{ /* entity-specific fields */ }>
}
```

**Detail mappers** each have unique flat/nested structures. Only `job_details` and `scope_of_work` share a mapper (`job.mapper.ts`).

### Current admin UI

- **List page** (`DocumentTemplatesSettingsPanel.tsx`): grouped table of all 35 types with template assignment dropdowns
- **Detail page** (`DocumentTemplateDetailClient.tsx`): two tabs — "Transform" (empty placeholder) and "Template" (docx selector)
- The "Transform" tab currently shows: *"No custom transform is configured for this scenario yet. Generation uses the built-in data mapper."*

---

## 4. Proposed architecture

### 4.1 Canonical source schemas

Define a Zod schema for every mapper's return type. These are the **source schemas** — they describe the raw entity data as produced by the mapper.

```
apps/api/src/modules/document-generation/
  schemas/
    source/
      _shared.ts            ← ListEnvelopeSchema, company_name, report_date, etc.
      quote.source.ts       ← QuoteSourceSchema (Zod)
      invoice.source.ts     ← InvoiceSourceSchema
      ...                   ← one per detail type
      quotes-list.source.ts ← QuotesListSourceSchema (extends ListEnvelopeSchema)
      ...                   ← one per list type
    target/
      quote.target.ts       ← QuoteTargetSchema (Zod) — simplified merge-tag fields
      ...
    index.ts                ← DOCUMENT_TYPE_SOURCE_SCHEMAS, DOCUMENT_TYPE_TARGET_SCHEMAS maps
    json-schema.ts          ← zodToJsonSchema() utility, cached export
```

**List envelope shared schema:**

```typescript
import { z } from 'zod';

export const ListEnvelopeSchema = z.object({
  company_name: z.string(),
  report_title: z.string(),
  report_date: z.string(),
  total_count: z.string(),
});
```

Each list source schema extends it with a typed `items` array:

```typescript
export const QuotesListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    quote_number: z.string(),
    name: z.string(),
    date: z.string(),
    total_amount: z.string(),
  })),
});
```

**Detail source schemas** are derived directly from each mapper's return shape, e.g.:

```typescript
export const InvoiceSourceSchema = z.object({
  company_name: z.string(),
  invoice_number: z.string(),
  issue_date: z.string(),
  received_date: z.string(),
  comments: z.string(),
  sub_total: z.string(),
  total_tax: z.string(),
  total_amount: z.string(),
  excess_amount: z.string(),
  po_number: z.string(),
  po_name: z.string(),
});
```

### 4.2 Target schemas

Target schemas define the **simplified, template-author-friendly** merge-tag namespace. The purpose: decouple template authors from the internal data model and provide stable, readable field names.

Example — invoice target might group fields:

```typescript
export const InvoiceTargetSchema = z.object({
  company: z.string().describe('Company name'),
  number: z.string().describe('Invoice number'),
  date: z.string().describe('Issue date'),
  received: z.string().describe('Date received'),
  notes: z.string().describe('Comments / notes'),
  subtotal: z.string().describe('Sub-total before tax'),
  tax: z.string().describe('Total tax amount'),
  total: z.string().describe('Total including tax'),
  excess: z.string().describe('Excess amount'),
  po: z.object({
    number: z.string().describe('Purchase order number'),
    name: z.string().describe('Purchase order name'),
  }).describe('Linked purchase order'),
});
```

Template authors then use `{{company}}`, `{{number}}`, `{{po.number}}` instead of `{{company_name}}`, `{{invoice_number}}`, `{{po_number}}`.

### 4.3 JSONata transform rules

Each document type gets a default JSONata expression that maps source → target. Stored in the DB alongside the template assignment.

Example for invoice:

```jsonata
{
  "company": company_name,
  "number": invoice_number,
  "date": issue_date,
  "received": received_date,
  "notes": comments,
  "subtotal": sub_total,
  "tax": total_tax,
  "total": total_amount,
  "excess": excess_amount,
  "po": {
    "number": po_number,
    "name": po_name
  }
}
```

### 4.4 Updated generation flow

```
mapper.aggregate()
  → validate against SourceSchema (runtime, log warnings)
  → apply JSONata rules (if configured) OR pass through (backward compat)
  → validate against TargetSchema (runtime, log warnings)
  → Docxtemplater merge on .docx with target data
  → PDF conversion + upload
```

### 4.5 Admin UI — transform editor

Replace the placeholder "Transform" tab in `DocumentTemplateDetailClient.tsx` with a three-panel editor:

```
┌──────────────────────────────────────────────────────────────┐
│  Transform: Invoice                                          │
├────────────────┬──────────────────┬──────────────────────────┤
│                │                  │                           │
│  SOURCE SCHEMA │  JSONATA RULES   │  TARGET SCHEMA           │
│                │                  │                           │
│  company_name  │  {               │  company: "Acme Corp"    │
│  invoice_number│    "company":    │  number: "INV-001"       │
│  issue_date    │      company_... │  date: "1 August 2026"   │
│  received_date │    "number":     │  ...                     │
│  comments      │      invoice_... │                           │
│  sub_total     │    ...           │  ✓ Matches target schema │
│  total_tax     │  }               │                           │
│  total_amount  │                  │                           │
│  excess_amount │  ┌─────────────┐ │                           │
│  po_number     │  │ ▶ Transform │ │                           │
│  po_name       │  └─────────────┘ │                           │
│                │                  │                           │
└────────────────┴──────────────────┴──────────────────────────┘
```

Left panel: read-only schema tree (collapsible for nested). Center: editable JSONata with syntax highlighting (CodeMirror or Monaco). Right: live-preview of transform output against sample data, with validation indicators against the target schema.

---

## 5. Database changes

### New table: `document_template_transforms`

```sql
CREATE TABLE document_template_transforms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES organizations(id),
  document_type TEXT NOT NULL,
  jsonata_rules TEXT,
  target_schema JSONB,
  test_data     JSONB,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    UUID,
  
  UNIQUE (tenant_id, document_type)
);
```

Each (tenant, document_type) pair gets at most one transform. `jsonata_rules` is the JSONata expression string. `target_schema` stores the JSON Schema for the target (auto-derived or manually defined). `test_data` stores sample source data for the editor preview.

Source schemas are **not stored in the DB** — they are code-defined and served via an API endpoint so the frontend can display them.

### Existing table changes

None required initially. The `document_templates` table already maps `(tenant_id, document_type)` → template file. The transform is a parallel concern keyed on the same composite.

---

## 6. API endpoints

### Source schema endpoint (read-only, from code)

```
GET /api/document-generation/schemas/:documentType/source
→ { schema: <JSON Schema>, sampleData: <mapper output for demo entity> }
```

Returns the Zod-derived JSON Schema for the given document type's source mapper. `sampleData` is optional — could use test fixtures or a real entity.

### Target schema + transform CRUD

```
GET    /api/document-generation/transforms/:documentType
PUT    /api/document-generation/transforms/:documentType
DELETE /api/document-generation/transforms/:documentType

Body (PUT): {
  jsonataRules?: string,
  targetSchema?: object,
  testData?: object
}
```

### Transform preview (evaluate JSONata without saving)

```
POST /api/document-generation/transforms/:documentType/preview
Body: { sourceData: object, jsonataRules: string }
→ { result: object, errors?: string[] }
```

This can run server-side (trusted JSONata evaluation) or the frontend can evaluate client-side (as billie does). Client-side is faster for interactive editing; server-side is safer for complex expressions.

---

## 7. Frontend dependencies

| Package | Purpose | billie uses? |
|---|---|---|
| `jsonata` | Evaluate JSONata rules client-side in editor | Yes (`^2.0.6`) |
| `@codemirror/lang-json` | Syntax highlighting for JSONata / JSON panels | No (billie uses plain textarea via `ContentDisplay`) |
| `zod-to-json-schema` | Convert Zod source/target schemas to JSON Schema for display | No (billie stores JSON Schema directly) |

`jsonata` is the only hard requirement. CodeMirror is a quality-of-life improvement for the editor.

---

## 8. Implementation steps

### Phase 1 — Canonical source schemas (API, no UI changes)

| Step | Description | Files |
|---|---|---|
| 1.1 | Create `schemas/source/_shared.ts` with `ListEnvelopeSchema` | New |
| 1.2 | Create one `*.source.ts` per detail mapper (18 files), derived from mapper return shapes | New |
| 1.3 | Create one `*.source.ts` per list mapper (16 files), extending `ListEnvelopeSchema` | New |
| 1.4 | Create `schemas/index.ts` exporting `DOCUMENT_TYPE_SOURCE_SCHEMAS` map | New |
| 1.5 | Add `z.parse()` validation in each mapper's `aggregate()` (warn-only, don't break generation) | Modify 34 mappers |
| 1.6 | Add `json-schema.ts` utility using `zod-to-json-schema` | New |
| 1.7 | Add `GET /schemas/:documentType/source` endpoint | New controller route |

### Phase 2 — Target schemas + JSONata defaults

| Step | Description | Files |
|---|---|---|
| 2.1 | Define target schemas for each document type (simplify field names, add `.describe()`) | New `schemas/target/*.target.ts` |
| 2.2 | Write default JSONata rules for each document type (source → target mapping) | New `schemas/defaults/*.jsonata.ts` or `.jsonata` files |
| 2.3 | Create `document_template_transforms` table (migration) | New migration |
| 2.4 | Create repository + service for transforms | New |
| 2.5 | Add CRUD endpoints for transforms | New controller routes |
| 2.6 | Seed default JSONata rules per document type | Seed script |

### Phase 3 — Generation pipeline integration

| Step | Description | Files |
|---|---|---|
| 3.1 | Update `DocumentGenerationService.runGenerate()` to load transform for the document type | Modify service |
| 3.2 | If transform exists: evaluate JSONata on mapper output, use result as merge data | Modify service |
| 3.3 | If no transform: pass mapper output directly (backward compatibility) | Modify service |
| 3.4 | Add optional target schema validation (warn/log, don't block) | Modify service |
| 3.5 | Install `jsonata` in `apps/api` | `package.json` |

### Phase 4 — Admin UI transform editor

| Step | Description | Files |
|---|---|---|
| 4.1 | Install `jsonata` in `apps/frontend` | `package.json` |
| 4.2 | Create `TransformEditorContext.tsx` (adapted from billie's pattern) | New |
| 4.3 | Create `SchemaTreePanel.tsx` — collapsible JSON Schema tree viewer | New |
| 4.4 | Create `JsonataEditorPanel.tsx` — editable JSONata with syntax highlighting | New |
| 4.5 | Create `TransformPreviewPanel.tsx` — live output + validation indicators | New |
| 4.6 | Create `TransformEditor.tsx` — three-panel layout composing the above | New |
| 4.7 | Replace placeholder in `DocumentTemplateDetailClient.tsx` "Transform" tab | Modify |
| 4.8 | Add BFF routes for source schema + transform CRUD | New/modify frontend API routes |

### Phase 5 — Polish + AI assist (optional)

| Step | Description |
|---|---|
| 5.1 | Add AI chat assistant for JSONata rule writing (like billie's `TransformationsChatProvider`) |
| 5.2 | Add "Load sample data" button (fetch a real entity from API for preview) |
| 5.3 | Add JSONata template library (common patterns: rename, flatten, group, conditional) |
| 5.4 | Add merge-tag reference documentation panel (auto-generated from target schema) |
| 5.5 | Add transform versioning / history |

---

## 9. Schema inventory — what each mapper returns today

This table is the starting point for writing source schemas. Each row documents the keys returned by the mapper's `aggregate()` method.

### Detail mappers

| Document type | Mapper file | Top-level keys | Nested structures |
|---|---|---|---|
| `quote` | `quote.mapper.ts` | `company_name`, `quote_number`, `quote_name`, `quote_date`, `quote_reference`, `quote_note`, `expires_in_days`, `estimated_start_date`, `estimated_completion_date`, `quote_to_name`, `quote_to_email`, `quote_to_address`, `quote_for_name`, `quote_from_name`, `quote_from_address`, `sub_total`, `total_tax`, `total_amount` | `groups[].{ group_name, group_subtotal, items[].{ item_name, item_description, item_category, item_quantity, item_unit_cost, item_tax, item_total } }` |
| `invoice` | `invoice.mapper.ts` | `company_name`, `invoice_number`, `issue_date`, `received_date`, `comments`, `sub_total`, `total_tax`, `total_amount`, `excess_amount`, `po_number`, `po_name` | None |
| `purchase_order` | `purchase-order.mapper.ts` | Similar to quote — company, PO details, groups/items | `groups[].items[]` |
| `work_order` | `work-order.mapper.ts` | Similar to quote — company, WO details, groups/items | `groups[].items[]` |
| `proposal` | `proposal.mapper.ts` | Similar to quote — company, proposal details, groups/items | `groups[].items[]` |
| `bill` | `bill.mapper.ts` | `company_name`, `invoice_number`, `issue_date`, `received_date`, `comments`, `sub_total`, `total_tax`, `total_amount`, `excess_amount`, `po_number`, `po_name` | None |
| `rfq` | `rfq.mapper.ts` | Flat RFQ fields | Needs audit |
| `job_details` | `job.mapper.ts` | `company_name`, `job_name`, `job_reference`, `request_date`, `claim_*`, `address_*` | None |
| `scope_of_work` | `job.mapper.ts` | Same as `job_details` (shared mapper) | None |
| `claim` | `claim.mapper.ts` | Flat claim fields | Needs audit |
| `contact` | `contact.mapper.ts` | Flat contact fields | Needs audit |
| `task` | `task.mapper.ts` | Flat task fields | Needs audit |
| `appointment` | `appointment.mapper.ts` | Flat appointment fields | Needs audit |
| `message` | `message.mapper.ts` | Flat message fields | Needs audit |
| `journal` | `journal.mapper.ts` | Flat journal fields | Needs audit |
| `vendor` | `vendor.mapper.ts` | Flat vendor fields | Needs audit |
| `assessment` | `assessment.mapper.ts` | ~40 flat keys covering attendance, building, habitability, hazards, damage, make-safe, temp accommodation, recommendation | None (fully flattened) |
| `report` | `report.mapper.ts` | Report metadata + flattened `reportData` as `data_*` keys | Dynamic `data_*` keys |

### List mappers (all share envelope)

| Document type | Mapper file | Item keys |
|---|---|---|
| `jobs_list` | `jobs-list.mapper.ts` | `name`, `reference`, `request_date`, `suburb`, `state` |
| `quotes_list` | `quotes-list.mapper.ts` | `quote_number`, `name`, `date`, `total_amount` |
| `invoices_list` | `invoices-list.mapper.ts` | Needs audit (likely: `invoice_number`, `name`, `date`, `total_amount`) |
| `bills_list` | `bills-list.mapper.ts` | Needs audit |
| `work_orders_list` | `work-orders-list.mapper.ts` | Needs audit |
| `purchase_orders_list` | `purchase-orders-list.mapper.ts` | Needs audit |
| `proposals_list` | `proposals-list.mapper.ts` | Needs audit |
| `rfqs_list` | `rfqs-list.mapper.ts` | Needs audit |
| `reports_list` | `reports-list.mapper.ts` | Needs audit |
| `claims_list` | `claims-list.mapper.ts` | `claim_number`, `external_reference`, `lodgement_date`, `policy_number` |
| `contacts_list` | `contacts-list.mapper.ts` | `full_name`, `email`, `mobile_phone` |
| `tasks_list` | `tasks-list.mapper.ts` | `name`, `status`, `priority`, `due_date` |
| `appointments_list` | `appointments-list.mapper.ts` | `name`, `location`, `start_date`, `end_date`, `status` |
| `messages_list` | `messages-list.mapper.ts` | `subject`, `created_at`, `acknowledgement_required` |
| `journals_list` | `journals-list.mapper.ts` | `name`, `status`, `suburb`, `state`, `created_at` |
| `vendors_list` | `vendors-list.mapper.ts` | `name`, `external_reference`, `phone`, `state`, `is_active` |

**"Needs audit"** = mapper exists but return shape was not fully read during this review. Step 1.2/1.3 will read each mapper in full.

---

## 10. List schema analysis — shared vs unique

### Shared envelope (confirmed across all list mappers)

All 16 list mappers return the same four envelope keys: `company_name`, `report_title`, `report_date`, `total_count`. This is a strong candidate for a shared `ListEnvelopeSchema`.

### Item schemas

Item rows are **not shared** — each entity type has different fields. However, some groups have similar shapes:

| Pattern | Document types | Common item fields |
|---|---|---|
| **Financial documents** | `quotes_list`, `invoices_list`, `bills_list`, `proposals_list`, `purchase_orders_list`, `work_orders_list` | `number`, `name`, `date`, `total_amount` (naming varies slightly) |
| **Operational entities** | `tasks_list`, `appointments_list`, `messages_list` | `name`, `status`, `date` (different date fields) |
| **Location-based** | `jobs_list`, `journals_list` | `name`, `suburb`, `state` |
| **Unique** | `claims_list`, `contacts_list`, `vendors_list`, `rfqs_list`, `reports_list` | Entity-specific fields |

**Recommendation:** Define per-type item schemas but extract a `FinancialListItemSchema` base for the financial group (number + name + date + amount). The shared `ListEnvelopeSchema` wraps a generic `items: z.array(z.object({...}))` that each list type specializes.

---

## 11. Risk assessment

| Risk | Mitigation |
|---|---|
| Breaking existing templates when merge tags change | Phase 3 defaults to pass-through (no transform = current behavior). Templates only break if a transform is explicitly saved with different output keys. |
| JSONata complexity for admins | Default rules are pre-generated for all types. Admin only needs to edit if they want to customize merge-tag names. The target schema panel shows what fields the template can use. |
| Performance of JSONata evaluation in generate pipeline | JSONata evaluation is fast (< 10ms for typical payloads). Compile once, evaluate per request. |
| 34 schemas to create and maintain | Automate initial generation by running each mapper against a test tenant; diff the output to generate Zod definitions. Thereafter, changes to mappers require corresponding schema updates (enforced by validation in step 1.5). |
| Divergence between source schemas and mapper implementations | Runtime `z.parse()` in mappers catches drift immediately. CI tests can also validate a sample payload per mapper. |
| `report.mapper.ts` dynamic keys (`data_*`) | Report mapper flattens arbitrary `reportData` fields. Its source schema must use `z.record()` for the dynamic portion, with a documented convention. |

---

## 12. Open questions

1. **Should target schemas be tenant-customizable?** If yes, store in `document_template_transforms.target_schema`. If no, define in code alongside source schemas.

2. **Should we switch from Docxtemplater to docx-templates?** Billie uses `docx-templates` (different library). Current codebase uses `docxtemplater`. Both support merge tags but with different syntax (`{{tag}}` vs `<<tag>>`). Migration is possible but adds scope. **Recommendation:** Stay with Docxtemplater for now; the transform layer is library-agnostic.

3. **Client-side vs server-side JSONata evaluation in the editor?** Billie evaluates client-side. This is fine for preview but means sending `jsonata` (npm package, ~200KB) to the browser. The alternative is a server-side preview endpoint. **Recommendation:** Client-side for interactive editing (faster feedback), server-side for actual generation.

4. **Should `assessment` have a list type (`assessments_list`)?** Currently the only detail type without a list counterpart. Likely yes, but out of scope for this feature.

5. **How should the `report` type handle dynamic keys?** Reports flatten arbitrary `reportData` into `data_*` keys. The source schema needs a different approach (passthrough or record type). The target schema could define a structured `data` object with known fields per report type, but this depends on whether report types are themselves dynamic.
