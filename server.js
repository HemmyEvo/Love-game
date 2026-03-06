const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  path: "/socket.io",
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
});

const publicDir = path.join(__dirname, "Public");
app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
const ITEM_COUNT = 22;
const BOT_PREFIX = "bot-";
const INVITE_CODE_LENGTH = 8;
const SIMULATION_FPS = 60;
const BROADCAST_FPS = 20;
const MIN_TARGET_SCORE = 3;
const MAX_TARGET_SCORE = 99;
const DEFAULT_TARGET_SCORE = 15;

const rooms = {};
const socketToRoom = {};
const disconnectionTimeouts = new Map();

function roomCode() {
  const alphabet = "LOVEXY";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function inviteCode() {
  return Math.random().toString(36).slice(2, 2 + INVITE_CODE_LENGTH).toUpperCase();
}

function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${Math.random()}-${seed}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4),
  };
}

function normalizeTargetScore(input) {
  const n = Number.parseInt(input, 10);
  if (Number.isNaN(n)) return DEFAULT_TARGET_SCORE;
  return Math.min(MAX_TARGET_SCORE, Math.max(MIN_TARGET_SCORE, n));
}

function createRoom({ mode = "duo", maxScore = DEFAULT_TARGET_SCORE } = {}) {
  let code = roomCode();
  while (rooms[code]) code = roomCode();

  const loveItems = Array.from({ length: ITEM_COUNT }, (_, index) => createLoveItem(index));
  rooms[code] = {
    code,
    inviteCode: inviteCode(),
    mode,
    maxScore: normalizeTargetScore(maxScore),
    winnerId: null,
    isGameOver: false,
    players: {},
    scores: {},
    names: {},
    loveItems,
    letter: `My love, join me in Love Rush Arena. Our secret code is ${code}. 💌`,
  };
  return rooms[code];
}

function addPlayerToRoom(room, socketId, loverName) {
  room.players[socketId] = {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`,
  };
  room.scores[socketId] = room.scores[socketId] || 0;
  room.names[socketId] = loverName || "Lover";
}

function ensureBot(room) {
  const botId = `${BOT_PREFIX}${room.code}`;
  if (room.players[botId]) return;

  room.players[botId] = { x: 160, y: 140, color: "#92ccff" };
  room.scores[botId] = 0;
  room.names[botId] = "Cupid Bot";
}

function emitRoomState(room, event = "gameUpdate", { volatile = false } = {}) {
  const channel = volatile ? io.to(room.code).volatile : io.to(room.code);
  channel.emit(event, {
    roomCode: room.code,
    players: room.players,
    loveItems: room.loveItems,
    scores: room.scores,
    names: room.names,
    mode: room.mode,
    maxScore: room.maxScore,
    isGameOver: room.isGameOver,
    winnerId: room.winnerId,
    winnerName: room.winnerId ? room.names[room.winnerId] || "Lover" : null,
  });
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (!room) return;

  const liveHumanPlayers = Object.keys(room.players).filter((id) => !id.startsWith(BOT_PREFIX));
  if (liveHumanPlayers.length === 0) {
    delete rooms[code];
  }
}

function finishGame(room, winnerId) {
  if (!room || room.isGameOver) return;
  room.isGameOver = true;
  room.winnerId = winnerId;

  io.to(room.code).emit("gameOver", {
    roomCode: room.code,
    winnerId,
    winnerName: room.names[winnerId] || "Lover",
    winningScore: room.scores[winnerId] || 0,
    maxScore: room.maxScore,
  });

  emitRoomState(room, "gameUpdate");
}

function botStep(room) {
  const botId = `${BOT_PREFIX}${room.code}`;
  const bot = room.players[botId];
  if (!bot) return;

  let nearest = null;
  let nearestDistance = Infinity;
  room.loveItems.forEach((item) => {
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

function runCollisions(room) {
  if (!room || room.isGameOver) return;

  const ids = Object.keys(room.players);
  for (const id of ids) {
    const player = room.players[id];
    for (let i = room.loveItems.length - 1; i >= 0; i -= 1) {
      const item = room.loveItems[i];
      if (Math.hypot(player.x - item.x, player.y - item.y) < 30) {
        room.scores[id] = (room.scores[id] || 0) + 1;
        room.loveItems.splice(i, 1);
        room.loveItems.push(createLoveItem(i));

        if (room.scores[id] >= room.maxScore) {
          finishGame(room, id);
          return;
        }
      }
    }
  }
}

app.get("/api/invitation", (req, res) => {
  const roomCodeFromQuery = String(req.query.roomCode || "").toUpperCase().trim();
  const inviteCodeFromQuery = String(req.query.inviteCode || "").toUpperCase().trim();
  const room = rooms[roomCodeFromQuery];

  const invited = Boolean(
    room && room.inviteCode && inviteCodeFromQuery && room.inviteCode === inviteCodeFromQuery,
  );

  res.json({ invited, roomCode: invited ? room.code : null });
});

io.on("connection", (socket) => {
  socket.emit("ready", { message: "Connected to Love Rush" });

  socket.on("createRoom", ({ loverName, withBot, maxScore }) => {
    const room = createRoom({ mode: withBot ? "bot-duo" : "duo", maxScore });
    addPlayerToRoom(room, socket.id, loverName);
    if (withBot) ensureBot(room);

    socket.join(room.code);
    socketToRoom[socket.id] = room.code;

    socket.emit("init", {
      playerId: socket.id,
      roomCode: room.code,
      players: room.players,
      loveItems: room.loveItems,
      scores: room.scores,
      names: room.names,
      mode: room.mode,
      letter: room.letter,
      inviteCode: room.inviteCode,
      maxScore: room.maxScore,
      isGameOver: room.isGameOver,
      winnerId: room.winnerId,
    });

    emitRoomState(room, "gameUpdate");
  });

  socket.on("joinRoom", ({ loverName, roomCode: rawCode }) => {
    const code = String(rawCode || "").toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit("joinError", { message: "Love letter code not found 💔" });
      return;
    }

    const humans = Object.keys(room.players).filter((id) => !id.startsWith(BOT_PREFIX));
    if (humans.length >= 2 && room.mode !== "bot-duo") {
      socket.emit("joinError", { message: "This duo room is already full." });
      return;
    }

    addPlayerToRoom(room, socket.id, loverName);
    socket.join(code);
    socketToRoom[socket.id] = code;

    socket.emit("init", {
      playerId: socket.id,
      roomCode: room.code,
      players: room.players,
      loveItems: room.loveItems,
      scores: room.scores,
      names: room.names,
      mode: room.mode,
      letter: room.letter,
      inviteCode: room.inviteCode,
      maxScore: room.maxScore,
      isGameOver: room.isGameOver,
      winnerId: room.winnerId,
    });

    emitRoomState(room, "gameUpdate");
  });

  socket.on("move", ({ x, y }) => {
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code] || !rooms[code].players[socket.id]) return;
    const room = rooms[code];
    if (room.isGameOver) return;

    room.players[socket.id].x = Math.max(15, Math.min(WORLD_WIDTH - 15, x));
    room.players[socket.id].y = Math.max(15, Math.min(WORLD_HEIGHT - 15, y));
  });

  socket.on("disconnect", () => {
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code]) return;

    const timeoutId = setTimeout(() => {
      const room = rooms[code];
      if (!room) return;

      delete room.players[socket.id];
      delete room.scores[socket.id];
      delete room.names[socket.id];
      delete socketToRoom[socket.id];

      emitRoomState(room, "gameUpdate");
      cleanupRoom(code);
      disconnectionTimeouts.delete(socket.id);
    }, 10000);

    disconnectionTimeouts.set(socket.id, timeoutId);
  });
});

const simulationLoop = setInterval(() => {
  Object.values(rooms).forEach((room) => {
    if (room.isGameOver) return;
    if (room.mode === "bot-duo") botStep(room);
    runCollisions(room);
  });
}, 1000 / SIMULATION_FPS);

const broadcastLoop = setInterval(() => {
  Object.values(rooms).forEach((room) => {
    emitRoomState(room, "gameUpdate", { volatile: true });
  });
}, 1000 / BROADCAST_FPS);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  clearInterval(simulationLoop);
  clearInterval(broadcastLoop);
  server.close();
});
