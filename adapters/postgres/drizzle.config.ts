import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://agentmesh:agentmesh_secret@localhost:5432/agentmesh",
  },
  verbose: true,
  strict: true,
});
