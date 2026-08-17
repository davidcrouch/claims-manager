# 003 — Agentic UI & MCP Apps Readiness Assessment

## 1. Vision

The end-state is an app whose traditional UI (sidebar, list pages, detail pages,
forms) is simply the **framework for supporting agents** that call skills and
tools, which open UI panels in a chat canvas depending on conversation context.
Every piece of functionality currently accessed via point-and-click should also
be accessible — and ideally *better* — through an agentic, chat-first workflow.

The MCP Apps specification (SEP-1865) is the external standard that formalises
this: tools declare UI resources via `ui://` URIs; hosts render them in
sandboxed iframes; bidirectional JSON-RPC over `postMessage` connects the iframe
to the host. The question is how far the existing codebase already supports this
model and what gaps remain.

---

## 2. Current Architecture Inventory

### 2.1 App Shell & Layout

| Layer | Component | Role |
|---|---|---|
| Server layout | `app/(app)/layout.tsx` | Auth gate, provisioning check, fetches org name |
| Client shell | `AppLayoutClient` → `AppShell` | `SidebarProvider` + `SidebarInset` + `EntityDrawerProvider` + `ChatDrawer` |
| Sidebar | `AppSidebar` | Navigation, admin/main toggle, chat launch |
| Header | `AppHeader` | Breadcrumbs, user avatar, admin settings toggle |
| Content pane | `<div className="flex min-h-0 flex-1 ...">` | Route children rendered here |
| Chat | `ChatDrawer` (portal, left-slide) | SSE streaming, conversation history, canvas dispatch |
| Entity drawers | `EntityDrawerProvider` → `ChatFormHost` | Registry-driven dynamic drawer mount |
| Breadcrumbs | `BreadcrumbProvider` | Context for page title, breadcrumbs, header actions |
| Connection monitor | `ApiConnectionMonitor` | Polls health, auto-refreshes on reconnect |

Key observation: the shell already separates concerns cleanly — sidebar,
header, content pane, chat overlay, and entity drawers are independent layers.
The chat drawer can coexist beside form drawers with width negotiation
(`form-drawer-layout.ts`). Page content registers title and actions via
`SetPageHeader` / `SetHeaderActions` context slots — no prop drilling through
the shell.

### 2.2 Page Component Patterns

All routes live under `app/(app)/`. The patterns are:

#### List Pages (server component → client list)

```
page.tsx  (server) → loads data via getServerApiClient()
                   → renders <XxxPageClient>
```

`XxxPageClient` is a `'use client'` wrapper that:
- Renders `<SetHeaderActions>` with a **Create** button
- Renders the list table (e.g. `JobsListClient`, `ClaimsListClient`)
- Manages a `<XxxFormDrawer>` for create

Entities with list pages: claims, jobs, quotes, invoices, tasks, contacts,
messages, appointments, work-orders, purchase-orders, bills, rfqs, proposals,
journals, assessments, reports, documents, schedule, vendors, catalog.

**59 pages total** across `(app)` and `(marketing)` route groups: 28 list
pages, 18 detail pages, 12 other (dashboard, calendar, finance, admin, shared),
1 redirect.

**Row-click behaviour varies by entity type:**

| Pattern | Entities |
|---|---|
| Navigate to detail route | Claims, Jobs, Quotes, Invoices, Bills, POs, WOs, RFQs, Proposals, Vendors, Reports, Assessments, Journals |
| Open detail/edit drawer | Tasks (`TaskDetailDrawer`), Messages (`MessageDetailDrawer`), Appointments (`AppointmentFormDrawer`) |
| No row click (display only) | Contacts |

#### Detail Pages (server component → client detail)

```
[id]/page.tsx  (server) → loads entity + lookups
                        → renders <XxxDetail>
```

`XxxDetail` is a tabbed `'use client'` component. Tabs use URL search params
(`?tab=overview`). Data mutation goes through server actions in
`[id]/actions.ts`.

Entities with detail pages: claims, jobs, quotes, invoices, work-orders,
purchase-orders, bills, rfqs, proposals, journals, assessments, reports,
documents, vendors.

#### Drawer-Only Entities

Some entities are view/edit exclusively via drawers (no separate detail route):
- **Tasks** → `TaskDetailDrawer`
- **Appointments** → `AppointmentFormDrawer`
- **Messages** → `MessageDetailDrawer`
- **Contacts** → `ContactDetailDrawer` / `ContactFormDrawer`

#### Form Drawers

All create forms use `BottomFormDrawer`, a full-height right-slide panel
rendered via `createPortal`. Standard props:

```typescript
interface BottomFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: ReactNode;
  companionChatOpen?: boolean;  // ← already MCP-aware
  aiAssistEnabled?: boolean;
  onAIAssist?: () => void;
  preventClose?: boolean;
}
```

Existing form drawers (18): Job, Quote, Task, Contact, Appointment, Invoice,
WorkOrder, PurchaseOrder, Bill, Rfq, Proposal, Message, Report, Journal,
Assessment, Catalog, CatalogItem, Connection.

**Data loading:** Server-first architecture with no React Query / SWR. Server
components fetch via `getServerApiClient()` (Bearer JWT + `x-tenant-id`),
client components refetch through `'use server'` actions, and browser calls go
through a `/api/v1` BFF proxy. Mutations call `router.refresh()` for
invalidation. URL `searchParams` are the source of truth for filters and tabs.

### 2.3 Chat & AI Infrastructure (Already Built)

#### Streaming pipeline

```
User message
  → POST /api/v1/chat (Next.js proxy → API)
  → SSE stream
  → parseSSEStream() → applyEvent() on ChatMessage parts
  → dispatchCallbacks() → onCanvasComponent / onCanvasAction / onMcpApp
```

**SSE event types already supported:**
- `text-delta`, `reasoning-delta` — token streaming
- `tool-call`, `tool-result` — agentic tool use with pending/complete states
- `canvas-action` — open/update code/markdown artifacts
- `canvas-component` — **open a registered React component by name + props**
- `mcp-app` — **MCP App part with `resourceUri`** (forward-looking)
- `citation` — entity references
- `usage`, `step-start`, `step-end`, `finish` — telemetry

#### Canvas component dispatch (key mechanism)

1. SSE emits `canvas-component` event with `{ component, props }`
2. `ChatDrawer.handleOpenCanvasComponent()` enriches props (e.g. infers jobId
   from page context), then calls `openEntityDrawer()`
3. `EntityDrawerProvider` looks up `drawerRegistry[component]`, dynamically
   imports and mounts it via `ChatFormHost`
4. The drawer opens beside the chat drawer, both visible simultaneously

#### Drawer Registry

```typescript
// drawer-registry.ts — 15 entries
drawerRegistry = {
  QuoteFormDrawer, TaskFormDrawer, ContactFormDrawer,
  AssessmentCreateDrawer,
  AssessmentAttendanceDrawer, AssessmentBuildingTabDrawer,
  AssessmentHabitabilityDrawer, AssessmentHazardsTabDrawer,
  AssessmentDamageDrawer, AssessmentMakeSafeDrawer,
  AssessmentTempAccommodationDrawer, AssessmentSpecialistsDrawer,
  AssessmentRecommendationDrawer,
  TaskDetailDrawer, AppointmentFormDrawer,
}
```

#### Canvas Tool Map (AI tool name → drawer key)

**Dual maps exist and must stay in sync:**

- Backend: `CANVAS_TOOL_MAP` in `ai-chat.service.ts` — the authoritative
  resolver; emits `canvas-component` SSE events when a tool result matches
- Frontend: `CANVAS_TOOL_COMPONENT_MAP` in `canvas-tool-map.ts` — **currently
  unused** at runtime (resolution happens server-side only); exists as
  documentation / fallback

```typescript
// canvas-tool-map.ts — 38 tool→component mappings
open_quote_form      → QuoteFormDrawer
create_task          → TaskFormDrawer
open_assessment_*    → Assessment*Drawer
fill_assessment_*    → Assessment*Drawer
// ...
```

#### Page Context

`usePageContext()` extracts `entityType`, `entityId`, `jobId` from the current
URL so the chat agent knows what page the user is on.

### 2.4 Agent & Skills System (Already Built)

**Packs** define agents and skills in YAML:

| Pack | Agents | Skills | Coverage |
|---|---|---|---|
| `claims-core` | Claims Assistant | find-claim, create-task | Claims, jobs, tasks, contacts, appointments |
| `assessment-field` | Assessment Assistant | 11 skills (create + 9 tabs + complete) | Full assessment workflow |
| `commercial-estimating` | Estimator | estimate-review, rfq-scope | Quotes, RFQs, proposals |
| `documents-workflow` | Doc Ops | transform-preview, template-assign | Document generation |

**4 packs, 4 agents, 17 skills.**

**Important:** Packs define *agents* and *skills* only — **not tools**. Tools
(~350+) are implemented in `apps/claims-mcp` across 5 MCP mounts
(`/operations/mcp`, `/documents/mcp`, `/filesystem/mcp`, `/ai/mcp`,
`/organisation/mcp`, plus aggregate `/mcp`). Skills reference tools by name +
integration label via `requiredToolRefs`.

Each skill declares:
- `triggerHints` — semantic matching from user message
- `instructionPrompt` — step-by-step workflow (e.g. "call `open_assessment_building`, review journals, fill form")
- `requiredToolRefs` — tools to enable (open_*, fill_*, update_*, get_*, list_*)
- `invocationMode` — `inline` (within conversation) or `isolated`

The **assessment-field** pack is the most MCP App-influenced: each skill opens a
tab drawer via `open_assessment_*`, pre-fills fields via `fill_assessment_*`, and
saves via `update_assessment_*`. The AI reviews journal entries and photos,
infers answers, opens the form in the canvas, and fills fields — the user
reviews and confirms.

### 2.5 The Assessment Pattern (Gold Standard)

The assessment workflow is the blueprint for the agentic UI model:

```
User: "Fill in the building tab for this assessment"
  → skill match: assessment-building
  → agent calls: get_assessment, get_job, list_journals
  → agent reviews journal pages & photos
  → agent calls: open_assessment_building (SSE canvas-component event)
     → frontend opens AssessmentBuildingTabDrawer beside chat
  → agent calls: fill_assessment_building { roofType: "Tile", constructionType: "Brick Veneer", ... }
     → drawer receives AI-pushed fields via spread props, merges into form state
  → agent presents summary, asks user to review
  → user clicks Save (or agent calls update_assessment_building)
```

This is achieved via `createAssessmentTabDrawer()`, a factory that:
- Loads assessment data on open via `fetchAssessmentByIdAction`
- Watches for AI-pushed field props via `useEffect` on `aiFields`
- Merges AI values into local form state
- Renders the form component with `data` and `onChange` (`TabFormProps`)
- Saves via `updateAssessmentAction` server action
- Supports locking for published assessments

The same `TabFormProps` components are reused on the `AssessmentDetailClient`
detail page (inline tabs) and in the AI-driven drawers — a single source of
field UI shared between both surfaces. The `EntityDrawerProvider` merges props
when the same drawer is already open, which is critical for incremental
`fill_*` calls:

```typescript
if (prev?.component === args.component) {
  return { component: args.component, props: { ...prev.props, ...args.props } };
}
```

---

## 3. Readiness Assessment

### 3.1 What Already Works for Agentic/MCP UI

| Capability | Status | Evidence |
|---|---|---|
| Chat-driven tool calls | **Done** | Full SSE pipeline, tool-call/result rendering |
| Canvas component dispatch | **Done** | `canvas-component` SSE event → drawer registry → dynamic mount |
| AI form pre-fill | **Done** | Assessment tab drawers accept `...aiFields` spread props |
| Chat + form coexistence | **Done** | Width negotiation, `companionChatOpen` prop chain |
| Skill-driven workflows | **Done** | YAML skills with tool refs, trigger hints, instruction prompts |
| Agent with tool permissions | **Done** | Agent YAML declares `enabledTools` list |
| Page context awareness | **Done** | `usePageContext()` gives entityType/entityId/jobId to chat |
| MCP App SSE event type | **Wired** | `mcp-app` event type exists in types, streaming, and callbacks |
| Entity drawer from non-chat | **Done** | Schedule uses `useEntityDrawer()` directly |
| Canvas artifacts (code/markdown) | **Done** | `ChatArtifactDrawer` for generated content |

### 3.2 Coverage Gaps

#### A. Drawer Registry Gaps

Only 15 of ~20 form drawers and ~22 detail components are in the registry:

**Form drawers NOT in registry (no AI open/fill support):**
- `JobFormDrawer`
- `InvoiceFormDrawer`
- `WorkOrderFormDrawer`
- `PurchaseOrderFormDrawer`
- `BillFormDrawer`
- `RfqFormDrawer`
- `ProposalFormDrawer`
- `MessageFormDrawer`
- `ReportFormDrawer`
- `JournalFormDrawer`
- `CatalogFormDrawer` / `CatalogItemFormDrawer`
- `ConnectionFormDrawer`

**Detail drawers NOT in registry (no AI view support):**
- `ClaimDetail` — full page only
- `JobDetail` — full page only
- `QuoteDetail` — full page only
- `InvoiceDetail` — full page only
- (most detail pages are full-page, not drawer-mountable)

#### B. AI Field Acceptance Pattern

Only the assessment tab drawers implement the `...aiFields` spread-prop
pattern for AI pre-fill. Other form drawers accept only explicit typed props
(e.g. `QuoteFormDrawer` requires `jobId` as a string, not arbitrary AI fields).

**Gap:** To make all forms AI-fillable, each form drawer needs:
1. An `[key: string]: unknown` spread in its props interface
2. A `useEffect` that merges AI-pushed values into form state
3. Corresponding `fill_*` tool definitions in the API

#### C. Detail Pages as Canvas Components

Detail pages (`ClaimDetail`, `JobDetail`, etc.) are full-page components that
depend on server-side data loading (server component → client component). They
cannot currently be mounted in a drawer or iframe because:
- They rely on server components for initial data fetch
- They use `useRouter()`, `usePathname()`, `useSearchParams()` extensively
- They have no `open/onOpenChange` drawer interface

**Gap:** Detail views need a drawer-mountable variant that:
- Accepts an entity ID prop and fetches its own data (like `TaskDetailDrawer`)
- Has the standard `open/onOpenChange` interface
- Can be registered in `drawerRegistry`

#### D. Tool Definitions

The `canvas-tool-map.ts` maps 38 tool names to components but only covers
assessments, quotes, tasks, contacts, and appointments. Most CRUD tools
(`create_job`, `create_invoice`, etc.) exist in the agent's `enabledTools` list
but have no corresponding `open_*` / `fill_*` canvas tool mapping.

#### E. MCP App iframe Support

The `mcp-app` SSE event type is wired into the streaming pipeline and type
system (`McpAppPart` with `resourceUri`), but there is no rendering
implementation yet — `ChatDrawer` does not handle `onMcpApp` by creating an
iframe.

#### F. Dual Canvas Map Sync

Backend `CANVAS_TOOL_MAP` in `ai-chat.service.ts` is the authoritative map;
frontend `canvas-tool-map.ts` is a mirror that is **not imported at runtime**.
Any additions must update both files. This is fragile and should be unified
(e.g. single source in a shared package, or frontend map removed entirely).

#### G. Conversation Persistence Gap

Backend `persistConversationMessages` stores **text only** (not tool/canvas
parts). Full message parts live in frontend state until
`updateConversationAction` saves the message array. This means if the user
closes the browser mid-conversation, tool call history may be lost.

---

## 4. MCP Apps iframe vs Native Component Rendering

### 4.1 The Two Approaches

| Aspect | MCP App iframe (`ui://`) | Native Component (current) |
|---|---|---|
| **Security model** | Sandboxed iframe, CSP, no parent DOM access | Full trust, same React tree |
| **Communication** | JSON-RPC over `postMessage` | Direct props, callbacks, shared state |
| **Data access** | Must go through host-proxied tool calls | Direct API client, server actions, React context |
| **Rendering** | Self-contained HTML bundle | Dynamic import from codebase |
| **State management** | Isolated; must use `ui/update-model-context` | Shared React state, context, router |
| **Performance** | Extra iframe overhead, serialisation | Native React rendering |
| **Portability** | Runs in any MCP-compatible host (Claude, ChatGPT, etc.) | Only runs in this app |
| **Development** | Must bundle as standalone HTML | Standard React component |
| **Auth** | Needs token forwarding via host bridge | Inherits session from parent |

### 4.2 Assessment: When to Use Each

**Use native components (current approach) when:**
- The component is part of this app and all parties are trusted
- Performance and UX matter (no serialisation overhead)
- Deep integration with app state is needed (router, context, etc.)
- The component needs to trigger navigation, toasts, or other app-level effects
- You control both the chat host and the UI component

**Use MCP App iframes when:**
- Third-party tools need to render UI in the chat (external MCP servers)
- The UI must be portable across multiple hosts (Claude Desktop, ChatGPT, etc.)
- Security isolation is required (untrusted content)
- The tool is provided by a different organisation/service

### 4.3 Recommendation: Hybrid Architecture

For this codebase, where all components are first-party and trusted:

1. **Keep native component rendering as the primary path.** The drawer registry
   + canvas-component SSE event pattern is already working well. It provides
   better UX, no serialisation overhead, and full access to app state.

2. **Add MCP App iframe rendering as a secondary path** for:
   - Third-party MCP servers that provide UI resources
   - Future portability (e.g. serving the same tools in Claude Desktop)
   - Components that need to run in external hosts

3. **Make components dual-mode:** For key forms that should work in both
   contexts, create a thin adapter that:
   - In native mode: renders the React component directly via drawer registry
   - In iframe mode: bundles the same form as a standalone HTML app with the
     MCP App bridge, communicating via `postMessage`

---

## 5. Gap Closure Roadmap

### Phase 1: Complete Drawer Registry (Low effort, high value)

Register all existing form drawers and create drawer-mountable detail views:

```
Priority 1 (used in claims-core agent tools):
- JobFormDrawer          → open_job_form / fill_job_form
- MessageFormDrawer      → open_message_form
- ContactDetailDrawer    (already exists, just register)

Priority 2 (commercial-estimating pack):
- InvoiceFormDrawer      → open_invoice_form / fill_invoice_form
- WorkOrderFormDrawer    → open_work_order_form
- RfqFormDrawer          → open_rfq_form
- ProposalFormDrawer     → open_proposal_form

Priority 3 (remaining entities):
- PurchaseOrderFormDrawer, BillFormDrawer, ReportFormDrawer, JournalFormDrawer
```

For each:
1. Add to `drawerRegistry` in `drawer-registry.ts`
2. Add tool→component mappings in `canvas-tool-map.ts`
3. Add `[key: string]: unknown` AI field props where missing
4. Define `open_*` / `fill_*` tools in the API integration

### Phase 2: AI-Fillable Form Pattern (Medium effort)

Generalise the assessment `createAssessmentTabDrawer` pattern:

```typescript
// Proposed: createAIFillableDrawer() factory
function createAIFillableDrawer<T>({
  title: string,
  icon: ComponentType,
  FormComponent: ComponentType<FormProps<T>>,
  fetchAction: (id: string) => Promise<T>,
  saveAction: (id: string, data: Partial<T>) => Promise<void>,
  fieldMapping: Record<string, keyof T>,  // AI field name → form field
}) → ComponentType<CanvasDrawerProps>
```

### Phase 3: Detail View Drawers (Medium effort)

Create drawer-mountable variants of detail pages:

```typescript
// Pattern: fetch-own-data detail drawer
function JobDetailDrawer({ open, onOpenChange, jobId, ...aiFields }) {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => { /* fetch by jobId */ }, [jobId]);
  return (
    <BottomFormDrawer open={open} onOpenChange={onOpenChange} ...>
      <JobOverviewTab data={job} />
    </BottomFormDrawer>
  );
}
```

### Phase 4: MCP App iframe Host (Larger effort)

Implement the iframe rendering path:

1. **AppBridge host component** — renders `<iframe sandbox="...">` with the
   MCP App HTML, handles `postMessage` bridge
2. **Tool call proxying** — `tools/call` from iframe → host → API
3. **Display mode handling** — `ui/request-display-mode` for inline/fullscreen
4. **Security policy** — CSP, permission declarations, user consent for
   iframe-initiated tool calls

### Phase 5: Dual-Mode Component Bundles (Future)

For forms that should be portable to external MCP hosts:

1. Bundle key forms as standalone HTML apps (Vite build → single HTML)
2. Embed the MCP App SDK bridge (`@anthropic/mcp-app-sdk`)
3. Register as `ui://` resources on the MCP server
4. In-app: render natively via drawer registry (no iframe needed)
5. External hosts: serve the HTML bundle, communicate via bridge

---

## 6. Architectural Strengths

The codebase is **well-positioned** for the agentic UI vision:

1. **Drawer registry + dynamic import** — new components can be added without
   touching the chat or shell code
2. **SSE event taxonomy** — `canvas-component`, `canvas-action`, and `mcp-app`
   are already distinct event types
3. **Width negotiation** — chat and forms already coexist with responsive layout
4. **Page context** — the agent knows what entity/page the user is on
5. **Skill system** — YAML-defined workflows with tool chains and instruction
   prompts
6. **`BottomFormDrawer` abstraction** — consistent drawer shell with AI-assist
   hooks (`aiAssistEnabled`, `onAIAssist`, `companionChatOpen`)
7. **Assessment gold standard** — a complete working example of the full
   agent→tool→canvas→form→save pipeline

## 7. Architectural Risks

1. **Server component dependency** — detail pages rely on server-side data
   loading that cannot run in a drawer or iframe context
2. **Router coupling** — many components use `useRouter()`, `usePathname()`,
   `useSearchParams()` which are meaningless in an iframe
3. **Auth propagation** — iframes need explicit token forwarding; current
   components inherit the Next.js session implicitly
4. **Form state isolation** — each form drawer manages its own local state;
   there is no centralised form state that an external bridge could read/write
5. **Tool proliferation** — each entity needs open/fill/update tool triplets
   plus canvas-tool-map entries; this scales linearly with entity count

---

## 8. Related Documentation

- `docs/implementation/46_AGENTIC_AI_PLATFORM.md` — full platform design doc
- `apps/api/packs/*/pack.yaml` — pack manifests
- `apps/claims-mcp/src/tools/*.tool.ts` — ~350+ MCP tool implementations

---

## 9. Summary

| Dimension | Score | Notes |
|---|---|---|
| Agent infrastructure | **9/10** | Chat, streaming, tools, skills, packs — all production-ready |
| Canvas component dispatch | **8/10** | Working pattern, just needs more entries |
| AI form pre-fill | **6/10** | Only assessments; needs generalisation |
| Detail view in canvas | **3/10** | Detail pages are server-rendered, not drawer-mountable |
| MCP App iframe hosting | **2/10** | Types wired, no rendering implementation |
| Dual-mode portability | **1/10** | Not started; would require build pipeline changes |
| Overall agentic readiness | **~6/10** | Strong foundation, coverage gaps in registry and form patterns |

The assessment workflow proves the model works end-to-end. The primary work is
**generalising that pattern** across all entity types and deciding when the MCP
App iframe path is needed versus the simpler native component path.
