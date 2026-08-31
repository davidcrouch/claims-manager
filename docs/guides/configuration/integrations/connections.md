---
title: "Connections"
slug: connections
description: "How to add and manage insurer and platform connections (credentials, environments, and webhook events)."
section: configuration
area: integrations
routes:
  - /connections
  - /connections/[id]
audience: manager
permissions_discussed:
  - integrations.read
  - integrations.manage
  - org.integrations.manage
tags:
  - connections
  - crunchwork
  - webhooks
  - integrations
related_guides:
  - mcp-connections
  - mcp-servers
  - organisation-claims
version: 1
last_updated: 2026-08-31
---

# Connections

**Connections** hold credentials for insurer and platform systems that sync claims and jobs into EnsureOS — for example **Crunchwork** or **More0 Ensure**. This is not the same as MCP (agent tool) connections.

The page lives under Admin **Integrations** but the URL is `/connections` (not under `/admin`). Detail pages are `/connections/[id]`.

## Key Concepts

- **Provider** — the external system (Crunchwork, More0 Ensure). Each provider has its own credential form.
- **Environment** — typically **staging** or **production**. Name connections so the environment is obvious.
- **Active / inactive** — inactive connections do not process inbound events.
- **Webhook events** — inbound payloads recorded on the connection detail **Webhook Events** tab.

## Accessing Connections

1. Click the **gear icon** in the top-right header.
2. Under **Integrations**, click **Connections**.

> **Required permission:** Viewing the list needs `integrations.read`. Creating, editing, and deactivating needs `integrations.manage`. Organisation OAuth client settings (if your role includes them) use `org.integrations.manage` on other admin screens — this page is the provider credential list.

The header shows total connections, **Active** / **Inactive** counts, **Events**, and **Recent errors** when any exist.

## Compared with MCP

| Page | URL | Purpose |
|------|-----|---------|
| **Connections** | `/connections` | Insurer/platform credentials and webhooks |
| **MCP Connections** | `/mcp-connections` | Bind agents to MCP servers (tools) |
| **MCP Servers** | `/admin/mcp-servers` | Register MCP server URLs |

## Adding a connection

1. Click **Add Connection**.
2. Choose **Provider**.
3. Enter a **Connection Name** (for example “Crunchwork Production”).
4. Choose **Environment** (staging or production).
5. Complete the provider form (API credentials, endpoints). Enter secrets only in the form fields — never in chat or in a help ticket screenshot.
6. Submit. EnsureOS returns you to the list.

If a connection already exists for that provider, the drawer warns that you are adding another.

> **Warning:** Do not paste API keys, passwords, or tokens into this guide, into chat, or into screenshots. Rotate a leaked secret on the provider side, then update the connection.

## Finding and opening a connection

1. Use search, **Active** / **Inactive** filters, and sort tabs (**Name**, **Provider**, **Last Event**, **Events**).
2. Click a row to open `/connections/[id]`.
3. The header shows provider, environment, and **Active** / **Inactive**.
4. **Edit Connection** opens the edit drawer (rotate credentials, rename, change active state).
5. Tabs:
   - **Webhook Events** — inbound event table for this connection.
   - **Details** — read-only connection metadata.

> **Warning:** Deactivating or disabling a connection **stops inbound jobs and claim updates** from that provider. Coordinate with operations before you turn production off.

## Best Practices

1. **Keep one production connection per provider** unless you have a documented reason for a second.

2. **Name by environment** (“Crunchwork Staging”, “Crunchwork Production”) so nobody tests against the wrong side.

3. **Rotate secrets in the edit drawer**, never by emailing a key.

4. **Watch Recent errors** on the list and the Webhook Events tab after a provider outage.

5. **Do not confuse this page with MCP Connections.** Chat and **?** use MCP; job sync uses Connections.
