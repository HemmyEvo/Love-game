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
const maxScoreInput = document.getElementById("maxScoreInput");
const targetScoreLabel = document.getElementById("targetScoreLabel");

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
let pendingRoomCreation = false;
let isOfflineMode = false;
let targetScore = 15;
let isGameOver = false;
let winnerId = null;
let pollTimer = null;

const REALTIME_PROVIDER = "convex";
const CONVEX_HTTP_URL = "https://rugged-alpaca-539.convex.site";
const CONVEX_DEPLOY_KEY = "dev:rugged-alpaca-539|eyJ2MiI6IjRiYzhmOTZkN2NjNDRmYzBiNTI3ZjAyN2U5YjliYmYxIn0=";
const CONVEX_FUNCTIONS = {
  createRoom: "game:createRoom",
  joinRoom: "game:joinRoom",
  move: "game:move",
  getRoomState: "game:getRoomState",
  validateInvitation: "game:validateInvitation",
};

const DEVICE_ID_KEY = "love-rush-device-id";
const localDeviceId = (() => {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `lover-${Math.random().toString(36).slice(2, 11)}`;
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
})();

const urlParams = new URLSearchParams(window.location.search);
const invitedRoomCodeFromLink = (urlParams.get("room") || "")
  .toUpperCase()
  .trim()
  .slice(0, 6);
const inviteTokenFromLink = (urlParams.get("invite") || "")
  .toUpperCase()
  .trim();

const joystickState = { x: 0, y: 0, active: false };

async function convexCall(kind, path, args = {}) {
  const response = await fetch(`${CONVEX_HTTP_URL}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${CONVEX_DEPLOY_KEY}`,
    },
    body: JSON.stringify({ path, args }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Convex ${kind} failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  if (data?.status === "error") {
    throw new Error(data.errorMessage || `Convex ${kind} error`);
  }

  return data?.value ?? data?.result ?? data;
}

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

function getTargetScore() {
  const value = Number.parseInt(maxScoreInput.value, 10);
  if (Number.isNaN(value)) return 15;
  return clamp(value, 3, 99);
}

function setTargetScore(value) {
  targetScore = clamp(Number(value) || 15, 3, 99);
  targetScoreLabel.textContent = `First to ${targetScore}`;
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

function applyRoomState(data = {}) {
  isOfflineMode = false;
  isGameOver = Boolean(data.isGameOver);
  winnerId = data.winnerId || null;
  playerId = data.playerId || playerId;
  players = data.players || {};
  loveItems = data.loveItems || [];
  scores = data.scores || {};
  names = data.names || {};
  setTargetScore(data.maxScore || targetScore || 15);
  setRoom(data.roomCode || roomCode);
  updateScoreboard();
  checkForWinnerFromScores();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!roomCode || isOfflineMode) return;
    try {
      const state = await convexCall("query", CONVEX_FUNCTIONS.getRoomState, {
        roomCode,
        playerId,
      });
      if (state) applyRoomState(state);
    } catch (_error) {
      // Keep rendering local frame even if one poll fails.
    }
  }, 80);
}

async function checkConvexHealth() {
  if (!CONVEX_HTTP_URL || !CONVEX_DEPLOY_KEY) {
    connected = false;
    setStatus("Convex config missing", "offline");
    return;
  }

  try {
    await convexCall("query", CONVEX_FUNCTIONS.getRoomState, { roomCode: "", playerId: "" });
    connected = true;
    setStatus("Connected (Convex Realtime)", "online");
  } catch (_error) {
    connected = true;
    setStatus("Connected (Convex Realtime)", "online");
  }
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
  setTargetScore(15);
  isGameOver = false;
  winnerId = null;
  updateScoreboard();
  joinError.textContent = "";
  lobby.classList.add("compact");
  setStatus("Offline Bot Mode", "offline");
}

function finishLocalGame(winningPlayerId, winningTargetScore = targetScore) {
  if (isGameOver) return;

  isGameOver = true;
  winnerId = winningPlayerId;

  const winnerName = names[winningPlayerId] || "Lover";
  const wonByYou = winningPlayerId === playerId;

  joinError.textContent = wonByYou
    ? `You won! Reached ${winningTargetScore} 💖`
    : `${winnerName} won by reaching ${winningTargetScore}.`;

  setStatus("Game finished", "offline");
}

function checkForWinnerFromScores() {
  if (isGameOver) return;

  const reachedGoal = Object.entries(scores).find(([, score]) => Number(score) >= targetScore);
  if (!reachedGoal) return;

  const [winningPlayerId] = reachedGoal;
  finishLocalGame(winningPlayerId, targetScore);
}

function runOfflineTick() {
  if (isGameOver) return;

  const botId = "local-bot";
  const bot = players[botId];

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

  Object.keys(players).forEach((id) => {
    const player = players[id];
    for (let i = loveItems.length - 1; i >= 0; i -= 1) {
      const item = loveItems[i];
      if (Math.hypot(player.x - item.x, player.y - item.y) < 30) {
        scores[id] = (scores[id] || 0) + 1;
        loveItems.splice(i, 1);
        loveItems.push(createLoveItem(i));
        updateScoreboard();

        if (scores[id] >= targetScore) {
          finishLocalGame(id, targetScore);
          return;
        }
      }
    }
  });
}
// ---------------------

createRoomBtn.addEventListener("click", async () => {
  if (!connected) {
    joinError.textContent = "You must be connected to the internet to play with a friend.";
    return;
  }

  pendingRoomCreation = true;
  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.createRoom, {
      loverName: getLoverName(),
      withBot: false,
      maxScore: getTargetScore(),
      deviceId: localDeviceId,
    });

    applyRoomState(data);
    if (pendingRoomCreation && data?.letter && data?.inviteCode) {
      renderInvite(data.letter, data.roomCode, data.inviteCode);
    }
    pendingRoomCreation = false;
    joinError.textContent = "";
    lobby.classList.add("compact");
    setStatus("Duo Multiplayer", "online");
    startPolling();
  } catch (error) {
    pendingRoomCreation = false;
    joinError.textContent = error?.message || "Could not create room.";
  }
});

createBotBtn.addEventListener("click", async () => {
  if (!connected) {
    startOfflineMode();
    return;
  }

  pendingRoomCreation = true;
  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.createRoom, {
      loverName: getLoverName(),
      withBot: true,
      maxScore: getTargetScore(),
      deviceId: localDeviceId,
    });

    applyRoomState(data);
    if (pendingRoomCreation && data?.letter && data?.inviteCode) {
      renderInvite(data.letter, data.roomCode, data.inviteCode);
    }
    pendingRoomCreation = false;
    joinError.textContent = "";
    lobby.classList.add("compact");
    setStatus("Bot Duo Mode", "online");
    startPolling();
  } catch (_error) {
    pendingRoomCreation = false;
    startOfflineMode();
  }
});

joinRoomBtn.addEventListener("click", async () => {
  if (!connected) {
    joinError.textContent = "You must be connected to the internet to join a room.";
    return;
  }

  pendingRoomCreation = false;
  const code = roomCodeInput.value.toUpperCase().trim();

  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.joinRoom, {
      loverName: getLoverName(),
      roomCode: code,
      deviceId: localDeviceId,
    });

    applyRoomState(data);
    joinError.textContent = "";
    lobby.classList.add("compact");
    setStatus(data?.mode === "bot-duo" ? "Bot Duo Mode" : "Duo Multiplayer", "online");
    startPolling();
  } catch (error) {
    joinError.textContent = error?.message || "Could not join room.";
  }
});

maxScoreInput.addEventListener("change", () => {
  maxScoreInput.value = String(getTargetScore());
  setTargetScore(getTargetScore());
});

setTargetScore(getTargetScore());
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

async function sendMoveUpdate(x, y) {
  if (!connected || isOfflineMode || !roomCode || !playerId || isGameOver) return;
  try {
    await convexCall("mutation", CONVEX_FUNCTIONS.move, { roomCode, playerId, x, y });
  } catch (_error) {
    // Ignore transient realtime write errors.
  }
}

function moveSelf() {
  if (!playerId || !players[playerId] || isGameOver) return;

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

  if (!isOfflineMode) {
    sendMoveUpdate(me.x, me.y);
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
    const data = await convexCall("query", CONVEX_FUNCTIONS.validateInvitation, {
      roomCode: invitedRoomCodeFromLink,
      inviteCode: inviteTokenFromLink,
    });

    if (!data?.invited || !data?.roomCode) return;

    roomCodeInput.value = data.roomCode;
    openInviteOverlay(data.roomCode);
  } catch (_error) {
    // Fail silently if invitation check is temporarily unavailable.
  }
}

checkConvexHealth();
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
