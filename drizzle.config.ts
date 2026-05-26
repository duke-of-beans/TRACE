import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL
  || process.env.DATABASE_URL_OPS
  || "postgresql://trace_ops:trace_ops_dev@127.0.0.1:5432/trace";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/db/schema/shared.ts",
    "./src/db/schema/vault-a.ts",
    "./src/db/schema/vault-b.ts",
    "./src/db/schema/vault-c.ts",
  ],
  out: "./migrations",
  dbCredentials: { url },
});
