# Building repairs catalogue data

## Files

| File | Description |
|------|-------------|
| `building-repairs-catalog.csv` | 520+ insurance building repair catalogue items for import |
| `generate-building-repairs-catalog.mjs` | Regenerates the CSV (run after editing item definitions) |

## Import

1. Open **Admin → Catalogue** in claims-manager.
2. Click **Import CSV** and paste the file contents (or upload if supported).
3. Import runs `CatalogBootstrapService.ensureDefaults` — default types and categories are created on first import if the tenant catalogue is empty.
4. **Missing categories** referenced in `category_code` are **auto-created** during import (including the `trades` parent when needed). Known codes use default names; unknown codes are humanized from the code (e.g. `water_damage` → "Water Damage") and placed under `trades`.

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

## Regenerate

```bash
node data/generate-building-repairs-catalog.mjs
```

## Coverage

Items cover typical insurance claim building repairs: water/flood, fire/smoke, storm, mould, wet areas, kitchens, roofing, electrical, plumbing, plastering, carpentry, painting, flooring, external works, equipment hire, subcontract lump sums, and scope assemblies.
