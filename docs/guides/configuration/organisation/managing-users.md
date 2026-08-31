---
title: "Managing Users"
slug: managing-users
description: "How to invite users, assign roles, resend invitations, and disable or remove members of your organisation."
section: configuration
area: organisation
routes:
  - /admin/users
audience: manager
permissions_discussed:
  - org.users.read
  - org.users.manage
  - org.users.invite
  - org.users.remove
  - roles.grant.admin
  - roles.grant.platform_admin
tags:
  - users
  - invite
  - roles
  - onboarding
  - security
related_guides:
  - roles-and-permissions
  - company-settings
  - getting-started
version: 1
last_updated: 2026-08-31
---

# Managing Users

The **Users** page is where organisation administrators invite teammates, assign roles, and remove access. Every person who signs in should be a distinct user so assignments, chat, and audit trails stay accurate.

Role *definitions* (which permissions sit on Manager vs Estimator) live on **Roles & Permissions**. This guide covers *who* holds those roles.

## Key Concepts

- **Member** — a user who belongs to this organisation (`organization_users`).
- **Invited** — an invitation email was sent; they have not completed sign-in yet.
- **Active / Disabled** — disabled users cannot use the organisation until you enable them again.
- **Roles** — named permission sets. A user can hold several roles; effective access is the **union** of all assigned roles.
- **Privileged roles** — Organisation Admin and Platform Admin require extra grant permissions. See [Roles & Permissions](roles-and-permissions.md).

## Accessing Users

1. Click the **gear icon** in the top-right header to open Admin Settings.
2. Under **Organisation**, click **Users**.

The list shows **Name**, **Email**, **Role** (chips), **Status**, **Last login**, and a row **Actions** menu.

> **Required permission:** You need `org.users.read` (Read Users) to open this page. Inviting requires `org.users.invite`. Changing roles or enabling/disabling requires `org.users.manage`. Removing a member requires `org.users.remove`.

## Inviting a User

1. Click **Invite User** in the header.
2. In the **Invite User** drawer, enter:
   - **Email** (required)
   - **Given name** and **Family name** (optional but recommended)
   - **Roles** — click chips to toggle. At least one role is required. The first available role is selected by default.
3. Click the submit control on the drawer footer to send the invitation.
4. The new row appears with status **invited**. The invitee receives an email to join.

> **Tip:** Invite with the smallest role that still lets them work (often **Member** or **Estimator**). You can add Manager later from **Edit roles**.

If the invitation fails, the drawer shows an error (for example a duplicate email). Fix the field and try again.

## Resending an Invitation

For a user whose status is **invited**:

1. Open the **⋯** menu on that row.
2. Click **Resend invite**.
3. Confirm the success message. The invitee receives another email.

Resend is hidden once the user is active.

## Editing Roles

1. Open the **⋯** menu on the user row.
2. Click **Edit roles**.
3. In the **Edit Roles** drawer, toggle role chips. Selected chips are filled; unselected chips are outlined.
4. Keep at least one role selected.
5. Save from the drawer footer.

Users can hold multiple roles. Their permissions are combined.

> **Required permission:** `org.users.manage` is required to change assignments. Granting **Organisation Admin** also requires `roles.grant.admin`. Granting **Platform Admin** requires `roles.grant.platform_admin`. Without those grant permissions, those chips may fail or be blocked — see the Roles guide.

> **Note:** Permission changes take effect on the next sign-in or token refresh. An already-open session may keep old permissions until then.

## Disabling and Enabling

1. Open the **⋯** menu.
2. Click **Disable user** (or **Enable user** if they are already disabled).
3. Status updates immediately in the list.

Use **Disable** when someone is on leave or you need to block access without deleting the membership. Use **Remove** when they should no longer belong to the organisation at all.

## Removing a User

1. Open the **⋯** menu.
2. Click **Remove**.
3. Confirm **Remove [name] from this organisation?**

The row disappears. They lose organisation membership. This is stronger than disable.

> **Warning:** Removing a user does not reassign their open jobs or tasks. Reassign work first.

## Status Reference

| Status | Meaning |
|--------|---------|
| **active** | Can sign in and work |
| **invited** | Invitation sent; not yet signed in |
| **disabled** | Membership exists; sign-in to this organisation is blocked |

## Best Practices

1. **One person, one user.** Never share a login to “borrow” Manager access.
2. **Invite with least privilege**, then add permissions after they have used the product.
3. **Test a custom role** by inviting a spare mailbox (or a dedicated test user) before rolling it out.
4. **Disable before remove** if you might need the same person back next season.
5. **Review last login** periodically for unused invited rows and resend or remove them.
6. **Document why** someone has Organisation Admin in the role description on Roles & Permissions, not in a spreadsheet outside EnsureOS.
