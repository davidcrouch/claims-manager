# More0 Platform — Description for SaaS Scope-of-Work Planning

**Audience:** An AI agent or human architect drafting a scope of work for a new SaaS product that uses **More0** (this repository’s platform) as its **workflow, orchestration, and business-logic layer**.

**Source:** This document is derived from the `capabilities` monorepo (MoreZero / More0AI): application code under `apps/`, shared packages under `packages/`, and architecture notes under `docs/`. It is a **concise product/architecture brief**, not a legal contract.

---

## 1. What this system is

The repository implements a **capability-centric AI and automation platform**. At the control plane, **everything invocable is modeled as a “capability”**: agents, tools, workflows, prompts, models, providers, policies, applications, and related types share a common manifest and lifecycle.

**More0’s role for a SaaS builder:**

- **Orchestration:** Multi-step processes are expressed as **workflows** (e.g. AWS States Language–style state machines) executed by a **workflow engine**, with tasks that invoke other capabilities (agents, tools, nested workflows).
- **Business logic (declarative + bounded code):** Rules, composition, retries, branching, and checkpointing live in **workflow definitions** and **capability contracts** (methods, input/output schemas, channels). Imperative logic lives in **tools** (TypeScript, Python, containers, etc.) registered and versioned like any other capability.
- **AI behavior:** **Agents** bind **prompts**, **models**, and **tools**; execution is dispatched through the same registry and worker pipeline as non-LLM capabilities.

The SaaS product’s **product-specific UI, billing presentation, CRM, etc.** can remain in the SaaS codebase, while **durable process structure, AI tool routing, and registry-backed execution** are delegated to More0.

---

## 2. Core concepts (vocabulary)

| Concept | Meaning |
|--------|---------|
| **Capability** | A registered, versioned unit with a **type** (e.g. `workflow`, `agent`, `tool`), **methods**, and schemas. The unified schema reference is `docs/CAPABILITY_SCHEMA.md`. |
| **Registry** | Authoritative store and API for capability metadata, resolution, and (with workers) routing of invocations. Implementations live under `apps/registry` (Go). |
| **FQCN / naming** | Fully qualified capability names tie capabilities to apps and domains; subject mapping and discovery align with registry conventions (see `docs/architecture/federated-registries-architecture.md` and `docs/FQCN_NAMING_CONVENTION_PLAN.md`). |
| **Application (`app_key`)** | A logical product boundary: capabilities are grouped under applications for admin, import, and defaults. |
| **Worker** | A runtime process that **subscribes** to the registry, advertises which capabilities it can run, and **executes** invocations delivered over messaging (NATS). |
| **Invocation** | A call to a capability `method` with `params`, optionally over **sync**, **async**, or **stream** channels. |
| **Client SDK** | `@more0ai/client` (Node/Go/PHP, etc.) connects to the registry, resolves NATS (or uses HTTP gateways), and invokes capabilities without embedding NATS details in app code (`packages/sdks`). |

---

## 3. Execution architecture (how work actually runs)

High-level pipeline (see `docs/implementation/08_A_OVERVIEW_AND_DESIGN.md`, `08_E_PIPELINE_ORCHESTRATOR_DISPATCH.md`):

1. A client (HTTP gateway, admin BFF, desktop app, or another worker) requests execution of a capability.
2. The **registry** resolves the capability to a **worker** and validates the request; policy may apply.
3. The **Go worker** (`apps/more0ai/workers/capabilities-worker`, `workflow-worker`) dispatches to an **execution backend**, for example:
   - **resolver** — metadata/config resolution (e.g. prompt, model) without arbitrary code execution.
   - **inline-py** — Python for internal/tooling-style execution.
   - **workflow-engine** — ASL workflows; steps invoke other capabilities by reference.
   - **container** — OCI/containerd execution for isolation or heavy dependencies.
   - **opa** — policy (Rego), where applicable.

**Design intent:** The **Go worker is the canonical execution substrate**; legacy Node generic workers are deprecated for new features.

**Messaging:** **NATS** (and JetStream for durable patterns) underpins worker communication. The **HTTP gateway** (`apps/gateways/http`) exposes REST invoke/discover/describe and uses the client SDK so **HTTP clients never speak NATS directly**.

**Streaming:** Invoke paths support streaming (e.g. SSE from the HTTP gateway when workers emit event streams); protocol direction is documented in `docs/MESSAGE_PROTOCOL.md` (NDJSON/event-oriented execution).

---

## 4. System capabilities and the `more0ai` application

`apps/more0ai` is the **core platform application**: system tools, LLM **providers**, **schemas**, **workflows** (e.g. agent-orchestration patterns), and **worker capability definitions**. It includes:

- **`definitions/`** — Manifests for tools, workflows, providers, workers, etc., importable into the registry.
- **`workers/capabilities-worker/`** — Go worker running tools, workflows, providers, agents, models, prompts, and workspaces via multiple runners.
- **`workers/workflow-worker/`** — Go worker focused on workflow capabilities (system and app-level).

After building TypeScript bundles where needed, definitions are imported via registry CLI / compose flows (see `apps/more0ai/README.md`).

---

## 5. Admin, authoring, and lifecycle

**Admin UI** (`apps/admin-ui`): Vite frontend plus **Go API server** for authenticated operators.

- **OIDC** integration with **`apps/auth-server`** (OAuth 2.1 / OIDC, DCR, IAT for M2M, multi-tenant claims).
- **Applications** CRUD, **import**, **archive**.
- **Capabilities** per app: list, detail, **revisions**, **working vs published**, **methods**, **files**, **editor bundle** for graph/editor flows, **defaults**.
- **Organization** context for creates and switching; **federation sync status** endpoints exist for multi-registry scenarios.
- **API keys** path ties to auth-server patterns (see routes in `apps/admin-ui/server/internal/routes/routes.go`).

This is the **operator console** for the capability graph—not necessarily the end-user SaaS UI.

---

## 6. Identity, gateways, and integration patterns for a SaaS

| Component | Role for SaaS |
|-----------|----------------|
| **`apps/auth-server`** | Central **OIDC/OAuth** server: user login, M2M, Google/email flows, JWT claims for tenants/orgs. SaaS web apps can use standard OIDC with this issuer. |
| **`apps/gateways/http`** | **Generic capability invoke** over HTTP (`/api/v1/invoke`, describe, discover). Ideal BFF or backend-to-backend path: SaaS server calls workflows/tools **by capability name** without NATS in the SaaS process. |
| **`@more0ai/client`** | Same invoke/discover from Node/Go/PHP with registry bootstrap. |
| **Vertical definitions** | Domain-specific apps (e.g. `apps/verticals/workers-comp`) show how a **product line** packages agents, tools, and workflows for import as its own `app_key`. |

**Pattern:** SaaS **stores tenant IDs and entitlements** in its own DB; for each action, it passes **tenant/user context** into invocations (per platform invocation context conventions) so workflows and tools enforce scope. More0 holds **how** work runs; the SaaS holds **who is allowed** at the product level (often mirrored into tokens/claims).

---

## 7. Federation and multiple registries (platform direction)

`docs/architecture/federated-registries-architecture.md` describes **federated registries** (DNS-like zones, capability **cards**, JetStream sync, cross-registry search, signed metadata). For scope planning:

- **Today:** Single-registry deployments are the common path; admin UI already exposes federation status in places.
- **Future / enterprise:** SaaS might use a **cloud root registry** while customers or partners attach **satellite registries** (desktop, private cloud). Execution routing and “local-only” constraints are explicit in that design.

An SOW should state whether v1 assumes **one registry per environment** or **federation** is in scope.

---

## 8. Infrastructure and observability

`infra/README.md`: shared **PostgreSQL (pgvector)**, **Redis**, **MinIO**, **Mailpit**, **OpenTelemetry**, **Tempo**, **Loki**, **Prometheus**, **Grafana**, with ports in the **3200–3299** block. Registry and workers depend on this stack in typical dev/prod-style layouts.

---

## 9. Billing and gating (platform plans)

The repo contains **implementation plans** for billing, Stripe, feature gating, and execution trace settlement (e.g. under `docs/implementation/21_*.md`, `22_*.md`). Treat these as **roadmap/planning artifacts**: an SOW should confirm **whether** billing is in the SaaS only, in More0 only, or split (e.g. Stripe in SaaS UI, metered execution hooks in platform).

---

## 10. Testing and examples

- **`apps/client-tests`** — End-to-end style scenarios (e.g. `more0-builder`, `workflow-simple`, `create-agent`) with **definitions** (agents, prompts, workflows) importable like real apps.
- **`apps/playground`** — Experimentation surface.

These are useful **reference manifests** for an SOW (“deliverables look like importable `app.json` + capability tree”).

---

## 11. Suggested split: SaaS vs More0 (for scope documents)

Use this table when asking an AI to generate milestones:

| Own in **SaaS product** | Delegate to **More0** |
|-------------------------|------------------------|
| Marketing site, signup UX, pricing pages | Workflow ASL, agent graphs, tool registry |
| Tenant onboarding, seats, invoices (unless using platform billing) | Capability execution, worker scaling, provider config |
| Domain-specific data models (orders, patients, projects) | Reusable **tools** and **workflows** that accept those as params |
| Feature flags at product level | Prompt/model/tool **versions** and **publish** lifecycle |
| Primary OLTP DB for customer records | Registry DB for capabilities (separate concern) |

**Explicit SOW prompts you may add:**

- Which **capabilities** (names/`app_key`) ship in v1 and which are **system** vs **tenant-custom**.
- Whether **human-in-the-loop** steps are modeled as workflow **wait** states or SaaS UI callbacks.
- **SLAs** on invoke latency, streaming, and worker pool sizing.
- **Compliance**: data residency for LLM calls vs container workers; logging/redaction.

---

## 12. Key file pointers (for implementers)

| Topic | Location |
|-------|----------|
| Capability schema | `docs/CAPABILITY_SCHEMA.md` |
| Go worker execution design | `docs/implementation/08_GO_EXECUTION_ARCHITECTURE_INDEX.md` |
| Federation | `docs/architecture/federated-registries-architecture.md` |
| HTTP API to capabilities | `apps/gateways/http/README.md` |
| Core platform app | `apps/more0ai/README.md` |
| Auth | `apps/auth-server/README.md` |
| Client SDK | `packages/sdks/README.md` |
| Workflow engine package | `packages/engines/workflow/README.md` |

---

*End of document. Update this file when major platform boundaries change (e.g. new default gateway, federation GA, billing integration).*
