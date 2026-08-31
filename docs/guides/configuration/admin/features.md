---
title: "Features"
slug: features
description: "How to view and manage organisation feature flags and default-on grants from the standalone Features page."
section: configuration
area: admin
routes:
  - /admin/features
audience: admin
permissions_discussed:
  - features.read
  - features.manage
tags:
  - features
  - flags
  - ai
  - admin
related_guides:
  - company-settings
  - agents
version: 1
last_updated: 2026-08-31
---

# Features

**Features** is the standalone admin page for feature flags: keys such as `ai.agents` or `ai.chat` that show or hide whole areas of EnsureOS. Default-on flags are included in new sessions.

This is **not** a tab on Company. Company holds the organisation profile only. Old bookmarks such as `/admin/settings?tab=features` redirect here.

## Key Concepts

- **Feature key** — machine id (for example `ai.agents`). Shown in monospace on the left of each row.
- **Label / description** — human name and short explanation.
- **Default** — **On** or **Off**. Default-on features are granted in new sessions.
- **Grant** — whether a given session includes the feature. Changing defaults requires a new sign-in to refresh the token.

## Accessing Features

1. Click the **gear icon** in the top-right header.
2. Under **Admin**, click **Features**.

The sidebar item is gated on `features.read`. Without it, the link is hidden and the page redirects to the dashboard.

> **Required permission:** You need `features.read` (View Feature Configuration) to open this page. Creating, editing, deleting, and toggling defaults requires `features.manage`.

The header title is **Features**. The table count matches the number of definitions.

## Viewing and searching

1. Use **Search features…** to filter by key, label, or description.
2. Each row shows the key, label, description, and **On** / **Off** default.
3. If you only have `features.read`, you can search and read; you will not see **Add Feature** or row **Edit** / delete.

A note on the page states: default-enabled features are included in new sessions. **Re-login after changing defaults to refresh your token.**

## Adding a feature

1. Click **Add Feature**.
2. Enter **Feature key** (for example `ai.chat`), **Label**, optional **Description**.
3. Check **Enabled by default** if new sessions should include it.
4. Click **Create**. Key and label are required.

## Editing or toggling a feature

1. Click **Edit** on a row to change label, description, and default-enabled.
2. Click **Save**.
3. Or click the **On** / **Off** pill to toggle default without opening the form.

> **Note:** The feature **key** is not edited after create. Create a new definition if the key must change.

## Deleting a feature

1. Click the trash icon.
2. Confirm **Delete this feature definition? All grants will also be removed.**

> **Warning:** Deleting `ai.agents`, `ai.skills`, or `ai.connections` hides Agents, Skills, Capability Packs, or MCP menu items for sessions that no longer have those grants. Staff already signed in keep their token until they sign in again.

## Features that affect Admin menus

| Feature key | Sidebar impact (when off) |
|-------------|---------------------------|
| `ai.agents` | Hides **Agents** and **Capability Packs** |
| `ai.skills` | Hides **Skills** |
| `ai.connections` | Hides **MCP Connections** and **MCP Servers** |

These keys are typical; your organisation list may include others.

## Best Practices

1. **Treat Features as a release switch**, not a per-user permission. Use [Roles & Permissions](../organisation/roles-and-permissions.md) for people; use Features for product areas.

2. **Sign out and back in** after you change defaults so you see the same menus as staff.

3. **Do not delete built-in AI flags** unless you intend to hide those admin pages organisation-wide.

4. **Keep labels understandable** — managers read the label, not the key.
