import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: ['.env', '../.env', '../../.env'] });

const DB_HOST=process.env.DB_HOST
const DB_PORT=process.env.DB_PORT
const DB_NAME=process.env.DB_NAME
const DB_USER=process.env.DB_USER
const DB_PASSWORD=process.env.DB_PASSWORD

// Encode credentials to ensure special characters (like '#') are handled
const encodedUser = encodeURIComponent(DB_USER!)
const encodedPass = encodeURIComponent(DB_PASSWORD!)
const DATABASE_URL = `postgresql://${encodedUser}:${encodedPass}@${DB_HOST}:${DB_PORT}/${DB_NAME}`


export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations-drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
