# Catalogue — CW ↔ internal mapping

**Internal tables:** `catalog_items`, `catalog_item_types`, `catalog_categories`, `catalog_assembly_components`
**Services:** `CatalogInboundService`, `CatalogOutboundService`, `CatalogResolutionService`
**Last aligned with:** Catalogue module v1 (`docs/implementation/36_CATALOGUE_MODULE.md`)

> **Policy:** claims-manager is the **catalogue master**. Inbound Crunchwork catalogue IDs are resolved to local rows via `catalog_items.external_reference`. Unknown IDs are logged for admin review — we never auto-create catalogue entries from external sync.

---

## 1. Identity and ownership

| Concept | Internal | Notes |
|---------|----------|-------|
| Local catalogue item | `catalog_items.id` (UUID) | Primary key used on document lines |
| Tenant-scoped code | `catalog_items.code` | Unique per tenant; operator-facing SKU (e.g. `LAB-PLU-08`) |
| External / CW reference | `catalog_items.external_reference` | **Must be the Crunchwork catalog item UUID** when set (Insurance REST API `catalogItemId` format UUID). Never store the SKU/code here. Unique per tenant+catalog when set. |
| Item kind | `catalog_items.kind` | `primitive` or `assembly` |
| Assembly BOM | `catalog_assembly_components` | One-level explosion on document insert (v1) |

---

## 2. Inbound resolution (CW → claims-manager)

When a quote (or other document) payload arrives with `catalogItemId` or `catalogComboId`:

1. If the value is already a UUID matching a local `catalog_items.id`, it is kept as-is.
2. Otherwise look up `catalog_items.external_reference` (expected: CW catalog UUID from the Insurance REST API).
3. On match → replace the payload field with the local UUID before persistence.
4. On miss → log to `external_reference_resolution_log` with `domain = catalog_item` and `resolution_action = unknown_catalog_id`. The original external reference remains in `api_payload`; no local FK is set.

**Hook:** `CrunchworkQuoteMapper` runs `CatalogInboundService.processQuotePayload` on the full quote payload before writing `quotes.api_payload`.

**Review:** `GET /catalog/unresolved-references` lists recent unknown IDs for admin follow-up.

---

## 3. Outbound enrichment (claims-manager → CW)

When creating or updating quotes via the CW API, `CatalogSelectionService.buildOutboundQuoteGroups` and `CatalogOutboundService.enrichPayload` walk line items and combos:

| Internal field | Outbound behaviour |
|----------------|-------------------|
| `catalogItemId` (local UUID) | Replaced with `catalog_items.external_reference` **only when that value is a UUID** (CW catalog item id). Otherwise the field is omitted. |
| `catalogComboId` (local UUID) | Same for assembly/combo rows |
| Missing / non-UUID `external_reference` | Field omitted — line still publishes with name/cost snapshot; no catalogue link on CW until admin sets the CW UUID |

**Contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` / swagger `BaseItemInput.catalogItemId` — type string, format UUID. Sending SKU codes (e.g. `LAB-PLU-08`) causes CW `500 invalid input syntax for type uuid`.

Linked items round-trip; unlinked items continue to work internally and still publish to CW without a catalogue FK.

---

## 4. Document line snapshot fields

When a catalogue item is added to a quote, PO, or work order via `CatalogSelectionService`:

| Snapshot column | Source |
|-----------------|--------|
| `catalog_item_id` / `catalog_combo_id` | FK to `catalog_items` |
| `name`, `description`, `type`, `category` | Copied from catalogue at insert time |
| `unit_cost`, `buy_cost`, `quantity`, `tax` | Snapshotted; not live-linked |
| `totals` JSONB | Computed at insert |

**Price drift:** `CatalogMismatchService` compares snapshotted `unit_cost` on draft quote lines to the current catalogue price. Mismatches are written to `quote_items.mismatches` JSONB and surfaced in the estimate UI.

---

## 5. Unknown ID handling summary

| Scenario | Action |
|----------|--------|
| CW sends known catalog UUID (`external_reference`) | Resolve to local UUID |
| CW sends unknown UUID | Log + leave line unlinked |
| Operator sets `external_reference` to CW catalog UUID | Future inbound/outbound sync resolves automatically |
| Operator creates item with matching CW UUID | Same |
| Seed / CSV leaves `external_reference` empty | Outbound omits `catalogItemId` until linked |

---

## 6. Related endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /quotes/:id/groups` | Ensure default quote group for catalogue selection |
| `POST /quotes/:quoteId/groups/:groupId/catalog-items` | Add primitive with snapshot |
| `POST /quotes/:quoteId/groups/:groupId/catalog-assemblies` | Add assembly with one-level BOM explosion |
| `GET /quotes/:id/catalog-mismatches` | Scan draft quote for price drift (read-only) |
| `POST /quotes/:id/catalog-mismatches/scan` | Scan and flag mismatches on line items |

See also [`quotes.md`](./quotes.md) for full quote/group/combo/item field routing.
