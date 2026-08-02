# Building repairs catalogue data

Two related seed catalogues are generated together from a single script:

1. **Crunchwork v1 (CSV import)** — `building-repairs-catalog.csv`. A flat list of
   primitives and fixed-price assemblies in the Crunchwork-style import format used
   by `CatalogBootstrapService`. This is what gets pasted/uploaded via **Admin →
   Catalogue → Import CSV**.
2. **Internal Building Repairs (computed BOM)** — `internal-assembly-bom.json`. For
   every assembly in the CSV, the underlying bill of materials (primitive `code` +
   `quantity` + `wasteFactor`) needed to price that assembly with `pricingMode:
   "computed"` instead of a fixed lump sum. Every component `code` in this file is
   guaranteed to exist as a primitive in the CSV (the generator validates this and
   throws if not). Seeding logic maps this internal CSV catalogue onto the
   Crunchwork catalogue schema by `code`.

## Files

| File | Description |
|------|-------------|
| `building-repairs-catalog.csv` | 600+ insurance building repair catalogue items for import (520+ primitives, 80+ fixed-price assemblies) |
| `internal-assembly-bom.json` | Computed-pricing BOM: one entry per assembly with 3–8 components referencing primitive codes from the CSV |
| `generate-building-repairs-catalog.mjs` | Regenerates both files (run after editing item definitions) |

## Seed (preferred)

```bash
pnpm --filter api run db:seed
# or for a new tenant: POST /internal/seed-tenant
```

`catalog-dev` seed creates both catalogues for the tenant:

| Catalogue | Type | Contents |
|-----------|------|----------|
| **Crunchwork v1** | `crunchwork` | All CSV rows (primitives + fixed assemblies); `external_reference` = `code` for CW sync |
| **Building Repairs** | `internal` | CSV primitives + ~80+ **computed** assemblies from `internal-assembly-bom.json` with real BOM lines |

## Manual import

1. Open **Admin → Catalogue** in claims-manager.
2. Click **Import CSV** and paste the file contents (or upload if supported).
3. Import runs `CatalogBootstrapService.ensureDefaults` — default types and categories are created on first import if the tenant catalogue is empty.
4. **Missing categories** referenced in `category_code` are **auto-created** during import (including the `trades` parent when needed). Known codes use default names; unknown codes are humanized from the code (e.g. `water_damage` → "Water Damage") and placed under `trades`.
5. CSV import does **not** create BOM lines — use the seed (or Admin assembly editor) for computed assemblies.

### Required unit types

Primitives use `unit_type_ref` values **`ea`** (each) and **`hr`** (hour). Ensure the tenant has these in **Settings → Lookups → unit_type**, or run `pnpm --filter api db:seed` (catalog-dev seed creates them).

## CSV columns

| Column | Purpose |
|--------|---------|
| `code` | Unique item code per tenant |
| `display_name` | Short name shown in lists and pickers (maps to `catalog_items.name`) |
| `line_item_description` | Longer text copied onto quote/PO/WO lines (maps to `catalog_items.description`) |
| `kind` | `primitive` or `assembly` |
| `type_code` | `material`, `labour`, `equipment`, `vendor`, or `other` |
| `category_code` | `electrical`, `carpentry`, `plumbing`, `plastering`, or `general` |
| `unit_type_ref` | Required for primitives: `ea` or `hr` |
| `unit_cost` / `buy_cost` | Sell and buy rates (ex. tax) |
| `markup_type` / `markup_value` | Typically `percent` and `20` |
| `tax_rate` | GST rate, e.g. `0.10` |
| `pricing_mode` / `fixed_unit_cost` | Assemblies use `fixed` with a lump-sum sell price |

Legacy headers `name` and `description` are still accepted by the import API.

## `internal-assembly-bom.json` format

```json
{
  "code": "ASM-WET-BATH-REL",
  "name": "Bathroom relining",
  "description": "Assembly allowance for bathroom relining including waterproofing wall linings and fit-off",
  "typeCode": "other",
  "categoryCode": "plumbing",
  "pricingMode": "computed",
  "components": [
    { "code": "MAT-PLUM-BACKFLOW-19", "quantity": 12, "wasteFactor": 1.07 },
    { "code": "LAB-PLU-09", "quantity": 2, "wasteFactor": 1 }
  ]
}
```

`code` matches the corresponding assembly row's `code` in the CSV. `components[].code`
always resolves to a `primitive` row's `code` in the CSV — the generator asserts this
and fails the build if any reference is missing. Use this file when seeding assemblies
that should price dynamically from their components rather than a fixed lump sum.

## Word document templates (`templates/`)

Standard `.docx` blanks seeded into each tenant’s **Templates & Forms** folder and
wired to Admin → Document Templates:

| File | Assigned scenarios |
|------|--------------------|
| `TAX INVOICE.docx` | Invoice |
| `INVOICE.docx` | Bill |
| `REQUEST FOR QUOTATION.docx` | RFQ, Quote, Purchase Order |
| `SCOPE OF WORK.docx` | Work Order, Proposal, Report |

**How it works:**

1. CI/CD syncs `data/templates/*.docx` → `gs://{bucket}/platform/templates/` on deploy
2. On a tenant's first login, `ProvisioningService` reads from the GCS platform
   prefix (or local `data/templates/` fallback for dev) and uploads through the
   real API pipeline (thumbnails, upload pipelines, etc.)
3. Document Templates settings are then assigned to match each scenario

For local dev, ensure ADC is configured (`gcloud auth application-default login`)
or templates will be read from the local `data/templates/` directory as a fallback.

## Regenerate

```bash
node data/generate-building-repairs-catalog.mjs
```

Regenerating rewrites both `building-repairs-catalog.csv` and
`internal-assembly-bom.json` from the same in-memory item definitions, so primitive
codes referenced by the BOM always stay in sync with the CSV.

## Coverage

Items cover typical insurance claim building repairs: water/flood, fire/smoke, storm, mould, wet areas, kitchens, roofing, electrical, plumbing, plastering, carpentry, painting, flooring, external works, equipment hire, subcontract lump sums, and scope assemblies.
