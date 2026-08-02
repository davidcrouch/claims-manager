FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc -p tsconfig.json
RUN npm prune --production

FROM node:22-alpine
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
ENV NODE_ENV=production
ENV MS_GRAPH_MCP_PORT=8080
ENV MCP_HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "dist/main.js"]
