import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
const INITIAL_LOVE_ITEMS = 18;

function randomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function randomPlayerColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`;
}

function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${seed}-${Math.random().toString(36).slice(2, 9)}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4),
  };
}

function createPlayer(color) {
  return {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color,
  };
}

async function findRoomByCode(ctx, roomCode) {
  return ctx.db
    .query("rooms")
    .filter((q) => q.eq(q.field("roomCode"), roomCode))
    .first();
}

export const createRoom = mutation({
  args: {
    loverName: v.optional(v.string()),
    withBot: v.optional(v.boolean()),
    maxScore: v.optional(v.number()),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let roomCode = randomCode();
    let existing = await findRoomByCode(ctx, roomCode);
    while (existing) {
      roomCode = randomCode();
      existing = await findRoomByCode(ctx, roomCode);
    }

    const playerId = args.deviceId || `lover-${Math.random().toString(36).slice(2, 11)}`;
    const maxScore = Math.max(3, Math.min(99, Math.floor(args.maxScore ?? 15)));
    const inviteCode = randomCode(8);

    const players = {
      [playerId]: createPlayer(randomPlayerColor()),
    };
    const scores = { [playerId]: 0 };
    const names = { [playerId]: (args.loverName || "Lover").trim() || "Lover" };
    const loveItems = Array.from({ length: INITIAL_LOVE_ITEMS }, (_, i) => createLoveItem(i));

    if (args.withBot) {
      players["bot-player"] = { x: 160, y: 140, color: "#92ccff" };
      scores["bot-player"] = 0;
      names["bot-player"] = "Cupid Bot";
    }

    await ctx.db.insert("rooms", {
      roomCode,
      inviteCode,
      mode: args.withBot ? "bot-duo" : "duo",
      createdAt: Date.now(),
      maxScore,
      isGameOver: false,
      winnerId: null,
      players,
      scores,
      names,
      loveItems,
    });

    return {
      roomCode,
      playerId,
      players,
      scores,
      names,
      loveItems,
      mode: args.withBot ? "bot-duo" : "duo",
      maxScore,
      isGameOver: false,
      winnerId: null,
      inviteCode,
      letter: "I made us a room in Love Rush. Join me and let’s collect hearts together 💖",
    };
  },
});

export const getRoomState = query({
  args: {
    roomCode: v.string(),
    playerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const roomCode = (args.roomCode || "").trim().toUpperCase();

    // Frontend health check calls this with empty args.
    if (!roomCode) {
      return { ok: true };
    }

    const room = await findRoomByCode(ctx, roomCode);
    if (!room) {
      throw new Error("Room not found");
    }

    return {
      roomCode: room.roomCode,
      playerId: args.playerId || null,
      mode: room.mode || "duo",
      maxScore: room.maxScore || 15,
      isGameOver: Boolean(room.isGameOver),
      winnerId: room.winnerId || null,
      players: room.players || {},
      scores: room.scores || {},
      names: room.names || {},
      loveItems: room.loveItems || [],
      inviteCode: room.inviteCode || null,
    };
  },
});
