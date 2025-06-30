const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoresElement = document.getElementById("scores");

// Game state
let playerId;
let players = {};
let loveItems = [];
let scores = {};

// Connect to server
const socket = io();

// Handle initialization
socket.on('init', (data) => {
  playerId = data.playerId;
  players = data.players;
  loveItems = data.loveItems;
  scores = data.scores;
  updateScoreboard();
});

// Handle new players
socket.on('newPlayer', (data) => {
  players[data.playerId] = data.player;
});

// Handle player movement updates
socket.on('playerMoved', (data) => {
  if (players[data.playerId]) {
    players[data.playerId].x = data.x;
    players[data.playerId].y = data.y;
  }
});

// Handle player disconnections
socket.on('playerDisconnected', (id) => {
  delete players[id];
  delete scores[id];
  updateScoreboard();
});

// Handle game state updates
socket.on('gameUpdate', (data) => {
  players = data.players;
  loveItems = data.loveItems;
});

// Handle score updates
socket.on('scoreUpdate', (data) => {
  scores[data.playerId] = data.score;
  updateScoreboard();
});

// Update scoreboard
function updateScoreboard() {
  scoresElement.innerHTML = '';
  for (const id in scores) {
    const scoreElement = document.createElement('div');
    scoreElement.textContent = `Player ${id.slice(0, 4)}: ${scores[id]}`;
    if (id === playerId) {
      scoreElement.style.fontWeight = 'bold';
      scoreElement.style.color = players[id]?.color || 'black';
    }
    scoresElement.appendChild(scoreElement);
  }
}

// Keyboard controls
const keys = {};
document.addEventListener("keydown", (event) => {
  keys[event.keyCode] = true;
});
document.addEventListener("keyup", (event) => {
  delete keys[event.keyCode];
});

// Current player movement
function updatePlayerPosition() {
  if (!players[playerId]) return;
  
  const player = players[playerId];
  const speed = 5;
  
  if (37 in keys && player.x > 0) { // Left
    player.x -= speed;
  }
  if (39 in keys && player.x < canvas.width - 50) { // Right
    player.x += speed;
  }
  if (38 in keys && player.y > 0) { // Up
    player.y -= speed;
  }
  if (40 in keys && player.y < canvas.height - 50) { // Down
    player.y += speed;
  }
  
  // Send movement to server
  socket.emit('move', { x: player.x, y: player.y });
}

// Draw a heart shape
function drawHeart(x, y, width, height, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const topCurveHeight = height * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  // Top left curve
  ctx.bezierCurveTo(
    x, y, 
    x - width / 2, y, 
    x - width / 2, y + topCurveHeight
  );
  // Bottom left curve
  ctx.bezierCurveTo(
    x - width / 2, y + (height + topCurveHeight) / 2, 
    x, y + (height + topCurveHeight) / 2, 
    x, y + height
  );
  // Bottom right curve
  ctx.bezierCurveTo(
    x, y + (height + topCurveHeight) / 2, 
    x + width / 2, y + (height + topCurveHeight) / 2, 
    x + width / 2, y + topCurveHeight
  );
  // Top right curve
  ctx.bezierCurveTo(
    x + width / 2, y, 
    x, y, 
    x, y + topCurveHeight
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Get color based on love item type
function getLoveColor(type) {
  const colors = ['#ff3399', '#ff66b3', '#ff99cc'];
  return colors[type] || '#ff3399';
}

// Draw game
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw love items
  loveItems.forEach(item => {
    drawHeart(item.x, item.y, 20, 20, getLoveColor(item.type));
  });
  
  // Draw players
  for (const id in players) {
    const player = players[id];
    drawHeart(player.x, player.y, 50, 50, player.color);
    
    // Draw player ID
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText(id.slice(0, 4), player.x + 15, player.y - 5);
  }
}

// Game loop
function gameLoop() {
  updatePlayerPosition();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
