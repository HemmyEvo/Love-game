const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const loveItems = [];
const scores = {};

// Generate random love items
function generateLoveItems() {
  for (let i = 0; i < 20; i++) {
    loveItems.push({
      id: i,
      x: Math.random() * 780,
      y: Math.random() * 580,
      type: Math.floor(Math.random() * 3)
    });
  }
}

// Check collisions
function checkCollisions() {
  for (const playerId in players) {
    const player = players[playerId];
    for (let i = loveItems.length - 1; i >= 0; i--) {
      const item = loveItems[i];
      if (
        player.x < item.x + 20 &&
        player.x + 50 > item.x &&
        player.y < item.y + 20 &&
        player.y + 50 > item.y
      ) {
        // Collision detected
        scores[playerId] = (scores[playerId] || 0) + 1;
        loveItems.splice(i, 1);
        
        // Add new love item
        loveItems.push({
          id: Date.now() + Math.random(),
          x: Math.random() * 780,
          y: Math.random() * 580,
          type: Math.floor(Math.random() * 3)
        });
        
        io.emit('scoreUpdate', { playerId, score: scores[playerId] });
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Add new player
  players[socket.id] = {
    x: Math.random() * 750,
    y: Math.random() * 550,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`
  };
  scores[socket.id] = 0;
  
  // Send initial game state
  socket.emit('init', { 
    playerId: socket.id, 
    players, 
    loveItems, 
    scores 
  });
  
  // Broadcast new player to others
  socket.broadcast.emit('newPlayer', { 
    playerId: socket.id, 
    player: players[socket.id] 
  });
  
  // Handle player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', {
        playerId: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    delete scores[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Game loop
setInterval(() => {
  checkCollisions();
  io.emit('gameUpdate', { players, loveItems });
}, 1000 / 60);

// Start server
generateLoveItems();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
