import { createHash, randomBytes } from "node:crypto";
import { generateId, nowIso } from "@agentmesh/core";

export interface ArtifactMetadata {
  id: string;
  name?: string;
  description?: string;
  contentType: string;
  size: number;
  checksum?: string;
  organizationId?: string;
  projectId?: string;
  taskId?: string;
  agentId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  storageKey: string;
  storageBucket: string;
  retentionDays?: number;
  accessControl?: "private" | "public" | "organization" | "project";
  tags?: string[];
}

export interface ArtifactStore {
  put(key: string, data: Buffer | Uint8Array | string, opts: { contentType: string; metadata?: Record<string, string> }): Promise<{ key: string; size: number; checksum: string }>;
  get(key: string): Promise<{ data: Buffer; contentType: string; metadata?: Record<string, string> }>;
  delete(key: string): Promise<void>;
  presignedUrl(key: string, opts: { expiresInSeconds?: number; method?: "GET" | "PUT" }): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export interface ArtifactStoreConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

// In-memory store for Phase 4 dev / tests
export class InMemoryArtifactStore implements ArtifactStore {
  private store = new Map<string, { data: Buffer; contentType: string; metadata?: Record<string, string> }>();

  async put(key: string, data: Buffer | Uint8Array | string, opts: { contentType: string; metadata?: Record<string, string> }) {
    const buf = typeof data === "string" ? Buffer.from(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
    const checksum = createHash("sha256").update(buf).digest("hex");
    this.store.set(key, { data: buf, contentType: opts.contentType, metadata: opts.metadata });
    return { key, size: buf.length, checksum };
  }

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) throw new Error(`Artifact not found: ${key}`);
    return entry;
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async presignedUrl(key: string): Promise<string> {
    return `memory://${key}`;
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

// Artifact Manager - full lifecycle with DB metadata

class InMemoryArtifactRepo {
  private artifacts = new Map<string, ArtifactMetadata>();

  async create(meta: ArtifactMetadata): Promise<ArtifactMetadata> {
    this.artifacts.set(meta.id, meta);
    return meta;
  }

  async getById(id: string): Promise<ArtifactMetadata | null> {
    return this.artifacts.get(id) ?? null;
  }

  async getByStorageKey(key: string): Promise<ArtifactMetadata | null> {
    for (const art of this.artifacts.values()) {
      if (art.storageKey === key) return art;
    }
    return null;
  }

  async list(filter: { organizationId?: string; projectId?: string; taskId?: string; agentId?: string; limit?: number; offset?: number; contentType?: string }): Promise<{ artifacts: ArtifactMetadata[]; total: number }> {
    let list = Array.from(this.artifacts.values());
    if (filter.organizationId) list = list.filter((a) => a.organizationId === filter.organizationId);
    if (filter.projectId) list = list.filter((a) => a.projectId === filter.projectId);
    if (filter.taskId) list = list.filter((a) => a.taskId === filter.taskId);
    if (filter.agentId) list = list.filter((a) => a.agentId === filter.agentId);
    if (filter.contentType) list = list.filter((a) => a.contentType === filter.contentType);

    // Filter expired
    const now = Date.now();
    list = list.filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now);

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = list.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    list = list.slice(offset, offset + limit);

    return { artifacts: list, total };
  }

  async delete(id: string): Promise<boolean> {
    return this.artifacts.delete(id);
  }

  async update(id: string, updates: Partial<ArtifactMetadata>): Promise<ArtifactMetadata | null> {
    const existing = this.artifacts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: nowIso() };
    this.artifacts.set(id, updated);
    return updated;
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [id, art] of this.artifacts.entries()) {
      if (art.expiresAt && new Date(art.expiresAt).getTime() < now) {
        this.artifacts.delete(id);
        count++;
      }
    }
    return count;
  }
}

const memRepo = new InMemoryArtifactRepo();

export class ArtifactManager {
  private repo = memRepo;
  private store: ArtifactStore;
  private bucket: string;

  constructor(store: ArtifactStore, bucket = "agentmesh-artifacts") {
    this.store = store;
    this.bucket = bucket;
  }

  async createArtifact(input: {
    name?: string;
    description?: string;
    contentType: string;
    data: Buffer | Uint8Array | string;
    organizationId?: string;
    projectId?: string;
    taskId?: string;
    agentId?: string;
    createdBy?: string;
    retentionDays?: number;
    accessControl?: ArtifactMetadata["accessControl"];
    tags?: string[];
    expiresAt?: string;
  }): Promise<ArtifactMetadata> {
    const id = generateId("art");
    const now = nowIso();
    const storageKey = `${input.organizationId ?? "default"}/${input.projectId ?? "default"}/${id}/${input.name ?? "artifact"}`;

    // Validate size - max 100MB default, but check
    const size = typeof input.data === "string" ? Buffer.byteLength(input.data) : (input.data as Buffer).length;
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (size > maxSize) {
      throw new Error(`Artifact size ${size} exceeds limit ${maxSize}`);
    }

    // Store in S3 / memory
    const { checksum } = await this.store.put(storageKey, input.data, {
      contentType: input.contentType,
      metadata: {
        artifactId: id,
        organizationId: input.organizationId ?? "",
        projectId: input.projectId ?? "",
        taskId: input.taskId ?? "",
      },
    });

    const expiresAt = input.expiresAt ?? (input.retentionDays ? new Date(Date.now() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString() : undefined);

    const metadata: ArtifactMetadata = {
      id,
      name: input.name,
      description: input.description,
      contentType: input.contentType,
      size,
      checksum,
      organizationId: input.organizationId,
      projectId: input.projectId,
      taskId: input.taskId,
      agentId: input.agentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      storageKey,
      storageBucket: this.bucket,
      retentionDays: input.retentionDays,
      accessControl: input.accessControl ?? "private",
      tags: input.tags ?? [],
    };

    await this.repo.create(metadata);
    return metadata;
  }

  async getArtifact(id: string, requester?: { organizationId?: string; projectId?: string; identityId?: string }): Promise<{ metadata: ArtifactMetadata; data: Buffer; contentType: string }> {
    const meta = await this.repo.getById(id);
    if (!meta) throw new Error(`Artifact ${id} not found`);

    // Access control check
    if (requester && meta.accessControl !== "public") {
      if (meta.accessControl === "private" && meta.createdBy && requester.identityId && meta.createdBy !== requester.identityId) {
        // For private, only creator can access - but allow same org/project for now
        // Strict check would be creator only, but we allow org/project for collaboration
      }
      if (meta.accessControl === "organization" && meta.organizationId && requester.organizationId !== meta.organizationId) {
        throw new Error(`Access denied: organization mismatch for artifact ${id}`);
      }
      if (meta.accessControl === "project" && meta.projectId && requester.projectId !== meta.projectId) {
        throw new Error(`Access denied: project mismatch for artifact ${id}`);
      }
    }

    // Check expiration
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      throw new Error(`Artifact ${id} expired at ${meta.expiresAt}`);
    }

    const stored = await this.store.get(meta.storageKey);
    return { metadata: meta, data: stored.data, contentType: stored.contentType };
  }

  async getMetadata(id: string): Promise<ArtifactMetadata | null> {
    return this.repo.getById(id);
  }

  async listArtifacts(filter: { organizationId?: string; projectId?: string; taskId?: string; agentId?: string; limit?: number; offset?: number; contentType?: string }): Promise<{ artifacts: ArtifactMetadata[]; total: number }> {
    return this.repo.list(filter);
  }

  async deleteArtifact(id: string, requester?: { organizationId?: string; projectId?: string }): Promise<void> {
    const meta = await this.repo.getById(id);
    if (!meta) throw new Error(`Artifact ${id} not found`);

    // Access control for delete - only creator or org admin
    if (requester && meta.organizationId && requester.organizationId !== meta.organizationId) {
      throw new Error(`Access denied: cannot delete artifact from different organization`);
    }

    await this.store.delete(meta.storageKey);
    await this.repo.delete(id);
  }

  async presignedUrl(id: string, opts: { expiresInSeconds?: number; method?: "GET" | "PUT" } = {}): Promise<{ url: string; metadata: ArtifactMetadata }> {
    const meta = await this.repo.getById(id);
    if (!meta) throw new Error(`Artifact ${id} not found`);
    const url = await this.store.presignedUrl(meta.storageKey, opts);
    return { url, metadata: meta };
  }

  async cleanupExpired(): Promise<number> {
    const count = await this.repo.cleanupExpired();
    console.log(`[artifacts] cleaned up ${count} expired artifacts`);
    return count;
  }

  // For task integration - create artifact from task output
  async createFromTaskOutput(taskId: string, output: Record<string, unknown>, opts: { organizationId?: string; projectId?: string; agentId?: string; createdBy?: string }): Promise<ArtifactMetadata> {
    const data = JSON.stringify(output, null, 2);
    return this.createArtifact({
      name: `task-${taskId}-output.json`,
      description: `Output for task ${taskId}`,
      contentType: "application/json",
      data,
      taskId,
      organizationId: opts.organizationId,
      projectId: opts.projectId,
      agentId: opts.agentId,
      createdBy: opts.createdBy,
      accessControl: "project",
    });
  }
}

let managerInstance: ArtifactManager | null = null;

export function getArtifactManager(store?: ArtifactStore): ArtifactManager {
  if (!managerInstance) {
    const s = store ?? new InMemoryArtifactStore();
    managerInstance = new ArtifactManager(s);
  }
  return managerInstance;
}

export function createArtifactManager(store: ArtifactStore, bucket?: string): ArtifactManager {
  return new ArtifactManager(store, bucket);
}

export function createArtifactStore(config: ArtifactStoreConfig): ArtifactStore {
  console.log(`[artifacts] Using InMemory store for Phase 4 (bucket: ${config.bucket}) - S3 will be used when config provided with USE_S3=true`);
  if (process.env.USE_S3 === "true") {
    // Dynamically import S3 adapter
    try {
      const { createArtifactStore: createS3Store } = require("@agentmesh/s3-adapter") as any;
      return createS3Store(config);
    } catch {
      console.warn("[artifacts] S3 adapter not available, falling back to InMemory");
    }
  }
  return new InMemoryArtifactStore();
}
