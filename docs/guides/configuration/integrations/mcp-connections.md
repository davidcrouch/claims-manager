---
title: "MCP Connections"
slug: mcp-connections
description: "How to connect organisation MCP servers so agents can call tools, including Claims Organisation for in-app help."
section: configuration
area: integrations
routes:
  - /mcp-connections
audience: admin
permissions_discussed:
  - integrations.read
  - integrations.manage
  - ai.admin
tags:
  - mcp
  - connections
  - help
  - agents
related_guides:
  - mcp-servers
  - capability-packs
  - agents
version: 1
last_updated: 2026-08-31
---

# MCP Connections

**MCP Connections** bind your organisation to registered MCP servers so agents can call tools — search, open a help guide, update a catalogue item, and similar actions.

Register the server first on [MCP Servers](mcp-servers.md). This page creates the live connection, tests it, and refreshes the tool list.

The URL is `/mcp-connections` (Admin → Integrations), not under `/admin`.

## Key Concepts

- **MCP** — Model Context Protocol: a standard way for agents to call tools on a server.
- **Integration / server** — the registered definition (name and URL) from MCP Servers.
- **Connection** — your organisation’s authenticated binding to that server.
- **Status** — **connected**, **pending**, **reauth required**, or **error**.
- **Tools** — actions discovered after a successful connect or **Refresh tools**.

## Accessing MCP Connections

1. Click the **gear icon** in the top-right header.
2. Under **Integrations**, click **MCP Connections**.

The sidebar item requires the **ai.connections** feature.

> **Required permission:** Viewing needs `integrations.read`. Connecting, testing, and disconnecting needs `integrations.manage`. Agents that use these tools also need `ai.admin` / `ai.manage` as described in [Agents](../ai/agents.md).

The page title is **MCP Connections**. **Connect** (plus) opens the connect drawer.

## Connecting a server

1. Click **Connect**.
2. Select the MCP integration (server) you registered.
3. Choose authentication: none, API key, or OAuth (as the server requires).
4. For API key, enter the key in the drawer only.
5. Submit. OAuth opens a browser window; return here when it completes.
6. Confirm the row shows **connected**.
7. Use **Refresh tools** if the tool list is empty.

> **Note:** Help tools live on the server whose display name is **Claims Organisation**. The Help System pack binds to that exact name.

## Managing a connection

On each row you can **Test**, **Refresh tools**, or **Disconnect** (confirm first). Click a row for tool detail.

| Status | What to do |
|--------|------------|
| **connected** | Ready for agents |
| **pending** | Finish OAuth or wait for the handshake |
| **reauth required** | Connect again with OAuth |
| **error** | Test, check the server URL, then reconnect |

## If ? does nothing

Header **?** opens Help Assistant and expects help tools on **Claims Organisation**.

1. On **MCP Servers**, confirm a server named exactly **Claims Organisation** exists and is active.
2. On this page, confirm that server is **connected** (not error or disconnected).
3. On [Capability Packs](../ai/capability-packs.md), confirm **Help System** is installed.
4. On [Agents](../ai/agents.md), confirm **Help Assistant** exists and still has help skills / guide tools.

If the connection is missing, **?** may open chat with no way to load a guide. Install the pack and connect the server; do not rebuild Help Assistant from scratch.

## Best Practices

1. **Connect Claims Organisation before going live with ?.**

2. **Refresh tools** after the MCP server is upgraded so new guide tools appear.

3. **Disconnect unused servers** so agents cannot call stale tools.

4. **Never put API keys in chat or tickets.** Rotate and re-enter them in the connect drawer.
