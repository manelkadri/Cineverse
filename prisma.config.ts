import { defineConfig } from "prisma/config";

// Prisma CLI only auto-loads .env; load .env.local too (it takes precedence).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file absent
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
});
