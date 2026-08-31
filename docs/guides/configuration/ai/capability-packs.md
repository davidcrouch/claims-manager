---
title: "Capability Packs"
slug: capability-packs
description: "How to install, upgrade, and uninstall bundled AI agents, skills, and MCP tool selections."
section: configuration
area: ai
routes:
  - /admin/capability-packs
audience: admin
permissions_discussed:
  - ai.admin
  - ai.manage
tags:
  - ai
  - packs
  - help-system
  - install
related_guides:
  - agents
  - skills
  - mcp-connections
  - catalogues
version: 1
last_updated: 2026-08-31
---

# Capability Packs

**Capability Packs** install a workflow bundle: agents, skills, and the MCP tools those agents are allowed to call. Examples include **Help System** (online guides and **?**), catalogue operations, and assessment field assistance.

Use this page to preview, install, upgrade, check drift, or uninstall a pack. You do not edit pack files here.

## Key Concepts

- **Pack** — a versioned bundle (`packId` @ version) with a display name and description.
- **Source** — built-in catalogue or an uploaded file.
- **Install** — creates or updates the agents, skills, and tool selections in your organisation.
- **Upgrade** — moves an installed pack to the newer catalogue version.
- **Drift** — differences between the installed copy and the pack definition (someone edited an agent after install).
- **Integration refs** — MCP server display names the pack expects to bind. For Help System this **must** be **Claims Organisation**.

## Accessing Capability Packs

1. Click the **gear icon** in the top-right header.
2. Under **AI**, click **Capability Packs**.

The sidebar item uses the **ai.agents** feature (same flag as Agents).

> **Required permission:** Installing and uninstalling packs requires `ai.admin`.

The page title is **Capability Packs**. **Refresh** reloads the catalogue. **Upload pack** accepts a zip or JSON for a custom pack.

## Reading the catalogue

| Column | Meaning |
|--------|---------|
| **Pack** | Display name, id @ version, description, and **MCP:** integration names |
| **Source** | Built-in or upload |
| **Contents** | Agent, skill, and prompt counts |
| **Status** | Not installed, or installed status and version |
| **Actions** | Details, Install, Upgrade, Drift, Uninstall, Force |

Click the pack name or **Details** to preview contents before you install.

## Installing a pack

1. Confirm the **MCP** line lists the servers you already connected. Help System must show **Claims Organisation**.
2. Click **Details** and review agents and skills.
3. Click **Install**.
4. Open [Agents](agents.md) and [Skills](skills.md) to confirm the new rows.

> **Note:** After pack definition (YAML) changes on the server, **re-install** or **Upgrade** the pack. Editing an agent by hand is overwritten or reported as drift. Keep this short: install again rather than merging fields yourself.

> **Warning:** If Help System’s integration name is not exactly **Claims Organisation**, help tools will not bind and **?** cannot open guides. Fix the MCP server display name, then re-install the pack.

## Upgrade, drift, and uninstall

1. **Upgrade** appears when the catalogue version is newer than the installed version.
2. **Drift** lists artefacts that no longer match the pack (type, key, status). Use it after someone edited a pack-managed agent.
3. **Uninstall** removes the pack’s install record and pack-managed artefacts when safe.
4. **Force** uninstalls even if something still references the pack. Use only if a normal uninstall fails.

> **Warning:** Uninstalling **Help System** removes Help Assistant and the three help skills. **?** will stop opening guides until you install the pack again and reconnect **Claims Organisation**.

## Help System checklist

For header **?** and “help me with this page”:

1. [MCP Servers](../integrations/mcp-servers.md) includes a server whose **Name** is **Claims Organisation**.
2. [MCP Connections](../integrations/mcp-connections.md) shows that server **connected**.
3. This page shows **Help System** installed.
4. [Agents](agents.md) lists Help Assistant with help skills pinned.

## Best Practices

1. **Install Help System before training staff on ?.** Chat without the pack cannot open guides.

2. **Match integration display names exactly** — especially **Claims Organisation**.

3. **Upgrade rather than hand-merge** when the catalogue version changes.

4. **Check Drift** before blaming the model; a local prompt edit may have diverged from the pack.

5. **Avoid Force uninstall** unless support has asked for it.
