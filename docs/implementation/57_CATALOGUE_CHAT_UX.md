# 57 — Catalogue Chat UX

**Status:** Implemented  
**Date:** 2026-08-20  
**Depends on:** `36_CATALOGUE_MODULE.md`, `46_AGENTIC_AI_PLATFORM.md`, discussion `003-agentic-ui-mcp-apps-readiness.md`  
**Related:** assessment-field pack (open/fill drawer pattern), Claims Filesystem MCP mount

---

## Overview

Improve catalogue authoring by (1) aligning API BOM rules with the product hierarchy, (2) completing category/type CRUD surfaces, and (3) shipping chat-driven workflows via MCP tools, native canvas drawers, and a `catalog-ops` capability pack.

True MCP App iframes remain future work. This tranche uses the same **native canvas drawer** path as assessments (`open_*` / `fill_*` tools → SSE `canvas-component` → `EntityDrawerHost`).

---

## Domain hierarchy

```
Catalog
  └── Category (taxonomy; may hold any kind)
        ├── Primitive (leaf; unit required)
        ├── Assembly (BOM → primitives only)
        └── Scope (BOM → assemblies and/or primitives; never scopes)
```

| Parent | Allowed BOM children |
|--------|----------------------|
| Assembly | Primitive |
| Scope | Primitive, Assembly |
| Primitive | — (no BOM) |

---

## Phase summary

### 1. API

- `CatalogAssemblyService.validateBomLine` uses `isAllowedBomComponent` (assembly→primitive; scope→assembly|primitive; never nest scopes).
- Categories: `GET /catalog/categories/:id`; frontend update/delete wired.
- Types: `GET /catalog/types/:id`, `DELETE /catalog/types/:id` (soft deactivate).

### 2. MCP (`apps/claims-mcp/src/tools/catalog.tool.ts`)

CRUD proxies retained with kind-aware descriptions, plus canvas tools:

| Tool | Drawer |
|------|--------|
| `open_catalog` / `fill_catalog` | `CatalogFormDrawer` |
| `open_catalog_item` / `fill_catalog_item` | `CatalogItemFormDrawer` |
| `open_catalog_category` / `fill_catalog_category` | `CatalogCategoriesDrawer` |
| `open_catalog_bom` / `fill_catalog_bom` | `CatalogBomDrawer` |

Integration display name: **Claims Filesystem**.

### 3. Frontend canvas

- Drawers registered in `drawer-registry.ts`.
- Tool → component map in `canvas-tool-map.ts` and `AiChatService` `CANVAS_TOOL_MAP`.
- Forms accept AI fill props (merge on open EntityDrawer).
- `CatalogBomEditor` filters candidates by parent kind.

### 4. Capability pack

`apps/api/packs/catalog-ops/`:

- Agent: `catalog-assistant`
- Skills: find-catalog-item, create-item, create-assembly, create-scope, edit-catalog-item, manage-bom, manage-category, import-catalog

Install via capability packs admin (builtin pack root).

---

## Key files

| Area | Path |
|------|------|
| BOM rules | `apps/api/src/modules/catalog/catalog.utils.ts` |
| Assembly service | `apps/api/src/modules/catalog/services/catalog-assembly.service.ts` |
| MCP tools | `apps/claims-mcp/src/tools/catalog.tool.ts` |
| Pack | `apps/api/packs/catalog-ops/` |
| Drawers | `apps/frontend/src/components/catalog/Catalog*Drawer.tsx`, `CatalogBomDrawer.tsx` |

---

## Test plan

- [ ] Unit: `isAllowedBomComponent` matrix (already in `catalog.utils.spec.ts`)
- [ ] API: adding assembly under assembly returns 400; scope under scope returns 400; primitive under assembly OK; assembly under scope OK
- [ ] Admin: create/edit/deactivate category; BOM picker only lists allowed kinds
- [ ] Chat: install `catalog-ops`, open Catalogue Assistant, create item → assembly BOM → scope BOM with drawers opening
- [ ] Import skill: preview then confirm CSV import

---

## Out of scope

- MCP App iframe host / `ui://` resources
- Multi price lists, parametric BOM, vendor pricing
- Full admin page visual redesign
