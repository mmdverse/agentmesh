import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

let s3Instance: S3Client | null = null;

export function createS3Client(config: S3Config): S3Client {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle ?? true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export function getS3(config?: S3Config): S3Client {
  if (s3Instance) return s3Instance;
  const cfg: S3Config = config ?? {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin123",
    bucket: process.env.S3_BUCKET ?? "agentmesh-artifacts",
    forcePathStyle: true,
  };
  s3Instance = createS3Client(cfg);
  return s3Instance;
}

export class S3ArtifactStore {
  constructor(
    private s3: S3Client,
    private bucket: string
  ) {}

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    opts: { contentType: string; metadata?: Record<string, string> }
  ) {
    const body = typeof data === "string" ? Buffer.from(data) : data;
    const checksum = createHash("sha256")
      .update(body as any)
      .digest("hex");

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body as any,
        ContentType: opts.contentType,
        Metadata: { ...opts.metadata, checksum },
      })
    );

    return { key, size: (body as Buffer).length, checksum };
  }

  async get(key: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    if (res.Body) {
      // @ts-ignore - Body is stream
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const data = Buffer.concat(chunks);
    return {
      data,
      contentType: res.ContentType ?? "application/octet-stream",
      metadata: res.Metadata,
    };
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async presignedUrl(
    key: string,
    opts: { expiresInSeconds?: number; method?: "GET" | "PUT" } = {}
  ): Promise<string> {
    const command =
      opts.method === "PUT"
        ? new PutObjectCommand({ Bucket: this.bucket, Key: key })
        : new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command as any, { expiresIn: opts.expiresInSeconds ?? 3600 });
  }
}

export function createArtifactStore(config: S3Config): S3ArtifactStore {
  const client = getS3(config);
  return new S3ArtifactStore(client, config.bucket);
}
