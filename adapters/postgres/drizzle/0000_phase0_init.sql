-- Phase 0 Initial Schema - AgentMesh
-- Generated manually for Phase 1 Registry

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- organizations
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" ("slug");

-- projects
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "projects_org_idx" ON "projects" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_org_slug_idx" ON "projects" ("organization_id", "slug");

-- agents
CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "version" varchar(50) NOT NULL DEFAULT '0.1.0',
  "url" text NOT NULL,
  "provider_organization" varchar(255),
  "trust_level" varchar(20) NOT NULL DEFAULT 'UNTRUSTED',
  "health" varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  "region" varchar(100),
  "environment" varchar(20) DEFAULT 'development',
  "tags" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone,
  "ttl_seconds" integer
);
CREATE INDEX IF NOT EXISTS "agents_org_idx" ON "agents" ("organization_id");
CREATE INDEX IF NOT EXISTS "agents_project_idx" ON "agents" ("project_id");
CREATE INDEX IF NOT EXISTS "agents_name_idx" ON "agents" ("name");
CREATE INDEX IF NOT EXISTS "agents_health_idx" ON "agents" ("health");
CREATE INDEX IF NOT EXISTS "agents_trust_idx" ON "agents" ("trust_level");

-- agent_versions
CREATE TABLE IF NOT EXISTS "agent_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "version" varchar(50) NOT NULL,
  "card" jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_versions_agent_idx" ON "agent_versions" ("agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_versions_agent_version_idx" ON "agent_versions" ("agent_id", "version");

-- agent_cards
CREATE TABLE IF NOT EXISTS "agent_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "card" jsonb NOT NULL,
  "protocol_version" varchar(20) NOT NULL DEFAULT '0.2',
  "signature_verified" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "agent_cards_agent_idx" ON "agent_cards" ("agent_id");

-- skills
CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "skill_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "skills_agent_idx" ON "skills" ("agent_id");
CREATE INDEX IF NOT EXISTS "skills_skill_id_idx" ON "skills" ("skill_id");
CREATE INDEX IF NOT EXISTS "skills_name_idx" ON "skills" ("name");

-- tasks
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" varchar(255) PRIMARY KEY,
  "root_task_id" varchar(255) NOT NULL,
  "parent_task_id" varchar(255),
  "agent_id" varchar(255) NOT NULL,
  "session_id" varchar(255) NOT NULL,
  "context_id" varchar(255) NOT NULL,
  "trace_id" varchar(255) NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "state" varchar(20) NOT NULL DEFAULT 'SUBMITTED',
  "input" jsonb,
  "output" jsonb,
  "error" jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "tasks_root_idx" ON "tasks" ("root_task_id");
CREATE INDEX IF NOT EXISTS "tasks_agent_idx" ON "tasks" ("agent_id");
CREATE INDEX IF NOT EXISTS "tasks_context_idx" ON "tasks" ("context_id");
CREATE INDEX IF NOT EXISTS "tasks_trace_idx" ON "tasks" ("trace_id");
CREATE INDEX IF NOT EXISTS "tasks_state_idx" ON "tasks" ("state");
CREATE INDEX IF NOT EXISTS "tasks_org_idx" ON "tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "tasks_created_idx" ON "tasks" ("created_at");

-- task_history
CREATE TABLE IF NOT EXISTS "task_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" varchar(255) NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "from_state" varchar(20),
  "to_state" varchar(20) NOT NULL,
  "reason" text,
  "actor_id" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "task_history_task_idx" ON "task_history" ("task_id");
CREATE INDEX IF NOT EXISTS "task_history_created_idx" ON "task_history" ("created_at");

-- task_edges
CREATE TABLE IF NOT EXISTS "task_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_task_id" varchar(255) NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "child_task_id" varchar(255) NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "agent_id" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "task_edges_parent_idx" ON "task_edges" ("parent_task_id");
CREATE INDEX IF NOT EXISTS "task_edges_child_idx" ON "task_edges" ("child_task_id");

-- messages
CREATE TABLE IF NOT EXISTS "messages" (
  "id" varchar(255) PRIMARY KEY,
  "task_id" varchar(255) REFERENCES "tasks"("id") ON DELETE CASCADE,
  "context_id" varchar(255) NOT NULL,
  "trace_id" varchar(255) NOT NULL,
  "role" varchar(20) NOT NULL,
  "parts" jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_task_idx" ON "messages" ("task_id");
CREATE INDEX IF NOT EXISTS "messages_context_idx" ON "messages" ("context_id");
CREATE INDEX IF NOT EXISTS "messages_trace_idx" ON "messages" ("trace_id");
CREATE INDEX IF NOT EXISTS "messages_created_idx" ON "messages" ("created_at");

-- artifacts
CREATE TABLE IF NOT EXISTS "artifacts" (
  "id" varchar(255) PRIMARY KEY,
  "task_id" varchar(255) REFERENCES "tasks"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "name" varchar(255),
  "description" text,
  "content_type" varchar(255) NOT NULL,
  "size" integer NOT NULL,
  "checksum" varchar(128),
  "storage_key" text NOT NULL,
  "storage_bucket" varchar(255) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "artifacts_task_idx" ON "artifacts" ("task_id");
CREATE INDEX IF NOT EXISTS "artifacts_org_idx" ON "artifacts" ("organization_id");
CREATE INDEX IF NOT EXISTS "artifacts_created_idx" ON "artifacts" ("created_at");

-- routes
CREATE TABLE IF NOT EXISTS "routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "skill" varchar(255),
  "capability" varchar(255),
  "strategy" varchar(50) NOT NULL DEFAULT 'capability_match',
  "config" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "routes_org_idx" ON "routes" ("organization_id");
CREATE INDEX IF NOT EXISTS "routes_skill_idx" ON "routes" ("skill");

-- policies
CREATE TABLE IF NOT EXISTS "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "effect" varchar(20) NOT NULL DEFAULT 'allow',
  "subjects" jsonb DEFAULT '[]'::jsonb,
  "resources" jsonb DEFAULT '[]'::jsonb,
  "actions" jsonb DEFAULT '[]'::jsonb,
  "conditions" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "policies_org_idx" ON "policies" ("organization_id");

-- credentials
CREATE TABLE IF NOT EXISTS "credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "type" varchar(50) NOT NULL,
  "data" jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "credentials_org_idx" ON "credentials" ("organization_id");
CREATE INDEX IF NOT EXISTS "credentials_type_idx" ON "credentials" ("type");

-- events
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" varchar(100) NOT NULL,
  "source" varchar(100) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "data" jsonb,
  "trace_id" varchar(255),
  "organization_id" uuid REFERENCES "organizations"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events" ("type");
CREATE INDEX IF NOT EXISTS "events_subject_idx" ON "events" ("subject");
CREATE INDEX IF NOT EXISTS "events_trace_idx" ON "events" ("trace_id");
CREATE INDEX IF NOT EXISTS "events_created_idx" ON "events" ("created_at");
CREATE INDEX IF NOT EXISTS "events_org_idx" ON "events" ("organization_id");

-- webhooks
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "secret" text,
  "events" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_delivery_at" timestamp with time zone,
  "last_delivery_status" varchar(20)
);
CREATE INDEX IF NOT EXISTS "webhooks_org_idx" ON "webhooks" ("organization_id");
