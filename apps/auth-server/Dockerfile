# Multi-stage build for Auth Server
FROM node:22-alpine AS base

# Set working directory
WORKDIR /app

# Install pnpm and system dependencies
RUN apk add --no-cache libc6-compat python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@latest --activate

#########################################################
# Dependencies build stage
#########################################################
FROM base AS deps
# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only the necessary package.json files
COPY packages/telemetry/package.json ./packages/telemetry/
COPY apps/auth-server/package.json ./apps/auth-server/

# Prefetch everything into the pnpm store (no node_modules yet)
RUN pnpm fetch

#########################################################
# Production build stage
#########################################################
FROM deps AS build
COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store

# Copy workspace files and source code
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Copy source code for the necessary packages
COPY packages/telemetry/ ./packages/telemetry/
COPY apps/auth-server/ ./apps/auth-server/

# Install all deps (including dev) required to compile workspace packages.
RUN pnpm install --frozen-lockfile --prod=false

# Build internal libraries first (in dependency order)
RUN pnpm -r --aggregate-output \
  --filter "@morezero/telemetry" \
  build

# Build the auth-server
RUN pnpm --filter "@morezero/auth-server" build

############################
# Runtime (distroless)
############################
# FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S authserver -u 1001

# Copy the entire built workspace to maintain proper structure
COPY --from=build --chown=authserver:nodejs /app ./
# Copy specific runtime files to the working directory
COPY --from=build --chown=authserver:nodejs /app/apps/auth-server/package.json ./package.json

# Fix pnpm symlinks by running pnpm rebuild
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm rebuild

# Switch to non-root user
USER authserver

# Expose port
EXPOSE 4000

WORKDIR /app/apps/auth-server
# Start the application  
CMD ["node", "dist/server.js"]
