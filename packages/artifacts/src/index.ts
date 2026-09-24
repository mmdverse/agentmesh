export interface ArtifactMetadata {
  id: string;
  name?: string;
  description?: string;
  contentType: string;
  size: number;
  checksum?: string; // sha256
  organizationId?: string;
  projectId?: string;
  taskId?: string;
  createdAt: string;
  expiresAt?: string;
  storageKey: string; // key in S3
  storageBucket: string;
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

// In-memory for Phase 0
export class InMemoryArtifactStore implements ArtifactStore {
  private store = new Map<string, { data: Buffer; contentType: string; metadata?: Record<string, string> }>();

  async put(key: string, data: Buffer | Uint8Array | string, opts: { contentType: string; metadata?: Record<string, string> }) {
    const buf = typeof data === "string" ? Buffer.from(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
    const checksum = await this.sha256(buf);
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

  private async sha256(data: Buffer): Promise<string> {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(data).digest("hex");
  }
}

export function createArtifactStore(config: ArtifactStoreConfig): ArtifactStore {
  console.log(`[artifacts] Using InMemory store for Phase 0 (bucket: ${config.bucket})`);
  return new InMemoryArtifactStore();
}
