-- Agentic AI Platform (doc 46): settings, MCP registry, agents, chat, skills, quotas, capability packs.
-- skill.embedding uses jsonb for phases 0–3; Phase 4 upgrades to vector(768) via pgvector.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "default_provider" text DEFAULT 'vertex-gemini' NOT NULL,
  "default_model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
  "default_temperature" numeric(3, 2) DEFAULT 0.7 NOT NULL,
  "max_tokens_per_response" integer DEFAULT 8192 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_integration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "url" text NOT NULL,
  "transport_type" text DEFAULT 'http' NOT NULL,
  "supported_auth_types" jsonb DEFAULT '["none"]'::jsonb NOT NULL,
  "auth_config" jsonb DEFAULT '{}'::jsonb,
  "visibility" text DEFAULT 'org' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "trusted_server" boolean DEFAULT false NOT NULL,
  "shared_connection_policy" text DEFAULT 'user_required' NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_integration_transport_type_check" CHECK (transport_type IN ('http', 'sse')),
  CONSTRAINT "mcp_integration_visibility_check" CHECK (visibility IN ('public', 'org', 'private')),
  CONSTRAINT "mcp_integration_status_check" CHECK (status IN ('draft', 'active', 'disabled', 'error')),
  CONSTRAINT "mcp_integration_shared_connection_policy_check" CHECK (shared_connection_policy IN ('org_shared', 'user_required'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_integration_tenant_idx" ON "mcp_integration" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "mcp_integration" ADD CONSTRAINT "mcp_integration_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_connection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "auth_type" text DEFAULT 'none' NOT NULL,
  "credential_ref" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "visibility" text DEFAULT 'org' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_connection_auth_type_check" CHECK (auth_type IN ('none', 'api_key', 'bearer_passthrough', 'oauth')),
  CONSTRAINT "mcp_connection_status_check" CHECK (status IN ('pending', 'connected', 'reauth_required', 'expired', 'revoked', 'error')),
  CONSTRAINT "mcp_connection_visibility_check" CHECK (visibility IN ('org', 'private'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_connection_integration_org_idx" ON "mcp_connection" USING btree ("integration_id", "tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_connection_org_integration_user_unique" ON "mcp_connection" USING btree ("tenant_id", "integration_id", "user_id") WHERE deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE "mcp_connection" ADD CONSTRAINT "mcp_connection_integration_id_mcp_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."mcp_integration"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_connection" ADD CONSTRAINT "mcp_connection_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_tool_manifest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL,
  "schema_hash" text NOT NULL,
  "tool_count" integer DEFAULT 0 NOT NULL,
  "manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_tool_manifest" ADD CONSTRAINT "mcp_tool_manifest_connection_id_mcp_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mcp_connection"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_oauth_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "integration_id" uuid NOT NULL,
  "state" text NOT NULL,
  "nonce" text,
  "pkce_verifier" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_oauth_state_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "mcp_oauth_state" ADD CONSTRAINT "mcp_oauth_state_integration_id_mcp_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."mcp_integration"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "slug" text,
  "name" text NOT NULL,
  "description" text,
  "type" text DEFAULT 'chat' NOT NULL,
  "chat_enabled" boolean DEFAULT true NOT NULL,
  "provider" text DEFAULT 'vertex-gemini' NOT NULL,
  "model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
  "temperature" numeric(3, 2) DEFAULT 0.7,
  "max_tokens" integer DEFAULT 8192,
  "system_prompt" text,
  "enabled_tool_refs" jsonb DEFAULT '[]'::jsonb,
  "connection_ids" uuid[] DEFAULT '{}',
  "visibility" text DEFAULT 'org' NOT NULL,
  "supports_vision" boolean DEFAULT false NOT NULL,
  "max_steps" integer DEFAULT 10 NOT NULL,
  "avatar_url" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "pinned_skills" uuid[] DEFAULT '{}',
  "semantic_skills" text DEFAULT 'all',
  "pack_install_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_type_check" CHECK (type IN ('chat', 'system')),
  CONSTRAINT "agent_visibility_check" CHECK (visibility IN ('public', 'org', 'private')),
  CONSTRAINT "agent_semantic_skills_check" CHECK (semantic_skills IN ('all', 'none', 'pinned_only'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tenant_idx" ON "agent" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_tenant_slug_unique" ON "agent" USING btree ("tenant_id", "slug") WHERE slug IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_conversation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "agent_id" uuid,
  "title" text,
  "messages_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "pinned_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversation_tenant_user_idx" ON "chat_conversation" USING btree ("tenant_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversation_updated_idx" ON "chat_conversation" USING btree ("tenant_id", "user_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversation_entity_idx" ON "chat_conversation" USING btree ("related_entity_type", "related_entity_id");
--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_message_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_id" uuid,
  "agent_id" uuid,
  "agent_name" text,
  "model" text NOT NULL,
  "provider" text NOT NULL,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "tool_calls_count" integer DEFAULT 0 NOT NULL,
  "tool_names" text[] DEFAULT '{}',
  "system_prompt_snapshot" text,
  "duration_ms" integer,
  "status" text DEFAULT 'success' NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_message_audit_status_check" CHECK (status IN ('success', 'error', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_message_audit_tenant_created_idx" ON "ai_message_audit" USING btree ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_message_audit_conversation_idx" ON "ai_message_audit" USING btree ("conversation_id");
--> statement-breakpoint
ALTER TABLE "ai_message_audit" ADD CONSTRAINT "ai_message_audit_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_message_audit" ADD CONSTRAINT "ai_message_audit_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_tool_invocation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "agent_id" uuid,
  "conversation_id" uuid,
  "message_audit_id" uuid,
  "connection_id" uuid NOT NULL,
  "tool_name" text NOT NULL,
  "namespaced_tool_id" text NOT NULL,
  "input_args" jsonb,
  "result_summary" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "latency_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_tool_invocation_status_check" CHECK (status IN ('pending', 'success', 'error', 'timeout'))
);
--> statement-breakpoint
ALTER TABLE "mcp_tool_invocation" ADD CONSTRAINT "mcp_tool_invocation_connection_id_mcp_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mcp_connection"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "canvas_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid,
  "content_type" text NOT NULL,
  "title" text,
  "content" text,
  "component_name" text,
  "component_props" jsonb,
  "language" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "canvas_artifact_content_type_check" CHECK (content_type IN ('markdown', 'code', 'component'))
);
--> statement-breakpoint
ALTER TABLE "canvas_artifact" ADD CONSTRAINT "canvas_artifact_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "trigger_hints" text[] DEFAULT '{}',
  "instruction_prompt" text NOT NULL,
  "required_tool_refs" jsonb DEFAULT '[]'::jsonb,
  "input_schema" jsonb,
  "output_schema" jsonb,
  "invocation_mode" text DEFAULT 'inline' NOT NULL,
  "include_history" boolean DEFAULT false NOT NULL,
  "history_message_count" integer DEFAULT 5,
  "model_override" text,
  "provider_override" text,
  "category" text DEFAULT 'general',
  "visibility" text DEFAULT 'org' NOT NULL,
  "embedding" jsonb,
  "pack_install_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "skill_invocation_mode_check" CHECK (invocation_mode IN ('inline', 'isolated')),
  CONSTRAINT "skill_visibility_check" CHECK (visibility IN ('public', 'org', 'private'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_tenant_idx" ON "skill" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_message_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "message_id" text NOT NULL,
  "rating" text NOT NULL,
  "categories" jsonb DEFAULT '[]'::jsonb,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_message_feedback_rating_check" CHECK (rating IN ('positive', 'negative'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_message_feedback_message_user_idx" ON "ai_message_feedback" USING btree ("message_id", "user_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_quota" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "quota_type" text DEFAULT 'tokens' NOT NULL,
  "period" text DEFAULT 'monthly' NOT NULL,
  "limit_value" bigint NOT NULL,
  "warn_threshold_pct" integer DEFAULT 80 NOT NULL,
  "enforcement" text DEFAULT 'warn' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_usage_quota_quota_type_check" CHECK (quota_type IN ('tokens', 'messages', 'cost')),
  CONSTRAINT "ai_usage_quota_period_check" CHECK (period IN ('daily', 'monthly')),
  CONSTRAINT "ai_usage_quota_enforcement_check" CHECK (enforcement IN ('warn', 'enforce')),
  CONSTRAINT "ai_usage_quota_tenant_type_period_unique" UNIQUE("tenant_id", "quota_type", "period")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_quota" ADD CONSTRAINT "ai_usage_quota_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "title" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_notification_user_idx" ON "ai_chat_notification" USING btree ("tenant_id", "user_id", "is_read");
--> statement-breakpoint
ALTER TABLE "ai_chat_notification" ADD CONSTRAINT "ai_chat_notification_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_user_memory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" text DEFAULT 'user' NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_user_memory_tenant_user_key_unique" ON "ai_user_memory" USING btree ("tenant_id", "user_id", "key");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "template_text" text NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb,
  "category" text DEFAULT 'general',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_template" ADD CONSTRAINT "prompt_template_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capability_pack_install" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "pack_id" text NOT NULL,
  "pack_version" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "installed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "capability_pack_install_status_check" CHECK (status IN ('active', 'disabled', 'upgrading', 'error'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capability_pack_install_tenant_idx" ON "capability_pack_install" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "capability_pack_install" ADD CONSTRAINT "capability_pack_install_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capability_pack_artefact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "install_id" uuid NOT NULL,
  "artefact_type" text NOT NULL,
  "artefact_id" uuid NOT NULL,
  "source_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "capability_pack_artefact_artefact_type_check" CHECK (artefact_type IN ('agent', 'skill', 'prompt_template'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capability_pack_artefact_install_artefact_uidx" ON "capability_pack_artefact" USING btree ("install_id", "artefact_type", "artefact_id");
--> statement-breakpoint
ALTER TABLE "capability_pack_artefact" ADD CONSTRAINT "capability_pack_artefact_install_id_capability_pack_install_id_fk" FOREIGN KEY ("install_id") REFERENCES "public"."capability_pack_install"("id") ON DELETE cascade ON UPDATE no action;
