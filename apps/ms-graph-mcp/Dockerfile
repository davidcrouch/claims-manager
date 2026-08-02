# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/ms-graph-mcp/package.json apps/ms-graph-mcp/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

FROM deps AS build
COPY apps/ms-graph-mcp/ apps/ms-graph-mcp/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
RUN pnpm --filter ms-graph-mcp run build
RUN pnpm --filter ms-graph-mcp --prod deploy /deploy

FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
ENV NODE_ENV=production
ENV MS_GRAPH_MCP_PORT=8080
ENV MCP_HOST=0.0.0.0
WORKDIR /app

COPY --from=build --chown=appuser:appgroup /deploy ./
USER appuser
EXPOSE 8080
CMD ["node", "dist/main.js"]
