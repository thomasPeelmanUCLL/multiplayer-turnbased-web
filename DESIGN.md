# Multiplayer Turn-Based Web Game — System Design

> Living document. Update this as decisions are made and architecture evolves.

---

## 1. Vision

A browser-based platform for **turn-based multiplayer games** (card battlers, board games, strategy games, etc.).
Players can create accounts, browse or create game rooms, play matches in real time, and view match history.

Design goals:
- **Authoritative server** — all game logic runs server-side; the client only renders and sends actions.
- **Game-agnostic core** — the platform logic (rooms, matchmaking, persistence) is separated from game rules, so new game types can be plugged in.
- **Reconnect-safe** — a player can close their tab and rejoin an in-progress match without losing state.
- **Horizontally scalable** — stateless HTTP layer + Redis-backed WebSocket rooms.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast DX, component model maps well to game UIs |
| Styling | Tailwind CSS v4 | Utility-first, easy to theme per game |
| Realtime | [Colyseus](https://colyseus.io) (Node.js) | Room lifecycle, state sync, reconnect, matchmaking out of the box |
| HTTP API | Express (mounted alongside Colyseus) | Auth, lobby, match history, leaderboard |
| Database | PostgreSQL | Relational model suits users, matches, events |
| ORM | Drizzle ORM | Typed schema, lightweight, pairs well with TS |
| Auth | JWT (access + refresh) + bcrypt | Stateless, easy to add OAuth later |
| Cache / Pub-Sub | Redis (Valkey) | Colyseus driver for horizontal scaling |
| Deployment | Docker Compose (dev) → k3s/k8s (prod) | Aligns with existing infra |
| CI | GitHub Actions | Lint, test, build on every push |

---

## 3. Repository Structure

```
multiplayer-turnbased-web/
├── apps/
│   ├── client/          # React + Vite frontend
│   └── server/          # Colyseus + Express backend
├── packages/
│   └── shared/          # Shared TypeScript types (actions, state, events)
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/             # Kubernetes manifests
│   └── migrations/      # SQL migration files (Drizzle Kit)
├── DESIGN.md            # This file
├── README.md
├── package.json         # pnpm workspace root
└── pnpm-workspace.yaml
```

**Monorepo** managed with `pnpm workspaces`. Both `apps/client` and `apps/server` import from `packages/shared` for shared types (no drift between client and server message formats).

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,           -- bcrypt hash
  avatar_url  TEXT,
  elo         INT NOT NULL DEFAULT 1000,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type   TEXT NOT NULL,           -- 'tictactoe' | 'chess' | 'cards' …
  status      TEXT NOT NULL DEFAULT 'waiting',  -- waiting|active|finished|abandoned
  winner_id   UUID REFERENCES users(id),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Match participants (supports 2+ players)
CREATE TABLE match_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  seat        SMALLINT NOT NULL,       -- turn order (0 = first)
  result      TEXT,                    -- 'win' | 'loss' | 'draw' | 'abandoned'
  UNIQUE (match_id, seat)
);

-- Turn event log (event sourcing)
CREATE TABLE turn_events (
  id          BIGSERIAL PRIMARY KEY,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  turn_number INT NOT NULL,
  player_id   UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,           -- 'play_card' | 'move' | 'end_turn' | 'surrender'
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Match snapshots (for fast reconnect, stored every N turns)
CREATE TABLE match_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  turn_number INT NOT NULL,
  state       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 Indexes

```sql
CREATE INDEX ON turn_events (match_id, turn_number);
CREATE INDEX ON match_players (user_id);
CREATE INDEX ON match_players (match_id);
CREATE INDEX ON match_snapshots (match_id, turn_number DESC);
```

---

## 5. API Design

### 5.1 HTTP (REST via Express)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login, returns JWT pair |
| POST | `/auth/refresh` | refresh token | Get new access token |
| POST | `/auth/logout` | JWT | Revoke refresh token |
| GET | `/users/me` | JWT | Own profile |
| GET | `/users/:id` | JWT | Public profile + stats |
| GET | `/matches` | JWT | Lobby: list open matches |
| POST | `/matches` | JWT | Create a new match room |
| GET | `/matches/:id` | JWT | Match details + event log |
| GET | `/matches/:id/replay` | JWT | Full event log for replay |
| GET | `/leaderboard` | — | Top players by Elo |

### 5.2 WebSocket (Colyseus Rooms)

Colyseus exposes rooms over WebSocket. Clients use the Colyseus JS SDK to join rooms.

**Room types:**

| Room ID | Description |
|---|---|
| `lobby` | Presence room — lists open game rooms, player counts |
| `match_{gameType}` | The actual game room |

**Client → Server messages (actions):**

```ts
// packages/shared/src/actions.ts
export type ClientAction =
  | { type: 'end_turn' }
  | { type: 'surrender' }
  | { type: 'play_card';   cardId: string; targetId?: string }
  | { type: 'move_piece'; from: string;   to: string }
  | { type: 'place';      position: number };
```

**Server → Client state (Colyseus schema):**

```ts
// packages/shared/src/state.ts
export class MatchState extends Schema {
  @type('string')  phase: 'waiting' | 'active' | 'finished' = 'waiting';
  @type('string')  currentPlayerId: string = '';
  @type('number')  turnNumber: number = 0;
  @type('number')  turnDeadline: number = 0;  // unix ms, 0 = no timer
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  // game-specific state lives in a subclass
}
```

---

## 6. Game Room Lifecycle

```
  [Client A creates room]         [Client B joins room]
          │                               │
          ▼                               ▼
   Room: phase=waiting  ──────────► phase=waiting (2/2 players)
          │
          ▼  (all seats filled OR host starts)
   Room: phase=active
          │
          │  Client A sends action
          ▼
   Server validates:
     - Is it A's turn?
     - Is the action legal per game rules?
     │
     ├─ INVALID → send error back to A only
     │
     └─ VALID
           │
           ├─ Mutate room state
           ├─ Append turn_event to DB
           ├─ Broadcast state patch (Colyseus auto-diffs)
           └─ Check win condition
                 │
                 ├─ Game continues → advance currentPlayerId
                 └─ Game over → phase=finished, persist result, update Elo
```

**Reconnection:**
1. Player disconnects.
2. Room stays alive (`autoDispose: false` while match is `active`).
3. Player rejoins within the reconnect window (e.g., 5 min) → server restores their session.
4. Full current state is sent on join (Colyseus sends full snapshot for new/reconnected clients).
5. If player does not return → they forfeit; room finishes.

---

## 7. Turn Timer

- Each turn has a `turnDeadline` (unix ms) broadcast in state.
- Server runs a timeout; on expiry, the current player's turn is auto-ended (or they forfeit, depending on game config).
- The client renders a countdown derived from `turnDeadline - Date.now()`.
- Configurable per game type (`timePerTurnMs` in room options).

---

## 8. Adding a New Game Type

Each game is a module that implements the `GamePlugin` interface:

```ts
// packages/shared/src/plugin.ts
export interface GamePlugin<S extends MatchState, A extends ClientAction> {
  gameType: string;
  initialState: (players: string[]) => S;
  applyAction:  (state: S, playerId: string, action: A) => S;
  checkWin:     (state: S) => { over: boolean; winnerId?: string };
  timePerTurnMs?: number;  // 0 = no timer
}
```

To ship a new game: implement `GamePlugin`, register it in `apps/server/src/games/index.ts`. No changes to platform code needed.

---

## 9. Frontend Page Map

| Route | Component | Description |
|---|---|---|
| `/` | `HomePage` | Landing, login/register CTA |
| `/lobby` | `LobbyPage` | List open rooms, create room |
| `/match/:id` | `MatchPage` | Game board + turn UI |
| `/profile/:id` | `ProfilePage` | Stats, match history |
| `/leaderboard` | `LeaderboardPage` | Global Elo ranking |

Client routing: React Router v7. Colyseus SDK connects on `MatchPage` mount and disconnects on unmount.

---

## 10. Infrastructure (Docker Compose — dev)

```yaml
# infra/docker-compose.yml (sketch)
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: turnbased
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ['5432:5432']

  redis:
    image: valkey/valkey:8-alpine
    ports: ['6379:6379']

  server:
    build: ./apps/server
    env_file: .env
    ports: ['2567:2567']
    depends_on: [postgres, redis]

  client:
    build: ./apps/client
    ports: ['5173:5173']
    depends_on: [server]
```

**Production (k3s):** each service becomes a Deployment + Service. Server Deployments use sticky sessions (or Colyseus's Redis driver for stateless horizontal scaling). PostgreSQL → managed instance (CloudNativePG or external). Redis → Valkey StatefulSet.

---

## 11. Milestones

### MVP 1 — Playable Core
- [ ] Monorepo setup (pnpm workspaces, shared types)
- [ ] Postgres + Drizzle schema + migrations
- [ ] Auth (register, login, JWT refresh)
- [ ] Colyseus server + tic-tac-toe plugin (simplest possible game)
- [ ] React client: lobby + match page
- [ ] Docker Compose dev environment

### MVP 2 — Production-Ready
- [ ] Turn timer + auto-forfeit
- [ ] Reconnect support
- [ ] Match history + replay viewer
- [ ] Elo rating updates on match finish
- [ ] GitHub Actions CI (lint, typecheck, test)

### MVP 3 — Platform
- [ ] Second game type (e.g., card battler)
- [ ] Spectator mode
- [ ] Chat (per room)
- [ ] Invite by link
- [ ] Leaderboard

### MVP 4 — Scale & Harden
- [ ] Redis Colyseus driver (multi-instance)
- [ ] k3s manifests + Helm chart
- [ ] Anti-cheat audit (validate all actions server-side, rate limit)
- [ ] Observability (OpenTelemetry, Grafana)

---

## 12. Open Questions

- [ ] Which game(s) to implement first beyond tic-tac-toe?
- [ ] Async (play-by-email style) vs. live-only matches?
- [ ] Guest play (no account) for quick games?
- [ ] Mobile-first UI or desktop-first?
- [ ] Spectator count limit?

---

*Last updated: 2026-07-01*
