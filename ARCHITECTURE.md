# multiplayer-turnbased-web — Architecture & Developer Guide

> **Audience:** Human developers and AI assistants working on this codebase.  
> **Purpose:** Explain the repo layout, key design decisions, gotchas, and the exact steps needed to add new features without breaking the build.

---

## Repo overview

This is a **pnpm workspace monorepo**. Everything lives under one git root:

```
multiplayer-turnbased-web/
├── apps/
│   ├── server/          # Colyseus + Express backend (Node 22)
│   └── client/          # Vite + React frontend
├── packages/
│   └── shared/          # Types, Zod schemas, game logic — imported by both apps
├── infra/
│   ├── docker-compose.yml
│   └── migrations/      # SQL files auto-applied by Postgres on first boot
├── pnpm-workspace.yaml
└── pnpm-lock.yaml       # Single lockfile for the whole monorepo
```

The three buildable units are:

| Package | Name in workspace | Build command |
|---|---|---|
| `packages/shared` | `@repo/shared` | `tsup src/index.ts --format esm,cjs --dts --clean` |
| `apps/server` | `@repo/server` | `tsc` |
| `apps/client` | `@repo/client` | `vite build` |

`@repo/shared` **must build first** — both apps depend on its compiled output in `packages/shared/dist/`.

---

## Infrastructure

Three services are started by `infra/docker-compose.yml`:

| Service | Image / Source | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | 5432 | DB = `turnbased`, user/pass = `dev/dev` (dev only). SQL migrations in `infra/migrations/` run automatically on first boot. |
| `redis` | `valkey/valkey:8-alpine` | 6379 | Used by Colyseus for presence/matchmaking across processes. |
| `server` | Built from `apps/server/Dockerfile` | 2567 | Waits for both postgres and redis health checks before starting. |
| `client` | Built from `apps/client/Dockerfile` | 5173 | Build args: `VITE_API_URL`, `VITE_SERVER_WS_URL`. |

Copy `.env.example` to `.env` in the repo root and fill in secrets before first run.

### Common commands

```bash
# Start everything
docker compose -f infra/docker-compose.yml up

# Rebuild only the server after code changes
docker compose -f infra/docker-compose.yml build --no-cache server
docker compose -f infra/docker-compose.yml up -d server

# Wipe postgres data and start fresh
docker compose -f infra/docker-compose.yml down -v
```

---

## `packages/shared` — the single source of truth

Every type, schema, and constant that both the server and client need lives here. **Never duplicate these in an app.**

### File responsibilities

| File | What it owns |
|---|---|
| `tictactoe.ts` | `Player`, `Cell`, `Board`, `TicTacToeState`, `MatchPhase`, **`ClientAction`** (the canonical union: `place_mark` \| `resign`) |
| `actions.ts` | Legacy alternative action union (`place` \| `end_turn` \| `surrender`). Re-exported with explicit named exports to avoid clashing with `tictactoe.ts`. **Do not add `ClientAction` here.** |
| `schemas.ts` | Zod schemas for HTTP bodies: `RegisterBodySchema`, `LoginBodySchema`, `RefreshBodySchema`, `CreateMatchBodySchema` |
| `validation.ts` | Zod schemas for WebSocket actions: `ClientActionSchema`, `PlaceMarkSchema`, `ResignSchema`. Inferred type is `ValidatedClientAction` (not `ClientAction`) to avoid name collision. |
| `state.ts` | Generic match state helpers shared across game types |
| `index.ts` | Barrel — re-exports everything. See the gotcha below. |

### ⚠️ Critical barrel gotcha

`index.ts` uses **explicit named re-exports** for `actions.ts` to avoid TypeScript error `TS2308: Module has already exported a member named 'ClientAction'`:

```ts
// index.ts — DO NOT change to export * from './actions.js'
export type { PlaceAction, EndTurnAction, SurrenderAction, ActionType } from './actions.js';
export * from './schemas.js';
export * from './state.js';
export * from './tictactoe.js';   // <-- ClientAction lives here
export * from './validation.js';  // <-- ValidatedClientAction lives here
```

If you add a new file to `shared/src/`, add it to `index.ts`. If the new file exports any name that already exists in another file, use explicit named exports — **never `export *` two files that share a name**.

### ⚠️ Lockfile rule

When you add a dependency to any `package.json` in the monorepo, you **must** also commit the updated `pnpm-lock.yaml`. The Docker build runs `pnpm install --frozen-lockfile` — if `package.json` and the lockfile disagree, the build fails.

```bash
# After editing any package.json:
pnpm install           # updates pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "chore: update lockfile"
git push
```

---

## `apps/server` — Colyseus + Express

### Directory layout

```
apps/server/src/
├── index.ts          # Entry point — wires Express + Colyseus, registers rooms
├── auth/             # JWT helpers, bcrypt wrappers
├── config/           # Env validation (zod), constants
├── db/               # Drizzle ORM queries (matches, users)
├── game/             # Pure game logic — NO Colyseus imports
│   └── tictactoe.ts  # applyAction(), createInitialState(), checkWinner()
├── lib/
│   └── logger.ts     # Pino logger instance (import this everywhere — no console.log)
├── middleware/        # Express middleware (auth guard, error handler)
├── rooms/
│   ├── BaseRoom.ts   # Abstract Colyseus Room — lifecycle + message routing
│   └── TicTacToeRoom.ts  # Extends BaseRoom — only game-specific logic
└── routes/           # Express REST routes
```

### Room architecture

`BaseRoom` is an abstract class that every game room extends. It handles:
- `onCreate` / `onJoin` / `onLeave` Colyseus lifecycle
- Routing all `'action'` messages to `handleAction()`
- `broadcastState()` — calls `getStatePlain()` and sends to all clients
- `sendError(client, message)` — sends a typed error message to one client

A concrete room only needs to implement two methods:

```ts
protected abstract getStatePlain(): object;
protected abstract handleAction(client: Client, action: ActionMessage): void;
```

To add a new game (e.g. Chess):

1. Create `apps/server/src/game/chess/` with pure logic functions and types
2. Create `apps/server/src/rooms/ChessRoom.ts` extending `BaseRoom`
3. Add one line to `apps/server/src/index.ts`:
   ```ts
   gameServer.define('chess', ChessRoom).enableRealtimeListing();
   ```
4. Add shared types to `packages/shared/src/chess.ts` and re-export from `index.ts`

### Logging

Import the pino logger — never use `console.log` in server code:

```ts
import { logger } from '../lib/logger.js';

logger.info({ roomId: this.roomId }, 'Match started');
logger.warn({ action, error }, 'Rejected action');
logger.error({ err }, 'Unhandled error');
```

### Dependencies

All runtime dependencies must be in `apps/server/package.json` **and** reflected in `pnpm-lock.yaml`. Current runtime deps: `colyseus`, `@colyseus/schema`, `@colyseus/ws-transport`, `express`, `cors`, `helmet`, `express-rate-limit`, `drizzle-orm`, `pg`, `bcrypt`, `jsonwebtoken`, `zod`, `pino`, `pino-pretty`.

---

## Adding a new game — checklist

- [ ] `packages/shared/src/<game>.ts` — types (`State`, `ClientAction`) + pure logic or just types
- [ ] Update `packages/shared/src/index.ts` — add export, use explicit named exports if any name conflicts
- [ ] `apps/server/src/game/<game>/logic.ts` — `createInitialState()`, `applyAction()` (no Colyseus)
- [ ] `apps/server/src/rooms/<Game>Room.ts` — extends `BaseRoom`, ~60 lines
- [ ] Register in `apps/server/src/index.ts`
- [ ] `pnpm install` → commit `pnpm-lock.yaml` if new deps were added
- [ ] `docker compose ... build --no-cache server && up -d server`

---

## Known issues / tech debt

| Item | Location | Notes |
|---|---|---|
| `actions.ts` has a different `ClientAction` shape than `tictactoe.ts` | `packages/shared/src/` | `actions.ts` uses `place`/`end_turn`/`surrender`; `tictactoe.ts` uses `place_mark`/`resign`. They need to be reconciled or `actions.ts` should be deleted once nothing depends on it. |
| `"types"` condition warning in `shared/package.json` | `packages/shared/package.json` | The `exports` field puts `"types"` after `"import"` and `"require"`, so esbuild warns it will never be used. Move `"types"` to the top of the conditional exports object. |
| No test suite | Everywhere | Game logic functions in `apps/server/src/game/` are pure and ready to test — no test runner is wired up yet. |
