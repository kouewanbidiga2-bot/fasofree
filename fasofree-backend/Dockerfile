# ── Stage 1: Build ──────────────────────────────────────────
# ⚠️ Node 24 (LTS) : requis par firebase-admin@14 (>=22) et lint-staged@17
# (>=22.22.1). L'image node:20 provoquait des warnings EBADENGINE à chaque build.
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
EXPOSE 10000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
