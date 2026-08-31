---
title: "Agents"
slug: agents
description: "How to configure AI chat agents, page specialists, and the Help Assistant used by the header question-mark control."
section: configuration
area: ai
routes:
  - /admin/agents
audience: admin
permissions_discussed:
  - ai.read
  - ai.manage
  - ai.admin
tags:
  - ai
  - agents
  - help assistant
  - chat
related_guides:
  - skills
  - capability-packs
  - ai-audit
  - getting-started
  - mcp-connections
version: 1
last_updated: 2026-08-31
---

# Agents

**Agents** are the chat personas staff pick in the AI drawer: a default claims assistant, page specialists (catalogue, assessment, estimator, report builder), and the **Help Assistant** that powers the header **?** control.

This page lists every agent in the organisation. Opening a row configures model, prompt, MCP connections, tools, and pinned skills.

## Key Concepts

- **Agent** — a named chat persona with a model, system prompt, and tool access.
- **Slug** — stable identifier (for example `help-assistant`, `catalog-assistant`). Page routing uses slugs, not display names.
- **Default agent** — marked **Default**. Used when chat opens and no page specialist applies. Cannot be deleted.
- **System agent** — marked **System**. Used for background tasks (for example document classification). Cannot be deleted from this list.
- **Skill** — reusable instructions pinned to an agent. See [Skills](skills.md).
- **Capability pack** — installs a bundle of agents and skills. See [Capability Packs](capability-packs.md).
- **MCP tools** — actions the agent may call, discovered from [MCP Connections](../integrations/mcp-connections.md).

## Accessing Agents

1. Click the **gear icon** in the top-right header.
2. Under **AI**, click **Agents**.

The sidebar item requires the **ai.agents** feature. If you do not see **AI**, ask an administrator to enable that feature on [Features](../admin/features.md).

> **Required permission:** Viewing and using chat needs `ai.read` / `ai.manage`. Organisation-wide agent configuration needs `ai.admin` (Administer AI).

The page title is **AI Agents**. **Create Agent** opens a drawer to add a custom persona.

## Page specialists vs Help Assistant

When staff open chat on a page, EnsureOS prefers a specialist if one is installed:

| Page area | Agent slug | Typical name |
|-----------|------------|----------------|
| Catalogues | `catalog-assistant` | Catalogue Assistant |
| Assessments | `assessment-assistant` | Assessment Assistant |
| Estimates (quotes) | `estimator` | Estimator |
| Document templates / reports | `report-builder` | Report Builder |
| Roles, users, and other admin help | `help-assistant` | Help Assistant |

The header **?** control **always** uses **Help Assistant** (`help-assistant`). It looks up the guide for the current route and opens it in the canvas. It does not switch to the catalogue or assessment specialist.

> **Note:** If **?** does nothing useful, the Help Assistant is missing, the **help-system** pack is not installed, or **Claims Organisation** MCP is not connected. See [MCP Connections](../integrations/mcp-connections.md) and [Capability Packs](capability-packs.md).

## Reviewing the list

Each row shows name, provider, model, temperature, and badges:

| Badge | Meaning |
|-------|---------|
| **Default** | Fallback chat agent |
| **System** | Background / non-chat agent |
| **Hidden from Chat** | **Show in Chat Selector** is off |

Click a row to open configuration. Delete (trash) is hidden for default and system agents.

## Configuring an agent

1. Click the agent row.
2. Work through the tabs, then **Save**.

### General

- **Name** — shown in the chat picker.
- **Visibility** — who may use the agent (typically organisation).
- **Show in Chat Selector** — turn off to hide specialists you do not want in the picker (they can still be selected by the page).
- **System Prompt** — the standing instructions. Do not strip help-guide tools from Help Assistant.

### Config

Provider (Google or Anthropic), **Model**, **Temperature** (precise ↔ creative), **Max Tokens**, vision attachments, and execution limits (**Autonomous mode**, max steps, pause after tool steps, max duration). Avatar colour and optional image URL control how the agent appears in chat.

### Connections

Attach MCP connections so the agent can call tools (including **Claims Organisation** for help guides).

### Tools

Allow or deny individual tools from those connections. Help Assistant needs the guide lookup and open-guide tools.

### Skills

Pin skills such as **Help With Current Page**, **Search Help Guides**, and **Open Help Guide**. See [Skills](skills.md).

> **Warning:** Do not remove guide tools from Help Assistant. **?** will open chat but cannot load a guide.

> **Tip:** Prefer installing a capability pack over building a “super-agent” that has every tool. Specialists stay safer and easier to audit.

## Creating a custom agent

1. Click **Create Agent**.
2. Set name, model, and prompt.
3. Attach connections and pin skills.
4. Enable **Show in Chat Selector** only if staff should pick it manually.

Packs such as **Help System** create their agents on install. Re-install or upgrade the pack after pack definition changes rather than hand-editing every field.

## Best Practices

1. **Leave Help Assistant’s guide tools and help skills in place** so **?** keeps working.

2. **Do not make every user a catch-all agent.** Use specialists for catalogues, assessments, estimates, and reports.

3. **Hide system and experimental agents** from the chat selector so staff are not overwhelmed.

4. **Review [AI Audit](ai-audit.md)** after prompt or tool changes to confirm calls still succeed.

5. **Install packs first**, then tweak prompts — packs recreate the intended connections and skills.
