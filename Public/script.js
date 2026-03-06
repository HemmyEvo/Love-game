const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoresElement = document.getElementById("scores");
const statusPill = document.getElementById("statusPill");
const roomBadge = document.getElementById("roomBadge");
const touchPad = document.getElementById("touchPad");
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");
const lobby = document.getElementById("lobby");
const joinError = document.getElementById("joinError");
const loveLetter = document.getElementById("loveLetter");

const createRoomBtn = document.getElementById("createRoomBtn");
const createBotBtn = document.getElementById("createBotBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const loverNameInput = document.getElementById("loverName");
const roomCodeInput = document.getElementById("roomCodeInput");

const inviteOverlay = document.getElementById("inviteOverlay");
const incomingCodeElement = document.getElementById("incomingCode");
const copyIncomingCodeBtn = document.getElementById("copyIncomingCodeBtn");
const useIncomingCodeBtn = document.getElementById("useIncomingCodeBtn");

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
let socketReady = false;

const joystickState = { x: 0, y: 0, active: false };

const socket = io(window.location.origin, {
  path: "/socket.io",
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  timeout: 10000,
  autoConnect: true
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

function safeEmit(eventName, payload) {
  if (!socket.connected) return;
  socket.emit(eventName, payload);
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
  return Promise.resolve();
}

function openInviteOverlay(code) {
  if (!code) return;
  incomingCodeElement.textContent = code;
  inviteOverlay.classList.remove("hidden");
  inviteOverlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    inviteOverlay.classList.add("open");
  });
}

function closeInviteOverlay() {
  inviteOverlay.classList.remove("open");
  inviteOverlay.setAttribute("aria-hidden", "true");
  setTimeout(() => inviteOverlay.classList.add("hidden"), 220);
}

function renderInvite(letter, code) {
  if (!letter || !code) return;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`;
  loveLetter.classList.remove("hidden");
  loveLetter.innerHTML = `
    <strong>💌 Share Invite</strong>
    <p>${letter}</p>
    <p><strong>Code:</strong> ${code}</p>
    <div class="invite-row">
      <button id="copyInviteBtn">Copy Invite</button>
      <button id="shareWhatsAppBtn">Share to WhatsApp</button>
    </div>
  `;

  document.getElementById("copyInviteBtn").addEventListener("click", async () => {
    await copyText(`Love Rush invite: ${code} ${inviteUrl}`);
  });

  document.getElementById("shareWhatsAppBtn").addEventListener("click", () => {
    const text = `Love Rush invite 💌%0ARoom code: ${encodeURIComponent(code)}%0A${encodeURIComponent(inviteUrl)}`;
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  });
}

socket.on("connect", () => {
  connected = true;
  socketReady = true;
  setStatus("Connected", "online");
});

socket.on("disconnect", (reason) => {
  connected = false;
  socketReady = false;
  setStatus(`Disconnected (${reason})`, "offline");
});

socket.io.on("reconnect_attempt", () => {
  setStatus("Reconnecting…", "offline");
});

socket.io.on("reconnect", () => {
  connected = true;
  socketReady = true;
  setStatus("Reconnected", "online");
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
  socketReady = false;
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

  if (data.letter) renderInvite(data.letter, data.roomCode);

  lobby.classList.add("compact");
  setStatus(data.mode === "bot-duo" ? "Bot Duo Mode" : "Duo Multiplayer", "online");
});

socket.on("gameUpdate", (data) => {
  players = data.players || {};
  loveItems = data.loveItems || [];
  scores = data.scores || {};
  names = data.names || {};
  if (data.roomCode) setRoom(data.roomCode);
  updateScoreboard();
});

createRoomBtn.addEventListener("click", () => {
  if (!connected) return;
  safeEmit("createRoom", { loverName: getLoverName(), withBot: false });
});

createBotBtn.addEventListener("click", () => {
  if (!connected) return;
  safeEmit("createRoom", { loverName: getLoverName(), withBot: true });
});

joinRoomBtn.addEventListener("click", () => {
  if (!connected) return;
  const code = roomCodeInput.value.toUpperCase().trim();
  safeEmit("joinRoom", { loverName: getLoverName(), roomCode: code });
});

function updateScoreboard() {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  scoresElement.innerHTML = "";

  sorted.forEach(([id, score], index) => {
    const row = document.createElement("div");
    const isYou = id === playerId;
    row.className = `score-row ${isYou ? "is-you" : ""}`;
    row.innerHTML = `<span>${index + 1}. ${isYou ? "You" : names[id] || "Lover"}</span><strong>${score}</strong>`;
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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function resetJoystick() {
  joystickState.x = 0;
  joystickState.y = 0;
  joystickState.active = false;
  joystickKnob.style.left = "50%";
  joystickKnob.style.top = "50%";
}

function moveJoystick(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxRadius = rect.width * 0.3;

  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);

  if (dist > maxRadius) {
    const ratio = maxRadius / dist;
    dx *= ratio;
    dy *= ratio;
  }

  joystickState.x = clamp(dx / maxRadius, -1, 1);
  joystickState.y = clamp(dy / maxRadius, -1, 1);
  joystickState.active = true;

  joystickKnob.style.left = `${50 + joystickState.x * 30}%`;
  joystickKnob.style.top = `${50 + joystickState.y * 30}%`;
}

if (window.matchMedia("(pointer: coarse)").matches) {
  touchPad.classList.add("visible");
}

joystick.addEventListener("pointerdown", (event) => {
  joystick.setPointerCapture(event.pointerId);
  moveJoystick(event.clientX, event.clientY);
});

joystick.addEventListener("pointermove", (event) => {
  if (!joystickState.active) return;
  moveJoystick(event.clientX, event.clientY);
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  joystick.addEventListener(eventName, resetJoystick);
});

function moveSelf() {
  if (!playerId || !players[playerId]) return;

  const me = players[playerId];
  const speed = 4.7;
  let vx = joystickState.x;
  let vy = joystickState.y;

  if (keys.has("left")) vx -= 1;
  if (keys.has("right")) vx += 1;
  if (keys.has("up")) vy -= 1;
  if (keys.has("down")) vy += 1;

  me.x = clamp(me.x + clamp(vx, -1, 1) * speed, 15, WORLD_WIDTH - 15);
  me.y = clamp(me.y + clamp(vy, -1, 1) * speed, 15, WORLD_HEIGHT - 15);

  if (socketReady) {
    safeEmit("move", { x: me.x, y: me.y });
  }
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
  ctx.shadowBlur = 12 * glow;
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
  ctx.fillStyle = "#0b0b0b";
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
    ctx.fillText("Create or join a room to start", 275, 300);
  }
}

function gameLoop() {
  moveSelf();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

const inviteCode = new URLSearchParams(window.location.search).get("invite");
if (inviteCode) {
  const code = inviteCode.toUpperCase().trim().slice(0, 6);
  roomCodeInput.value = code;
  openInviteOverlay(code);
}

copyIncomingCodeBtn.addEventListener("click", async () => {
  await copyText(incomingCodeElement.textContent);
});

useIncomingCodeBtn.addEventListener("click", () => {
  roomCodeInput.value = incomingCodeElement.textContent;
  closeInviteOverlay();
  roomCodeInput.focus();
});

inviteOverlay.addEventListener("click", (event) => {
  if (event.target === inviteOverlay) closeInviteOverlay();
});
