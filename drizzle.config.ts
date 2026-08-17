import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.PKG_TRUST_DB ?? "data/trust.sqlite",
  },
  strict: true,
  verbose: true,
});
