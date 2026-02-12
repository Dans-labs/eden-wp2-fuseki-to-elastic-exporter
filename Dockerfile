# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# ---- Stage 2: Build ----
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm exec prisma generate
RUN pnpm run build

# ---- Stage 3: Production ----
FROM node:22-alpine AS production

RUN apk add --no-cache curl \
    && corepack enable && corepack prepare pnpm@10 --activate

RUN addgroup -g 1001 appuser && adduser -u 1001 -G appuser -s /bin/sh -D appuser

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/prisma ./prisma

COPY --from=build /app/dist ./dist

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api || exit 1

CMD ["node", "dist/main.js"]
