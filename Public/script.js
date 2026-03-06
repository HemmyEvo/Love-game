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
let pendingRoomCreation = false;
let isOfflineMode = false; // New flag for offline play

const urlParams = new URLSearchParams(window.location.search);
const invitedRoomCodeFromLink = (urlParams.get("room") || "")
  .toUpperCase()
  .trim()
  .slice(0, 6);
const inviteTokenFromLink = (urlParams.get("invite") || "")
  .toUpperCase()
  .trim();

const joystickState = { x: 0, y: 0, active: false };

const socket = io(window.location.origin, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  timeout: 20000,
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
  inviteOverlay.classList.remove("open");
  inviteOverlay.setAttribute("aria-hidden", "false");
  void inviteOverlay.offsetWidth;
  setTimeout(() => {
    inviteOverlay.classList.add("open");
  }, 60);
}

function closeInviteOverlay() {
  inviteOverlay.classList.remove("open");
  inviteOverlay.setAttribute("aria-hidden", "true");
}

function renderInvite(letter, code, inviteCode) {
  if (!letter || !code || !inviteCode) return;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}&invite=${encodeURIComponent(inviteCode)}`;
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
    const message = `Love Rush invite 💌\nRoom code: ${code}\n${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
}

// --- OFFLINE LOGIC ---
function createLoveItem(seed = 0) {
  return {
    id: `${Date.now()}-${Math.random()}-${seed}`,
    x: Math.random() * (WORLD_WIDTH - 24) + 12,
    y: Math.random() * (WORLD_HEIGHT - 24) + 12,
    type: Math.floor(Math.random() * 4)
  };
}

function startOfflineMode() {
  isOfflineMode = true;
  playerId = "local-player";
  const botId = "local-bot";

  players = {
    [playerId]: {
      x: Math.random() * (WORLD_WIDTH - 100) + 50,
      y: Math.random() * (WORLD_HEIGHT - 100) + 50,
      color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`
    },
    [botId]: { x: 160, y: 140, color: "#92ccff" }
  };

  names = {
    [playerId]: getLoverName(),
    [botId]: "Cupid Bot (Offline)"
  };

  scores = {
    [playerId]: 0,
    [botId]: 0
  };

  loveItems = Array.from({ length: 22 }, (_, i) => createLoveItem(i));

  setRoom("OFFLINE");
  updateScoreboard();
  joinError.textContent = "";
  lobby.classList.add("compact");
  setStatus("Offline Bot Mode", "offline");
}

function runOfflineTick() {
  const botId = "local-bot";
  const bot = players[botId];

  // Offline Bot AI
  if (bot && loveItems.length > 0) {
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

  // Offline Collisions
  Object.keys(players).forEach((id) => {
    const player = players[id];
    for (let i = loveItems.length - 1; i >= 0; i -= 1) {
      const item = loveItems[i];
      if (Math.hypot(player.x - item.x, player.y - item.y) < 30) {
        scores[id] = (scores[id] || 0) + 1;
        loveItems.splice(i, 1);
        loveItems.push(createLoveItem(i));
        updateScoreboard();
      }
    }
  });
}
// ---------------------

socket.on("connect", () => {
  connected = true;
  socketReady = true;
  if (!isOfflineMode) setStatus("Connected", "online");
});

socket.on("disconnect", (reason) => {
  connected = false;
  socketReady = false;
  if (!isOfflineMode) setStatus(`Disconnected (${reason})`, "offline");
});

socket.io.on("reconnect_attempt", () => {
  if (!isOfflineMode) setStatus("Reconnecting…", "offline");
});

socket.io.on("reconnect", () => {
  connected = true;
  socketReady = true;
  if (!isOfflineMode) setStatus("Reconnected", "online");
});

socket.on("connect_error", () => {
  connected = false;
  socketReady = false;
  if (!isOfflineMode) setStatus("Connection failed", "offline");
});

socket.on("joinError", ({ message }) => {
  joinError.textContent = message;
});

socket.on("init", (data) => {
  isOfflineMode = false; // Reset offline flag if we join an online game
  playerId = data.playerId;
  players = data.players;
  loveItems = data.loveItems;
  scores = data.scores;
  names = data.names;
  setRoom(data.roomCode);
  updateScoreboard();
  joinError.textContent = "";

  if (pendingRoomCreation && data.letter && data.inviteCode) {
    renderInvite(data.letter, data.roomCode, data.inviteCode);
  }
  pendingRoomCreation = false;

  lobby.classList.add("compact");
  setStatus(data.mode === "bot-duo" ? "Bot Duo Mode" : "Duo Multiplayer", "online");
});

socket.on("gameUpdate", (data) => {
  if (isOfflineMode) return; // Ignore server updates if playing offline
  players = data.players || {};
  loveItems = data.loveItems || [];
  scores = data.scores || {};
  names = data.names || {};
  if (data.roomCode) setRoom(data.roomCode);
  updateScoreboard();
});

createRoomBtn.addEventListener("click", () => {
  if (!connected) {
    joinError.textContent = "You must be connected to the internet to play with a friend.";
    return;
  }
  pendingRoomCreation = true;
  safeEmit("createRoom", { loverName: getLoverName(), withBot: false });
});

createBotBtn.addEventListener("click", () => {
  if (!connected) {
    startOfflineMode(); // Launch offline mode if socket drops
    return;
  }
  pendingRoomCreation = true;
  safeEmit("createRoom", { loverName: getLoverName(), withBot: true });
});

joinRoomBtn.addEventListener("click", () => {
  if (!connected) {
    joinError.textContent = "You must be connected to the internet to join a room.";
    return;
  }
  pendingRoomCreation = false;
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

  if (socketReady && !isOfflineMode) {
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
  
  if (isOfflineMode) {
    runOfflineTick();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

async function maybeShowInvitationOverlay() {
  if (!invitedRoomCodeFromLink || !inviteTokenFromLink) return;

  try {
    const response = await fetch(`/api/invitation?roomCode=${encodeURIComponent(invitedRoomCodeFromLink)}&inviteCode=${encodeURIComponent(inviteTokenFromLink)}`);
    if (!response.ok) return;

    const data = await response.json();
    if (!data.invited || !data.roomCode) return;

    roomCodeInput.value = data.roomCode;
    openInviteOverlay(data.roomCode);
  } catch (_error) {
    // Fail silently if invitation check is temporarily unavailable.
  }
}

maybeShowInvitationOverlay();

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
