ï»¿# Work hours tracking

## Entries

- `2026-04-03` `eaea05a` **48 h**
  `440 files | +130 398 ï¿½??0 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: First delivery of the claims management platformï¿½??sign-in, shared building blocks, quality checks before release, and repeatable environments so the team can keep building.
  **Initial commit: claims-manager monorepo.** Delivered the first integrated **claims-manager** codebase: a structured foundation for insurance claims operations in one place.
  Set up the **authentication service** and **application API** so sign-in and business logic can evolve together.
  Added **shared components** reusable across the product build future features faster and keep a consistent experience.
  Put **build and quality automation** in place so every change is checked the same way before release.
  Provided **container-based local and deployment layouts** so environments are repeatable for the team and for hosted runs.
  Documented and wired the **overall project shape** so onboarding and delivery have a clear starting point.
  This engagement represents a full **platform bootstrap** suitable for ongoing claims-management development.

- `2026-04-03` `0185049` **0.5 h**
  `34 files | +3 ï¿½??587 | Tier 1 mechanical | Light orchestration`
  Lay summary: Housekeeping onlyï¿½??auto-generated build folders are no longer kept in the change history, so records stay clean and easier to review.
  **Remove build artifacts from tracking and update .gitignore.** Cleaned the repository so **generated build output** is no longer stored in version control.
  Updated ignore rules so routine compiles and cache folders stay out of commits going forward.
  Removed previously tracked **compiled artifacts** so the history reflects **source and configuration** only.
  **No change** to product features or end-user behaviorï¿½??this is housekeeping that keeps reviews and clones professional.
  Reduces noise for anyone auditing what actually shipped in a given change.

- `2026-04-03` `bf394b2` **3 h**
  `1 file | +27 ï¿½??289 | Tier 3 complex | Moderate orchestration`
  Lay summary: Local developer setup now follows the same standard hosting model as the rest of the company, so there is one source of truth instead of duplicate instructions.
  **refactor(infra): replace duplicate infra with pointer to shared capabilities stack.** Aligned **local development infrastructure** with the organization's **shared hosting stack** instead of maintaining a separate copy.
  Simplifies what the team must install and update when the standard environment changes.
  Cuts duplicate definitions so **local and shared environments stay in step** with less manual drift.
  Confirmed the **developer stack still comes up cleanly** after the consolidation.
  Delivers **maintainable, standards-based** infrastructure setup for day-to-day work.

- `2026-04-03` `ebf600e` **10.5 h**
  `19 files | +1 867 ï¿½??11 290 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Sign-in and ï¿½??which customer is this?ï¿½?ï¿½ now line up across the website, services, and stored data, with a smoother path for people already on the product.
  **feat(auth): organization resolution, JWT organization_id, squashed Drizzle baseline.** Improved **sign-in and tenant handling** so each **organization** is recognized reliably in the system.
  Supported a **smooth transition** from older organization identifiers so existing customers are not forced to cut over overnight.
  Updated the **login and consent experience** and related safeguards to match the new organization model.
  Consolidated the **database schema story** into a **single clear baseline** for new environments and audits.
  Adjusted **environment setup scripts** so freshly provisioned systems create the right databases automatically.
  **Tested** authentication flows and provisioning end-to-end before handoff.
  Outcome: **organization-aware authentication** and data setup ready for multi-tenant claims operations.

- `2026-04-07` `fa8b5f6` **38.5 h**
  `131 files | +7 685 ï¿½??1 | Tier 2 standard | Heavy orchestration`
  Lay summary: Delivered the main claims management websiteï¿½??screens for day-to-day work, login and logout, layout and navigation, and a live link to the supporting service behind it.
  **feat(frontend): full Next.js frontend for claims management.** Built the complete **user-facing application** with placeholder pages for claims, jobs, invoices, quotes, reports, vendors, and purchase orders.
  Delivered **form-based workflow templates** for creating appointments, messages, invoices, quotes, and reports from within each entity.
  Implemented **initial authentication flows** including login, logout, session management, and token callback so users sign in through the existing auth service.
  Provided a **responsive layout** with sidebar navigation, breadcrumbs, and a dashboard overview of activity.
  Created a **reusable UI component library** (cards, dialogs, sheets, dropdowns, tabs, status badges, and more) so screens are consistent across modules.
  Connected the frontend to the **backend API** with a typed client so data flows end-to-end for all entity types.

- `2026-04-07` `927ed6b` **4 h** (NOT-BILLABLE)
  `5 files | +404 ï¿½??0 | Tier 3 complex | Moderate orchestration`
  Lay summary: Internal time-tracking and ledger lines tied to commits, including backfilled historyï¿½??work kept in-house for process, not billed to the client.
  **chore: add work-hours tracking for commit-level time logging.** Set up **automated time tracking** that records estimated hours and a summary of work with each commit.
  Delivered a **post-commit hook** and supporting script so entries are appended to a tracking ledger after qualifying commits.
  **Backfilled the full commit history** with estimated hours and invoice-style descriptions for all prior work.
  Added **line-ending rules** so hook scripts work correctly across platforms.
  Updated **repository ignore rules** to keep local editor configuration out of version control.

- `2026-04-10` `29ea32a` **10 h**
  `59 files | +7 723 ï¿½??976 | Tier 3 complex | Heavy orchestration`
  Lay summary: Tightened how sign-in, stored customer data, and partner-system handoffs line up so the website, login service, and back office behave consistently and are safer to run.
  **Integration schema hardening and auth alignment across API, sign-in service, and web app.**
  Tightened integration-related data shapes so provider and connection relationships are clearer and webhook and external-object handling match the updated model.
  Simplified organization and registration flows in the sign-in service by removing redundant layers and aligning tokens with the streamlined model.
  Updated the business API and user storage to match the same organization and JWT shape end to end.
  Adjusted the web experience for sign-in, registration, and entity forms so sessions stay consistent with the backend.
  Refreshed database migrations and local infrastructure so new environments start from the current baseline without drift.
  Documented the integration hardening plan and webhook operator notes in implementation docs and updated the delivery overview.

- `2026-04-13` `f12daa7` **5.5 h**
  `30 files | +5 592 ï¿½??2 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Staff can add and oversee outside service providers and review their automated traffic and errors from dedicated screens in the product.
  Delivered a complete **providers management interface** for creating, editing, and monitoring integration providers and their connections.
  Built backend API endpoints for provider and connection CRUD with webhook event statistics and paginated event history.
  Added a **full-page management UI** with list, detail, and form views including connection configuration and webhook monitoring.
  Extended repository layer with provider-scoped webhook event queries, error counts, and last-event tracking.
  Authored **webhook pipeline v2 architecture documentation** covering receipt simplification, sweep service, tool endpoints, entity mapping, workflow refinement, and observability.
  Documented the providers management UI design specification for team reference.

- `2026-04-14` `f27ea49` **10 h**
  `65 files | +3 249 ï¿½??56 | Tier 3 complex | Heavy orchestration`
  Lay summary: Repeatable path from automated checks through staging to live hosting, with packaged releases, staff runbooks, and each customerï¿½??s partner activity kept apart from othersï¿½??.
  Delivered **repeatable hosted delivery** with automated build, test, and promotion paths for staging and production.
  Added **infrastructure-as-code** and **Kubernetes manifests** so networking, data stores, secrets, and workloads can be provisioned and updated in a controlled way.
  Shipped **operator scripts** for applying Terraform, rolling out releases, and rolling back when needed.
  Hardened **container images** so the API carries database migrations and can apply them at deploy time in a standard way.
  Prepared the **web application image** for efficient production serving alongside the API and supporting services.
  Scoped **integration provider visibility** to the signed-in customer so webhook history and counts cannot leak across tenants.
  Retired the older single-purpose workflow in favor of the new pipeline layout aligned with the monorepo.

- `2026-04-17` `fc9153a` **18 h**
  `98 files | +12 755 ï¿½??823 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Major back-office upgrade so partner activity flows in through one controlled path, with stronger tracking of who is on each claim, encrypted stored credentials, and refreshed claims screens for staff.
  **Delivered webhook pipeline v2** ï¿½?? a coordinated path for bringing in partner-system activity so events are processed reliably end-to-end.
  Added retries, recovery for out-of-order updates, and in-memory projection so late or related events are still captured correctly.
  Extended **claim data modelling** to track assignees and contact relationships directly on each claim, with the supporting database migration.
  Encrypted stored partner credentials at rest and refreshed the configuration layout to match the updated integration arrangement.
  Expanded translation coverage for the main partner system with new appointment, quote, and report mappings plus a richer claim mapping.
  Refreshed the **claims list screen** with cleaner filtering and updated provider editing screens for consistency.
  Authored mapping and orchestration **documentation** for the team plus an internal time-tracking invoice tool.

- `2026-04-18` `a1f5a74` **6 h**
  `47 files | +8 775 ï¿½??2 374 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Replaced the old "add your own partner" screens with a built-in list of supported partner systems and tailored connection forms, so staff configure partner links instead of defining the partners themselves.
  **Hardcoded provider catalogue and connection-focused management UI.** Replaced the previous generic partner management screens with a **built-in catalogue** of supported partner systems so staff no longer maintain partner records by hand.
  Introduced **partner-specific connection forms** so each partner link is configured using the exact fields that partner actually needs.
  Refreshed the **back-office API** with new endpoints for managing connections, matching the simplified model end-to-end.
  Retired the **unused partner records table** with a safe database migration, reducing surface area and keeping the schema focused.
  Delivered a **design specification** describing the new hardcoded-partner model so the team has a single reference for future changes.
  Added **automated tests** covering the updated partner service to guard the refactor going forward.

- `2026-04-18` `1d41703` **4 h**
  `17 files | +7 242 ï¿½??36 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Tightened how customer identity is stored and linked across claims records so partner updates always land against the correct customer, with safeguards against accidentally pointing services at the wrong database.
  **Schema tenant-id hardening, webhook tenant wiring, and seed framework.** Converted the stored **customer identifier** on every claims table into a strongly-typed reference back to the **organizations** table so bad or mismatched values are rejected at the database level.
  Shipped the supporting **database migration** that safely converts existing records and adds the new constraints.
  Updated the **webhook intake** so incoming partner events are attributed to the customer from the **signed-in connection** rather than trusting a field in the payload, preventing cross-customer drift.
  Added a **startup safety check** in both the main API and sign-in service that refuses to start if pointed at the wrong database, protecting against accidental environment mis-configuration.
  Introduced a **reusable seeding framework** with flush support so reference data (like integration providers) can be populated and reset consistently across environments.
  Delivered an initial **integration providers seed** so new environments come up with the expected partner catalog out of the box.

- `2026-04-20` `9ba736d` **14 h**
  `52 files | +2 617 ï¿½??243 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Spans commits `46f2b24..9ba736d` (14 commits) covering the initial staging pipeline build-out and subsequent live-deployment hardening.
  Lay summary: Set up the full automated delivery pipeline to the staging website and worked through many rounds of fixes so the website, sign-in service, and application all build, deploy, and start cleanly against live hosted infrastructure.
  **Automated delivery pipeline to branlamie.com staging, plus live pipeline hardening.** Delivered an **end-to-end automated hosted delivery pipeline** so every change flows from automated checks through build, packaging, and rollout to the live staging site.
  Provisioned the staging environment as **infrastructure-as-code** ï¿½?? databases, in-memory cache, private network, container registry, a hosted virtual machine, custom domains, and HTTPS ï¿½?? with repeatable apply and rollback.
  Added **operator seeding and bootstrap scripts** so environment secrets, database connection strings, and encryption keys are populated into the managed secret store in one idempotent run.
  Hardened the **container images** for the application, the sign-in service, and the public website so each starts cleanly in the hosted environment and follows the expected workspace layout.
  Reworked the **sign-in service configuration** so registered redirect addresses and client credentials come from environment configuration, making the service safe to deploy across environments.
  Walked the pipeline through successive staging runs, **diagnosing and fixing each failure** surfaced by the live environment ï¿½?? package manager pinning, first-time image bootstrap, migration networking, database name alignment, and standards-compliant token exchange.
  Registered the **staging domains** (web app, sign-in, and application interface) with HTTPS so the product is reachable at its friendly URLs, ready for end-to-end user flow testing.

- `2026-04-22` `45d0d54` **3 h**
  `17 files | +245 ï¿½??195 | Tier 2 standard / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Diagnosed and fixed a production error blocking every signed-in page on the staging website, and made the site gracefully degrade instead of showing a blank error if a backend hiccup happens.
  **Staging authentication fix and Server Components resilience.** Diagnosed the root cause of the generic error message users were seeing on the staging site ï¿½?? the **signing-key lookup address** was wrong, so every signed-in request was being rejected.
  Corrected the staging configuration to point at the **correct signing-key endpoint** so tokens validate cleanly end-to-end.
  Hardened **every signed-in page** (claims, jobs, quotes, invoices, reports, vendors, purchase orders, and related detail screens) so future backend hiccups surface as empty states or clean not-found pages instead of the generic error message.
  Aligned every server-rendered page on the **shared tenant-aware request helper** so the customer identifier is always forwarded to the backend consistently.
  Tightened the **backend tenant resolver** to ignore blank-or-whitespace values, removing a class of silent mis-routes.
  Verified the staging database shape (tables, applied migrations, row counts) against the expected model while investigating.

- `2026-04-22` `2f01230` **4.5 h**
  `2 files | +1 107 ï¿½??33 | Tier 2 standard | Heavy orchestration`
  Lay summary: Redesigned the public marketing home page so it looks like a modern, professional product site with a custom hero illustration and a consistent style across every section.
  **Redesign marketing landing page with bespoke hero illustration.** Rebuilt the public **home page** as a proper marketing site with a clean, alternating-section layout, consistent typography, and a cohesive colour palette drawn from the company's other product sites.
  Delivered a distinctive **hero section** with a custom-generated product illustration, headline and subtitle, primary and secondary calls-to-action, customer rating, and high-level trust indicators.
  Added sections for **the problem we solve**, a **unified-records** overview, **workflow automation**, **operational reporting**, and **professional-standards assurances**, each with supporting visuals.
  Included a **sign-up call-to-action** band and a clean **footer** so visitors always have a clear next step.
  Produced a bespoke **navy hero visual** (AI-generated) shipped with the site so the page does not rely on stock imagery.
  Made the whole page **responsive** so it reads cleanly on phones, tablets, and desktops.

- `2026-04-22` `b093287` **6 h**
  `75 files | +12 247 ï¿½??671 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Rebuilt the partner-webhook processing pipeline so each incoming event is handed to a managed workflow that runs a short, auditable sequence of steps, with the raw payload archived to object storage and a clean fallback to the existing in-process path.
  **More0 webhook-workflow app with S3 archive, webhook tools, and event orchestration.** Packaged the webhook pipeline as a self-contained **More0 workflow app** (`process-inbound-event`) that takes an event identifier and drives the end-to-end flow: read the event, archive the raw payload, upsert mapped records, and update the processing log.
  Defined six **HTTP tool endpoints** (webhook-event-read, payload-archive, crunchwork-fetch, external-object-upsert, entity-mapper, processing-log-update) behind a shared **tool-auth guard**, each with its own tool descriptor and typed handler, so the workflow can call well-scoped API capabilities.
  Added a new **S3 / MinIO service and module** with configuration wiring so inbound payloads are archived to a dedicated bucket for audit and replay.
  Shipped a **database migration and seed-framework entry** (`sample-data.seed.ts`) to support the new archive / processing flow and populate reference data consistently across environments.
  Extended the **webhook orchestrator** and event-type resolver to dispatch to the workflow when enabled, while keeping the legacy in-process path as an environment-switchable fallback.
  Updated the **external-object service, entity mapper registry, and partner mappers** (appointment, attachment, claim, invoice, job, message, purchase order, quote, report, task) to plug into the new pipeline cleanly.
  Wired the **deployment layer** ï¿½?? Docker Compose for local, Kubernetes external-secrets and api-server manifests, and the Terraform secrets module ï¿½?? so the new bucket, More0 config, and environment toggles are available in every environment.
  Retired the previous `external/tools` module in favour of the new **webhook-tools module** and documented the whole pipeline in an implementation note.
  Added unit specs for the **orchestrator and More0 service** plus a client-test script for the workflow so the integration can be exercised end-to-end without the partner.

- `2026-04-22` `ff299f5` **4 h**
  `25 files | +2 599 ï¿½??557 | Tier 2 standard | Moderate orchestration`
  Lay summary: Rebuilt every list screen ï¿½?? claims, jobs, invoices, quotes, purchase orders, reports, and vendors ï¿½?? around a shared, consistent layout with the same filters, search, and table behaviour so the application feels like one coherent product.
  **Unified list pages with shared filters and cleaner detail view.** Introduced a **shared list-filters component** used by every list screen so search, status, date, and other filter controls look and behave identically everywhere.
  Rebuilt the **list clients** for claims, jobs, invoices, quotes, purchase orders, reports, and vendors around a single consistent table-based layout, replacing the older mixed card-and-table approach.
  Retired the legacy **per-entity card components** (ClaimCard, InvoiceCard, JobCard, PurchaseOrderCard, QuoteCard, ReportCard) so there is one canonical presentation for list items, reducing visual drift and maintenance cost.
  Tightened the **claim detail page** and matching loading state for a faster, cleaner read, and aligned the associated page clients (invoices, jobs) on the new layout.
  Aligned **server-rendered pages** across the app on the new list structure so page headings, empty states, and data flow match end-to-end.
  Updated shared **API types** to support the unified filter surface across list screens.

- `2026-04-23` `96dbedc` **2 h**
  `45 files | +3 887 ï¿½??960 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Staff see a clearer job screen with organized tabs and sign-in pages that match the rest of the product.
  **Job detail workspace and refreshed sign-in experience.** Delivered a clearer job workspace with dedicated tabs for appointments, documents, messages, finances, parties, tasks, and job-type specifics so everything related to a job is easy to find.
  Modernized the sign-in, registration, and sign-out screens to match the product's visual standards and keep the first impression consistent with the main application.
  Introduced reusable building blocks for structured detail views shared across job and claim areas so future screens stay visually aligned with less repeat work.
  Expanded job actions and loading behaviour so the page keeps pace with real-world use and surfaces the right information as work moves forward.
  Aligned navigation and data typing with the updated screens for fewer surprises during review and smoother handoffs between list and detail views.
  Captured the design approach in an implementation note for future maintenance and onboarding.

- `2026-04-23` `762bed1` **5.5 h**
  `39 files | +574 ï¿½??689 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: The product now appears under the new EnsureOS name and logo everywhere customers sign in and use the site, with a cleaner two-column sign-in layout.
  **Rebrand to EnsureOS with logos and unified auth layout.** Rolled out the **EnsureOS** name and **new brand artwork** across the public website, in-app navigation, and browser title areas so the experience reads as one product.
  Restyled **sign-in, registration, and sign-out** into a single card with **branding on the left** and the form on a clear white panel, matching the intended first-impression layout.
  Replaced legacy sign-in service images and favicon with the **new icon and full logo** assets served from the application and sign-in host.
  Updated **page titles and labels** in the main application and supporting API documentation strings so staff and integrations see the new product name consistently.
  Adjusted **marketing copy** on the landing page to describe EnsureOS in plain language while keeping the same overall structure.
  Confirmed **type checks** on the touched applications after the layout and copy changes.

- `2026-04-23` `d38ac0e` **5 h**
  `62 files | +998 ï¿½??620 | Tier 2 standard | Moderate orchestration`
  Lay summary: Every list and detail screen now shares the same page header, the side navigation and shell were refreshed, and the request-routing piece was renamed in line with the framework update.
  **List/detail page header unification and request-routing rename.** Introduced a shared **list page header** and **set-page-header** building blocks and applied them consistently across claims, jobs, invoices, quotes, purchase orders, reports, vendors, and connections so every screen opens with the same title, breadcrumb, and action layout.
  Refreshed the **application shell** ï¿½?? side navigation, top bar, layout wrapper, and breadcrumb provider ï¿½?? so navigation feels cohesive across the product.
  Renamed the Next.js **middleware module to proxy** to match the current framework convention, keeping existing request-rewriting behaviour.
  Swapped in the new **EnsureOS logos and favicons** on both the public sign-in host and the main application for a consistent brand across tabs, headers, and sign-in panels.
  Tightened shared UI primitives (tabs and related components) used by the updated pages so the refreshed screens render cleanly.
  Aligned marketing and app layout entry points with the new shell so the site loads under the updated branding end to end.

- `2026-04-23` `597f91a` **1 h**
  `21 files | +496 ï¿½??270 | Tier 2 standard | Moderate orchestration`
  Lay summary: Staff can return to lists with one tap and see more consistent headers while browsing connections and other business records.
  **List and detail navigation polish across modules.** Extended shared list and detail headers so titles, breadcrumbs, and primary actions read the same way across claims, jobs, invoices, quotes, purchase orders, reports, vendors, and connections.
  Added a compact back control on detail screens so returning to the parent list is one clear step.
  Reworked the connections experience for clearer layout, spacing, and filtering alongside other listing screens.
  Restructured claim and job detail areas to align with the updated headers and tab presentation.
  Adjusted shared filters and vendor listing behaviour so screens stay predictable as users move between records.

- `2026-04-24` `dd3cb04` **4.5 h**
  `13 files | +1 719 ï¿½??419 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Expanded the internal reference that explains how each partner-system field lines up with our records for claims, jobs, quotes, and service orders, and adjusted the claim and job screens so those references are labelled correctly.
  **Extended Crunchwork field-mapping documentation and aligned claim/job detail labels.** Grew the internal mapping reference for **claims, jobs, quotes, and purchase orders** so every partner-system field has a clear home in our records, giving the team a single source of truth for integration work.
  Added dedicated mapping guides for **jobs, quotes, and purchase orders** alongside the existing claim mapping so the whole catalogue of tracked records is covered end-to-end.
  Refreshed the matching **module design notes** so their descriptions stay consistent with the mapping reference.
  Updated the **claim detail screen** to distinguish the insurer's own reference from the partner system's internal identifier and to surface vulnerability, contention, and last-updated information when present.
  Polished the **job overview screen** with clearer parent-job and parent-claim links plus an insurer-reference label so staff immediately see which record ties to which external system.
  Tightened the shared **claim data shape** so downstream screens can read the newly-mapped fields without manual casting.

- `2026-04-24` `ebbb86c` **6.5 h**
  `15 files | +15 373 ï¿½??147 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  (Drizzle snapshot JSON accounts for ~13 700 of the insertions; hand-written delta is ~1 700 lines.)
  Lay summary: Aligned the stored data for quotes and service orders with the partner-system contract and expanded the on-screen detail pages so every field now has a named home, plus a small backend lookup for invoices tied to a job.
  **Schema alignment for quotes and purchase orders; quote / PO detail screens expanded; invoices-by-job lookup.** Added the missing structural pieces (external-reference keys, parent-cascade deletes, lookup links, child indexes) so quote groups, combos, items and purchase-order groups, combos, items match the partner-system contract end-to-end.
  Tightened duplicate-prevention on the core **quotes** and **purchase-orders** records so the same partner record cannot be ingested twice.
  Reworked the **quote detail** and **purchase-order detail** screens to present every contract field ï¿½?? identity, parties, parent job and claim, service window, totals, adjustments, and payload fallback ï¿½?? in clearly labelled sections.
  Extended the shared frontend data shapes so the new screens read the enriched fields without manual casting.
  Added a backend endpoint for **invoices associated with a given job** so that view can surface them directly.
  Updated the internal mapping reference for quotes and purchase orders to show which parts are now schema-backed and which remain on the mapper backlog.

- `2026-04-25` `99af045` **5.5 h**
  `24 files | +1 292 ï¿½??719 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Refreshed the create-record pop-up used across the product and switched the connections list to a cleaner table view with consistent filtering and navigation.
  **Unified bottom form drawer across create flows, table-based connections, and detail polish.** Delivered a **new shared create-record pop-up** used everywhere in the product (appointments, jobs, messages, invoices, quotes, and reports) so every creation flow looks and behaves the same way.
  Rebuilt the **connections list** as a clean table with sort, search, and status-filter controls matching the rest of the product, replacing the older card-grid layout.
  Refreshed the **connection detail screen** with a side-sheet edit flow, grouped detail sections, and a consistent activity-events table using the same search, sort, and status controls.
  Polished the **claim, job, and purchase-order tabs** so the active tab reads more clearly, and made related-item tables link directly from each row's title instead of a trailing "Open" action.
  Updated the **application shell** with a larger brand mark, a new tagline, and a tightened dashboard header so the product reads as one coherent workspace.
  Aligned every create flow on the new drawer so future forms drop in without duplicating layout code.

- `2026-05-13` `ddc2b5d` **8 h**
  `81 files | +18 078 -128 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  (Drizzle snapshot JSON accounts for ~10 426 of the insertions; hand-written delta is ~7 650 lines.)
  Lay summary: The workspace gained clearer navigation and new areas for quotes, proposals, bills, and basic money-in and money-out views, with a richer home overview and behind-the-scenes data support so lists can load from the same system of record.
  **Operations modules, navigation, dashboard, tasks, sample data, staging notes, and work-hours artifacts.** Delivered **list and placeholder experiences** for work orders, requests for quote, proposals, bills, and accounts payable / receivable so teams can open consistent screens while deeper workflows mature.
  Extended the **main menu and dashboard** so day-to-day operations, finance, and admin destinations are easier to find and the home view summarizes what matters next.
  Grew the **service layer and stored shapes** for those records?including a database migration and richer sample data?so the application reads from one coherent model.
  Broadened **tasks** to relate cleanly to multiple parent record types as those operational objects come online.
  Refreshed **staging deployment notes and configuration** so hosted trial environments stay aligned with the new surface area.
  Captured **implementation plans and billing references** alongside the release for traceability and invoicing.

- `2026-06-08` `820d7a2` **22 h**
  `60 files | +7 035 -1 457 | Tier 2 standard | Moderate orchestration`
  Lay summary: Every screen in the product now matches its design specification, with missing tabs, action buttons, creation forms, and data tables filled in across jobs, work orders, invoices, purchase orders, claims, finance, and administration.
  **Comprehensive UI audit and implementation of all outstanding specification gaps.** Audited every page against its design specification and addressed every identified gap across the full product surface.
  Added missing **tabs and detail sections** to jobs (Timeline, Communications), purchase orders (Bills, Activities, Communications, Timeline, Attachments), work orders, and invoices so each record shows all planned information.
  Delivered **status-driven action buttons** on work orders (Accept, Decline, Start Work, Complete), proposals (Accept, Reject, Request Revision), and bills (Approve, Reject, Mark Paid) with server-side status mutations.
  Created and improved **creation forms** ? new Task form, and extended the Quote and Invoice forms with all specified fields ? and wired them to standalone list pages and detail tabs.
  Populated **finance tables** (Accounts Receivable and Accounts Payable) with live invoice and bill data including search, sort, and status filtering, and added an **Upcoming panel** to the dashboard.
  Split the **claim jobs view** into internal and linked tables, added missing claim fields, and upgraded **admin settings and user management** screens with structured layouts for organisation, notifications, and billing configuration.
  Replaced placeholder stubs with **line-item rendering** on work order and invoice detail pages, and added an **attachment upload zone** to job attachments.

- `2026-06-08` `8269b5f` **13.5 h**
  `23 files | +3 529 -0 | Tier 2 standard | Heavy orchestration`
  Lay summary: Documented every screen in the upstream vendor portal and wrote matching build-ready specifications for the EnsureOS claims workspace.
  **Upstream UI observation specs and EnsureOS implementation specifications for the full product surface.** Walked through every page of the upstream Crunchwork Pulse vendor portal ? claims, jobs, quotes, purchase orders, invoices, and activities ? and recorded field layouts, navigation paths, status flows, and action buttons into a structured reference set.
  Translated those observations into fourteen implementation specifications covering the EnsureOS claims workspace: dashboard, jobs, estimates and quotes, work orders, invoices, claims, RFQs, proposals, purchase orders, bills, operations, finance, and administration.
  Each implementation spec maps upstream fields to the local data model and calls out where the EnsureOS experience should diverge from or extend the upstream design.
  Captured the recursive contractor-chain concept ? customers upstream, vendors downstream ? so every module knows which direction data flows.
  Added a README index linking each specification to its file and functional area for easy navigation.
  Updated the repository ignore rules to exclude Terraform provider binaries and local state files from version control.

- `2026-06-15` `ddc250a` **38 h**
  `170 files | +21 264 -40 419 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Teams can now manage a product and service catalogue, build quotes from catalogue items, and rely on a new behind-the-scenes layer that keeps records consistent when data moves in and out of the system.
  **Catalogue module, domain layer, quote line-item integration, webhook proxy, and implementation specifications.** Delivered a full **product and service catalogue** with categories, item types, assemblies, pricing, CSV import, and an admin workspace for browsing, creating, and maintaining catalogue records.
  Built the **domain layer** ? transformers, use-case projections, shared services, workflow engine, document issuance, and outbound sync ? so jobs, quotes, purchase orders, and related records stay consistent as data flows through the application.
  Integrated **catalogue selection into quotes** with line-item tables, drag-and-drop assembly expansion, unresolved-item handling, and server actions that persist selections against live quote records.
  Added a **Cloudflare webhook proxy worker** and supporting documentation so inbound vendor events can be routed securely to the API in staging and production.
  Shipped **sample building-repairs catalogue data** and a generator script so teams can trial import and quoting workflows without manual data entry.
  Captured **implementation specifications** for the domain layer, catalogue module, and webhook proxy, and removed obsolete example bundle artefacts from the repository.

- `2026-06-19` `a78f00b` **20.5 h**
  `34 files | +2963 -461 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Quotes can now be organised into labelled groups with assembly items that expand into their component lines, and lookup data is scoped so each vendor connection keeps its own reference values.
  **Quote line-item groups, assembly bill-of-materials expansion, and provider-scoped lookups.** Added **create, edit, delete, and reorder** flows for quote line-item groups with label lookups, descriptions, and dimensions surfaced in the quote detail workspace.
  Rebuilt the **quote line-items table** with grouped sections, drag-and-drop between groups, inline editing, and dialogs for managing group metadata from the quote screen.
  Extended **catalogue selection** so assemblies expand into child line items from bill-of-materials data, with outbound quote payloads grouped to match the upstream vendor format.
  Improved the **catalog picker drawer** with assembly-aware drag targets and clearer handling when adding items into an existing quote group.
  Shipped **database migrations** for lookup provider codes and job connection tracking, plus assembly BOM seed data so quoting workflows can be exercised end to end.
  Wired **API and server actions** for group CRUD, group-label lookup resolution, and catalogue item queries used by the quote UI.
  Validated end-to-end quoting flows ? group management, assembly expansion, and catalogue pick-and-drop ? against sample building-repairs data.

- `2026-06-19` `806409c` **0.5 h**
  `6 files | +77 -42 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed a deployment build error on the quote screen and improved the pinned catalogue drawer so line items use the full screen height.
  **Quote line-items build fix and pinned catalogue drawer layout.** Corrected the group actions menu trigger so production builds pass TypeScript checks after the dropdown component library upgrade.
  Moved the **Catalogue** button into the line-items toolbar so it stays visible while editing groups and items.
  When the catalogue drawer is **pinned open**, the app header and quote tabs hide automatically so the estimate table can use the full viewport height.
  Adjusted the **sticky toolbar** offset when chrome is hidden, keeping group controls accessible at the top of the line-items view.

- `2026-06-19` `5c38559` **6.5 h**
  `10 files | +1431 -129 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Quote line items can now be edited inline, deleted with clear confirmation, and assembly components can optionally be removed from the catalogue when deleted from an estimate.
  **Quote line-item inline editing, delete flows, and assembly-aware catalogue removal.** Rebuilt the **quote line-items table** with inline editing for quantities, costs, markup, tax, and descriptions, plus batch save that recalculates totals on the server.
  Added **delete confirmation** for individual line items and whole assemblies, with an option to remove assembly components from the catalogue definition when deleting from an estimate.
  Shipped **API endpoints** for deleting quote items and assemblies, batch-updating line fields, and optionally unlinking catalogue assembly components.
  Wired **server actions and API client** methods so the quote workspace persists edits and deletions without a full page reload.
  Refined the **catalogue picker drawer** and quote tab layout so editing, deleting, and adding items work smoothly alongside pinned catalogue browsing.
  Updated **sticky toolbar and table styling** so grouped rows, assembly children, and action menus stay usable during long editing sessions.

- `2026-06-21` `96497e6` **24 h**
  `121 files | +7541 -34890 | Tier 2 standard / Tier 3 complex / Tier 4 integration | Moderate orchestration`
  Lay summary: Staff can now keep structured job journals with pages and attachments, while appointments, contacts, and jobs screens were upgraded with clearer tables, forms, and vendor sync support.
  **Journals module, appointments overhaul, and multi-screen job workspace improvements.** Delivered a full **journals feature** ? database schema, API, file storage for page attachments, list and detail screens, and a journals tab on each job.
  Rebuilt **appointments** with a dedicated table layout, richer create/edit drawer, server actions, and tighter job and contact linking from the appointments list and job tab.
  Added **contact create and edit** flows via a form drawer and expanded contact API endpoints used by the contacts list.
  Extended **jobs** with sync-status tracking, entity lookup views, outbound adapter updates for vendor push, and backfill utilities for external references and status values.
  Improved **quotes and invoices** list and detail screens with shared table components, API client helpers, and navigation updates in the app sidebar.
  Consolidated **database migrations** and added new migrations for job sync status and cross-entity lookup views, plus implementation docs for journals and provider adapter architecture.

- `2026-06-21` `e50a92f` **12 h**
  `49 files | +4353 -1972 | Tier 2 standard | Moderate orchestration`
  Lay summary: All list screens now have sortable column headers and active/archived tabs, and new create-record forms were added for purchase orders, work orders, RFQs, proposals, and bills.
  **List-page upgrade with sortable columns, active/archived tabs, and new entity create forms.** Replaced the previous sort-tab and status-filter controls with clickable sortable column headers and active/archived/all tabs across all list screens ? claims, jobs, invoices, quotes, reports, tasks, bills, proposals, purchase orders, RFQs, and work orders.
  Added shared **ValueFilterMenu** and **SortableColumnHeader** components so each list page filters and sorts consistently using in-memory data.
  Created **form drawers** for purchase orders, work orders, RFQs, proposals, and bills, wired through new server actions and API client methods.
  Added **job-detail tabs** for work orders, RFQs, proposals, and bills, and enhanced existing tabs (invoices, tasks, reports, messages, parties, appointments, journals) with inline create actions and improved data loading.
  Extended the **claims page** to derive active vs. archived status from lookup values, so the tabs auto-filter without hard-coded status IDs.
  Added a **purchase-order create endpoint** on the API and expanded the frontend API client with new entity create and query methods.

- `2026-06-30` `9393b56` **32 h**
  `206 files | +10317 -1819 | Tier 2 standard / Tier 3 complex / Tier 4 integration | Heavy orchestration`
  Lay summary: Staff can manage multiple price catalogues, receive in-app notifications, view a unified schedule, and work RFQs and quotes end-to-end with improved lists, attachments, and provider sync.
  **Multi-catalog management, notifications, schedule, RFQ workflow, and Crunchwork integration sync.** Delivered **multi-catalog administration** ? create and edit catalogues, import line items from spreadsheets, browse assemblies, and pick catalogue items from quotes and jobs.
  Added an **in-app notifications** feature with database storage, API endpoints, and a header bell so staff see alerts without leaving the app.
  Shipped a **unified schedule view** backed by a database events view, combining appointments and related activities in one calendar screen.
  Expanded **RFQ workflows** with richer create/edit forms, vendor linking, line-item handling, and detail screens wired through new server actions.
  Improved **list screens across the product** with shared table pagination, toast feedback, type badges, and consistent server-action patterns for bills, proposals, contacts, and work orders.
  Strengthened **Crunchwork provider sync** ? vendor sync service, job connection backfill, attachment downloads, connection documentation links, webhook handling, and mapper/transformer updates for jobs, quotes, purchase orders, and attachments.

- `2026-07-30` `1a6026f` **24.5 h**
  `116 files | +4940 -1213 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Jobs can be created without a claim, with internal job types and a clearer create form, and list screens across the app get stronger shared filters.
  **Direct (claim-optional) jobs, internal job types, and list-filter upgrades.** Allowed jobs to exist without a linked claim and added an optional job display name.
  Seeded **internal job types** for create-job flows that are not tied to the external provider?s type list.
  Rebuilt the **create/edit job form** so staff can pick claim (or none), job type, and related fields with clearer validation.
  Extended **jobs and related APIs** so lists and creates work for claim-linked and standalone jobs alike.
  Upgraded **shared list filters** and applied them across claims, jobs, invoices, quotes, RFQs, work orders, and other entity lists.
  Improved **RFQ detail and job child tabs** so create/link flows stay consistent with the new job model.

- `2026-08-01` `a1c3eb8` **40 h**
  `264 files | +47823 -607 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staff can store and generate job documents from templates, with automatic handoffs between organisations for purchase orders and work orders.
  **Document filesystem, template generation, messaging workflows, and cross-organisation purchase and work orders.** Delivered a **cloud-backed document library** so each organisation can organise files by category and attach them to day-to-day claims work.
  Built **document generation from Word templates** for quotes, invoices, purchase orders, work orders, bills, proposals, reports, and related records.
  Added **background messaging** so document and order events can move reliably between services without blocking the user.
  Enabled **cross-organisation purchase-order and work-order** flows so partner tenants can receive and process work on shared jobs.
  Updated the **sign-in experience branding** and supporting configuration for the new document services.
  Provisioned **staging and development hosting** for storage and messaging so the feature can run in shared environments.
  Captured **implementation specifications** covering the document platform and related workflows.

- `2026-08-01` `f92bd46` **0.5 h**
  `2 files | +4 -1 | Tier 1 mechanical / Tier 3 complex | Light orchestration`
  Lay summary: Fixed a small website build issue and gave the deployment account permission to manage background messaging.
  **CI build fix and Pub/Sub deployer permissions.** Corrected an import used when refreshing job screens after edits so continuous integration builds succeed again.
  Granted the **deployment service account** authority to administer messaging topics needed by the new document workflows.
  Confirmed the change is limited to build tooling and infrastructure access, with no change to end-user screens beyond restoring a clean deploy path.
  Keeps staging releases unblocked after the document-platform introduction.
  **No product behaviour change** for staff beyond reliable deployment of the related services.

- `2026-08-01` `7e162e2` **0.5 h**
  `1 file | +27 -10 | Tier 2 standard | Light orchestration`
  Lay summary: Adjusted an automated check so partner-provider registration matches the simplified service layout.
  **Providers unit-test alignment for direct registry entry.** Updated the providers service test to match the streamlined provider registration path used at runtime.
  Removed expectations tied to the older nested registry shape so the suite reflects current behaviour.
  Keeps continuous integration green after the provider packaging changes.
  Confirms partner integration lookup still resolves through the intended registration entry.
  **No change** to live provider configuration screens or inbound webhook handling.

- `2026-08-01` `a9801e4` **0.5 h**
  `2 files | +4 -0 | Tier 1 mechanical | Light orchestration`
  Lay summary: Made sure the main business service starts correctly in its cloud container by declaring a required runtime library.
  **Express dependency for API Docker runtime.** Added Express as a direct dependency of the API package so container builds include the library the service needs at startup.
  Refreshed the lockfile to record the resolved version for reproducible installs.
  Prevents runtime failures when the API image is built without relying on transitive dependency quirks.
  Supports reliable Cloud Run and local container starts after recent packaging changes.
  **No change** to API business endpoints or data models.

- `2026-08-02` `dd4589c` **16 h**
  `46 files | +1983 -2131 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Document creation is smoother?staff can upload files with previews, generate Word documents from templates, and convert Office files when needed.
  **Document generation UI, uploads, and Office conversion.** Delivered richer **template-driven document generation** in the product UI so staff can produce client-ready Word documents from live records.
  Improved the **upload experience** with drag-and-drop, clearer progress, and thumbnail previews for common file types.
  Added **Office and LibreOffice conversion** support so generated or uploaded documents can be turned into shareable formats in the workflow.
  Extended **cloud storage and hosting configuration** so templates and generated files land in the correct buckets.
  Tidied related **sign-in service packaging** to keep the document stack deployable alongside the API and website.
  Validated upload, generate, and convert paths against the new document library screens.
  Outcome: staff can produce and attach professional documents without leaving the claims workspace.

- `2026-08-02` `0b10477` **28 h**
  `65 files | +2890 -196 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staging now runs as separate cloud services for the website, sign-in, business API, and partner webhooks, sharing the same database and cache.
  **Cloud Run deployment model with extracted partner webhook service.** Introduced a **per-process Cloud Run layout** so the public partner webhook service, private business API, sign-in service, and website each scale independently.
  Extracted a slim **provider webhook service** that verifies partner signatures, stores inbound events, and hands work to the automation layer.
  Added **Terraform modules and staging wiring** for Cloud Run services against shared managed database and cache.
  Rebuilt **continuous integration** into parallel image builds and a staging Cloud Run deploy workflow.
  Created a least-privilege **database user for the webhook service** and documented the cutover runbook for operators.
  Supported a **zero-downtime edge switch** so DNS can move from the previous VM path to Cloud Run when ready.
  Delivered operator documentation covering staging bootstrap and Cloud Run operations.

- `2026-08-02` `c48cdab` **30 h**
  `37 files | +3816 -20 | Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Sign-in now supports richer roles, invitations, and admin controls, and the cloud staging services were corrected so they start cleanly.
  **Auth-server role and invitation upgrade with Cloud Run startup fixes.** Extended the **sign-in service** with role definitions, feature flags, permission administration, and invitation flows aligned to the organisation?s parity target.
  Added **email-based invitations and password-reset messaging** with templated messages staff and admins can rely on during onboarding.
  Delivered **admin APIs and screens support** for managing users, roles, permissions, and features without manual database edits.
  Fixed **Cloud Run environment wiring** ? removed a reserved port setting and corrected private-network attachment so staging services start without platform errors.
  Documented the **auth-server parity upgrade** for operators and implementers.
  Adjusted staging service protection and IAM settings to match organisation policy constraints during bring-up.
  Validated invitation, role assignment, and staging service startup paths after the combined auth and infrastructure changes.

- `2026-08-02` `49eeca5` **0.5 h**
  `2 files | +2 -0 | Tier 1 mechanical | Light orchestration`
  Lay summary: Removed accidental temporary deployment files from the repository so the project history stays clean.
  **Remove accidentally committed plan and tooling artefacts.** Deleted a local Terraform plan binary that should not be stored in version control.
  Removed an empty tooling stub from the sign-in service package tree.
  Updated ignore rules so future plan files are less likely to be committed by mistake.
  Keeps reviews focused on intentional source and configuration changes.
  **No change** to product behaviour or deployed environments.

- `2026-08-02` `5fd5eb6` **0.5 h**
  `1 file | +156 -3 | Tier 1 mechanical | Light orchestration`
  Lay summary: Refreshed the shared dependency lockfile so the sign-in service installs match the new libraries it needs.
  **Lockfile update for auth-server dependencies.** Recorded resolved versions for new sign-in service libraries so installs are reproducible across developer machines and CI.
  Aligns the workspace lockfile with the packages introduced in the role and invitation upgrade.
  Prevents install drift between local and pipeline environments.
  Supports clean builds of the sign-in service after the parity work.
  **No functional product change** beyond dependency resolution consistency.

- `2026-08-02` `c83063c` **0.5 h**
  `4 files | +16 -15 | Tier 2 standard / Tier 3 complex | Light orchestration`
  Lay summary: Cleared TypeScript build errors in the sign-in service so cloud images compile cleanly.
  **Auth-server TypeScript fixes for rate-limit and identity types.** Corrected type mismatches in rate-limiting and identity-related paths that blocked production builds.
  Adjusted invitation auto-link typing so the compiler accepts the current service contracts.
  Updated ignore rules for local artefacts uncovered during the fix.
  Restores a green TypeScript build for the sign-in service on Cloud Run image builds.
  **No intentional change** to login or invitation behaviour beyond compile correctness.

- `2026-08-02` `c08fc25` **0.5 h**
  `1 file | +2 -1 | Tier 3 complex | Light orchestration`
  Lay summary: Gave the sign-in cloud service the service name it expects at startup.
  **SERVICE_NAME environment for auth-server on Cloud Run.** Added the required service-name environment variable to the staging auth Cloud Run definition.
  Ensures startup configuration matches what the sign-in process reads when identifying itself.
  Unblocks healthy revisions after the Cloud Run cutover work.
  Keeps staging auth aligned with the shared Cloud Run module conventions.
  **No change** to login screens or token issuance logic.

- `2026-08-02` `b676b82` **0.5 h**
  `1 file | +3 -5 | Tier 3 complex | Light orchestration`
  Lay summary: Allowed the staging cloud services to accept traffic again after the organisation?s access policy was updated.
  **Re-enable unauthenticated Cloud Run access after org policy resolution.** Restored the staging setting that lets the platform edge reach Cloud Run services once the organisation policy allowed it.
  Removed temporary workarounds that blocked public invoke while the policy was restrictive.
  Lets the website, sign-in, and webhook entry points receive traffic through the intended edge path.
  Confirmed the change is limited to staging Cloud Run IAM/invoke configuration.
  **No change** to application business rules.

- `2026-08-02` `187b34a` **1 h**
  `1 file | +35 -3 | Tier 3 complex | Moderate orchestration`
  Lay summary: Finished wiring the sign-in cloud service with the secrets and identity settings it needs to issue secure sessions.
  **Complete auth-server Cloud Run environment with OIDC and JWKS secrets.** Added the remaining staging environment variables so the sign-in service can load OpenID and key-set secrets at runtime.
  Connected secret references required for token signing and discovery endpoints on Cloud Run.
  Aligns staging auth configuration with the More0-parity identity model introduced earlier.
  Reduces bring-up guesswork for operators deploying auth revisions.
  Supports end-to-end login against the Cloud Run-hosted sign-in service.

- `2026-08-02` `4ecff44` **1 h**
  `2 files | +35 -7 | Tier 3 complex | Moderate orchestration`
  Lay summary: Logout pages now meet the site?s security script rules, so signed-out users are redirected without browser warnings.
  **CSP nonce support on logout auto-submit scripts.** Updated logout rendering so automatic redirect scripts carry the content-security nonce required by the hardened policy.
  Adjusted OpenID provider view helpers to pass the nonce through consistently on logout responses.
  Prevents browsers from blocking the post-logout redirect under strict script rules.
  Keeps sign-out behaviour smooth for staff using the Cloud Run-hosted auth service.
  Confirmed logout still completes session cleanup before returning the user to the application.

- `2026-08-02` `d875fa9` **1.5 h**
  `5 files | +41 -17 | Tier 3 complex | Moderate orchestration`
  Lay summary: Staging now defaults to the cloud-service edge instead of the older virtual-machine and container-compose path.
  **Staging edge defaulted to Cloud Run; Compose VM path retired.** Switched staging Terraform defaults so public hostnames target Cloud Run rather than the Compose VM.
  Updated staging outputs and variables to match the Cloud Run-first edge mode.
  Reduced reliance on the temporary VM path while cutover continues.
  Keeps staging networking and service wiring consistent with the new deployment model.
  Documented the default so operators no longer need to opt into Cloud Run for routine staging work.

- `2026-08-02` `2e9e0df` **3 h**
  `15 files | +133 -132 | Tier 3 complex | Moderate orchestration`
  Lay summary: Simplified staging networking by dropping old hostname mappings and clarifying the private network layout.
  **Remove Cloud Run domain mappings and rename staging subnet to private.** Deleted Cloud Run domain-mapping resources now that hostname routing is handled at the edge.
  Renamed and clarified the **private subnet** wiring so staging network outputs match the Cloud Run-only model.
  Updated production and staging Terraform callers to use the revised networking module interface.
  Refreshed operator docs to describe the simpler hostname and network arrangement.
  Reduces duplicate hostname configuration that conflicted with the load-balancer direction of travel.
  Validated module inputs/outputs still compose for staging and production environments.

- `2026-08-02` `038dff4` **10.5 h**
  `47 files | +704 -3335 | Tier 1 mechanical / Tier 3 complex | Moderate orchestration`
  Lay summary: Hosting is now Cloud Run only?old virtual-machine, Compose, and Kubernetes paths were removed so there is one supported way to run staging and production.
  **Cloud Run-only deployment; remove VM, Compose, and GKE paths.** Deleted the staging Compose VM module, Kubernetes overlays, and GKE Terraform so the repository has a single supported hosting model.
  Removed legacy continuous-delivery workflows tied to the old paths.
  Aligned **production and staging** on Cloud Run sizing and variables, with production using larger CPU and memory.
  Updated bootstrap and Cloud Run runbooks to describe Cloudflare hostnames pointing at Cloud Run services.
  Cleared obsolete scripts and documentation that instructed operators to use the retired VM route.
  Leaves a cleaner infrastructure tree for ongoing Cloud Run and load-balancer work.
  Outcome: staging and production share one supported hosting path for future releases.

- `2026-08-02` `0f2856a` **1 h**
  `4 files | +28 -28 | Tier 3 complex | Light orchestration`
  Lay summary: Production cloud services were sized to match the staging pattern, with a stronger website service allocation.
  **Production Cloud Run sizes aligned; frontend capacity increased.** Updated production Terraform so service CPU and memory follow the staging Cloud Run pattern.
  Raised the **website service** to two virtual CPUs for better interactive performance.
  Refreshed Cloud Run documentation to match the new production sizing.
  Keeps production capacity decisions explicit in Terraform rather than ad-hoc console edits.
  Supports smoother production bring-up after the Cloud Run-only refactor.

- `2026-08-02` `55d15fd` **0.5 h**
  `2 files | +2 -2 | Tier 1 mechanical / Tier 3 complex | Light orchestration`
  Lay summary: Set the production website cloud service to two CPUs and one gigabyte of memory.
  **Production frontend Cloud Run 2 vCPU / 1Gi.** Adjusted production website service resources to two virtual CPUs and one gibibyte of memory.
  Updated the Cloud Run guide to state the same allocation.
  Keeps production frontend capacity consistent with the intended performance target.
  Avoids under-provisioned website revisions after the sizing pass.
  **No application code change.**

- `2026-08-02` `296e7e9` **34 h**
  `107 files | +14860 -1030 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staging custom hostnames now use a proper Google HTTPS load balancer, and the product gained filing templates, automation pipelines, and early AI document helpers.
  **GCP HTTPS load balancer for staging domains, filesystem templates, pipelines, and system agents.** Delivered a **Google HTTPS load balancer** with managed certificates and serverless backends so staging custom hostnames reach Cloud Run without an application-level proxy.
  Updated DNS and operator documentation for grey-cloud address records pointing at the load balancer.
  Added **filesystem template administration** so organisations can define filing structures and export artefacts from the admin workspace.
  Introduced **automation pipelines** and **system agent** foundations for document classification and related assisted workflows.
  Extended seeds and catalogue sample data so filing defaults and document templates are available in fresh environments.
  Shipped supporting API and website surfaces for template setup, category management, and pipeline editing.
  Captured an implementation specification for the broader agentic platform direction while landing the staging edge and filing foundations.

- `2026-08-02` `da322cf` **62 h**
  `234 files | +28652 -296 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staff can chat with an in-product assistant that uses company tools, saved skills, and partner connections, with admin controls for who may use what.
  **Agentic AI platform with chat, skills, MCP integrations, and More0-aligned RBAC.** Delivered end-to-end **AI chat** so staff can ask questions, attach files, and complete assisted workflows inside the claims workspace.
  Added **agents and skills administration** so organisations can configure assistants, tool access, and reusable procedures without engineering changes for each request.
  Integrated **MCP connections** including claims-domain and Microsoft Graph tool servers so the assistant can act on jobs, contacts, mail, calendar, and related records under controlled credentials.
  Extended the **sign-in and permission model** with More0-aligned roles and permission checks so AI and admin features respect organisation access rules.
  Shipped **conversation memory, sharing, feedback, and audit** surfaces so assisted activity is reviewable and retainable for operations.
  Delivered the matching **website chat drawer, admin screens, and connection management** so day-to-day use and oversight stay in one product.
  Outcome: a production-ready assistant foundation that combines chat, tools, skills, and access control for claims operations.

- `2026-08-02` `d12a41f` **5.5 h**
  `50 files | +1075 -267 | Tier 2 standard | Moderate orchestration`
  Lay summary: Create buttons now sit in the top header across main work screens, and forms make it clearer which job a new record belongs to.
  **Header create actions and shared job selection across operational screens.** Moved primary create actions into the app header across bills, quotes, RFQs, purchase orders, work orders, proposals, appointments, and related lists.
  Added a shared **job picker** so create forms link records to the correct job consistently.
  Wired job detail tabs and list pages to the same header action pattern for a familiar create experience.
  Improved appointment and quote flows so actions and job context sit where staff expect them.
  Kept create drawers available from both list pages and job workspaces without duplicate toolbar clutter.
  Outcome: staff see create controls in one place and can attach new records to jobs more reliably.


- `2026-08-07` `08f1bbd` **50.5 h**
  `291 files | +16 394 -7 321 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staff can run site assessments, move estimates and proposals between partner organisations, generate documents from more record types, and archive day-to-day records from list screens.
  **Assessments, cross-organisation estimates and proposals, broader document generation, and shared list archive controls.** Delivered a full **assessments** capability so teams can capture site findings, hazards, and comments against jobs with matching API, assistant tools, and workspace screens.
  Enabled **cross-organisation estimate and proposal handoffs** so partner tenants can receive, review, and progress shared commercial documents with custody tracking.
  Expanded **template-driven document generation** across claims, jobs, contacts, journals, messages, tasks, vendors, and major list views so staff can produce client-ready files from more records.
  Added **shared archive and status controls** on list and detail screens so active versus archived work is managed consistently across modules.
  Improved **estimate capture, approval, and publish** flows plus job contact linking so quoting and party management stay in one workspace.
  Outcome: operations, commercial handoffs, documentation, and record lifecycle controls land as one coherent product update.

- `2026-08-08` `f8692c3` **38 h**
  `104 files | +10 013 -1 005 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Staff can keep company documents separate from each job?s files, choose filing templates when setting up the organisation and creating jobs, and keep clearer site journals.
  **Company and project document libraries, richer site journals, and smoother first-time setup.** Organisations now have a company filing area plus a separate project filing area for each job, chosen from templates during setup and when a job is created.
  The documents workspace shows company files and all projects together, or a single job?s project files when that job is in focus.
  Organisation setup asks for company and default project filing templates so new workspaces start with the right structure.
  Site journals support clearer overviews and structured page entries so field notes are easier to capture and review.
  Word documents preview more reliably, and local development starts more cleanly if a port is already in use.
  Filing defaults and template administration stay aligned with the company versus project model.
  Outcome: filing, job setup, and site journals work together as one consistent operational workspace.

- `2026-08-09` `43c5468` **8 h**
  `90 files | +4 845 -934 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: The home screen is now a morning worklist, jobs and tasks can be assigned to people, the catalogue supports larger scope items, and quote lines are easier to edit.
  **Operations inbox, catalogue scopes, job assignment, and richer quote line items.** The home dashboard is a morning worklist of active jobs, items needing a decision, today?s schedule, and unread notices, each linking to the right screen.
  Staff can assign jobs and tasks to people in the organisation from create and edit forms.
  The product catalogue supports scope-style items as well as simple and assembled items, with a smoother add-and-edit experience.
  Quote line items are easier to review and edit, including grouping and catalogue picks used on estimates and related commercial documents.
  Work orders, proposals, RFQs, invoices, and bills show clearer status and next-step actions from their detail screens.
  Outcome: daily work, ownership, catalogue structure, and quoting sit together in one operational update.

- `2026-08-09` `69aa3c3` **48 h**
  `145 files | +19 536 -920 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Partner organisations can now pass work requests, jobs, invoices and bills between each other, with clearer printing, templates, and site journals for everyday staff.
  **Completed partner-to-partner supply chain handoffs plus clearer document printing and filing.** Requests for quote now become jobs at the receiving organisation, and invoices become bills, so work and payment requests move between companies without re-keying.
  Accepting a proposal can raise a purchase order, and finishing authorised work opens the path to invoice, so the commercial chain keeps moving.
  Staff see when a partner has issued a newer version, how deep subcontracting has gone, and can compare competing bids before choosing.
  Document templates can live in a chosen company folder, assessments can be printed from a standard template, and print or download uses a clearer drawer.
  Site journals are easier to overview and fill in, and create forms show progress while records are saved.
  An insurance industry API reference was added for integration planning alongside the operational update.
  Outcome: partner trading, documents, and day-to-day capture work as one operational update.

- `2026-08-11` `07180a9` **26 h**
  `122 files | +8 410 -1 900 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Site assessments are easier to fill and publish, jobs show clearer location and ownership, and staff can see whether a record was created here or received from a partner.
  **Structured assessments, clearer job editing, and partner-origin tracking.** Assessments now use clear sections for site findings so teams can complete and publish reports more consistently.
  Job screens support richer editing, including location on a map and who is assigned, plus clearer type-specific details.
  Estimates and related commercial documents keep improved line-item and publish behaviour for everyday quoting.
  Records show whether they were created in this workspace or received from a partner organisation.
  Integration mapping for jobs is clearer, and inbound partner webhooks are more reliable.
  Written reviews compare claims, jobs, and estimates against partner system gaps so follow-up work stays focused.
  Outcome: field capture, job ownership, and partner-sourced records work together in one operational update.

- `2026-08-12` `3b9c62c` **1 h**
  `1 file | +4 -1 | Tier 3 complex | Moderate orchestration`
  Lay summary: Sign-in and other browser API calls work again instead of failing behind the login screen.
  **Fixed login and API routing so staff can sign in again.** Browser requests to the app?s own API routes were being blocked by a framework middleware mismatch.
  Sign-in and related session calls reach the correct handlers again.
  Everyday screens that depend on those calls load normally after authentication.
  The change is limited to how the web app decides which paths need middleware.
  Outcome: staff can complete login and use the workspace without the previous API failure.

- `2026-08-13` `5326be7` **40 h**
  `133 files | +4 230 -3 261 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Staff only see and change what their role allows, can switch organisation without signing in again, and the product now deploys to the hosted cloud environments.
  **Role-based access, safer sign-in, organisation switching, and hosted deploy updates.** Staff permissions now control who can view and change each area of the product, with an administration screen to manage roles.
  People who belong to more than one organisation can switch workspace without signing in again.
  Inviting colleagues is clearer, including a confirmation screen after an invite is accepted.
  The home dashboard and navigation show active work more clearly and respect what each person is allowed to see.
  Demo sample data was removed from setup so new environments start cleaner, with standard lookups and construction catalogue data still available.
  Hosting now deploys the services to Google Cloud on staging and production, and the old Fly.io configuration was removed.
  Outcome: access control, invitations, and hosted releases work together as one security and operations update.

- `2026-08-13` `caefdc7` **0.5 h**
  `2 files | +13 -3 | Tier 2 standard | Light orchestration`
  Lay summary: The automated product build succeeds again so the latest updates can be released.
  **Fixed the failed website build so the latest update can ship.** Role management responses are read safely when creating a role.
  The production website build completes without the previous type error.
  Automated checks can proceed to tests and hosting deploy.
  No change to how staff use roles or permissions day to day.
  Outcome: the release pipeline is unblocked after the role-management build failure.

- `2026-08-14` `7de1686` **0.5 h**
  `6 files | +170 -64 | Tier 3 complex | Moderate orchestration`
  Lay summary: Crunchwork staging webhooks now reach both the hosted staging server and the local development environment through an updated relay on Cloudflare.
  **Rewired Crunchwork staging webhook delivery through updated Cloudflare relay.** Crunchwork's staging webhook destination changed from an older proxy address to the provider's public staging URL.
  The Cloudflare relay Worker was updated to intercept at the new public address and forward payloads to both the hosted staging server and the local development tunnel.
  A new internal webhook endpoint was added on the provider service so the relay can deliver without conflicting with its own interception point.
  The relay was redeployed to Cloudflare with the updated route on the staging domain.
  The old relay route on the previous domain was removed.
  Outcome: Crunchwork staging webhooks are received and processed on both staging and local development environments via the updated relay.

- `2026-08-14` `3c32b8e` **0.5 h**
  `5 files | +20 -2 | Tier 3 complex | Light orchestration`
  Lay summary: Staging sign-in service can start again after a missing encryption setting was added to hosting.
  **Fixed staging auth deploy by wiring the required Redis encryption secret.** Auth was failing Cloud Run startup checks because a required production encryption key was never mounted.
  Hosting config now creates and attaches that secret for the auth service on staging.
  The same mount is prepared for production when that environment is enabled.
  The staging secret seed script covers the new key for future rebuilds.
  Outcome: auth-server staging deploys can pass startup checks again.

- `2026-08-14` `826a5d1` **0.5 h**
  `3 files | +10 -6 | Tier 3 complex | Light orchestration`
  Lay summary: The staging API is now reachable on a public hostname so webhook relays and operators can call it.
  **Opened staging API on a public hostname behind the load balancer.** Staging API was previously private to other services only.
  It is now publicly invokable and routed on the staging load balancer hostname.
  DNS for that hostname was added to point at the staging load balancer.
  Application authentication still protects normal API routes; only marked public routes stay open.
  Outcome: staging API can be reached at the public staging API hostname.

- `2026-08-14` `f10adfa` **0.5 h**
  `5 files | +40 -15 | Tier 3 complex | Moderate orchestration`
  Lay summary: Staging hosting was fixed so the public API hostname can finish provisioning without breaking certificates or permissions.
  **Fixed staging load-balancer certificate rotation and deploy permissions.** Adding the public API hostname required a new TLS certificate without taking down existing ones.
  Deploy automation was given permission to mark the API service as publicly invokable.
  Load-balancer routing was stabilized so adding a hostname does not rename sibling routes.
  Outcome: staging can complete the public API hostname cutover safely.

- `2026-08-14` `bc16a09` **1 h**
  `19 files | +603 -394 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Webhook and hosting infrastructure was hardened for commercial-grade staging and production deployment, and the quote editing interface was improved.
  **Hardened webhook routing and load-balancer configuration for commercial deployment.**
  Audited all public API endpoints and documented the application-level security model (JWT, HMAC, internal-token guards).
  Moved staging webhook fanout from direct Cloud Run access to the HTTPS load balancer, with Cloudflare Worker interception on the provider hostname.
  Prepared production Terraform with HTTPS load balancer, IAM permissions, and public API service configuration matching staging.
  Refactored quote detail view into tabbed layout with overview and parties tabs, and improved quote editing actions.
  Updated deployment documentation with the security model and per-service authentication strategy.

- `2026-08-14` `4510bbb` **0 h**
  `1 files | +9 -1 | Tier 3 complex | Light orchestration`
  Lay summary: Staging load balancer update was fixed so an unused provider route can be removed without breaking the apply.
  **Fixed load-balancer URL map destroy order.** Removing a backend required creating a replacement URL map first so Google would release the old reference.
  Outcome: Terraform can finish removing the staging provider hostname from the load balancer.

- `2026-08-14` `d057312` **0 h**
  `3 files | +20 -15 | Tier 3 complex | Light orchestration`
  Lay summary: Staging load balancer apply was unblocked by keeping the provider backend while leaving that hostname off the certificate.
  **Unblocked staging Terraform after URL map destroy cycle.** Reverted fingerprint-based URL map replacement that caused a dependency cycle.
  Kept the provider backend on the load balancer but omitted providers-staging from the managed certificate while Cloudflare terminates TLS for that hostname.
  Outcome: staging Terraform can complete certificate and routing updates without destroying in-use backends.

- `2026-08-15` `3b71d1d` **8 h**
  `42 files | +1623 -319 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Invoices can now be drafted and published cleanly, document templates are easier to manage, and claim-related pages load more reliably.
  Delivered create-then-publish invoicing so drafts stay local until ready to send.
  Linked invoices to work orders and improved how provider invoices are created and mapped.
  Added an invoice publish wizard so staff can review and confirm before sending.
  Built a document-template detail screen so admins can configure templates per document type.
  Improved catalogue selection and outbound sync for more accurate item handling.
  Speeding up claim, job, quote, and invoice page loads with shared cached data loading.

- `2026-08-15` `d3da0f8` **0.5 h**
  `1 files | +1 -1 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed a build error that blocked deploying the latest invoice page updates.
  Corrected invoice detail claim lookup to use the related job instead of a missing invoice field.
  Restored a clean production build so staging deployment can proceed.
  No change to invoice publishing behaviour for end users.
  Outcome: continuous integration can complete successfully again.
  Prevents the invoice detail page from failing type checks during release.


- `2026-08-15` `bd5634d` **5 h**
  `22 files | +1747 −379 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Quotes can be assigned to a person, and staff can add notes on RFQ line items while reviewing scope.
  Added assignee support on quotes so ownership is clear on the quote itself.
  Quote detail shows who is assigned and can fall back to the job assignee when needed.
  Staff can attach notes to RFQ groups and line items while reviewing scope.
  Improved the quote line-items table and group editing for clearer day-to-day use.
  Database updates back the new assignee and note fields.
  Outcome: clearer ownership on quotes and better context on RFQ line items.

- `2026-08-16` `5813ec6` **78.5 h**
  `224 files | +18269 −2990 | Tier 1 mechanical / Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Staff can install capability packs, reshape document templates with live transforms, and use a broader assistant toolkit—including field assessment skills—across the product.
  Delivered installable capability packs so organisations can turn on agents and skills as packaged features.
  Added an admin screen to browse, inspect, and install packs without engineering changes.
  Built document-template transforms with preview, versioning, and merge-tag support so output can be shaped per document type.
  Expanded the assistant tool surface so chat can act across claims, finance, documents, and related workflows.
  Refreshed field assessment screens and skills so assessors complete tabs with clearer guided assistance.
  Improved how chat uses page context and skills so help stays relevant to the screen in use.
  Outcome: packs, document transforms, and a wider assistant toolkit ready for day-to-day claims operations.

- `2026-08-16` `a0b3619` **7.5 h**
  `51 files | +4504 −192 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Staff can email RFQ packs to suppliers and review what was sent, including generated documents and delivery status.
  **Send RFQ requests to suppliers by email with a clear request history.** Staff can select recipients, customise the message, and send quotation requests from an RFQ.
  Each send is recorded as a request batch so the team can see who was contacted and when.
  Generated RFQ documents can be attached to the outbound email for each supplier.
  A requests tab and batch detail view show delivery status and related documents in one place.
  Contact picking on jobs was improved so the right people are easier to choose when sending.
  Outcome: RFQ outreach is tracked end-to-end instead of living only in inboxes.

- `2026-08-17` `0f43afb` **4.5 h**
  `53 files | +2450 −400 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Staff can open tasks and appointments from the schedule and lists without leaving the page, and an admin account can be seeded for Ensure Construction.
  Added a shared side panel so tasks and appointments open in place from schedule, lists, and assistant actions.
  Schedule and dashboard links now open the matching task or appointment directly.
  Improved list filters and column controls across jobs, quotes, contacts, and related screens.
  Hardened task sync and quote handling so parent jobs and related records stay consistent.
  Added an Ensure Construction admin seed and wiring for transactional email secrets in hosted environments.
  Outcome: faster day-to-day navigation from calendar and lists, with cleaner admin bootstrap.

- `2026-08-17` `659bb61` **0.5 h**
  `3 files | +42 −7 | Tier 2 standard / Tier 3 complex | Light orchestration`
  Lay summary: Fixed a failed staging release by correcting task sync typing and recognising an email secret that was already in place.
  Corrected task sync typing so the API build and checks pass again.
  Told staging infrastructure to adopt the existing email API key secret instead of trying to create a duplicate.
  Restored the path for a successful staging deployment after the earlier change.
  No change to day-to-day product behaviour beyond unblocking the release.
  Outcome: staging pipeline can proceed again.

- `2026-08-17` `3683461` **0.5 h**
  `2 files | +19 −24 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed the sign-in service build so staging packaging succeeds after the admin seed script failed type checks.
  Updated the Ensure Construction admin seed to use the shared organisation helpers.
  Corrected password-identity updates so they match the database schema types.
  Confirmed the auth service compiles cleanly for release packaging.
  Outcome: auth service build unblocked for staging deploy.

- `2026-08-17` `9369b43` **0 h**
  `9 files | +227 −13 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: After the first organisation exists, people can no longer create new organisations from public sign-up; they need an invitation.
  Closed public new-organisation signup once at least one organisation is on the system.
  Left an optional setting to force open or closed signup for testing or recovery.
  Hid the Sign Up link and create-organisation option when signup is closed.
  Blocked registration and API signup paths that would create a new organisation.
  Invite-based joins to existing organisations remain available.

- `2026-08-17` `e66ca52` **0 h**
  `8 files | +486 −172 | Tier 2 standard | Light orchestration`
  Lay summary: Password reset now returns people to sign-in correctly, and the app layout chrome was tightened.
  Fixed password-reset success and sign-in links so users are not sent to a broken login page.
  Kept the reset flow tied to the active sign-in session when one exists.
  Tidied the main app header, sidebar, and shell layout behaviour.
  Outcome: smoother password reset and cleaner app chrome (no charge).

- `2026-08-17` `7ef3ece` **7.5 h**
  `72 files | +4302 −3412 | Tier 2 standard / Tier 3 complex / Tier 4 deep | Heavy orchestration`
  Lay summary: Unified how external updates land in the app, improved messages and schedule, and made connection health easier to see.
  Replaced the old per-entity external mappers with a single projection path for inbound updates.
  Added connection identifiers and webhook admin/sweep tooling so sync issues are easier to find and clear.
  Expanded schedule event data and calendar behaviour so appointments link and display more reliably.
  Improved messages across entity screens, including detail viewing, composing, and shared message/attachment tabs.
  Added upstream API health monitoring so users get clearer feedback when the backend is unreachable.
  Documented webhook projection unification and event-type coverage for operators and future work.

- `2026-08-17` `2693c29` **0 h**
  `1 files | +1 −1 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed a type error that was blocking the staging release build.
  Added the missing entity id on a skipped message projection result so typecheck passes.
  Outcome: CI can proceed to build and deploy again (no charge).

- `2026-08-18` `3fdb697` **2 h**
  `7 files | +384 −228 | Tier 2 standard | Moderate orchestration`
  Lay summary: Journal pages are easier to scan and edit, with a clearer header, sticky tabs, and a simpler address form.
  Added a compact journal header with status, address, visit date, and linked job.
  Overview and entries tabs now keep their place in the URL so refresh and sharing stay on the same view.
  Simplified the create/edit journal address flow with a collapsible detail section after search.
  Cleaned up the journal overview layout for faster reading of site and visit details.
  Outcome: smoother day-to-day journal review and data entry.

- `2026-08-18` `0c1e76a` **0 h**
  `1 files | +8 −1 | Tier 1 mechanical | Light orchestration`
  Lay summary: Registered a missed database migration so staging can load connection identifiers for messages.
  Added the connection identifiers migration to the Drizzle journal so deploy migrators apply it.
  Outcome: staging can create the identifiers table and unblock message sync (no charge).

- `2026-08-18` `cbf1941` **1 h**
  `2 files | +68 −44 | Tier 3 complex / Tier 4 deep | Moderate orchestration`
  Lay summary: Webhook catch-up no longer gets stuck behind old unmatched events, so new messages and updates keep flowing.
  Processes ready webhook events before trying to match unmatched ones.
  Counts failed connection matches and parks events after a retry limit.
  Prefers newest unmatched events so recent work is not blocked by old junk.
  Makes batch size and retry limit configurable for operators.
  Outcome: staging-style backlog starvation is much less likely to repeat.

- `2026-08-19` `1da6d45` **8.5 h**
  `72 files | +1921 −814 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Production can now be released the same way as staging, and staff get clearer messages, assessments, and side-by-side forms.
  **Brought production hosting in line with staging and improved day-to-day screens.**
  Release tags now build, check, and deploy the live environment with the same steps staging already uses.
  Added a production go-live runbook, secret seeding, and rollback so the first live cutover is repeatable.
  Field assessment guidance now gathers job information first and walks staff through each section to finish.
  Communications live on one messages screen with send from a job, instead of a duplicate tab on the job page.
  Forms and chat sit side by side more reliably, and connection and file-pipeline screens were simplified.
  Updated the public hero image to match the current brand presentation.

- `2026-08-19` `67dc756` **1 h**
  `6 files | +95 −7 | Tier 3 complex | Moderate orchestration`
  Lay summary: The live hosting pipeline can now manage production as well as staging, after the deployer account was given the right access.
  **Granted the automated deployer access to the production project.**
  The same trusted GitHub identity that already updates staging can now apply production infrastructure.
  Enabled the required Google Cloud services on production so the first apply does not stall.
  Documented the one-time bootstrap step operators must run if production access is missing.
  Outcome: production Terraform apply can proceed instead of failing with permission errors.

- `2026-08-19` `f068e34` **1 h**
  `16 files | +469 −112 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: The catalogue side panel is back to its original width, and room groups now appear for existing customers on staging and production.
  **Restored the catalogue panel and filled in missing room groups for hosted environments.**
  The catalogue drawer is back to its original compact width so the quote stays visible beside it.
  Room groups such as kitchen and bathroom now appear for existing customers instead of an empty list.
  Staging and production releases now load those groups automatically for every organisation.
  Outcome: staff can drag room groups onto quotes in both hosted environments.

- `2026-08-19` `2a4f0de` **0.5 h**
  `91 files | +3936 −89 | Tier 2 standard | Light orchestration`
  Lay summary: Partner systems now hear about job changes, quote lines can be reordered, and builder workflow guides are filed in one place.
  **Sent job updates to partner systems, tidied job and quote screens, and filed builder workflow guides.**
  Jobs, quotes, tasks, appointments, and purchase orders now notify the partner workflow when they change.
  Staff can reorder quote lines, see make-safe and excess as clear yes/no markers, and get a loading message on the catalogue.
  Builder make-safe, assessment, and works guides plus related reference files now live in one Crunchwork folder.
  Sample flood, fire, and roof-leak job photos and notes were added for training and walkthroughs.

- `2026-08-22` `e380aed` **48 h**
  `430 files | +32892 −4797 | Tier 2 standard / Tier 3 complex / Tier 4 deep integration | Heavy orchestration`
  Lay summary: Staff can build reports from live job data, manage the product catalogue in chat, see a history of changes on each record, and run builder assessment, make-safe, and repair jobs with less manual follow-up.
  **Catalogue, reports, activity history, and builder job workflows in one delivery.**
  Staff can import and edit catalogue items, assemblies, and bills of materials, and ask the in-product assistant for help with those tasks.
  Report templates pull live job, quote, and invoice details so printed documents stay accurate without re-typing.
  Each job and related record now shows a history of what changed, who did it, and when.
  Builder assessment, make-safe, and repair-works jobs move through dates, documents, and partner updates with less re-keying.
  Publishing estimates and jobs gives clearer on-screen feedback, and people on a job stay aligned across contacts and messages.
  Task types, work-order details, and stronger sign-in complete the day-to-day operating set.

- `2026-08-23` `eb768f2` **12 h**
  `168 files | +6662 −3232 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Every entity now has its own reference number, contacts have a dedicated detail screen, quote lines can be grouped and edited in place, and document output includes richer project and financial data.
  **Record numbers, contact management, document transforms, and quote line-items.**
  Every job, quote, task, and purchase order now receives a sequential reference number automatically.
  Contacts have their own detail screen showing related jobs and a redesigned edit form.
  Quote line items can be grouped, edited inline, and totals flow through to generated documents.
  Document templates pull richer party, assessment, and financial data into printed output.
  List screens across the application use consistent server-side filtering and loading states.
  Outbound webhooks and projection events carry entity numbers and updated party information.

- `2026-08-24` `c3f12a2` **0.5 h**
  **fix(api): resolve CI typecheck failures.** Remove unsupported tx argument from quotesRepo.findOne and use filesystem category displayName instead of the removed name field.

- `2026-08-24` `53d51e0` **0.5 h**
  **test(api): expect three providers in registry summary.** Update providers findAll spec for the more0-ensure registry entry introduced alongside the direct provider.

- `2026-08-24` `d63704b` **12 h**
  `93 files | +8465 −5927 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Quote and related line lists are easier to group and edit, invoices print from a proper template, and the people on a job go through to the partner system.
  **Rebuilt line-item editing and invoice documents, and sent job contacts to the partner system.**
  Staff can group, search, reorder, and edit quote and catalogue lines in place, with totals, notes, and drag-and-drop from the catalogue.
  The same line editor is used on quotes, bills, invoices, work orders, and related screens so editing feels consistent.
  Invoices now generate from a dedicated printed template with grouped line items, quantities, rates, and amounts.
  Requests for quotation carry the right contacts and selected lines through create, edit, and issue.
  Job people are chosen more clearly on the job screen and those contacts are included when the job is sent to the partner workflow.
  Document output and partner updates stay in step with the latest line groups, parties, and job dates.

- `2026-08-24` `ae090b1` **1 h**
  `9 files | +116 −49 | Tier 2 standard | Moderate orchestration`
  Lay summary: Quote and catalogue line edits now stay on screen and save correctly, including when several lines are changed together.
  **Fixed quote and catalogue line editing so typed changes stay visible and actually save.**
  Staff can edit names, quantities, costs, and related fields on quote and catalogue lines and see those values on screen immediately.
  Saving now writes the edited groups and items correctly instead of dropping some changes.
  Editing several selected lines at once fills in the full set of fields so nothing is left blank.
  The same behaviour applies on the catalogue line list as on quotes.

- `2026-08-25` `1021abc` **4.5 h**
  `16 files | +550 −55 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Jobs from the partner system that share the same insurer reference now use one internal job number, and the claims list shows linked jobs more clearly.
  **Aligned internal job numbers and improved claims list job visibility.**
  Partner jobs that share an insurer reference (e.g. Make Safe and Builder Works under the same cc: number) now receive the same internal job number instead of each getting a new one.
  New job ingest looks up an existing number by insurer reference before assigning the next sequence value.
  Database migrations relaxed the internal-number uniqueness rule for insurer-linked jobs and backfilled existing dev data so sibling jobs already in the system match.
  Claims list search now includes job references, insurer references, and site address text so staff can find claims by job or location details.
  Claims list job column shows the primary job with a hover menu listing every related job and its type badge when multiple jobs exist on one claim.
  Job overview and shared label helpers surface the insurer reference consistently, separate from the partner system's own job identifier.

- `2026-08-26` `0e70cad` **10 h**
  `111 files | +4101 −3266 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Record pages now share a consistent header and action bar, task types are built in instead of configured separately, and jobs and line-item editing work more smoothly.
  **Unified detail-page headers and simplified task types across the product.**
  Quotes, invoices, jobs, claims, and other record screens now use the same header layout with consistent save, print, publish, and archive actions.
  Configurable task-type mappings and the admin settings screen were removed in favour of a fixed partner task-type list shared by the app and API.
  Staff can create Make Safe jobs from the jobs list and see clearer job filtering, grouping, and insurer-reference handling.
  Line-item tables support improved drag-and-drop targets, parsing, and catalogue drops on quote and related screens.
  Invoice publishing uses shared publish logic; partner connections expose webhook event history more clearly.
  Automated tests cover task types, line-item sync, purchase-order transforms, and invoice publish helpers.

- `2026-08-26` `c865a25` **6 h**
  `19 files | +897 −17 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Incoming partner claims now show the right type and status, and hosted environments use the same item catalogue so product codes match.
  **Partner claims show real types and statuses, and hosted sites load the current item catalogue.**
  Incoming claims recognise partner statuses and loss types instead of appearing as Unknown.
  Claims already in the system are updated to those same labels so lists and filters work.
  Hosted environments replace old item catalogues with the current partner catalogue so product codes match the working system.
  Completed and cancelled claims appear under archive instead of dropping off the active list.
  Each release applies the catalogue and claim-label updates automatically after deploy.

- `2026-08-26` `fcff4e5` **0.5 h**
  `3 files | +37 −28 | Tier 3 complex | Light orchestration`
  Lay summary: A failed hosted release is corrected so claim labels and the product catalogue still update automatically after deploy.
  **Fixed the post-deploy update so hosted environments finish loading claim labels and the item catalogue.**
  The automatic update after a release no longer stops with an error before it finishes.
  Existing claims still receive the correct type and status labels.
  The current product catalogue still replaces older catalogues on hosted sites.
  Staff keep seeing the right claim list and matching product codes after the next release.

- `2026-08-26` `3cec069` **0.5 h**
  `6 files | +115 −8 | Tier 3 complex | Light orchestration`
  Lay summary: Ensure catalogue product lines can be sent to the insurer again on the hosted site.
  **Tagged Ensure catalogue product lines so they can be sent to the insurer.**
  Hosted releases apply that tagging automatically after each deploy.
  A later catalogue refresh keeps the insurer tag instead of clearing it.
  Staff can publish Ensure-based estimates without a manual retag.
  Grouping lines stay internal-only, as intended.

- `2026-08-26` `3b01a08` **0.5 h**
  `4 files | +141 −116 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed the hosted claims list so it opens reliably instead of showing an error on first load.
  **Restored the hosted claims list after a server-side rendering failure.**
  Diagnosed the staging error blocking the claims list on first load.
  Moved archive and active-tab helpers to a server-safe module shared with list filters.
  Updated the claims page to use those helpers instead of client-only code.
  Staging can load the full claims list on refresh and direct navigation again.

- `2026-08-26` `456d168` **4 h**
  `62 files | +749 −111 | Tier 2 standard | Moderate orchestration`
  Lay summary: Job lists now show the job type next to the job number, screens prefer the internal job number, and save status no longer crowds the header.
  **Clearer job labels on lists, and a save status that no longer crowds the header.**
  Record lists now show the job type next to the internal job number in the same link to the job.
  Quote and contact lists resolve job names and types even when the jobs list is large.
  The dashboard and related screens prefer the internal job number over insurer or partner references.
  Save status on job records appears under the header icons so title and action buttons stay in place.
  Catalogue drag-and-drop onto line items is more reliable.

- `2026-08-26` `4737f13` **2 h**
  `15 files | +699 −50 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Opening a job now shows how many related records sit behind each menu item, the schedule labels jobs more clearly, and the tasks list stays reliable when filters change.
  **Job-aware navigation counts, clearer schedule job labels, and a more reliable tasks list.**
  While a job is open, the side menu shows a count next to each related area that already has records.
  The schedule includes jobs by default and labels them with the internal job number and job type.
  The tasks list no longer drops or reloads incorrectly when staff change tabs or filters.
  Staff can see at a glance what is already on a job before opening each list.
  These updates apply on the website after the next release.

- `2026-08-27` `3a58387` **8 h**
  `60 files | +3071 −327 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Staff can update the catalogue from an estimate, invoices send more reliably to the insurer, and lists show clearer record numbers.
  **Catalogue updates from estimates, more reliable insurer invoicing, and clearer record labels.**
  Organisation admins can choose whether saving an estimate also updates matching catalogue items, either after a prompt or automatically.
  Invoices published to the insurer now handle vendor tax invoices and line totals more accurately.
  Quotes, invoices, and work orders show the insurer reference where it differs from the internal number, and save status sits under the header icons.
  Sign-in recovers more cleanly from an old session, and password reset is more reliable.
  The same insurer record can no longer create two work orders from one purchase order.

- `2026-08-30` `08515fe` **16 h**
  `151 files | +5 029 −1 989 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Jobs, tasks, and appointments now show whether they have reached the insurer, the in-app assistant follows the page and assessment section you are on, and printing and sign-in are more reliable.
  **Insurer sync status across jobs, tasks, and appointments, plus a page-aware in-app assistant.**
  Staff can see when a job, task, or appointment is still sending, has arrived, or failed to reach the insurer, and failed sends retry automatically.
  The in-app assistant follows the current page and, on assessments, the active section so suggestions match the work in front of you.
  Assessments can be printed from the record, and organisation assistants can be configured to act with less manual prompting.
  Document templates for invoices and related paperwork sit in a dedicated folder so new environments start with the right forms.
  Sign-in and organisation setup handle hosted database connections more reliably, and the assistant tools connection follows standard sign-in discovery.
  Unused hosting access was removed so insurer webhook and cloud services use a simpler, tighter setup.

- `2026-08-30` `ebdb1f1` **0.5 h**
  `3 files | +25 −13 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed a release check so the latest updates can go live on the hosted site.
  **Unblocked the hosted release after a type-check failure.**
  Corrected how existing tasks are passed when records sync from the insurer.
  Matched assessment chat skills by their displayed names so the right helper is boosted on each tab.
  Confirmed the application type-check and package build succeed locally.
  The hosted site can pick up the latest job, task, appointment, and assistant updates.

- `2026-08-31` `a63652b` **9 h**
  `144 files | +16 996 −293 | Tier 1 mechanical / Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Staff can open in-product help for the page they are on, manage catalogues more easily, and see clearer details on estimate line items.
  **In-product help, catalogue management, and clearer line-item details.**
  Staff can press help on a page or ask in chat and open a matching guide beside the conversation, with search across the full help set.
  Operations and configuration guides cover claims, jobs, assessments, estimates, invoices, vendors, and admin settings.
  Catalogue administrators can copy catalogues, work with structure, and import an updated item file.
  Line items show more useful detail on hover, with smoother keyboard movement around groups and assemblies.
  Invoices and quotes keep related components aligned when records are published or updated.
  Help documents are stored so they can be searched and opened the same way for every organisation.

- `2026-08-31` `ab6616b` **3 h**
  `55 files | +2891 −465 | Tier 2 standard / Tier 3 complex | Heavy orchestration`
  Lay summary: Catalogues can now be exported and re-imported without losing structure, and staging receives the same agents, skills, and help content as new sign-ups.
  **Lossless catalogue round-trip and staging seed parity.**
  Catalogue export now captures item IDs, hierarchy, source references, quantities, and metadata so they survive a re-import into the same or a different environment.
  Re-importing handles multi-parent items, cross-catalogue references, and UUID collisions gracefully.
  Staging and production deployments now seed MCP integrations, assessment skills, and capability packs for every organisation automatically.
  Journal site entries and walk-through image generation are available from the API and assistant tools.
  The help-guide ingestion job is created in staging infrastructure and deployment fails clearly if it is missing.

- `2026-08-31` `a01f553` **0.5 h**
  `2 files | +12 −12 | Tier 2 standard | Light orchestration`
  Lay summary: Fixed a release check so the latest updates can go live on the hosted site.
  **Unblocked the hosted release after a type-check failure.**
  Corrected how journal image generation reads AI configuration so the release checks pass.
  Confirmed the application type-check succeeds locally.
  The hosted site can pick up catalogue round-trip, seed parity, and journal updates.

- `2026-08-31` `pending` **4.5 h**
  `29 files | +746 −129 | Tier 2 standard / Tier 3 complex | Moderate orchestration`
  Lay summary: Printed reports can be downloaded on the hosted site, insurer updates process more reliably, and site-walk notes and photos stay on one cause of damage.
  **Printed reports, insurer update processing, and site-walk photos.**
  Printed reports download even when a direct file link cannot be created, and larger reports have more time to turn into PDFs.
  Insurer updates are handed to the main application for processing, and failed updates are retried automatically.
  Site-walk journals keep one cause of damage across spoken notes and photos.
  Photo generation for those journals recovers more cleanly when the image service is busy.
  The assessment helper is set to the current hosted model.

