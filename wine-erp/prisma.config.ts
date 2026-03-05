import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI
config({ path: ".env.local", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // URL loaded from .env.local via dotenv above
  // For migrations use: npx prisma db push --url "postgresql://..."
  // See .env.local for the correct Session Pooler URL
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
