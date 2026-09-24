import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

let dbInstance: Database | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

export interface PostgresConfig {
  url: string;
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

export function createPostgresClient(config: PostgresConfig): {
  client: ReturnType<typeof postgres>;
  db: Database;
} {
  const client = postgres(config.url, {
    max: config.max ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    connect_timeout: config.connectTimeout ?? 10,
    prepare: false,
  });

  const db = drizzle(client, { schema });

  return { client, db };
}

export function getDb(config?: PostgresConfig): Database {
  if (dbInstance) return dbInstance;
  const url =
    config?.url ??
    process.env.DATABASE_URL ??
    "postgresql://agentmesh:agentmesh_secret@localhost:5432/agentmesh";
  const { client, db } = createPostgresClient({ url, ...config });
  clientInstance = client;
  dbInstance = db;
  return db;
}

export async function closeDb(): Promise<void> {
  if (clientInstance) {
    await clientInstance.end({ timeout: 5 });
    clientInstance = null;
    dbInstance = null;
  }
}

export { schema };
export * from "./schema.js";
