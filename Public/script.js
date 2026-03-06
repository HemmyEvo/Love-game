const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoresElement = document.getElementById("scores");
const statusPill = document.getElementById("statusPill");
const roomBadge = document.getElementById("roomBadge");
const touchPad = document.getElementById("touchPad");
const lobby = document.getElementById("lobby");
const joinError = document.getElementById("joinError");
const loveLetter = document.getElementById("loveLetter");
const gyroBtn = document.getElementById("gyroBtn");

const createRoomBtn = document.getElementById("createRoomBtn");
const createBotBtn = document.getElementById("createBotBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const loverNameInput = document.getElementById("loverName");
const roomCodeInput = document.getElementById("roomCodeInput");

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;
canvas.width = WORLD_WIDTH;
canvas.height = WORLD_HEIGHT;

let playerId = null;
let roomCode = null;
let players = {};
let loveItems = [];
let scores = {};
let names = {};
let connected = false;

let gyroEnabled = false;
let gyroAxes = { x: 0, y: 0 };

const socket = io(window.location.origin, {
  path: "/socket.io",
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  timeout: 10000
});

function setStatus(text, state = "offline") {
  statusPill.textContent = text;
  statusPill.dataset.state = state;
}

function getLoverName() {
  return loverNameInput.value.trim() || "Lover";
}

function setRoom(code) {
  roomCode = code;
  roomBadge.textContent = `Room: ${roomCode || "—"}`;
}

function showLoveLetter(letter, code) {
  if (!letter || !code) return;
  loveLetter.classList.remove("hidden");
  loveLetter.innerHTML = `
    <strong>💌 Love Letter Invite</strong>
    <p>${letter}</p>
    <p><strong>Code:</strong> ${code}</p>
  `;
}

socket.on("connect", () => {
  connected = true;
  setStatus("Connected • pick mode", "online");
});

socket.on("disconnect", () => {
  connected = false;
  setStatus("Disconnected • retrying…", "offline");
});

socket.io.on("reconnect_attempt", () => {
  setStatus("Reconnecting…", "offline");
});

socket.io.on("reconnect", () => {
  connected = true;
  setStatus(roomCode ? "Reconnected" : "Connected • pick mode", "online");
});

socket.on("connect_error", () => {
  connected = false;
  setStatus("Connection failed", "offline");
});

socket.on("joinError", ({ message }) => {
  joinError.textContent = message;
});

socket.on("init", (data) => {
  playerId = data.playerId;
  players = data.players;
  loveItems = data.loveItems;
  scores = data.scores;
  names = data.names;
  setRoom(data.roomCode);
  updateScoreboard();
  joinError.textContent = "";

  if (data.letter) showLoveLetter(data.letter, data.roomCode);

  lobby.classList.add("compact");
  setStatus(data.mode === "bot-duo" ? "Bot Duo Mode" : "Duo Multiplayer", "online");
});

socket.on("gameUpdate", (data) => {
  players = data.players;
  loveItems = data.loveItems;
  scores = data.scores;
  names = data.names;
  if (data.roomCode) setRoom(data.roomCode);
  updateScoreboard();
});

createRoomBtn.addEventListener("click", () => {
  if (!connected) return;
  socket.emit("createRoom", { loverName: getLoverName(), withBot: false });
});

createBotBtn.addEventListener("click", () => {
  if (!connected) return;
  socket.emit("createRoom", { loverName: getLoverName(), withBot: true });
});

joinRoomBtn.addEventListener("click", () => {
  if (!connected) return;
  const code = roomCodeInput.value.toUpperCase().trim();
  socket.emit("joinRoom", { loverName: getLoverName(), roomCode: code });
});

function updateScoreboard() {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  scoresElement.innerHTML = "";

  sorted.forEach(([id, score], index) => {
    const row = document.createElement("div");
    const isYou = id === playerId;
    row.className = `score-row ${isYou ? "is-you" : ""}`;
    row.innerHTML = `
      <span>${index + 1}. ${isYou ? "You" : names[id] || "Lover"}</span>
      <strong>${score}</strong>
    `;
    scoresElement.appendChild(row);
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
  if (direction) keys.delete(direction);
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

function handleDeviceOrientation(event) {
  const tiltLeftRight = event.gamma || 0;
  const tiltFrontBack = event.beta || 0;

  if (window.matchMedia("(orientation: portrait)").matches) {
    gyroAxes.x = clamp(tiltLeftRight / 25, -1, 1);
    gyroAxes.y = clamp(tiltFrontBack / 35, -1, 1);
  } else {
    gyroAxes.x = clamp(tiltFrontBack / 35, -1, 1);
    gyroAxes.y = clamp(-tiltLeftRight / 25, -1, 1);
  }
}

async function enableGyroscope() {
  if (!("DeviceOrientationEvent" in window)) {
    gyroBtn.textContent = "Gyroscope not supported";
    return;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") {
        gyroBtn.textContent = "Gyroscope blocked";
        return;
      }
    }

    window.addEventListener("deviceorientation", handleDeviceOrientation);
    gyroEnabled = true;
    gyroBtn.textContent = "Gyroscope Enabled";
  } catch (_error) {
    gyroBtn.textContent = "Gyroscope unavailable";
  }
}

gyroBtn.addEventListener("click", enableGyroscope);

function moveSelf() {
  if (!playerId || !players[playerId]) return;

  const me = players[playerId];
  const speed = 4.8;
  let vx = 0;
  let vy = 0;

  if (keys.has("left")) vx -= 1;
  if (keys.has("right")) vx += 1;
  if (keys.has("up")) vy -= 1;
  if (keys.has("down")) vy += 1;

  if (gyroEnabled) {
    vx += gyroAxes.x;
    vy += gyroAxes.y;
  }

  me.x = clamp(me.x + vx * speed, 15, WORLD_WIDTH - 15);
  me.y = clamp(me.y + vy * speed, 15, WORLD_HEIGHT - 15);

  socket.emit("move", { x: me.x, y: me.y });
}

function drawHeart(x, y, size, color, glow = 0.9) {
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

function loveColor(type) {
  return ["#ff2d55", "#ffffff", "#d6d6d6", "#ff6f8f"][type] || "#ff2d55";
}

function resizeCanvas() {
  const available = canvas.parentElement.clientWidth;
  const scale = Math.min(1, available / WORLD_WIDTH);
  canvas.style.width = `${WORLD_WIDTH * scale}px`;
  canvas.style.height = `${WORLD_HEIGHT * scale}px`;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  gradient.addColorStop(0, "#090909");
  gradient.addColorStop(1, "#151515");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function draw() {
  drawBackground();

  loveItems.forEach((item) => {
    drawHeart(item.x, item.y, 18, loveColor(item.type), 0.7);
  });

  Object.entries(players).forEach(([id, player]) => {
    const mine = id === playerId;
    drawHeart(player.x, player.y, mine ? 36 : 31, player.color, mine ? 1 : 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 12px Inter, Arial";
    ctx.fillText(mine ? "You" : (names[id] || "Lover"), player.x - 14, player.y - 24);
  });

  if (!playerId) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "700 20px Inter, Arial";
    ctx.fillText("Create or join a love room to start", 250, 300);
  }
}

function gameLoop() {
  moveSelf();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
