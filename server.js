const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
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

const rooms = {};
const socketToRoom = {};

function roomCode() {
  const alphabet = "LOVEXY";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${Math.random()}-${seed}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4)
  };
}

function createRoom(mode = "duo") {
  let code = roomCode();
  while (rooms[code]) {
    code = roomCode();
  }

  const loveItems = Array.from({ length: ITEM_COUNT }, (_, index) => createLoveItem(index));
  rooms[code] = {
    code,
    mode,
    players: {},
    scores: {},
    names: {},
    loveItems,
    letter: `My love, join me in Love Rush Arena. Our secret code is ${code}. 💌`
  };
  return rooms[code];
}

function addPlayerToRoom(room, socketId, loverName) {
  room.players[socketId] = {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`
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

function emitRoomState(room, event = "gameUpdate") {
  io.to(room.code).emit(event, {
    roomCode: room.code,
    players: room.players,
    loveItems: room.loveItems,
    scores: room.scores,
    names: room.names,
    mode: room.mode
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
  Object.keys(room.players).forEach((id) => {
    const player = room.players[id];
    for (let i = room.loveItems.length - 1; i >= 0; i -= 1) {
      const item = room.loveItems[i];
      if (Math.hypot(player.x - item.x, player.y - item.y) < 30) {
        room.scores[id] = (room.scores[id] || 0) + 1;
        room.loveItems.splice(i, 1);
        room.loveItems.push(createLoveItem(i));
      }
    }
  });
}

io.on("connection", (socket) => {
  socket.emit("ready", { message: "Connected to Love Rush" });

  socket.on("createRoom", ({ loverName, withBot }) => {
    const room = createRoom(withBot ? "bot-duo" : "duo");
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
      letter: room.letter
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
      letter: room.letter
    });

    emitRoomState(room, "gameUpdate");
  });

  socket.on("move", ({ x, y }) => {
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code] || !rooms[code].players[socket.id]) return;
    const room = rooms[code];

    room.players[socket.id].x = Math.max(15, Math.min(WORLD_WIDTH - 15, x));
    room.players[socket.id].y = Math.max(15, Math.min(WORLD_HEIGHT - 15, y));
  });

  socket.on("disconnect", () => {
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    delete room.players[socket.id];
    delete room.scores[socket.id];
    delete room.names[socket.id];
    delete socketToRoom[socket.id];

    emitRoomState(room, "gameUpdate");
    cleanupRoom(code);
  });
});

const gameLoop = setInterval(() => {
  Object.values(rooms).forEach((room) => {
    if (room.mode === "bot-duo") botStep(room);
    runCollisions(room);
    emitRoomState(room, "gameUpdate");
  });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  clearInterval(gameLoop);
  server.close();
});
