---
title: "AI Audit"
slug: ai-audit
description: "How to review AI request history, success rate, duration, and tool calls for support and compliance."
section: configuration
area: ai
routes:
  - /admin/ai-audit
audience: admin
permissions_discussed:
  - ai.admin
  - ai.read
tags:
  - ai
  - audit
  - compliance
  - tokens
related_guides:
  - agents
  - features
version: 1
last_updated: 2026-08-31
---

# AI Audit

**AI Audit** is the organisation log of AI requests: which model ran, whether it succeeded, how long it took, and which tools it called. Use it for support (“why did chat fail?”) and for a light compliance review of usage.

This page is a live viewer. It does not export a file.

## Key Concepts

- **Record** — one AI request (a chat turn or background generation).
- **Status** — **success**, **error**, or **cancelled**.
- **Duration** — how long the request ran.
- **Tool calls** — MCP or other tools invoked during that request.
- **Model** — the model id used (for example a Gemini or Claude model).

## Accessing AI Audit

1. Click the **gear icon** in the top-right header.
2. Under **AI**, click **AI Audit**.

Unlike Agents and Skills, this item is not hidden behind the **ai.agents** feature flag. You still need AI admin access to use the log.

> **Required permission:** Reviewing the audit log requires `ai.admin` (or equivalent organisation AI administration). `ai.read` alone is not enough to administer this page.

The heading is **AI Audit Log**, with the subtitle “Monitor AI model usage, token consumption, and tool calls”.

## Reading the summary

Four cards summarise the current result set:

| Card | Meaning |
|------|---------|
| **Total Records** | Rows matching the current filters (all pages) |
| **Success Rate** | Share of loaded rows with status success |
| **Avg Duration** | Average request time on the loaded page |
| **Tool Calls** | Sum of tools invoked on the loaded page |

Click **Refresh** to reload.

> **Note:** Success rate, average duration, and tool-call totals on the cards are calculated from the **current page** of rows, not necessarily the entire filtered total.

## Filtering

1. Click **Filters**.
2. Set any of:
   - **Status** — All, Success, Error, Cancelled.
   - **Model** — free text (for example `gemini-2.5-flash`).
   - **From** / **To** — date range.
3. The table reloads from page 1.
4. **Clear all** resets filters to 25 rows per page.

There is no export button on this screen. Copy values from the table if you need a short excerpt for a ticket.

## Reading the table

Each row is one request. Open or scan rows for status icons, model, duration, and tools. Use **error** rows when a user reports that chat stopped or a tool failed.

Page controls move through the result set (**limit** is 25 per page unless you change it in filters).

> **Tip:** After you change an agent prompt or uninstall a pack, filter to **Error** for the same day to see broken tool names quickly.

## Best Practices

1. **Start from Error status** when supporting a failed chat, then widen to Success if you need context.

2. **Do not treat the summary cards as a formal report.** They reflect the page you are viewing.

3. **Use Features and Agents** to turn off or fix a misbehaving specialist; the audit log is read-only.

4. **Avoid pasting full prompts or customer data** from the log into external tickets unless your organisation’s privacy process allows it.
