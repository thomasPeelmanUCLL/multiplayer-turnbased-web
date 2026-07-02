FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
ENV CI=true

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN apk add --no-cache python3 make g++
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS build
COPY . .
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/server build

# Runtime — only production dependencies
FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/package.json ./
EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
