import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;

const naughtyPrompts = [
  { type: "Truth", text: "What is your biggest secret turn-on?" },
  { type: "Truth", text: "What's a naughty fantasy you've never told me about?" },
  { type: "Truth", text: "Where is your favorite place to be kissed?" },
  { type: "Truth", text: "What was your favorite intimate moment we've shared?" },
  { type: "Dare", text: "Send me a voice note moaning my name." },
  { type: "Dare", text: "Describe in detail what you want me to do to you later." },
  { type: "Dare", text: "Take off one piece of clothing right now." },
  { type: "Dare", text: "Give me a sensual massage next time we meet." }
];

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createPlayer() {
  return {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color: Math.random() > 0.5 ? "#8a1c1c" : "#d4af37", // Ancient Red or Gold
  };
}

function createLoveItem() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    x: Math.random() * (WORLD_WIDTH - 40) + 20,
    y: Math.random() * (WORLD_HEIGHT - 40) + 20,
    type: Math.floor(Math.random() * 4),
  };
}

async function findRoomByCode(ctx, roomCode) {
  return ctx.db.query("rooms").filter(q => q.eq(q.field("roomCode"), roomCode)).first();
}

function processGameState(room) {
  let { players, scores, loveItems, isGameOver, winnerId, gameStartTime, maxScore, timeLimit, todData } = room;
  
  if (gameStartTime && !isGameOver) {
    const elapsedSecs = (Date.now() - gameStartTime) / 1000;
    if (elapsedSecs >= timeLimit) {
      isGameOver = true;
    }
  }

  if (!isGameOver) {
    Object.keys(players).forEach((id) => {
      const p = players[id];
      for (let i = loveItems.length - 1; i >= 0; i--) {
        if (Math.hypot(p.x - loveItems[i].x, p.y - loveItems[i].y) < 30) {
          scores[id] = (scores[id] || 0) + 1;
          loveItems.splice(i, 1);
          loveItems.push(createLoveItem());
          if (scores[id] >= maxScore) isGameOver = true;
        }
      }
    });
  }

  if (isGameOver && !winnerId) {
    const ids = Object.keys(scores);
    if (ids.length === 2) {
      if (scores[ids[0]] > scores[ids[1]]) winnerId = ids[0];
      else if (scores[ids[1]] > scores[ids[0]]) winnerId = ids[1];
      else winnerId = "draw";
    } else {
      winnerId = ids[0];
    }

    if (winnerId !== "draw") {
      const loserId = Object.keys(players).find(id => id !== winnerId);
      const promptObj = naughtyPrompts[Math.floor(Math.random() * naughtyPrompts.length)];
      todData = { loserId, prompt: promptObj.text, answer: null, isDare: promptObj.type === "Dare", completed: false };
    }
  }

  return { players, scores, loveItems, isGameOver, winnerId, todData };
}

export const createRoom = mutation({
  args: { loverName: v.optional(v.string()), deviceId: v.optional(v.string()), maxScore: v.optional(v.number()), timeLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const playerId = args.deviceId || `player-${Math.random().toString(36).substring(2)}`;
    
    // STRICT RULE: User cannot create a new room if they already have one
    const existingRooms = await ctx.db.query("rooms").collect();
    const activeRoom = existingRooms.find(r => r.players && r.players[playerId]);
    if (activeRoom) {
      throw new Error("You already have an active chamber! Please flee/leave it first.");
    }

    let roomCode = randomCode();
    while (await findRoomByCode(ctx, roomCode)) roomCode = randomCode();

    const players = { [playerId]: createPlayer() };
    const scores = { [playerId]: 0 };
    const names = { [playerId]: args.loverName?.slice(0, 15) || "Wanderer" };
    const readyPlayers = { [playerId]: false };

    await ctx.db.insert("rooms", {
      roomCode, createdAt: Date.now(), maxScore: args.maxScore || 20, timeLimit: args.timeLimit || 60,
      gameStartTime: null, gameStarted: false, readyPlayers, isGameOver: false, winnerId: null,
      players, scores, names, loveItems: Array.from({ length: 20 }, createLoveItem),
      todData: null
    });

    return { roomCode, playerId };
  },
});

export const joinRoom = mutation({
  args: { roomCode: v.string(), loverName: v.optional(v.string()), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    const playerId = args.deviceId || `player-${Math.random().toString(36).substring(2)}`;
    if (Object.keys(room.players).length >= 2 && !room.players[playerId]) throw new Error("Chamber is full (Max 2 Wanderers)");

    if (!room.players[playerId]) {
      room.players[playerId] = createPlayer();
      room.scores[playerId] = 0;
      room.readyPlayers[playerId] = false;
    }
    room.names[playerId] = args.loverName?.slice(0, 15) || "Wanderer";

    await ctx.db.patch(room._id, { players: room.players, scores: room.scores, names: room.names, readyPlayers: room.readyPlayers });
    return { roomCode: room.roomCode, playerId, ...room };
  },
});

export const setMatchReady = mutation({
  args: { roomCode: v.string(), playerId: v.string(), ready: v.boolean() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    room.readyPlayers[args.playerId] = args.ready;
    const allReady = Object.keys(room.players).length === 2 && Object.values(room.readyPlayers).every(Boolean);

    await ctx.db.patch(room._id, { readyPlayers: room.readyPlayers, gameStarted: allReady, gameStartTime: allReady ? Date.now() : null });
    return { ...room, gameStarted: allReady };
  },
});

export const move = mutation({
  args: { roomCode: v.string(), playerId: v.string(), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room || room.isGameOver || !room.gameStarted) return room;

    if (room.players[args.playerId]) {
      room.players[args.playerId].x = args.x;
      room.players[args.playerId].y = args.y;
    }

    const nextState = processGameState(room);
    await ctx.db.patch(room._id, nextState);
    return { ...room, ...nextState };
  },
});

export const submitTod = mutation({
  args: { roomCode: v.string(), answer: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room || !room.todData) throw new Error("Invalid ritual request");
    
    room.todData.answer = args.answer.slice(0, 150);
    room.todData.completed = true;
    
    await ctx.db.patch(room._id, { todData: room.todData });
    return true;
  }
});

export const playAgain = mutation({
  args: { roomCode: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    const resetScores = {};
    const resetReady = {};
    Object.keys(room.players).forEach(id => { resetScores[id] = 0; resetReady[id] = false; });

    await ctx.db.patch(room._id, {
      scores: resetScores, readyPlayers: resetReady, isGameOver: false, winnerId: null,
      gameStarted: false, gameStartTime: null, todData: null,
      loveItems: Array.from({ length: 20 }, createLoveItem),
    });

    return await ctx.db.get(room._id);
  },
});

// STRICT RULE: Automatically delete the room completely if any user leaves.
export const leaveRoom = mutation({
  args: { roomCode: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (room) {
      await ctx.db.delete(room._id);
    }
    return true;
  }
});

export const getRoomState = query({
  args: { roomCode: v.string(), playerId: v.optional(v.string()) },
  handler: async (ctx, args) => await findRoomByCode(ctx, (args.roomCode || "").toUpperCase()) || null
});