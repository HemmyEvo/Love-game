const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoresElement = document.getElementById("scores");
const statusPill = document.getElementById("statusPill");
const touchPad = document.getElementById("touchPad");

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
canvas.width = WORLD_WIDTH;
canvas.height = WORLD_HEIGHT;

let scale = 1;
let playerId;
let players = {};
let loveItems = [];
let scores = {};
let connected = false;

const localPlayerId = "you";
let combo = 0;
let comboTimeout;

const socket = io({
  transports: ["websocket", "polling"],
  reconnectionAttempts: 4
});

function setStatus(text, css = "offline") {
  statusPill.textContent = text;
  statusPill.dataset.state = css;
}

socket.on("connect", () => {
  connected = true;
  setStatus("Online multiplayer", "online");
});

socket.on("connect_error", () => {
  if (!connected) {
    setStatus("Offline mode (serverless fallback)", "offline");
    startOfflineMode();
  }
});

socket.on("init", (data) => {
  connected = true;
  playerId = data.playerId;
  players = data.players;
  loveItems = data.loveItems;
  scores = data.scores;
  updateScoreboard();
});

socket.on("newPlayer", ({ playerId: id, player }) => {
  players[id] = player;
});

socket.on("playerMoved", ({ playerId: id, x, y }) => {
  if (players[id]) {
    players[id].x = x;
    players[id].y = y;
  }
});

socket.on("playerDisconnected", (id) => {
  delete players[id];
  delete scores[id];
  updateScoreboard();
});

socket.on("gameUpdate", (data) => {
  players = data.players;
  loveItems = data.loveItems;
});

socket.on("scoreUpdate", ({ playerId: id, score }) => {
  scores[id] = score;
  updateScoreboard();
});

function startOfflineMode() {
  if (playerId) return;

  playerId = localPlayerId;
  players = {
    [localPlayerId]: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, color: "#ff4fa8" },
    bot: { x: 100, y: 100, color: "#8ec5ff" }
  };
  scores = { [localPlayerId]: 0, bot: 0 };
  loveItems = Array.from({ length: 18 }, (_, i) => ({
    id: `offline-${Date.now()}-${i}`,
    x: Math.random() * (WORLD_WIDTH - 30) + 15,
    y: Math.random() * (WORLD_HEIGHT - 30) + 15,
    type: Math.floor(Math.random() * 4)
  }));

  setStatus("Offline mode (serverless fallback)", "offline");
  updateScoreboard();
}

function updateScoreboard() {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  scoresElement.innerHTML = "";

  sorted.forEach(([id, score], index) => {
    const scoreElement = document.createElement("div");
    scoreElement.className = "score-row";
    const isYou = id === playerId;
    scoreElement.innerHTML = `
      <span>${index + 1}. ${isYou ? "You" : `Player ${id.slice(0, 4)}`}</span>
      <strong>${score}</strong>
    `;

    if (isYou) {
      scoreElement.classList.add("is-you");
      scoreElement.style.borderColor = players[id]?.color || "#fff";
    }

    scoresElement.appendChild(scoreElement);
  });
}

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down"
};

const keys = new Set();
document.addEventListener("keydown", (event) => {
  const direction = keyMap[event.code];
  if (direction) {
    event.preventDefault();
    keys.add(direction);
  }
});

document.addEventListener("keyup", (event) => {
  const direction = keyMap[event.code];
  if (direction) {
    keys.delete(direction);
  }
});

if (window.matchMedia("(pointer: coarse)").matches) {
  touchPad.classList.add("visible");
}

touchPad.querySelectorAll("button").forEach((button) => {
  const direction = button.dataset.dir;

  const press = (event) => {
    event.preventDefault();
    keys.add(direction);
    button.classList.add("active");
  };

  const release = (event) => {
    event.preventDefault();
    keys.delete(direction);
    button.classList.remove("active");
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updatePlayerPosition() {
  if (!playerId || !players[playerId]) return;

  const speed = 5;
  const player = players[playerId];
  if (keys.has("left")) player.x -= speed;
  if (keys.has("right")) player.x += speed;
  if (keys.has("up")) player.y -= speed;
  if (keys.has("down")) player.y += speed;

  player.x = clamp(player.x, 15, WORLD_WIDTH - 15);
  player.y = clamp(player.y, 15, WORLD_HEIGHT - 15);

  if (connected) {
    socket.emit("move", { x: player.x, y: player.y });
  }
}

function drawHeart(x, y, size, color, glow = 0.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(0, -6, -20, -6, -20, 10);
  ctx.bezierCurveTo(-20, 22, -5, 30, 0, 36);
  ctx.bezierCurveTo(5, 30, 20, 22, 20, 10);
  ctx.bezierCurveTo(20, -6, 0, -6, 0, 10);
  ctx.closePath();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * glow;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function getLoveColor(type) {
  return ["#ff4fa8", "#ff79c8", "#ffd0ec", "#9d7aff"][type] || "#ff4fa8";
}

function updateOfflineWorld() {
  if (connected || !players.bot) return;

  const bot = players.bot;
  const nearest = loveItems.reduce((best, item) => {
    const d = (item.x - bot.x) ** 2 + (item.y - bot.y) ** 2;
    return d < best.distance ? { item, distance: d } : best;
  }, { item: null, distance: Infinity }).item;

  if (nearest) {
    bot.x += Math.sign(nearest.x - bot.x) * 1.8;
    bot.y += Math.sign(nearest.y - bot.y) * 1.8;
  }

  [playerId, "bot"].forEach((id) => {
    const p = players[id];
    if (!p) return;
    loveItems.forEach((item, index) => {
      const hit = Math.hypot(p.x - item.x, p.y - item.y) < 25;
      if (hit) {
        scores[id] = (scores[id] || 0) + (id === playerId ? Math.max(1, combo) : 1);

        if (id === playerId) {
          combo += 1;
          clearTimeout(comboTimeout);
          comboTimeout = setTimeout(() => (combo = 0), 2300);
        }

        loveItems.splice(index, 1);
        loveItems.push({
          id: `offline-${Date.now()}-${Math.random()}`,
          x: Math.random() * (WORLD_WIDTH - 30) + 15,
          y: Math.random() * (WORLD_HEIGHT - 30) + 15,
          type: Math.floor(Math.random() * 4)
        });
        updateScoreboard();
      }
    });
  });
}

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const availableWidth = wrap.clientWidth;
  scale = Math.min(1, availableWidth / WORLD_WIDTH);
  canvas.style.width = `${WORLD_WIDTH * scale}px`;
  canvas.style.height = `${WORLD_HEIGHT * scale}px`;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  gradient.addColorStop(0, "#241033");
  gradient.addColorStop(1, "#32184b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let i = 0; i < 24; i += 1) {
    const t = performance.now() / 1300 + i;
    ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 5) * 0.01})`;
    ctx.beginPath();
    ctx.arc((Math.sin(t) * 0.5 + 0.5) * WORLD_WIDTH, (Math.cos(t * 1.3) * 0.5 + 0.5) * WORLD_HEIGHT, 1.6 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  drawBackground();

  loveItems.forEach((item) => {
    drawHeart(item.x, item.y, 18, getLoveColor(item.type), 0.9);
  });

  Object.entries(players).forEach(([id, player]) => {
    drawHeart(player.x, player.y, id === playerId ? 36 : 30, player.color, id === playerId ? 1 : 0.7);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 12px Inter, Arial";
    ctx.fillText(id === playerId ? "You" : id.slice(0, 4), player.x - 12, player.y - 24);
  });

  if (!connected && playerId) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 16px Inter, Arial";
    ctx.fillText(`Combo x${Math.max(combo, 1)}`, 16, 28);
  }
}

function gameLoop() {
  updatePlayerPosition();
  updateOfflineWorld();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
