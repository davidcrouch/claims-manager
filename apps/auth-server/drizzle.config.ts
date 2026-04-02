import { defineConfig } from "drizzle-kit";
import "dotenv/config";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") return url;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const ssl = (process.env.DB_SSL ?? "false").toLowerCase() === "true" || (process.env.DB_SSL ?? "false").toLowerCase() === "1";
  if (host && port && database && user && password !== undefined) {
    const sslMode = ssl ? "sslmode=require" : "sslmode=disable";
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${sslMode}`;
  }
  throw new Error("Set DATABASE_URL or all of DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  tablesFilter: [
    "users",
    "user_identities",
    "organizations",
    "organization_users",
    "applications",
    "accounts",
    "account_users",
  ],
});
