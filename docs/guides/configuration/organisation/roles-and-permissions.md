---
title: "Roles & Permissions"
slug: roles-and-permissions
description: "How to create custom roles, assign permissions, and understand what each permission controls in the UI."
section: configuration
area: organisation
routes:
  - /admin/roles
  - /admin/users
audience: manager
permissions_discussed:
  - org.roles.create
  - org.roles.read
  - org.roles.update
  - org.roles.delete
  - org.users.manage
  - org.users.invite
  - org.users.remove
  - org.users.read
tags:
  - rbac
  - roles
  - permissions
  - security
  - access control
  - onboarding
  - custom roles
related_guides:
  - managing-users
  - company-settings
version: 1
last_updated: 2026-08-31
---

# Roles & Permissions

EnsureOS uses **role-based access control (RBAC)** to manage what each user can see and do. Every user is assigned one or more **roles**, and each role contains a set of **permissions** that grant access to specific features and actions.

This guide explains how roles and permissions work, how to create custom roles, and what each permission controls.

## Key Concepts

- **Permission** — a single capability, such as "Create Claims" or "Approve Invoices". Permissions gate specific actions throughout the application.
- **Role** — a named collection of permissions. Instead of assigning permissions to each user individually, you assign roles.
- **System role** — a built-in role that cannot be deleted (Platform Admin, Organisation Admin, Member). System roles can have their permissions edited.
- **Custom role** — a role created by your organisation. Custom roles can be created, edited, and deleted.

## Accessing Roles & Permissions

1. Click the **gear icon** in the top-right header to open Admin Settings.
2. Under **Organisation**, click **Roles & Permissions**.

This page shows all roles on the left and the permission matrix on the right.

> **Required permission:** You need `org.roles.read` (Read Org Roles) to view this page. To create or edit roles you also need `org.roles.create` and `org.roles.update`.

## Built-in Roles

EnsureOS ships with seven pre-configured roles. Three are **system roles** (cannot be deleted) and four are **custom templates** (can be edited or deleted).

### System Roles

| Role | Scope | Description |
|------|-------|-------------|
| **Platform Admin** | Platform | Full access to everything. Holds the wildcard (`*`) permission that grants all capabilities across all organisations. Reserved for platform operators. |
| **Organisation Admin** | Organisation | Full access within the organisation. Can manage users, roles, settings, and all domain features. Cannot manage platform-level resources. |
| **Member** | Organisation | Standard access for day-to-day work. Default role assigned to new users. Can create claims, edit jobs, manage documents, send messages, and use AI chat. Cannot manage users, roles, or organisation settings. |

### Pre-configured Custom Roles

These are installed as starting templates. They can be edited to match your organisation's needs or deleted if not required.

| Role | Description | Key Differences from Member |
|------|-------------|-----------------------------|
| **Manager** | Team lead with elevated access | Adds: view users and roles, assign jobs, approve invoices, manage finance, manage catalogues and filesystems, manage vendors and integrations |
| **Senior Estimator** | Creates estimates with catalogue write-back | Adds: `catalogs.update-from-estimate` — can push estimate line-item changes back to the source catalogue |
| **Estimator** | Creates estimates from catalogues | Adds: full procurement read/write. Cannot update source catalogues from estimates |
| **Viewer** | Read-only access | Read permissions only across all domain areas. Cannot create, edit, or delete any records |

## Creating a Custom Role

1. On the **Roles & Permissions** page, click the **Add Role** button in the top-right.
2. Fill in the role details:
   - **Role Key** — a machine-readable identifier (e.g. `compliance_officer`). Use lowercase with underscores. This cannot be changed after creation.
   - **Scope** — select **Organisation** for roles used within your org. **Platform** scope is for platform-level administration only.
   - **Display Name** — the human-readable name shown in the UI (e.g. "Compliance Officer").
   - **Description** — optional text explaining the role's purpose.
3. Click **Create**.
4. The new role appears in the left panel. Select it to open the permission matrix.
5. Check the permissions you want this role to have (see the reference table below).
6. Click **Save Permissions**.

## Editing a Role's Permissions

1. Select the role in the left panel.
2. The right panel shows all permissions grouped by category. Checked permissions are currently assigned.
3. Check or uncheck permissions as needed.
4. Click **Save Permissions** to apply changes.

> **Note:** Changes take effect the next time affected users sign in or their session refreshes. Active sessions continue with their existing permissions until token renewal.

## Deleting a Custom Role

1. Select the role in the left panel.
2. Click the **Delete** button (trash icon) in the top-right of the detail panel.
3. Confirm the deletion.

> **Warning:** System roles (Platform Admin, Organisation Admin, Member) cannot be deleted. Only custom roles show the delete button.

## Assigning Roles to Users

Roles are assigned to users from the **Users** page:

1. Navigate to **Admin Settings** → **Organisation** → **Users**.
2. Find the user and click the **Edit Roles** button (or click on the user row).
3. In the **Edit Roles** drawer, toggle roles on or off by clicking the role chips.
4. Click **Save Roles**.

Users can hold multiple roles simultaneously. Their effective permissions are the **union** of all permissions from all assigned roles.

> **Required permission:** You need `org.users.manage` (Manage Users) to change role assignments.

## Permission Wildcards

EnsureOS supports two wildcard patterns:

- **`*`** (superuser) — matches all permissions. Only assigned to the Platform Admin role.
- **Prefix wildcards** (e.g. `org.*`) — matches any permission starting with the prefix. For example, `org.*` grants `org.users.read`, `org.users.manage`, `org.roles.create`, and all other `org.*` permissions.

Wildcards are useful for broad grants but should be used sparingly. Prefer explicit permissions for custom roles.

## Privileged Role Grants

Some roles are considered **privileged** and require an additional permission to assign:

| Privileged Role | Required Permission | Purpose |
|-----------------|---------------------|---------|
| Platform Admin | `roles.grant.platform_admin` | Prevents accidental escalation to platform-level access |
| Organisation Admin | `roles.grant.admin` | Prevents non-admins from granting admin access |

If a user has `org.users.manage` but not the required `roles.grant.*` permission, they can assign other roles but not the privileged ones. This is an escalation protection mechanism.

## Permission Reference

Every permission in EnsureOS is listed below, grouped by category. The **UI Impact** column explains where the permission applies in the application.

### Platform (System)

These permissions manage the platform itself. They are scoped to **platform** level and are typically only relevant for Platform Admin users.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `*` | Superuser | Grants all permissions (wildcard) | Full access to everything in the application |
| `platform.roles.create` | Create Platform Roles | Create roles at platform scope | Add Role button (platform scope) on Roles & Permissions page |
| `platform.roles.read` | Read Platform Roles | View platform-scoped roles | See platform roles in the Roles & Permissions list |
| `platform.roles.update` | Update Platform Roles | Edit platform-scoped roles | Edit and save permissions for platform roles |
| `platform.roles.delete` | Delete Platform Roles | Delete platform-scoped roles | Delete button on platform roles |
| `platform.permissions.manage` | Manage Permissions | Create, update, and delete permission definitions | Manage the permission catalogue (advanced) |
| `platform.users.read` | View All Users | View users across organisations | See users from all organisations (platform admin panel) |
| `platform.users.manage` | Manage Platform Users | Assign platform roles to users | Assign platform-scoped roles to any user |
| `platform.users.invite` | Invite Platform Users | Invite users to the platform | Send invitations at the platform level |
| `platform.integrations.manage` | Manage Platform Integrations | Platform OAuth clients and DCR | Configure platform-level OAuth and integration settings |

### Privileged Role Grants

These guard against privilege escalation when assigning sensitive roles.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `roles.grant.platform_admin` | Grant Platform Admin | Grant or revoke the Platform Admin role | Required to assign/unassign the Platform Admin role in the Edit Roles drawer |
| `roles.grant.admin` | Grant Organisation Admin | Grant or revoke the Organisation Admin role | Required to assign/unassign the Organisation Admin role in the Edit Roles drawer |

### Administration

Permissions for managing users, roles, and organisation settings.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `org.users.read` | Read Users | View user list and profiles | **Users** page visibility in Admin sidebar; user list and profile details |
| `org.users.manage` | Manage Users | Change roles and remove users | Edit Roles drawer on the Users page; remove user actions |
| `org.users.invite` | Invite Org Users | Invite users to the organisation | **Invite User** button and drawer on the Users page |
| `org.users.remove` | Remove Org Users | Remove members from the organisation | Remove/deactivate user actions on the Users page |
| `org.roles.create` | Create Org Roles | Create roles at organisation scope | **Add Role** button on Roles & Permissions page |
| `org.roles.read` | Read Org Roles | View the role catalogue | **Roles & Permissions** page visibility in Admin sidebar; role list |
| `org.roles.update` | Update Org Roles | Edit roles and their permissions | Permission checkboxes and Save Permissions button |
| `org.roles.delete` | Delete Org Roles | Delete non-system roles | Delete button on custom roles |
| `org.settings.manage` | Manage Org Settings | Update organisation settings | **Company** settings page in Admin; organisation profile editing |
| `org.integrations.manage` | Manage Org Integrations | Organisation OAuth clients and DCR | OAuth client configuration in organisation integration settings |
| `features.read` | View Feature Configuration | View feature flags and grants | **Features** page visibility in Admin sidebar |
| `features.manage` | Manage Features | Create, update, delete feature flags | Edit controls on the Features page |

### Domain — Claims & Jobs

Core insurance claim and job management permissions.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `claims.create` | Create Claims | Create new insurance claims | **New Claim** button on the Claims list page |
| `claims.read` | Read Claims | View claims | Claims list page; claim detail pages |
| `claims.update` | Update Claims | Edit existing claims | Edit fields on claim detail pages |
| `claims.delete` | Delete Claims | Delete claims | Delete action on claim records |
| `jobs.create` | Create Jobs | Create repair/service jobs | **New Job** button on the Jobs list page |
| `jobs.read` | Read Jobs | View jobs | Jobs list page; job detail pages |
| `jobs.update` | Update Jobs | Edit jobs | Edit fields on job detail pages |
| `jobs.assign` | Assign Jobs | Assign jobs to providers | Job assignment controls on job detail pages |

### Domain — Invoicing & Finance

Permissions for invoices, finance ledgers, and reports.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `invoices.create` | Create Invoices | Create invoices | **New Invoice** button on the Invoices list page |
| `invoices.read` | Read Invoices | View invoices | Invoices list page; invoice detail pages |
| `invoices.update` | Update Invoices | Edit existing invoices | Edit fields on invoice detail pages |
| `invoices.approve` | Approve Invoices | Approve or reject invoices | Approve/reject actions on invoice records |
| `finance.read` | Read Finance | View finance summaries and ledgers | **Accounts Receivable** and **Accounts Payable** pages |
| `finance.manage` | Manage Finance | Update finance records | Edit controls on finance pages |
| `reports.read` | Read Reports | View reports and dashboards | **Reports** page; report detail and generation |

### Domain — Documents & Filesystems

Permissions for document management and filesystem configuration.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `documents.read` | Read Documents | View and download documents | **Documents** page; document viewer and download actions |
| `documents.manage` | Manage Documents | Upload, categorise, and delete documents | Upload button; categorisation controls; delete actions on documents |
| `filesystems.read` | Read Filesystems | View filesystem layouts and categories | **Filesystem Categories** and **Filesystem Templates** pages (view only) |
| `filesystems.manage` | Manage Filesystems | Configure filesystems and templates | Edit controls on Filesystem Categories and Templates pages |

### Domain — Catalogues

Permissions for managing catalogues, line items, and estimate write-back.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `catalogs.read` | Read Catalogues | View catalogue items and types | **Catalogues** page in Admin; catalogue detail pages; catalogue picker in estimates |
| `catalogs.manage` | Manage Catalogues | Create and update catalogues | New Catalogue button; edit catalogue items, categories, and BOM |
| `catalogs.update-from-estimate` | Update Catalogue from Estimate | Push estimate line-item changes back to the source catalogue | Catalogue update mode toggle on the Estimates page (when enabled in org settings) |

### Domain — Contacts & Journals

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `contacts.read` | Read Contacts | View contacts | **Contacts** list page; contact detail pages |
| `contacts.manage` | Manage Contacts | Create and update contacts | New Contact button; edit fields on contact detail pages |
| `journals.read` | Read Journals | View journals and pages | **Journals** list page; journal pages with photos and notes |
| `journals.manage` | Manage Journals | Create and update journals | New Journal button; add/edit journal pages |

### Domain — Assessments

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `assessments.read` | Read Assessments | View assessments | **Assessments** list page; assessment detail pages |
| `assessments.manage` | Manage Assessments | Create, publish, and delete assessments | New Assessment button; edit all assessment tabs; publish and delete actions |

### Domain — Procurement

Permissions for estimates, RFQs, proposals, work orders, purchase orders, and bills.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `procurement.read` | Read Procurement | View quotes, RFQs, proposals, work orders, and bills | **Estimates**, **RFQs**, **Proposals**, **Work Orders**, **Purchase Orders**, and **Bills** list and detail pages |
| `procurement.manage` | Manage Procurement | Create and update procurement records | Create and edit actions across all procurement entity pages |

### Domain — Vendors

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `vendors.read` | Read Vendors | View vendors | Vendor detail pages linked from RFQs, proposals, POs, and bills |
| `vendors.manage` | Manage Vendors | Update vendor links | Edit vendor associations and vendor detail fields |

### Domain — Messaging & Workflows

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `messaging.read` | Read Messaging | View messages and notifications | **Communications** page; message detail drawer |
| `messaging.send` | Send Messaging | Send messages and mark notifications read | Send button in the communications interface; mark-as-read actions |
| `workflows.read` | Read Workflows | View tasks, appointments, schedules, and pipelines | **Tasks**, **Schedule**, and **Appointments** pages |
| `workflows.manage` | Manage Workflows | Update tasks, appointments, schedules, and pipelines | Create and edit tasks; create and manage appointments; schedule management |

### Domain — Lookups

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `lookups.read` | Read Lookups | View lookup values | Dropdown values in forms across the application |
| `lookups.manage` | Manage Lookups | Create lookup values | Add new dropdown values in forms |

### AI

Permissions for AI chat, agents, and administration.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `ai.read` | Read AI | View AI chat and agents | View AI chat history; see agent configurations |
| `ai.manage` | Manage AI | Use AI chat and configure personal agents | Send messages in AI chat; personalise agent settings |
| `ai.admin` | Administer AI | Manage organisation-wide AI settings and agents | **Agents**, **Skills**, **Capability Packs**, and **AI Audit** pages in Admin; org-wide AI configuration |

### Integrations

Permissions for external service connections and MCP tools.

| Permission | Label | Description | UI Impact |
|------------|-------|-------------|-----------|
| `integrations.read` | Read Integrations | View MCP integrations and connections | **Connections** and **MCP Connections** pages (view only) |
| `integrations.manage` | Manage Integrations | Configure MCP integrations and connections | Create, edit, and delete connections; **MCP Servers** admin page |

## Default Permissions by Role

The table below shows which permissions are included in each pre-configured role.

| Permission | Platform Admin | Org Admin | Manager | Sr. Estimator | Estimator | Member | Viewer |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `*` (superuser) | Yes | | | | | | |
| `org.users.read` | | Yes | Yes | | | | |
| `org.users.manage` | | Yes | | | | | |
| `org.users.invite` | | Yes | | | | | |
| `org.users.remove` | | Yes | | | | | |
| `org.roles.create` | | Yes | | | | | |
| `org.roles.read` | | Yes | Yes | | | | |
| `org.roles.update` | | Yes | | | | | |
| `org.roles.delete` | | Yes | | | | | |
| `org.settings.manage` | | Yes | | | | | |
| `org.integrations.manage` | | Yes | | | | | |
| `features.read` | | Yes | | | | | |
| `features.manage` | | Yes | | | | | |
| `roles.grant.admin` | | Yes | | | | | |
| `claims.create` | | Yes | Yes | | | Yes | |
| `claims.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `claims.update` | | Yes | Yes | | | Yes | |
| `claims.delete` | | Yes | | | | | |
| `jobs.create` | | Yes | Yes | | | | |
| `jobs.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `jobs.update` | | Yes | Yes | Yes | Yes | Yes | |
| `jobs.assign` | | Yes | Yes | | | | |
| `invoices.create` | | Yes | Yes | | | | |
| `invoices.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `invoices.update` | | Yes | Yes | | | | |
| `invoices.approve` | | Yes | Yes | | | | |
| `finance.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `finance.manage` | | Yes | Yes | | | | |
| `reports.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `documents.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `documents.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `filesystems.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `filesystems.manage` | | Yes | Yes | | | | |
| `catalogs.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `catalogs.manage` | | Yes | Yes | | | | |
| `catalogs.update-from-estimate` | | Yes | | Yes | | | |
| `contacts.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `contacts.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `journals.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `journals.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `assessments.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `assessments.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `procurement.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `procurement.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `vendors.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `vendors.manage` | | Yes | Yes | | | | |
| `messaging.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `messaging.send` | | Yes | Yes | Yes | Yes | Yes | |
| `workflows.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `workflows.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `lookups.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `lookups.manage` | | Yes | Yes | | | | |
| `ai.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `ai.manage` | | Yes | Yes | Yes | Yes | Yes | |
| `ai.admin` | | Yes | | | | | |
| `integrations.read` | | Yes | Yes | Yes | Yes | Yes | Yes |
| `integrations.manage` | | Yes | Yes | | | | |

## Best Practices

1. **Start with the closest built-in role.** When creating a custom role, pick the pre-configured role closest to what you need and adjust permissions rather than starting from scratch.

2. **Use the principle of least privilege.** Only grant the permissions a role actually needs. It is easier to add permissions later than to discover that too-broad access caused a problem.

3. **Test custom roles.** After creating a role, sign in as a user with only that role to verify they can access everything they need and nothing they shouldn't.

4. **Document your custom roles.** Add a clear description when creating the role so other administrators understand its purpose.

5. **Review permissions periodically.** As the application evolves, new permissions may be added. Check that existing custom roles include any new permissions they need.

6. **Be careful with wildcards.** The superuser wildcard (`*`) grants everything, including future permissions. Reserve it for Platform Admin only.

7. **Use privileged role grants intentionally.** If you want managers to assign roles, grant `org.users.manage` but consider whether they should also be able to grant Organisation Admin access (which requires `roles.grant.admin`).
