import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
const INITIAL_LOVE_ITEMS = 18;
const BOT_ID = "bot-player";

function randomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(value) {
  return String(value || "Lover").trim().slice(0, 20) || "Lover";
}

function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${seed}-${Math.random().toString(36).slice(2, 9)}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4),
  };
}

function randomPlayerColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`;
}

function createPlayer(color = randomPlayerColor()) {
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

async function listRoomPresence(ctx, roomCode) {
  return ctx.db
    .query("roomPresence")
    .filter((q) => q.eq(q.field("roomCode"), roomCode))
    .collect();
}

async function getPresenceDoc(ctx, roomCode, playerId) {
  return ctx.db
    .query("roomPresence")
    .filter((q) => q.and(q.eq(q.field("roomCode"), roomCode), q.eq(q.field("playerId"), playerId)))
    .first();
}

function mergePlayersWithPresence(room, presenceDocs) {
  const players = { ...(room.players || {}) };
  presenceDocs.forEach((doc) => {
    if (!players[doc.playerId]) return;
    players[doc.playerId] = {
      ...players[doc.playerId],
      x: doc.x,
      y: doc.y,
    };
  });
  return players;
}

function roomResponse(room, currentPlayerId = null) {
  return {
    roomCode: room.roomCode,
    playerId: currentPlayerId,
    mode: room.mode || "duo",
    maxScore: room.maxScore || 15,
    isGameOver: Boolean(room.isGameOver),
    winnerId: room.winnerId || null,
    players: room.players || {},
    scores: room.scores || {},
    names: room.names || {},
    loveItems: room.loveItems || [],
    inviteCode: room.inviteCode || null,
    gameStarted: Boolean(room.gameStarted),
    maxScoreVotes: room.maxScoreVotes || {},
    readyPlayers: room.readyPlayers || {},
    promptScoreSetup: Boolean(room.promptScoreSetup),
    promptScoreSetupFor: room.promptScoreSetupFor || null,
    playAgainVotes: room.playAgainVotes || {},
  };
}

function collectLove(room) {
  const players = { ...(room.players || {}) };
  const scores = { ...(room.scores || {}) };
  const loveItems = [...(room.loveItems || [])];

  let winnerId = room.winnerId || null;
  let isGameOver = Boolean(room.isGameOver);

  if (!room.gameStarted || isGameOver) {
    return { players, scores, loveItems, winnerId, isGameOver };
  }

  Object.keys(players).forEach((id) => {
    const p = players[id];
    for (let i = loveItems.length - 1; i >= 0; i -= 1) {
      const item = loveItems[i];
      if (Math.hypot(p.x - item.x, p.y - item.y) < 30) {
        scores[id] = (scores[id] || 0) + 1;
        loveItems.splice(i, 1);
        loveItems.push(createLoveItem(i));
        if (scores[id] >= room.maxScore) {
          isGameOver = true;
          winnerId = id;
          break;
        }
      }
    }
  });

  if (room.mode === "bot-duo" && players[BOT_ID] && !isGameOver) {
    const bot = players[BOT_ID];
    let nearest = null;
    let nearestDistance = Infinity;
    loveItems.forEach((item) => {
      const d = (item.x - bot.x) ** 2 + (item.y - bot.y) ** 2;
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = item;
      }
    });
    if (nearest) {
      bot.x += Math.sign(nearest.x - bot.x) * 1.6;
      bot.y += Math.sign(nearest.y - bot.y) * 1.6;
    }
  }

  return { players, scores, loveItems, winnerId, isGameOver };
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
    while (await findRoomByCode(ctx, roomCode)) roomCode = randomCode();

    const playerId = args.deviceId || `lover-${Math.random().toString(36).slice(2, 11)}`;
    const maxScore = clamp(Math.floor(args.maxScore ?? 15), 3, 99);
    const mode = args.withBot ? "bot-duo" : "duo";

    const players = { [playerId]: createPlayer() };
    const scores = { [playerId]: 0 };
    const names = { [playerId]: normalizeName(args.loverName) };
    const maxScoreVotes = { [playerId]: maxScore };
    const readyPlayers = { [playerId]: mode === "bot-duo" };

    if (mode === "bot-duo") {
      players[BOT_ID] = { x: 160, y: 140, color: "#92ccff" };
      scores[BOT_ID] = 0;
      names[BOT_ID] = "Cupid Bot";
      maxScoreVotes[BOT_ID] = maxScore;
      readyPlayers[BOT_ID] = true;
    }

    const roomId = await ctx.db.insert("rooms", {
      roomCode,
      inviteCode: randomCode(8),
      mode,
      createdAt: Date.now(),
      maxScore,
      maxScoreVotes,
      readyPlayers,
      gameStarted: mode === "bot-duo",
      promptScoreSetup: false,
      promptScoreSetupFor: null,
      playAgainVotes: {},
      isGameOver: false,
      winnerId: null,
      players,
      scores,
      names,
      loveItems: Array.from({ length: INITIAL_LOVE_ITEMS }, (_, i) => createLoveItem(i)),
    });

    await ctx.db.insert("roomPresence", {
      roomCode,
      playerId,
      x: players[playerId].x,
      y: players[playerId].y,
      updatedAt: Date.now(),
    });

    if (mode === "bot-duo") {
      await ctx.db.insert("roomPresence", {
        roomCode,
        playerId: BOT_ID,
        x: players[BOT_ID].x,
        y: players[BOT_ID].y,
        updatedAt: Date.now(),
      });
    }

    const room = await ctx.db.get(roomId);
    return {
      ...roomResponse(room, playerId),
      letter: "I made us a room in Love Rush. Join me and let’s collect hearts together 💖",
    };
  },
});

export const joinRoom = mutation({
  args: {
    loverName: v.optional(v.string()),
    roomCode: v.string(),
    deviceId: v.optional(v.string()),
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) throw new Error("Room not found");

    if (room.inviteCode && args.inviteCode && room.inviteCode !== args.inviteCode.trim().toUpperCase()) {
      throw new Error("Invite code is invalid for this room");
    }

    const playerId = args.deviceId || `lover-${Math.random().toString(36).slice(2, 11)}`;
    const players = { ...(room.players || {}) };
    const scores = { ...(room.scores || {}) };
    const names = { ...(room.names || {}) };
    const votes = { ...(room.maxScoreVotes || {}) };
    const readyPlayers = { ...(room.readyPlayers || {}) };

    const humanIdsInRoom = Object.keys(players).filter((id) => id !== BOT_ID);
    const isNewHumanJoin = !players[playerId] && playerId !== BOT_ID;
    if (isNewHumanJoin && humanIdsInRoom.length >= 2) {
      throw new Error("Room is full (max 2 players)");
    }

    if (!players[playerId]) {
      const newPlayer = createPlayer();
      players[playerId] = newPlayer;
      scores[playerId] = scores[playerId] || 0;
      votes[playerId] = votes[playerId] || room.maxScore || 15;
      readyPlayers[playerId] = false;

      const existingPresence = await getPresenceDoc(ctx, roomCode, playerId);
      if (!existingPresence) {
        await ctx.db.insert("roomPresence", {
          roomCode,
          playerId,
          x: newPlayer.x,
          y: newPlayer.y,
          updatedAt: Date.now(),
        });
      }
    }

    names[playerId] = normalizeName(args.loverName);

    const humanIds = Object.keys(players).filter((id) => id !== BOT_ID);
    const allReady = humanIds.length > 0 && humanIds.every((id) => Boolean(readyPlayers[id]));
    const sameVote = humanIds.length > 0 && humanIds.every((id) => votes[id] === votes[humanIds[0]]);
    const gameStarted = room.mode === "bot-duo" ? true : (allReady && sameVote);
    const partnerId = humanIds.find((id) => id !== playerId) || null;
    const shouldPromptSetup = room.mode !== "bot-duo" && humanIds.length === 2 && !gameStarted;

    await ctx.db.patch(room._id, {
      players,
      scores,
      names,
      maxScoreVotes: votes,
      readyPlayers,
      gameStarted,
      maxScore: sameVote ? votes[humanIds[0]] : room.maxScore,
      promptScoreSetup: shouldPromptSetup,
      promptScoreSetupFor: shouldPromptSetup ? partnerId : null,
    });

    const updated = await ctx.db.get(room._id);
    return roomResponse(updated, playerId);
  },
});

export const move = mutation({
  args: {
    roomCode: v.string(),
    playerId: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) throw new Error("Room not found");
    if (room.isGameOver) return roomResponse(room, args.playerId);

    const players = { ...(room.players || {}) };
    if (!players[args.playerId]) {
      throw new Error("Player not found in room");
    }

    const nextX = clamp(args.x, 15, WORLD_WIDTH - 15);
    const nextY = clamp(args.y, 15, WORLD_HEIGHT - 15);
    const playerPresence = await getPresenceDoc(ctx, roomCode, args.playerId);

    if (playerPresence) {
      if (playerPresence.x === nextX && playerPresence.y === nextY) {
        const unchangedPresence = await listRoomPresence(ctx, roomCode);
        return roomResponse({ ...room, players: mergePlayersWithPresence(room, unchangedPresence) }, args.playerId);
      }

      await ctx.db.patch(playerPresence._id, {
        x: nextX,
        y: nextY,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("roomPresence", {
        roomCode,
        playerId: args.playerId,
        x: nextX,
        y: nextY,
        updatedAt: Date.now(),
      });
    }

    const roomPresence = await listRoomPresence(ctx, roomCode);
    const mergedPlayers = mergePlayersWithPresence(room, roomPresence);
    const next = collectLove({ ...room, players: mergedPlayers });

    const roomPatch = {};
    if (JSON.stringify(next.scores) !== JSON.stringify(room.scores || {})) roomPatch.scores = next.scores;
    if (JSON.stringify(next.loveItems) !== JSON.stringify(room.loveItems || [])) roomPatch.loveItems = next.loveItems;
    if (next.isGameOver !== Boolean(room.isGameOver)) roomPatch.isGameOver = next.isGameOver;
    if (next.winnerId !== (room.winnerId || null)) roomPatch.winnerId = next.winnerId;

    const botMoved =
      room.mode === "bot-duo" &&
      mergedPlayers[BOT_ID] &&
      next.players[BOT_ID] &&
      (mergedPlayers[BOT_ID].x !== next.players[BOT_ID].x || mergedPlayers[BOT_ID].y !== next.players[BOT_ID].y);

    if (botMoved) {
      const botPresence = await getPresenceDoc(ctx, roomCode, BOT_ID);
      if (botPresence) {
        await ctx.db.patch(botPresence._id, {
          x: next.players[BOT_ID].x,
          y: next.players[BOT_ID].y,
          updatedAt: Date.now(),
        });
      }
    }

    if (Object.keys(roomPatch).length > 0) {
      await ctx.db.patch(room._id, roomPatch);
    }

    const updated = await ctx.db.get(room._id);
    const updatedPresence = await listRoomPresence(ctx, roomCode);
    return roomResponse({ ...updated, players: mergePlayersWithPresence(updated, updatedPresence) }, args.playerId);
  },
});

export const getRoomState = query({
  args: {
    roomCode: v.string(),
    playerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const roomCode = (args.roomCode || "").trim().toUpperCase();
    if (!roomCode) return { ok: true };

    const room = await findRoomByCode(ctx, roomCode);
    if (!room) throw new Error("Room not found");
    const presence = await listRoomPresence(ctx, roomCode);
    return roomResponse({ ...room, players: mergePlayersWithPresence(room, presence) }, args.playerId || null);
  },
});

export const validateInvitation = query({
  args: {
    roomCode: v.string(),
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const inviteCode = args.inviteCode.trim().toUpperCase();
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) return { invited: false };
    return {
      invited: room.inviteCode === inviteCode,
      roomCode: room.roomCode,
      mode: room.mode || "duo",
    };
  },
});

export const setMatchPreferences = mutation({
  args: {
    roomCode: v.string(),
    playerId: v.string(),
    maxScore: v.number(),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.trim().toUpperCase());
    if (!room) throw new Error("Room not found");
    if (!(room.players || {})[args.playerId]) throw new Error("Player not in room");

    const maxScoreVotes = { ...(room.maxScoreVotes || {}) };
    const readyPlayers = { ...(room.readyPlayers || {}) };
    const value = clamp(Math.floor(args.maxScore || 15), 3, 99);

    maxScoreVotes[args.playerId] = value;
    readyPlayers[args.playerId] = Boolean(args.ready);

    const humanIds = Object.keys(room.players || {}).filter((id) => id !== BOT_ID);
    const allReady = humanIds.length > 0 && humanIds.every((id) => Boolean(readyPlayers[id]));
    const sameVote = humanIds.length > 0 && humanIds.every((id) => maxScoreVotes[id] === maxScoreVotes[humanIds[0]]);
    const gameStarted = room.mode === "bot-duo" ? true : (allReady && sameVote);
    const selectedMax = sameVote && humanIds.length ? maxScoreVotes[humanIds[0]] : room.maxScore;

    await ctx.db.patch(room._id, {
      maxScoreVotes,
      readyPlayers,
      gameStarted,
      maxScore: selectedMax,
      promptScoreSetup: false,
      promptScoreSetupFor: null,
      playAgainVotes: {},
    });

    const updated = await ctx.db.get(room._id);
    return roomResponse(updated, args.playerId);
  },
});


export const playAgain = mutation({
  args: {
    roomCode: v.string(),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) throw new Error("Room not found");
    if (!(room.players || {})[args.playerId]) throw new Error("Player not in room");

    const scores = { ...(room.scores || {}) };
    Object.keys(scores).forEach((id) => {
      scores[id] = 0;
    });

    const readyPlayers = { ...(room.readyPlayers || {}) };
    Object.keys(readyPlayers).forEach((id) => {
      readyPlayers[id] = room.mode === "bot-duo" && id === BOT_ID;
    });

    await ctx.db.patch(room._id, {
      scores,
      loveItems: Array.from({ length: INITIAL_LOVE_ITEMS }, (_, i) => createLoveItem(i)),
      isGameOver: false,
      winnerId: null,
      gameStarted: room.mode === "bot-duo",
      readyPlayers,
      promptScoreSetup: room.mode !== "bot-duo",
      promptScoreSetupFor: room.mode !== "bot-duo" ? args.playerId : null,
      playAgainVotes: {},
    });

    const updated = await ctx.db.get(room._id);
    const presence = await listRoomPresence(ctx, roomCode);
    return roomResponse({ ...updated, players: mergePlayersWithPresence(updated, presence) }, args.playerId);
  },
});

export const leaveRoom = mutation({
  args: {
    roomCode: v.string(),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) return { deleted: false, left: false };

    const players = { ...(room.players || {}) };
    const scores = { ...(room.scores || {}) };
    const names = { ...(room.names || {}) };
    const maxScoreVotes = { ...(room.maxScoreVotes || {}) };
    const readyPlayers = { ...(room.readyPlayers || {}) };
    const playAgainVotes = { ...(room.playAgainVotes || {}) };

    delete players[args.playerId];
    delete scores[args.playerId];
    delete names[args.playerId];
    delete maxScoreVotes[args.playerId];
    delete readyPlayers[args.playerId];
    delete playAgainVotes[args.playerId];

    const presence = await getPresenceDoc(ctx, roomCode, args.playerId);
    if (presence) await ctx.db.delete(presence._id);

    const humanIds = Object.keys(players).filter((id) => id !== BOT_ID);
    if (humanIds.length === 0) {
      const allPresence = await listRoomPresence(ctx, roomCode);
      await Promise.all(allPresence.map((doc) => ctx.db.delete(doc._id)));
      await ctx.db.delete(room._id);
      return { deleted: true, left: true };
    }

    const allReady = humanIds.every((id) => Boolean(readyPlayers[id]));
    const sameVote = humanIds.every((id) => maxScoreVotes[id] === maxScoreVotes[humanIds[0]]);

    await ctx.db.patch(room._id, {
      players,
      scores,
      names,
      maxScoreVotes,
      readyPlayers,
      playAgainVotes,
      gameStarted: room.mode === "bot-duo" ? true : (allReady && sameVote),
      maxScore: sameVote ? maxScoreVotes[humanIds[0]] : room.maxScore,
      promptScoreSetup: false,
      promptScoreSetupFor: null,
    });

    return { deleted: false, left: true };
  },
});
