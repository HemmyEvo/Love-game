# Love-game

## Run

```bash
npm start
```

Open `http://localhost:3000`.

## New room settings

When creating a room, the creator can set a **target score** (first to N wins).

## Realtime provider notes

Realtime is now handled with **Convex HTTP APIs only** (no Socket.IO bridge).

Move updates are sent via Convex mutations, and game state is refreshed by high-frequency Convex queries for realtime gameplay.

Convex config lives in `Public/script.js`:

- `/api/convex` proxy endpoint
- `CONVEX_FUNCTIONS`
