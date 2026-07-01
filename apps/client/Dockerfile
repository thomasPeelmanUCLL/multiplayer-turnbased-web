FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
ENV CI=true

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS build
ARG VITE_API_URL=http://localhost:2567
ARG VITE_SERVER_WS_URL=ws://localhost:2567
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SERVER_WS_URL=$VITE_SERVER_WS_URL
COPY . .
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/client build

# Runtime — serve the built static files
FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/apps/client/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
