# 63j — Guides: AI, Integrations, Admin

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Priority:** P2–P3  
**Related:** `46_AGENTIC_AI_PLATFORM.md`, `60_PAGE_AWARE_AGENT_CONTEXT.md`, `62_ONLINE_HELP_SYSTEM.md`, `28_PROVIDERS_MANAGEMENT_UI.md`

---

## Objective

Document remaining Configuration pages: AI admin, connections/MCP, feature flags, notifications. After this subplan, **every sidebar href** in `AppSidebar` has an ingested guide.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `configuration/ai/agents.md` | `agents` | `/admin/agents` | admin |
| `configuration/ai/skills.md` | `skills` | `/admin/skills` | admin |
| `configuration/ai/capability-packs.md` | `capability-packs` | `/admin/capability-packs` | admin |
| `configuration/ai/ai-audit.md` | `ai-audit` | `/admin/ai-audit` | admin |
| `configuration/integrations/connections.md` | `connections` | `/connections`, `/connections/[id]` | manager |
| `configuration/integrations/mcp-connections.md` | `mcp-connections` | `/mcp-connections` | admin |
| `configuration/integrations/mcp-servers.md` | `mcp-servers` | `/admin/mcp-servers` | admin |
| `configuration/admin/features.md` | `features` | `/admin/features` | admin |
| `configuration/admin/notifications.md` | `notifications` | `/admin/notifications` | manager |

Nav gating: Agents/Skills/Packs/MCP often require features `ai.agents`, `ai.skills`, `ai.connections` and permission `ai.admin`. Features page: `features.read` / `features.manage`. Document the live lock/empty states.

---

## 1. Agents

### Outline

1. Intro — chat personas (Help Assistant, Catalogue, Assessment, Estimator, Report Builder, default Claims Assistant).
2. Key Concepts — agent vs skill vs pack vs MCP tools; slug; default agent.
3. Accessing — gear → AI → **Agents** (`ai.agents` feature).
4. List/detail as live — enable, system prompt, tool allowlist, pinned skills (**walk UI**, don’t dump YAML).
5. Page-default agents (catalogue page opens catalogue assistant) vs **?** which uses Help Assistant (doc 62).
6. Installing packs creates agents — link capability-packs.
7. Best practices — don’t strip `open_help_guide` from Help Assistant; don’t make every user a Platform-style super-agent.

`related_guides`: `skills`, `capability-packs`, `ai-audit`, `getting-started`  
`permissions_discussed`: `ai.read`, `ai.manage`, `ai.admin`

---

## 2. Skills

Reusable instructions + tool bindings. How they appear on an agent. Help pack skills: `help-with-current-page`, `search-help`, `open-guide`.

`related_guides`: `agents`, `capability-packs`

---

## 3. Capability Packs

Install/uninstall builtin packs (`help-system`, `catalog-ops`, `assessment-field`, …). **Critical:** Help pack integration display name **Claims Organisation**. Re-install after YAML changes (ops note, one **Note** callout — keep short).

Walk the packs admin UI.

`related_guides`: `agents`, `skills`, `mcp-connections`, `catalogues`

---

## 4. AI Audit

Message/tool history for support and compliance. What a manager can filter. Don’t promise exports unless the UI has them.

`related_guides`: `agents`, `features`

---

## 5. Connections

**Routes `/connections`**, `/connections/[id]` — sidebar Integrations, **not** under `/admin`.

### Outline

1. Intro — insurer/platform credentials (e.g. Crunchwork) that sync jobs/claims.
2. Accessing — gear → Integrations → **Connections**.
3. List + detail — create, test, rotate secrets **without** pasting secret values in the guide.
4. vs MCP Connections vs MCP Servers.
5. Warning — disabling a connection stops inbound jobs.
6. Best practices — one production connection; name environments clearly.

`permissions_discussed`: `integrations.read`, `integrations.manage`, `org.integrations.manage` (confirm which the page uses)  
`related_guides`: `mcp-connections`, `mcp-servers`, `organisation-claims`

---

## 6. MCP Connections

User/org bindings to MCP servers so agents can call tools (Claims Organisation). Feature `ai.connections`.

Explain: Help **?** requires this integration connected + `help-system` pack installed (doc 62 ops checklist) — one short “If **?** does nothing” troubleshooting subsection.

`related_guides`: `mcp-servers`, `capability-packs`, `agents`

---

## 7. MCP Servers

Admin catalogue of MCP server definitions. Walk live `/admin/mcp-servers`.

`related_guides`: `mcp-connections`, `capability-packs`

---

## 8. Features

`FeaturesPageClient` / `FeaturesSettingsPanel`. Flags and grants. `features.read` / `features.manage`. Company settings used to nest this as a tab — **standalone page now**.

`related_guides`: `company-settings`, `agents`

---

## 9. Notifications

`NotificationsPageClient` currently lists placeholder email types with limited controls. **Document what is on screen today.** If toggles are non-functional, say they are not yet configurable. Do not invent a full notification-preference product.

`related_guides`: `communications-overview`, `company-settings`, `dashboard`

---

## Index updates

TOC already lists these nine files.

---

## Programme exit (after this subplan)

Re-run the master coverage matrix:

1. `pnpm --filter api guides:ingest`
2. For every `href` in `navGroups` + `adminNavGroups` in `AppSidebar.tsx`, `GET /guides/by-route?route=<href>` returns ≥1 guide.
3. Extra routes: `/vendors`, `/connections/{id}`, catalogue nested paths.
4. Confirm `docs/Crunchwork/Guides` is absent from `guide_document.file_path`.
5. Spot-check **?** on: Dashboard, Jobs, Assessments, Estimates, Catalogues, Users, Connections.

Optional: extend `ADMIN_ROUTE_MAP` for `document-templates`, `features`, `filesystem-templates`, `ai-audit`, `mcp-servers`, `claims` (org), `notifications`, `documents` (admin) so `pageLabel` is nicer — not required for route match.

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/admin/agents` | `agents` |
| `/connections` | `connections` |
| `/mcp-connections` | `mcp-connections` |
| `/admin/features` | `features` |
| `/admin/notifications` | `notifications` |
| **?** with pack missing | honest “no tools / install pack” — already a 62 risk; mention in MCP Connections guide |

---

## Acceptance

- [ ] Nine guides; Notifications is honest about current UI.
- [ ] Help troubleshooting lives on MCP Connections / Capability Packs, not repeated in every AI guide.
- [ ] Full sidebar coverage smoke from the parent plan.
- [ ] Ingest + **?** on agents and connections.
