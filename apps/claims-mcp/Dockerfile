# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/claims-mcp/package.json apps/claims-mcp/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

FROM deps AS build
COPY apps/claims-mcp/ apps/claims-mcp/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
RUN pnpm --filter claims-mcp run build
RUN pnpm --filter claims-mcp --prod deploy /deploy

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV CLAIMS_MCP_PORT=4601
ENV CLAIMS_MCP_HOST=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /deploy ./
USER node
EXPOSE 4601
CMD ["node", "dist/main.js"]
