import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI
config({ path: ".env.local", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // For migrations/db push: use DIRECT_URL (Session Pooler, port 5432, supports DDL)
  // Falls back to DATABASE_URL (Transaction Pooler, port 6543, pgBouncer — DML only)
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
