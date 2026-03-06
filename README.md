# Love-game

## Run

```bash
npm start
```

Open `http://localhost:3000`.

## New room settings

When creating a room, the creator can set a **target score** (first to N wins).

## Realtime provider notes

Current realtime provider is set to **Convex mode** in the client, using the existing Socket.IO bridge transport.

If you want to migrate to Convex later, edit these placeholders in `Public/script.js`:

- `REALTIME_PROVIDER`
- `CONVEX_HTTP_URL`
- `CONVEX_DEPLOY_KEY`
