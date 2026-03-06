const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static("Public"));

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
const ITEM_COUNT = 20;

const players = {};
const loveItems = [];
const scores = {};

function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${Math.random()}-${seed}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4)
  };
}

function generateLoveItems() {
  while (loveItems.length < ITEM_COUNT) {
    loveItems.push(createLoveItem(loveItems.length));
  }
}

function checkCollisions() {
  Object.keys(players).forEach((playerId) => {
    const player = players[playerId];

    for (let index = loveItems.length - 1; index >= 0; index -= 1) {
      const item = loveItems[index];
      const hit = Math.hypot(player.x - item.x, player.y - item.y) < 30;

      if (hit) {
        scores[playerId] = (scores[playerId] || 0) + 1;
        loveItems.splice(index, 1);
        loveItems.push(createLoveItem(index));
        io.emit("scoreUpdate", { playerId, score: scores[playerId] });
      }
    }
  });
}

io.on("connection", (socket) => {
  players[socket.id] = {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`
  };
  scores[socket.id] = 0;

  socket.emit("init", {
    playerId: socket.id,
    players,
    loveItems,
    scores
  });

  socket.broadcast.emit("newPlayer", {
    playerId: socket.id,
    player: players[socket.id]
  });

  socket.on("move", ({ x, y }) => {
    if (!players[socket.id]) return;

    players[socket.id].x = Math.max(15, Math.min(WORLD_WIDTH - 15, x));
    players[socket.id].y = Math.max(15, Math.min(WORLD_HEIGHT - 15, y));

    socket.broadcast.emit("playerMoved", {
      playerId: socket.id,
      x: players[socket.id].x,
      y: players[socket.id].y
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    delete scores[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

generateLoveItems();

const gameLoop = setInterval(() => {
  checkCollisions();
  io.emit("gameUpdate", { players, loveItems });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  clearInterval(gameLoop);
  server.close();
});
