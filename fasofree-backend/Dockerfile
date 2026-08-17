# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
EXPOSE 10000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
