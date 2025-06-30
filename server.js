const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("Public"));
// Socket.io connection handling
const players = {};
const loveItems = [];
const scores = {};

function generateLoveItems() {
  for (let i = 0; i < 20; i++) {
    loveItems.push({
      id: Date.now() + i, // More unique IDs
      x: Math.random() * 780,
      y: Math.random() * 580,
      type: Math.floor(Math.random() * 3)
    });
  }
}

function checkCollisions() {
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    loveItems.forEach((item, index) => {
      if (
        player.x < item.x + 20 &&
        player.x + 50 > item.x &&
        player.y < item.y + 20 &&
        player.y + 50 > item.y
      ) {
        scores[playerId] = (scores[playerId] || 0) + 1;
        loveItems.splice(index, 1);
        loveItems.push({
          id: Date.now(),
          x: Math.random() * 780,
          y: Math.random() * 580,
          type: Math.floor(Math.random() * 3)
        });
        io.emit('scoreUpdate', { playerId, score: scores[playerId] });
      }
    });
  });
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Initialize player
  players[socket.id] = {
    x: Math.random() * 750,
    y: Math.random() * 550,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`
  };
  scores[socket.id] = 0;

  // Send initial state
  socket.emit('init', { 
    playerId: socket.id,
    players,
    loveItems,
    scores
  });

  // Notify others
  socket.broadcast.emit('newPlayer', {
    playerId: socket.id,
    player: players[socket.id]
  });

  // Movement handler
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
      socket.broadcast.emit('playerMoved', {
        playerId: socket.id,
        ...data
      });
    }
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    delete players[socket.id];
    delete scores[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Game loop
const gameLoop = setInterval(() => {
  checkCollisions();
  io.emit('gameUpdate', { players, loveItems });
}, 1000 / 60);

// Server startup
generateLoveItems();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cleanup on exit
process.on('SIGTERM', () => {
  clearInterval(gameLoop);
  server.close();
});
