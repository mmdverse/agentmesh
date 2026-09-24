// Drizzle schema - Phase 0 minimal, will expand in Phase 1
import { pgTable, text, timestamp, jsonb, varchar, integer, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

// Organizations
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(t.slug),
  })
);

// Projects
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("projects_org_idx").on(t.organizationId),
    slugIdx: uniqueIndex("projects_org_slug_idx").on(t.organizationId, t.slug),
  })
);

// Agents
export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 50 }).notNull().default("0.1.0"),
    url: text("url").notNull(),
    providerOrganization: varchar("provider_organization", { length: 255 }),
    trustLevel: varchar("trust_level", { length: 20 }).notNull().default("UNTRUSTED"),
    health: varchar("health", { length: 20 }).notNull().default("UNKNOWN"),
    region: varchar("region", { length: 100 }),
    environment: varchar("environment", { length: 20 }).default("development"),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ttlSeconds: integer("ttl_seconds"),
  },
  (t) => ({
    orgIdx: index("agents_org_idx").on(t.organizationId),
    projectIdx: index("agents_project_idx").on(t.projectId),
    nameIdx: index("agents_name_idx").on(t.name),
    healthIdx: index("agents_health_idx").on(t.health),
    trustIdx: index("agents_trust_idx").on(t.trustLevel),
  })
);

// Agent versions
export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 50 }).notNull(),
    card: jsonb("card").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index("agent_versions_agent_idx").on(t.agentId),
    versionIdx: uniqueIndex("agent_versions_agent_version_idx").on(t.agentId, t.version),
  })
);

// Agent cards (cached)
export const agentCards = pgTable(
  "agent_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    card: jsonb("card").notNull(),
    protocolVersion: varchar("protocol_version", { length: 20 }).notNull().default("0.2"),
    signatureVerified: boolean("signature_verified").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    agentIdx: index("agent_cards_agent_idx").on(t.agentId),
  })
);

// Skills (normalized for fast lookup)
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    skillId: varchar("skill_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index("skills_agent_idx").on(t.agentId),
    skillIdIdx: index("skills_skill_id_idx").on(t.skillId),
    nameIdx: index("skills_name_idx").on(t.name),
  })
);

// Tasks
export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    rootTaskId: varchar("root_task_id", { length: 255 }).notNull(),
    parentTaskId: varchar("parent_task_id", { length: 255 }),
    agentId: varchar("agent_id", { length: 255 }).notNull(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    contextId: varchar("context_id", { length: 255 }).notNull(),
    traceId: varchar("trace_id", { length: 255 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    projectId: uuid("project_id").references(() => projects.id),
    state: varchar("state", { length: 20 }).notNull().default("SUBMITTED"),
    input: jsonb("input"),
    output: jsonb("output"),
    error: jsonb("error"),
    metadata: jsonb("metadata").default({}),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    rootIdx: index("tasks_root_idx").on(t.rootTaskId),
    agentIdx: index("tasks_agent_idx").on(t.agentId),
    contextIdx: index("tasks_context_idx").on(t.contextId),
    traceIdx: index("tasks_trace_idx").on(t.traceId),
    stateIdx: index("tasks_state_idx").on(t.state),
    orgIdx: index("tasks_org_idx").on(t.organizationId),
    createdIdx: index("tasks_created_idx").on(t.createdAt),
  })
);

// Task history (append-only)
export const taskHistory = pgTable(
  "task_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: varchar("task_id", { length: 255 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fromState: varchar("from_state", { length: 20 }),
    toState: varchar("to_state", { length: 20 }).notNull(),
    reason: text("reason"),
    actorId: varchar("actor_id", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index("task_history_task_idx").on(t.taskId),
    createdIdx: index("task_history_created_idx").on(t.createdAt),
  })
);

// Task edges for delegation tree
export const taskEdges = pgTable(
  "task_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentTaskId: varchar("parent_task_id", { length: 255 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    childTaskId: varchar("child_task_id", { length: 255 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    agentId: varchar("agent_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index("task_edges_parent_idx").on(t.parentTaskId),
    childIdx: index("task_edges_child_idx").on(t.childTaskId),
  })
);

// Messages
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    taskId: varchar("task_id", { length: 255 }).references(() => tasks.id, { onDelete: "cascade" }),
    contextId: varchar("context_id", { length: 255 }).notNull(),
    traceId: varchar("trace_id", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index("messages_task_idx").on(t.taskId),
    contextIdx: index("messages_context_idx").on(t.contextId),
    traceIdx: index("messages_trace_idx").on(t.traceId),
    createdIdx: index("messages_created_idx").on(t.createdAt),
  })
);

// Artifacts
export const artifacts = pgTable(
  "artifacts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    taskId: varchar("task_id", { length: 255 }).references(() => tasks.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    projectId: uuid("project_id").references(() => projects.id),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    checksum: varchar("checksum", { length: 128 }),
    storageKey: text("storage_key").notNull(),
    storageBucket: varchar("storage_bucket", { length: 255 }).notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    taskIdx: index("artifacts_task_idx").on(t.taskId),
    orgIdx: index("artifacts_org_idx").on(t.organizationId),
    createdIdx: index("artifacts_created_idx").on(t.createdAt),
  })
);

// Routes
export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    skill: varchar("skill", { length: 255 }),
    capability: varchar("capability", { length: 255 }),
    strategy: varchar("strategy", { length: 50 }).notNull().default("capability_match"),
    config: jsonb("config").default({}),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("routes_org_idx").on(t.organizationId),
    skillIdx: index("routes_skill_idx").on(t.skill),
  })
);

// Policies
export const policies = pgTable(
  "policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    effect: varchar("effect", { length: 20 }).notNull().default("allow"), // allow, deny
    subjects: jsonb("subjects").$type<string[]>().default([]),
    resources: jsonb("resources").$type<string[]>().default([]),
    actions: jsonb("actions").$type<string[]>().default([]),
    conditions: jsonb("conditions").default({}),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("policies_org_idx").on(t.organizationId),
  })
);

// Credentials (encrypted at rest in Phase 3)
export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // apiKey, oauth, mtls, etc
    data: jsonb("data").notNull(), // encrypted
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index("credentials_org_idx").on(t.organizationId),
    typeIdx: index("credentials_type_idx").on(t.type),
  })
);

// Events (audit log)
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 100 }).notNull(),
    source: varchar("source", { length: 100 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    data: jsonb("data"),
    traceId: varchar("trace_id", { length: 255 }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    projectId: uuid("project_id").references(() => projects.id),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index("events_type_idx").on(t.type),
    subjectIdx: index("events_subject_idx").on(t.subject),
    traceIdx: index("events_trace_idx").on(t.traceId),
    createdIdx: index("events_created_idx").on(t.createdAt),
    orgIdx: index("events_org_idx").on(t.organizationId),
  })
);

// Webhooks
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret"),
    events: jsonb("events").$type<string[]>().default([]),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    lastDeliveryStatus: varchar("last_delivery_status", { length: 20 }),
  },
  (t) => ({
    orgIdx: index("webhooks_org_idx").on(t.organizationId),
  })
);
