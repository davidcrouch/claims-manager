FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/provider/package.json ./apps/provider/
RUN pnpm install --frozen-lockfile --filter provider

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/provider/node_modules ./apps/provider/node_modules
COPY . .
RUN pnpm --filter provider build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/provider/package.json ./apps/provider/package.json
COPY --from=builder /app/apps/provider/node_modules ./apps/provider/node_modules
COPY --from=builder /app/apps/provider/dist ./apps/provider/dist

WORKDIR /app/apps/provider
EXPOSE 8080
CMD ["node", "dist/main.js"]
