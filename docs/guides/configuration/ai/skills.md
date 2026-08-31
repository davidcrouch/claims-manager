---
title: "Skills"
slug: skills
description: "How to manage reusable AI skills, including the help-system skills that power page help and guide search."
section: configuration
area: ai
routes:
  - /admin/skills
audience: admin
permissions_discussed:
  - ai.read
  - ai.manage
  - ai.admin
tags:
  - ai
  - skills
  - help
  - agents
related_guides:
  - agents
  - capability-packs
  - mcp-connections
version: 1
last_updated: 2026-08-31
---

# Skills

**Skills** are reusable instruction packs an agent can follow: when to run, which tools to call, and how to answer. Agents pin skills (or match them from trigger phrases) instead of repeating the same prompt in every system message.

This page lists organisation skills. Opening a row edits the prompt, tools, visibility, and a test panel.

## Key Concepts

- **Skill** — named instructions plus optional tool bindings.
- **Trigger hints** — phrases that suggest the skill (for example “how do I” or “help with this page”).
- **Invocation mode** — typically **inline** (the agent applies the skill during the conversation).
- **Pinned skill** — attached on an agent’s **Skills** tab so it is always available.
- **Category / visibility** — grouping and who may use the skill (organisation is typical for help skills).

## Accessing Skills

1. Click the **gear icon** in the top-right header.
2. Under **AI**, click **Skills**.

The sidebar item requires the **ai.skills** feature.

> **Required permission:** Organisation-wide skill configuration needs `ai.admin`. Using chat still requires `ai.read` / `ai.manage`.

The page title is **AI Skills**. **Create Skill** adds a custom skill.

## Help System skills

Installing the **Help System** pack creates three skills the Help Assistant should keep pinned:

| Skill name | Slug | When it runs |
|------------|------|----------------|
| **Help With Current Page** | `help-with-current-page` | User asks for help on this page, or presses **?**. Looks up the guide for the current route and opens it. |
| **Search Help Guides** | `search-help` | User asks “how do I…”, “what is…”, or similar. Searches guides and answers from the results. |
| **Open Help Guide** | `open-guide` | User wants the full guide in the canvas (“show the guide”, “open help”). |

These skills call tools on the **Claims Organisation** MCP connection (`get_guides_for_route`, `search_help_guides`, `open_help_guide`). If that connection is missing, the skills cannot run. See [MCP Connections](../integrations/mcp-connections.md).

> **Note:** Do not rename these slugs or strip their tool bindings if you want **?** and free-form help to keep working.

## Reviewing and editing a skill

The list columns are **Name**, **Category**, **Mode**, **Triggers**, and **Visibility**.

1. Click a row.
2. Use the tabs:
   - **General** — name, description, category, visibility.
   - **Prompt** — the instruction text the agent follows.
   - **Tools** — which MCP tools this skill may use.
   - **Settings** — invocation mode, trigger hints, output format.
   - **Test** — try the skill without changing production chat.
3. Click **Save**.

> **Warning:** Deleting a help-system skill from this list will break **?** until you re-install the **Help System** pack.

## Creating a skill

1. Click **Create Skill**.
2. Give a clear name and description (staff and agents both see these).
3. Write the **instruction prompt** as numbered steps the agent should follow.
4. Bind only the tools the skill needs.
5. Set trigger hints in everyday language.
6. Pin the skill on the relevant agent under [Agents](agents.md).

Empty list copy: **No skills configured yet.** After a Help System install you should see at least the three help skills above — if the list is empty, install the pack rather than recreating them by hand.

Packs remain the preferred way to add workflow skills (catalogue, assessment, help). Custom skills are for organisation-specific procedures.

## Best Practices

1. **Pin help-with-current-page, search-help, and open-guide** on Help Assistant after every pack re-install.

2. **Keep trigger hints in plain language** that match how staff actually ask (“how do I assign a role”).

3. **Bind the minimum tools.** A skill that can call every MCP tool is harder to audit.

4. **Use Test** before you pin a new skill on a production agent.
