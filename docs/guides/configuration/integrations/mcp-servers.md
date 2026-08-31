---
title: "MCP Servers"
slug: mcp-servers
description: "How to register MCP server definitions that agents and capability packs can connect to."
section: configuration
area: integrations
routes:
  - /admin/mcp-servers
audience: admin
permissions_discussed:
  - integrations.read
  - integrations.manage
tags:
  - mcp
  - servers
  - integrations
related_guides:
  - mcp-connections
  - capability-packs
version: 1
last_updated: 2026-08-31
---

# MCP Servers

**MCP Servers** is the catalogue of MCP **definitions**: name, URL, visibility, and status. Agents do not call a server until someone creates a connection on [MCP Connections](mcp-connections.md).

Use this page when you add EnsureOS’s own Claims Organisation server, or another MCP endpoint your organisation hosts.

## Key Concepts

- **Server / integration** — the registered URL and display **Name**.
- **Visibility** — **private**, **org**, or public (who may see the definition).
- **Status** — typically **active** or **draft**.
- **Display name** — packs bind by this name. Help System requires **Claims Organisation**.

## Accessing MCP Servers

1. Click the **gear icon** in the top-right header.
2. Under **Integrations**, click **MCP Servers**.

The sidebar item requires the **ai.connections** feature.

> **Required permission:** Viewing needs `integrations.read`. Adding, editing, and deleting needs `integrations.manage`.

The page title is **MCP Servers**, with the description “Register MCP integrations available to your organisation.”

## Adding a server

1. Click **Add MCP Server**.
2. Fill in the drawer:

| Field | Notes |
|-------|--------|
| **Name** | Display name. Help System packs bind to **Claims Organisation** exactly. |
| **Description** | Optional. Shown under the name in the table. |
| **URL** | The MCP endpoint. Use **Discover** after you enter it to probe tools and auth. |
| **Visibility** | **Organisation** (typical), **Private**, or **Public**. |
| **Auth types** | **None**, **Bearer (session)**, **API Key**, and/or **OAuth 2.0**. |
| **Transport** | Usually HTTP. |

3. Click **Discover** if offered, so EnsureOS can count tools and suggest whether auth is required.
4. Save. The row appears in the table (Name, URL, Visibility, Status, Created).

For in-app help, the name **must** be **Claims Organisation** (exact spelling and spacing). Then connect it on MCP Connections and install the **Help System** pack.

> **Note:** Registering a server does not connect it. Staff still need an MCP Connection before agents can call tools.

## Editing and deleting

1. Click a row (or the pencil) to edit the definition.
2. To delete, use the trash control and confirm. The confirmation states that **connections using this server will stop working**.

> **Warning:** Deleting **Claims Organisation** breaks Help Assistant tools and **?** until you register the same name again, reconnect, and re-install or re-bind the Help System pack.

Empty state: **No MCP servers registered**, with a short note to add a server so tools become available for connections and agents. **Add MCP Server** on the empty state opens the same drawer.

If the list fails to load, the page shows **Failed to load MCP servers** and **Retry**. A load error does not delete registered servers; refresh after the API is reachable again.

## Best Practices

1. **Keep the help server named Claims Organisation** so capability packs bind without a manual remap.

2. **Register the URL once** and connect per environment on MCP Connections rather than duplicating near-identical server rows.

3. **Do not delete a server that still has connections.** Disconnect first, then delete.

4. **Leave draft servers inactive** until the URL is reachable so agents do not attach a broken endpoint.
