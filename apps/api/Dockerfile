FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter api

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# pnpm installs with isolated node_modules: apps/api/node_modules/<dep> is a
# relative symlink into ../../../node_modules/.pnpm/<dep>@<ver>/.../<dep>.
# The workspace layout (root node_modules + apps/api/node_modules) must be
# preserved in the runtime image, otherwise every `require('drizzle-orm', ...)`
# style import breaks with MODULE_NOT_FOUND.
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/database/migrations-drizzle ./apps/api/dist/database/migrations-drizzle

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
