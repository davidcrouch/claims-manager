# 46 — Agentic AI Platform

## Overview

Add a full agentic AI platform to claims-manager: MCP server registry with multi-provider connections, configurable agents with tool allowlists, semantic skills, native SSE chat with a canvas that hosts application drawers natively, and a bidirectional drawer-chat bridge. The platform serves three audiences — internal staff, authenticated client portal users, and anonymous public portal visitors — with rendering strategies tailored to each trust level.

**Reference implementation:** `data_cloud/apps/mortgage-api` + `mortgage-ui` (Shore). This plan ports the proven patterns and improves on areas where Shore over-engineered (iframe-only MCP Apps) or under-delivered (no native canvas component host, no drawer-chat bridge).

## Scope

**Ported from data_cloud (adapted to claims-manager conventions):**
- MCP integration/connection two-tier model (doc 41)
- Agent and skill CRUD with tool wiring (docs 54, 110)
- Native SSE streaming layer replacing Vercel AI SDK (doc 51)
- Chat conversation persistence, audit, usage tracking (docs 38, 48b)
- Quotas, feedback, notifications (docs 48b–48f)
- Capability packs framework (doc 113)

**New (not in Shore):**
- Native canvas component host — drawers render directly in the React tree, not iframes
- Bidirectional drawer ↔ chat bridge (AI assist button, context serialization, form state injection)
- Canvas tool map — LLM tool calls open registered drawer components
- Shared component architecture — one component, three entry points (staff, client portal, public portal)
- Claims-domain MCP server (`claims-mcp`) with domain tools

**Excluded (defer):**
- Public portal chat + iframe widget pipeline (separate workstream when public portal is in scope)
- Deep research / Tavily integration
- Collaborative chat presence (WebSocket)
- Mail automation / ingest agents

**Pulled forward (filesystem category parity):**
- Minimal document pipelines + doc-classifier / category-description-gen system agents (enabled when `GCP_PROJECT_ID` is set; local/dev uses real ADC)
- Artifact export *settings* on org config (`organizations.config.filesystem.artifactExport`) — chat `save_to_filesystem` still waits on Phase 2 chat

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│                                                                 │
│  ChatPage ──SSE──► CanvasPane ──► Native Component Host         │
│      │                                │                         │
│      └── AI Assist Button ◄───── DrawerComponents               │
│                                                                 │
│  /api/chat (BFF proxy)                                          │
│  /api/mcp-app-host/call-tool (BFF proxy)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Bearer + x-tenant-id
┌──────────────────────────▼──────────────────────────────────────┐
│                        API (NestJS)                              │
│                                                                 │
│  MCP Integration Module     Agent Module     Skill Module        │
│  AI Chat Module (stream, audit, quota, canvas, memory)          │
│  Capability Pack Module     Conversation Module                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MCP HTTP / Bearer
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
         claims-mcp    Notion MCP      Slack MCP
         (own tools)   (tools only)    (tools only)
              │
              ▼
         Vertex AI / Anthropic (via Vertex)
```

### Rendering Strategy by Audience

| Audience | Auth | Canvas rendering | Widget scope |
|----------|------|------------------|--------------|
| Internal staff (#3) | OAuth (auth-server) | Native React — full app context | All drawers |
| Client portal (#2) | OAuth (auth-server) | Native React — scoped API | Subset of forms |
| Public portal (#1) | None | Iframe sandbox (Vite singlefile) | Standalone calculators only |

Phases 0–6 below cover #2 and #3. Public portal (#1) is a separate workstream.

## Phases

| Phase | Description | Schema Changes | New Deps | Effort |
|-------|-------------|----------------|----------|--------|
| 0 | Foundations — provider abstraction, permissions, config, drawer contract | `ai_settings` | `@google-cloud/vertexai`, `@anthropic-ai/sdk`, `@anthropic-ai/vertex-sdk` | 2–3 ew |
| 1 | MCP registry + connections | `mcp_integration`, `mcp_connection`, `mcp_tool_manifest`, `mcp_oauth_state`, `mcp_tool_invocation` | `@modelcontextprotocol/sdk` | 4–6 ew |
| 2 | Minimal chat + one agent + canvas host | `chat_conversation`, `ai_message_audit`, `agent` | None | 4–6 ew |
| 3 | Agent CRUD, tool wiring, connections UX | None (uses Phase 1–2 tables) | None | 3–4 ew |
| 3.5 | Drawer ↔ chat bridge | `canvas_artifact` | None | 3–4 ew |
| 4 | Skills framework | `skill` | None | 3–4 ew |
| 5 | Chat production polish | `ai_message_feedback`, `ai_usage_quota`, `ai_chat_notification`, `ai_user_memory`, `prompt_template` | None | 3–4 ew |
| 6 | Capability packs + platform ops | `capability_pack_install`, `capability_pack_artefact` | None | 2–3 ew |

---

## Phase 0 — Foundations

### 0.1 AI Provider Abstraction

Thin wrappers over native SDKs (not Vercel AI SDK). Two providers initially:

| Provider | SDK | Model access |
|----------|-----|--------------|
| Vertex Gemini | `@google-cloud/vertexai` | `gemini-2.5-pro`, `gemini-2.5-flash` |
| Anthropic (via Vertex) | `@anthropic-ai/vertex-sdk` | `claude-sonnet-4-5`, `claude-haiku-3-5` |

Each provider implements a `CompletionProvider` interface:

```typescript
interface CompletionProvider {
  streamCompletion(params: CompletionParams): AsyncGenerator<StreamEvent>;
  generateEmbedding(text: string): Promise<number[]>;
  countTokens(messages: Message[]): Promise<number>;
}
```

The `StreamEvent` union defines the SSE vocabulary:

```typescript
type StreamEvent =
  | { type: 'text-delta'; content: string }
  | { type: 'reasoning-delta'; content: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; result: unknown; resourceUri?: string }
  | { type: 'canvas-component'; component: string; props: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'step-start' | 'step-end'; stepIndex: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'finish'; reason: string };
```

### 0.2 Permissions & Feature Flags

Requires doc 45 (auth-server RBAC) to be complete. Seed these permissions and features:

**Permissions (category: `ai`):**

| Permission | Description |
|------------|-------------|
| `ai.read` | View chat history, agents, skills |
| `ai.manage` | Stream chat, create/edit agents and skills |
| `ai.admin` | Audit dashboard, quota management |
| `integrations.read` | View MCP integrations and connections |
| `integrations.manage` | Create/edit/delete MCP integrations and connections |

**Feature flags:**

| Feature key | Default | Controls |
|-------------|---------|----------|
| `ai.chat` | false | Chat nav item and route |
| `ai.agents` | false | Agents CRUD and selector |
| `ai.skills` | false | Skills CRUD |
| `ai.connections` | false | MCP connections nav |

### 0.3 Configuration

New environment variables (API):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VERTEX_AI_PROJECT` | Yes (prod) | — | GCP project for Vertex AI |
| `VERTEX_AI_LOCATION` | No | `global` | Vertex AI region |
| `VERTEX_EMBEDDING_MODEL` | No | `text-embedding-005` | Embedding model for skills |
| `DEFAULT_CHAT_MODEL` | No | `gemini-2.5-flash` | Default model when agent has none |
| `DEFAULT_CHAT_PROVIDER` | No | `vertex-gemini` | Default provider |
| `MCP_OAUTH_CALLBACK_BASE_URL` | No | `http://localhost:5002` | OAuth callback base for MCP connections |
| `GCP_SECRET_MANAGER_PROJECT` | Prod only | — | Secret Manager project for MCP credentials |

### 0.4 Drawer Component Contract

Standardize the props interface so drawers are canvas-hostable from day one. Applies to all existing and future `*FormDrawer` components:

```typescript
interface CanvasHostableProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: unknown) => void;
  renderMode?: 'drawer' | 'canvas';
}
```

When `renderMode === 'canvas'`, the component renders its form content without the `BottomFormDrawer` shell (the canvas pane provides the container). When `renderMode === 'drawer'` (default), existing behavior is preserved.

### 0.5 AI Settings Table

```sql
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_provider TEXT NOT NULL DEFAULT 'vertex-gemini',
  default_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  default_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens_per_response INTEGER NOT NULL DEFAULT 8192,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);
```

### 0.6 New Files (Phase 0)

```
apps/api/src/modules/ai-chat/
  providers/
    completion-provider.interface.ts
    vertex-gemini.provider.ts
    anthropic-vertex.provider.ts
    model-router.ts
  ai-settings.service.ts
  ai-settings.controller.ts
  ai-chat.module.ts

apps/api/src/database/schema/ai-settings.ts
apps/api/src/database/repositories/ai-settings.repository.ts
apps/api/src/database/migrations-drizzle/NNNN_ai_settings.sql

apps/frontend/src/components/forms/CanvasHostable.tsx   (shared wrapper)
apps/frontend/src/lib/ai/
  types.ts              (StreamEvent, message types, canvas types)
  chat-types.ts         (conversation, message part unions)
```

---

## Phase 1 — MCP Registry + Connections

### 1.1 Database Schema

```sql
CREATE TABLE mcp_integration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'http'
    CHECK (transport_type IN ('http', 'sse')),
  supported_auth_types JSONB NOT NULL DEFAULT '["none"]'::jsonb,
  auth_config JSONB DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'org'
    CHECK (visibility IN ('public', 'org', 'private')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled', 'error')),
  trusted_server BOOLEAN NOT NULL DEFAULT false,
  shared_connection_policy TEXT NOT NULL DEFAULT 'user_required'
    CHECK (shared_connection_policy IN ('org_shared', 'user_required')),
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mcp_integration_tenant_idx ON mcp_integration (tenant_id);

CREATE TABLE mcp_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES mcp_integration(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  auth_type TEXT NOT NULL DEFAULT 'none'
    CHECK (auth_type IN ('none', 'api_key', 'bearer_passthrough', 'oauth')),
  credential_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'reauth_required', 'expired', 'revoked', 'error')),
  visibility TEXT NOT NULL DEFAULT 'org'
    CHECK (visibility IN ('org', 'private')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mcp_connection_integration_org_idx
  ON mcp_connection (integration_id, tenant_id);
CREATE UNIQUE INDEX mcp_connection_org_integration_user_unique
  ON mcp_connection (tenant_id, integration_id, user_id)
  WHERE deleted_at IS NULL;

CREATE TABLE mcp_tool_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES mcp_connection(id) ON DELETE CASCADE,
  schema_hash TEXT NOT NULL,
  tool_count INTEGER NOT NULL DEFAULT 0,
  manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES mcp_integration(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT,
  pkce_verifier TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_tool_invocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID,
  conversation_id UUID,
  message_audit_id UUID,
  connection_id UUID NOT NULL REFERENCES mcp_connection(id),
  tool_name TEXT NOT NULL,
  namespaced_tool_id TEXT NOT NULL,
  input_args JSONB,
  result_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'error', 'timeout')),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2 Auth Types

| Auth type | Flow | Credential storage |
|-----------|------|-------------------|
| `none` | No auth headers | — |
| `api_key` | `Authorization: Bearer <key>` | Secret Manager (prod) or encrypted DB (dev) |
| `bearer_passthrough` | Forward user's JWT | Requires `trusted_server: true` on integration |
| `oauth` | OAuth 2.0 + PKCE → token stored | Secret Manager; refresh on 401 |

### 1.3 Security

- **SSRF guard:** Reject private IPs, localhost, link-local, metadata endpoints before connecting to MCP URLs
- **Limits:** 10 integrations/org, 20 connections/org, 5 connections/user, 200 tools/server, 100 tools/chat session
- **Credential transit:** Never return raw credentials in API responses; use Secret Manager refs in production

### 1.4 MCP Client

Ephemeral client per request using `@modelcontextprotocol/sdk`:

```typescript
class McpClient {
  async discover(url: string): Promise<DiscoverResult>;
  async testConnection(connectionId: string): Promise<TestResult>;
  async listTools(connectionId: string): Promise<ToolDefinition[]>;
  async callTool(connectionId: string, toolName: string, args: unknown): Promise<ToolResult>;
  async refreshManifest(connectionId: string): Promise<void>;
}
```

Tool namespacing: `mcp_{connectionId}__{toolName}` — guarantees uniqueness across servers.

### 1.5 API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/mcp-integrations` | `integrations.read` |
| POST | `/api/v1/mcp-integrations` | `integrations.manage` |
| GET | `/api/v1/mcp-integrations/:id` | `integrations.read` |
| PATCH | `/api/v1/mcp-integrations/:id` | `integrations.manage` |
| DELETE | `/api/v1/mcp-integrations/:id` | `integrations.manage` |
| POST | `/api/v1/mcp-integrations/discover` | `integrations.manage` |
| POST | `/api/v1/mcp-integrations/test-connection` | `integrations.manage` |
| GET | `/api/v1/mcp-connections` | `integrations.read` |
| POST | `/api/v1/mcp-connections` | `integrations.manage` |
| POST | `/api/v1/mcp-connections/:id/test` | `integrations.manage` |
| POST | `/api/v1/mcp-connections/:id/disconnect` | `integrations.manage` |
| POST | `/api/v1/mcp-connections/initiate-oauth` | `integrations.manage` |
| GET | `/api/v1/mcp-connections/oauth/callback` | Public (state-validated) |
| GET | `/api/v1/mcp-tools` | `integrations.read` |
| POST | `/api/v1/mcp-tools/refresh` | `integrations.manage` |

### 1.6 UI

| Route / Component | Purpose |
|---|---|
| `(app)/admin/settings/` — AI tab section | MCP integrations list + add drawer |
| `(app)/connections/` | MCP connections list + add/connect drawer |
| `AddIntegrationDrawer` | Name, URL, auth types, visibility, discover |
| `AddConnectionDrawer` | Select integration → auth flow → test |
| `McpToolsPanel` | Cached tool manifest viewer per connection |
| Server actions: `mcp-integrations.ts`, `mcp-connections.ts` | CRUD + discover + OAuth initiate |
| OAuth callback: `(app)/api/mcp/callback/route.ts` | BFF OAuth redirect handler |

### 1.7 New Files (Phase 1)

```
apps/api/src/modules/mcp-integration/
  mcp-integration.module.ts
  mcp-integration.controller.ts
  mcp-integration.service.ts
  mcp-connection.service.ts
  mcp-oauth.controller.ts
  mcp-oauth.service.ts
  mcp-client.ts
  mcp-ssrf-guard.ts
  mcp-tool-manifest.service.ts
  credential-transit.ts
  mcp-integration.types.ts

apps/api/src/database/schema/mcp-integration.ts
apps/api/src/database/repositories/
  mcp-integration.repository.ts
  mcp-connection.repository.ts
  mcp-tool-manifest.repository.ts
apps/api/src/database/migrations-drizzle/
  NNNN_mcp_integration.sql
  NNNN_mcp_connection.sql
  NNNN_mcp_tool_manifest.sql
  NNNN_mcp_oauth_state.sql
  NNNN_mcp_tool_invocation.sql

apps/frontend/src/components/integrations/
  McpIntegrationsPanel.tsx
  AddIntegrationDrawer.tsx
apps/frontend/src/components/connections/
  McpConnectionsPanel.tsx
  AddConnectionDrawer.tsx
  McpToolsPanel.tsx
apps/frontend/src/app/(app)/connections/page.tsx
apps/frontend/src/app/(app)/connections/actions.ts
apps/frontend/src/app/(app)/api/mcp/callback/route.ts
apps/frontend/src/app/(app)/admin/settings/actions/mcp-integrations.ts
```

---

## Phase 2 — Minimal Chat + One Agent + Canvas Host

### 2.1 Database Schema

```sql
CREATE TABLE agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'chat'
    CHECK (type IN ('chat', 'system')),
  chat_enabled BOOLEAN NOT NULL DEFAULT true,
  provider TEXT NOT NULL DEFAULT 'vertex-gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 8192,
  system_prompt TEXT,
  enabled_tool_refs JSONB DEFAULT '[]'::jsonb,
  connection_ids UUID[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'org'
    CHECK (visibility IN ('public', 'org', 'private')),
  supports_vision BOOLEAN NOT NULL DEFAULT false,
  max_steps INTEGER NOT NULL DEFAULT 10,
  avatar_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  pinned_skills UUID[] DEFAULT '{}',
  semantic_skills TEXT DEFAULT 'all'
    CHECK (semantic_skills IN ('all', 'none', 'pinned_only')),
  pack_install_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX agent_tenant_idx ON agent (tenant_id);
CREATE UNIQUE INDEX agent_tenant_slug_unique ON agent (tenant_id, slug)
  WHERE slug IS NOT NULL;

CREATE TABLE chat_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES agent(id),
  title TEXT,
  messages_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_entity_type TEXT,
  related_entity_id UUID,
  pinned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chat_conversation_tenant_user_idx
  ON chat_conversation (tenant_id, user_id);
CREATE INDEX chat_conversation_updated_idx
  ON chat_conversation (tenant_id, user_id, updated_at);
CREATE INDEX chat_conversation_entity_idx
  ON chat_conversation (related_entity_type, related_entity_id);

CREATE TABLE ai_message_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES chat_conversation(id),
  agent_id UUID REFERENCES agent(id),
  agent_name TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  tool_names TEXT[] DEFAULT '{}',
  system_prompt_snapshot TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_message_audit_tenant_created_idx
  ON ai_message_audit (tenant_id, created_at);
CREATE INDEX ai_message_audit_conversation_idx
  ON ai_message_audit (conversation_id);
```

### 2.2 Seed Default Agent

```typescript
const DEFAULT_AGENT = {
  slug: 'claims-assistant',
  name: 'Claims Assistant',
  type: 'chat',
  chatEnabled: true,
  provider: 'vertex-gemini',
  model: 'gemini-2.5-flash',
  systemPrompt: `You are a helpful assistant for insurance claims management...`,
  isDefault: true,
  semanticSkills: 'all',
};
```

### 2.3 SSE Streaming Protocol

The API streams chat responses as SSE events. The client consumes them via a custom `useChatStream` hook (not Vercel AI SDK's `useChat`).

**API endpoint:** `POST /api/v1/ai-chat/stream`

Request:

```typescript
{
  conversationId?: string;
  agentId?: string;
  message: string;
  attachments?: { url: string; mimeType: string }[];
  relatedEntityType?: string;
  relatedEntityId?: string;
}
```

Response: SSE stream of `StreamEvent` (defined in Phase 0.1).

**Tool loop:** The stream endpoint resolves the agent, loads connected MCP tools, calls the provider's `streamCompletion`, and loops on tool calls up to `agent.maxSteps`. Each tool call goes through the MCP client to the appropriate connected server. Tool results with a matching entry in the canvas tool map emit a `canvas-component` event.

### 2.4 Canvas Tool Map

A registry mapping MCP tool names to drawer components. When a tool result matches, the chat emits a `canvas-component` SSE event instead of (or in addition to) a text response.

```typescript
const canvasToolMap: Record<string, {
  component: string;
  propsMapper: (toolArgs: unknown, toolResult: unknown) => Record<string, unknown>;
}> = {
  'create_estimate': {
    component: 'QuoteFormDrawer',
    propsMapper: (args, result) => ({ jobId: args.jobId, renderMode: 'canvas' }),
  },
  'create_task': {
    component: 'TaskFormDrawer',
    propsMapper: (args) => ({ jobId: args.jobId, renderMode: 'canvas' }),
  },
  // ... registered per drawer as they become canvas-ready
};
```

### 2.5 Native Canvas Component Host

`CanvasPane` renders registered components directly in the React tree:

```typescript
const drawerRegistry: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {
  'QuoteFormDrawer':  lazy(() => import('@/components/forms/QuoteFormDrawer')),
  'TaskFormDrawer':   lazy(() => import('@/components/forms/TaskFormDrawer')),
  'ContactFormDrawer': lazy(() => import('@/components/contacts/ContactFormDrawer')),
  // ... grows as drawers adopt CanvasHostable contract
};
```

Canvas content types:

| contentType | Rendering |
|-------------|-----------|
| `markdown` / `code` | Editable text with preview |
| `component` | Native React from `drawerRegistry` — full app context, auth, server actions |

No iframe. No blob URLs. No JSON-RPC bridge. Components receive props directly and call `onSuccess` when complete, which sends the result back to the chat context.

### 2.6 Chat UI (Minimal)

| Component | Purpose |
|-----------|---------|
| `ChatPage` | Full-page chat route |
| `ChatDrawer` | Slide-out chat from any page |
| `ChatInterface` | Core chat shell: input, messages, agent selector |
| `ChatInputBar` | Text input + send + attach |
| `ChatMessageList` | Scrollable message list |
| `MessageRenderer` | Renders text, tool-call/result, canvas-component parts |
| `ToolInvocation` | Tool call/result card UI |
| `CanvasPane` | Side panel — markdown/code/component rendering |
| `ChatHistoryPanel` | Conversation list |
| `useChatStream` | Custom hook: SSE consumption, message state, tool-call tracking |
| `sse-parser` | SSE line parser → `StreamEvent` objects |

### 2.7 API Endpoints (Phase 2)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/v1/ai-chat/stream` | `ai.manage` |
| GET | `/api/v1/ai-chat/conversations` | `ai.read` |
| GET | `/api/v1/ai-chat/conversations/:id` | `ai.read` |
| POST | `/api/v1/ai-chat/conversations` | `ai.manage` |
| DELETE | `/api/v1/ai-chat/conversations/:id` | `ai.manage` |
| PATCH | `/api/v1/ai-chat/conversations/:id` | `ai.manage` |
| GET | `/api/v1/agents` | `ai.read` |
| GET | `/api/v1/agents/:id` | `ai.read` |
| GET | `/api/v1/ai-chat/models` | `ai.read` |
| GET | `/api/v1/ai-chat/audit` | `ai.admin` |

### 2.8 UI Routes (Phase 2)

| Route | Component |
|-------|-----------|
| `(app)/chat/page.tsx` | `ChatPage` |
| `(app)/chat/actions.ts` | Server actions for conversations, stream proxy |
| `(app)/api/chat/route.ts` | BFF SSE proxy to API stream endpoint |
| `(app)/api/mcp-app-host/call-tool/route.ts` | BFF proxy for canvas component tool calls |

### 2.9 New Files (Phase 2)

```
apps/api/src/modules/ai-chat/
  ai-chat.controller.ts
  ai-chat.service.ts
  ai-audit.controller.ts
  ai-audit.service.ts
  stream/
    stream-completion.ts
    mcp-tool-adapter.ts
    types.ts

apps/api/src/modules/agents/
  agent.module.ts
  agent.controller.ts
  agent.service.ts
  agent.types.ts
  agent-ids.ts

apps/api/src/modules/conversations/
  conversations.controller.ts
  conversations.service.ts

apps/api/src/database/schema/
  agent.ts
  chat-conversation.ts
  ai-message-audit.ts
apps/api/src/database/repositories/
  agent.repository.ts
  conversation.repository.ts
  ai-message-audit.repository.ts
apps/api/src/database/migrations-drizzle/
  NNNN_agent.sql
  NNNN_chat_conversation.sql
  NNNN_ai_message_audit.sql

apps/frontend/src/app/(app)/chat/
  page.tsx
  actions.ts
apps/frontend/src/app/(app)/api/chat/route.ts
apps/frontend/src/app/(app)/api/mcp-app-host/call-tool/route.ts
apps/frontend/src/components/chat/
  ChatPage.tsx
  ChatInterface.tsx
  ChatDrawer.tsx
  ChatInputBar.tsx
  ChatMessageList.tsx
  MessageRenderer.tsx
  ToolInvocation.tsx
  CanvasPane.tsx
  ChatHistoryPanel.tsx
apps/frontend/src/lib/ai/
  use-chat-stream.ts
  sse-parser.ts
```

---

## Phase 3 — Agent CRUD, Tool Wiring, Connections UX

### 3.1 Agent UI

| Component | Purpose |
|-----------|---------|
| `AgentsListPanel` | List all agents (settings page) |
| `CreateAgentDrawer` | Name, model, system prompt, visibility |
| `AgentConfigDrawer` | Full config: general, connections, tools, skills |
| `ConnectionSelectionStep` | Pick which MCP connections an agent can use |
| `ToolSelectionPanel` | Filter and select tools from connected servers |

### 3.2 API Endpoints (Phase 3)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/v1/agents` | `ai.manage` |
| PUT | `/api/v1/agents/:id` | `ai.manage` |
| DELETE | `/api/v1/agents/:id` | `ai.manage` |

### 3.3 Chat Agent Selector

`ChatInputBar` includes an agent picker. Only agents with `chatEnabled: true` appear. Switching agents creates a new conversation.

### 3.4 New Files (Phase 3)

```
apps/frontend/src/components/agents/
  AgentsListPanel.tsx
  CreateAgentDrawer.tsx
  AgentConfigDrawer.tsx
  ConnectionSelectionStep.tsx
  ToolSelectionPanel.tsx
apps/frontend/src/app/(app)/admin/settings/actions/agents.ts

(API controller/service already created in Phase 2; Phase 3 adds PUT/DELETE)
```

---

## Phase 3.5 — Drawer ↔ Chat Bridge

### 3.5.1 Path 1: Chat → Canvas Drawer

When the LLM calls a tool that maps to a drawer (via `canvasToolMap`), the stream emits a `canvas-component` event. `CanvasPane` opens and renders the drawer natively.

On submit (`onSuccess`), the result is injected back into the chat as a tool result, allowing the LLM to continue the conversation with awareness of what was created.

### 3.5.2 Path 2: Drawer → Chat (AI Assist)

Each drawer gets an optional AI assist button in its header (added to `BottomFormDrawer`):

```typescript
// In BottomFormDrawer.tsx
{aiAssistEnabled && (
  <Button variant="ghost" size="icon" onClick={() => onAIAssist?.(serializeContext())}>
    <SparklesIcon />
  </Button>
)}
```

When clicked:
1. The drawer serializes its context via a `useAIContext` hook
2. `ChatDrawer` opens with the context injected as a system message
3. The agent sees the current entity, form state, and related data
4. The agent can suggest values or call tools that update the open form

### 3.5.3 Context Serialization Protocol

Each drawer implements a `useAIContext` hook:

```typescript
function useAIContext(drawerType: string, formState: unknown, entityIds: Record<string, string>) {
  return {
    scope: drawerType,
    entityType: 'quote',
    entityIds: { jobId: '...', claimId: '...' },
    formState: { /* current form values */ },
    orgContext: { /* org name, settings */ },
  };
}
```

### 3.5.4 Canvas Artifact Persistence

```sql
CREATE TABLE canvas_artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID REFERENCES chat_conversation(id),
  content_type TEXT NOT NULL
    CHECK (content_type IN ('markdown', 'code', 'component')),
  title TEXT,
  content TEXT,
  component_name TEXT,
  component_props JSONB,
  language TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.5.5 New Files (Phase 3.5)

```
apps/frontend/src/lib/ai/
  canvas-tool-map.ts           (tool name → component mapping)
  use-ai-context.ts            (context serialization hook)
  drawer-registry.ts           (lazy component registry)

apps/frontend/src/components/chat/
  AIAssistButton.tsx            (sparkles button for drawer headers)

apps/api/src/modules/ai-chat/
  canvas/
    canvas.service.ts
    canvas.controller.ts

apps/api/src/database/schema/canvas-artifact.ts
apps/api/src/database/repositories/canvas-artifact.repository.ts
apps/api/src/database/migrations-drizzle/NNNN_canvas_artifact.sql
```

### 3.5.6 Drawer Rollout Order

Adopt the `CanvasHostable` contract incrementally:

| Priority | Drawers | Rationale |
|----------|---------|-----------|
| P0 | `QuoteFormDrawer`, `TaskFormDrawer`, `ContactFormDrawer` | Simple forms, prove the pattern |
| P1 | `PurchaseOrderFormDrawer`, `WorkOrderFormDrawer`, `BillFormDrawer`, `ReportFormDrawer` | Medium complexity, high agent value |
| P2 | `JobFormDrawer`, `RfqFormDrawer`, `AppointmentFormDrawer` | Complex multi-step — may need per-step AI assist |
| P3 | `CatalogPickerDrawer`, `CatalogImportDialog`, `DocumentUploadDrawer` | Specialized interaction patterns |

---

## Phase 4 — Skills Framework

### 4.1 Database Schema

```sql
CREATE TABLE skill (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_hints TEXT[] DEFAULT '{}',
  instruction_prompt TEXT NOT NULL,
  required_tool_refs JSONB DEFAULT '[]'::jsonb,
  input_schema JSONB,
  output_schema JSONB,
  invocation_mode TEXT NOT NULL DEFAULT 'inline'
    CHECK (invocation_mode IN ('inline', 'isolated')),
  include_history BOOLEAN NOT NULL DEFAULT false,
  history_message_count INTEGER DEFAULT 5,
  model_override TEXT,
  provider_override TEXT,
  category TEXT DEFAULT 'general',
  visibility TEXT NOT NULL DEFAULT 'org'
    CHECK (visibility IN ('public', 'org', 'private')),
  embedding vector(768),
  pack_install_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX skill_tenant_idx ON skill (tenant_id);
```

**Note:** Requires `pgvector` extension for the `embedding` column.

### 4.2 Skill Discovery

**Embedding strategy:** Composite text `{name}\n{description}\n{triggerHints.join(', ')}` embedded at create/update time using Vertex `text-embedding-005` (768 dimensions).

**Match flow:**
1. User message embedded at request time
2. Cosine similarity against all skills accessible to the active agent
3. Top-5 above threshold (0.45) injected into system prompt
4. Agent sees available skills and can activate them or respond normally

### 4.3 Invocation Modes

| Mode | Behavior |
|------|----------|
| `inline` | Skill instructions injected into the active agent's system prompt for the current turn |
| `isolated` | Separate completion call with the skill's own prompt; result merged back into conversation |

### 4.4 API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/skills` | `ai.read` |
| POST | `/api/v1/skills` | `ai.manage` |
| GET | `/api/v1/skills/:id` | `ai.read` |
| PUT | `/api/v1/skills/:id` | `ai.manage` |
| DELETE | `/api/v1/skills/:id` | `ai.manage` |
| POST | `/api/v1/skills/test-match` | `ai.manage` |
| POST | `/api/v1/skills/:id/test-invoke` | `ai.manage` |

### 4.5 UI

| Component | Purpose |
|-----------|---------|
| `SkillsListPanel` | List all skills |
| `CreateSkillDrawer` | Name, description, trigger hints, instruction prompt |
| `SkillConfigDrawer` | Full config: tools, invocation mode, schemas |
| `SkillToolPicker` | Select required tools from connected servers |
| `SkillTestPanel` | Test semantic matching and invocation |
| `AgentSkillsTab` | Pin/unpin skills on an agent |

### 4.6 New Files (Phase 4)

```
apps/api/src/modules/skills/
  skill.module.ts
  skill.controller.ts
  skill.service.ts
  skill.repository.ts         (or in database/repositories/)
  skill.types.ts
  skill-matcher.service.ts     (embedding + cosine similarity)
  skill-router.ts              (inline vs isolated dispatch)
  skill-inline-injector.ts
  skill-isolated-runner.ts
  skill-prompt-builder.ts

apps/api/src/modules/ai-chat/
  embedding.service.ts         (Vertex text-embedding-005 wrapper)

apps/api/src/database/schema/skill.ts
apps/api/src/database/migrations-drizzle/
  NNNN_skill.sql
  NNNN_enable_pgvector.sql

apps/frontend/src/components/skills/
  SkillsListPanel.tsx
  CreateSkillDrawer.tsx
  SkillConfigDrawer.tsx
  SkillToolPicker.tsx
  SkillTestPanel.tsx
apps/frontend/src/components/agents/AgentSkillsTab.tsx
apps/frontend/src/app/(app)/admin/settings/actions/skills.ts
```

---

## Phase 5 — Chat Production Polish

### 5.1 Database Schema

```sql
CREATE TABLE ai_message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  categories JSONB DEFAULT '[]'::jsonb,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ai_message_feedback_message_user_idx
  ON ai_message_feedback (message_id, user_id);

CREATE TABLE ai_usage_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL DEFAULT 'tokens'
    CHECK (quota_type IN ('tokens', 'messages', 'cost')),
  period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period IN ('daily', 'monthly')),
  limit_value BIGINT NOT NULL,
  warn_threshold_pct INTEGER NOT NULL DEFAULT 80,
  enforcement TEXT NOT NULL DEFAULT 'warn'
    CHECK (enforcement IN ('warn', 'enforce')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, quota_type, period)
);

CREATE TABLE ai_chat_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES chat_conversation(id),
  event_type TEXT NOT NULL,
  title TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_chat_notification_user_idx
  ON ai_chat_notification (tenant_id, user_id, is_read);

CREATE TABLE ai_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'user',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ai_user_memory_tenant_user_key_unique
  ON ai_user_memory (tenant_id, user_id, key);

CREATE TABLE prompt_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Features

| Feature | Description |
|---------|-------------|
| Message feedback | Thumbs up/down + categories on assistant messages |
| Conversation search | Full-text search across conversation titles and messages |
| Usage quotas | Per-tenant token/message/cost limits with warn/enforce modes |
| Notifications | Unread message badges for async conversations |
| Memory | Per-user key/value store injected into system prompt |
| Prompt templates | Reusable prompt snippets with variable substitution |
| Audit dashboard | Admin page showing usage, costs, model breakdown |
| Message timestamps | Display relative/absolute time on messages |
| File attachments | GCS upload + signed URLs for document context |
| Export | Export conversation as markdown/PDF |

### 5.3 API Endpoints (Phase 5)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/v1/ai-chat/feedback` | `ai.manage` |
| GET | `/api/v1/ai-chat/quota` | `ai.read` |
| PUT | `/api/v1/ai-chat/quota` | `ai.admin` |
| GET | `/api/v1/ai-chat/notifications` | `ai.read` |
| PATCH | `/api/v1/ai-chat/notifications/mark-read` | `ai.read` |
| GET | `/api/v1/ai-chat/memory` | `ai.read` |
| PUT | `/api/v1/ai-chat/memory` | `ai.manage` |
| GET | `/api/v1/ai-chat/templates` | `ai.read` |
| POST | `/api/v1/ai-chat/templates` | `ai.manage` |
| POST | `/api/v1/ai-chat/upload` | `ai.manage` |
| GET | `/api/v1/ai-chat/upload/signed-url` | `ai.manage` |
| POST | `/api/v1/ai-chat/export/:conversationId` | `ai.read` |

---

## Phase 6 — Capability Packs + Platform Ops

### 6.1 Database Schema

```sql
CREATE TABLE capability_pack_install (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'upgrading', 'error')),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX capability_pack_install_tenant_idx ON capability_pack_install (tenant_id);

CREATE TABLE capability_pack_artefact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  install_id UUID NOT NULL REFERENCES capability_pack_install(id) ON DELETE CASCADE,
  artefact_type TEXT NOT NULL
    CHECK (artefact_type IN ('agent', 'skill', 'prompt_template')),
  artefact_id UUID NOT NULL,
  source_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX capability_pack_artefact_install_artefact_uidx
  ON capability_pack_artefact (install_id, artefact_type, artefact_id);
```

### 6.2 Pack Structure (YAML)

```
packs/
  claims-baseline/
    pack.yaml           # id, version, description, integrationRefs
    agents/
      claims-assistant.yaml
    skills/
      document-completeness.yaml
      estimate-review.yaml
```

### 6.3 API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/capability-packs` | `ai.read` |
| GET | `/api/v1/capability-packs/installed` | `ai.read` |
| POST | `/api/v1/capability-packs/install` | `ai.admin` |
| POST | `/api/v1/capability-packs/upgrade/:installId` | `ai.admin` |
| DELETE | `/api/v1/capability-packs/:installId` | `ai.admin` |
| GET | `/api/v1/capability-packs/drift/:installId` | `ai.admin` |

---

## Claims MCP Server (Companion App)

A new NestJS app (`apps/claims-mcp`) serving domain tools via the MCP protocol. Seeded as a trusted integration with `bearer_passthrough` auth.

### Planned Tool Categories

| Category | Example Tools |
|----------|--------------|
| Claims | `search_claims`, `get_claim`, `get_claim_contacts`, `get_claim_timeline` |
| Jobs | `search_jobs`, `get_job`, `get_job_parties`, `update_job_status` |
| Quotes | `get_quote`, `get_quote_line_items`, `create_quote_line_item` |
| Finance | `get_job_financial_summary`, `get_ar_summary`, `get_ap_summary` |
| Contacts | `search_contacts`, `get_contact`, `create_contact` |
| Tasks | `search_tasks`, `create_task`, `update_task` |
| Documents | `list_documents`, `search_documents` |
| Lookups | `get_lookup_values`, `get_job_types`, `get_statuses` |

### Structure

```
apps/claims-mcp/
  src/
    main.ts
    server.ts               (MCP server setup)
    tool-catalog.ts          (tool registration)
    tools/
      claims.tool.ts
      jobs.tool.ts
      quotes.tool.ts
      finance.tool.ts
      contacts.tool.ts
      tasks.tool.ts
      documents.tool.ts
      lookups.tool.ts
    config.ts
  package.json
  Dockerfile
```

The claims-mcp server calls the claims-manager API using the forwarded Bearer token (`bearer_passthrough`), so it requires no direct database access.

---

## Shore File Reference (Porting Map)

Key source files in `data_cloud/apps/` for each phase:

| Phase | Shore source | Claims-manager target |
|-------|-------------|----------------------|
| 0 | `mortgage-api/src/ai-chat/providers/` | `api/src/modules/ai-chat/providers/` |
| 0 | `mortgage-api/src/config.ts` (AI vars) | `api/src/config/` |
| 1 | `mortgage-api/src/mcp-integration/` (entire dir) | `api/src/modules/mcp-integration/` |
| 1 | `mortgage-ui/src/components/integrations/` | `frontend/src/components/integrations/` |
| 1 | `mortgage-ui/src/components/connections/` | `frontend/src/components/connections/` |
| 2 | `mortgage-api/src/ai-chat/ai-chat.service.ts` | `api/src/modules/ai-chat/ai-chat.service.ts` |
| 2 | `mortgage-api/src/ai-chat/stream/` | `api/src/modules/ai-chat/stream/` |
| 2 | `mortgage-api/src/agents/` | `api/src/modules/agents/` |
| 2 | `mortgage-api/src/conversations/` | `api/src/modules/conversations/` |
| 2 | `mortgage-ui/src/components/chat/` (all) | `frontend/src/components/chat/` |
| 2 | `mortgage-ui/src/lib/ai/` | `frontend/src/lib/ai/` |
| 2 | `mortgage-ui/src/features/chat/ChatPage.tsx` | `frontend/src/app/(app)/chat/` |
| 3 | `mortgage-ui/src/components/agents/` | `frontend/src/components/agents/` |
| 4 | `mortgage-api/src/skills/` | `api/src/modules/skills/` |
| 4 | `mortgage-ui/src/components/skills/` | `frontend/src/components/skills/` |
| 5 | `mortgage-api/src/ai-chat/ai-audit.controller.ts` | `api/src/modules/ai-chat/ai-audit.controller.ts` |
| 5 | `mortgage-api/src/ai-chat/ai-quota.controller.ts` | `api/src/modules/ai-chat/ai-quota.controller.ts` |
| 6 | `mortgage-api/src/capability-packs/` | `api/src/modules/capability-packs/` |

---

## New Dependencies

| Package | App | Phase | Purpose |
|---------|-----|-------|---------|
| `@google-cloud/vertexai` | api | 0 | Gemini model access |
| `@anthropic-ai/sdk` | api | 0 | Anthropic SDK |
| `@anthropic-ai/vertex-sdk` | api | 0 | Anthropic via Vertex |
| `@modelcontextprotocol/sdk` | api, claims-mcp | 1 | MCP protocol client + server |
| `pgvector` | api (SQL) | 4 | Vector similarity for skill matching |

No Vercel AI SDK (`ai`, `@ai-sdk/*`) — the streaming layer is native.

## New Environment Variables (Complete)

| Variable | App | Phase | Required | Default | Description |
|----------|-----|-------|----------|---------|-------------|
| `VERTEX_AI_PROJECT` | api | 0 | Prod | — | GCP project for Vertex AI |
| `VERTEX_AI_LOCATION` | api | 0 | No | `global` | Vertex AI region |
| `VERTEX_EMBEDDING_MODEL` | api | 0 | No | `text-embedding-005` | Embedding model |
| `DEFAULT_CHAT_MODEL` | api | 0 | No | `gemini-2.5-flash` | Default chat model |
| `DEFAULT_CHAT_PROVIDER` | api | 0 | No | `vertex-gemini` | Default provider |
| `MCP_OAUTH_CALLBACK_BASE_URL` | api | 1 | No | `http://localhost:5002` | OAuth callback base |
| `GCP_SECRET_MANAGER_PROJECT` | api | 1 | Prod | — | Credential storage |
| `CLAIMS_MCP_URL` | api | 2 | No | `http://localhost:4601` | Claims MCP server URL |
| `CLAIMS_MCP_PORT` | claims-mcp | 2 | No | `4601` | Claims MCP listen port |
| `CLAIMS_API_URL` | claims-mcp | 2 | No | `http://localhost:4501` | API URL for MCP tools |

## Terraform / Deploy Changes

New Cloud Run service for `claims-mcp`:

```hcl
module "claims_mcp" {
  source = "../modules/cloud_run_service"
  service_name    = "claims-mcp"
  container_image = "gcr.io/${var.project}/claims-mcp:${var.image_tag}"
  port            = 4601
  env_vars = {
    CLAIMS_API_URL = module.api_server.service_url
  }
}
```

API service gains new env vars via Secret Manager: `VERTEX_AI_PROJECT`, `GCP_SECRET_MANAGER_PROJECT`.

## Docker Compose (Local Dev)

Add to root `docker-compose.yml`:

```yaml
claims-mcp:
  build: ./apps/claims-mcp
  ports:
    - "4601:4601"
  environment:
    - CLAIMS_API_URL=http://api:4501
  depends_on:
    - api
```
