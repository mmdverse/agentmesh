import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL ?? "postgresql://agentmesh:agentmesh_secret@localhost:5432/agentmesh";

async function run() {
  console.log(`[migrate] connecting to ${url.replace(/:[^:@]+@/, ":***@")}`);
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.log("[migrate] running migrations from ./drizzle folder");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done");
  await client.end();
}

run().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
