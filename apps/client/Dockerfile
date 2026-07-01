FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/client build

# Serve with a minimal static file server
FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/apps/client/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
