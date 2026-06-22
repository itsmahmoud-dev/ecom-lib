import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  casing: "snake_case",
  out: "./drizzle",
  schema: "./src/models",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
