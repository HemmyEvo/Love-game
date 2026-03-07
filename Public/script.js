const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const LOVE_SONGS = [
  { id: "1st-song", title: "Need You", artist: "Fireboy DML", streamUrl: "./Fireboy-DML-Need-You-[TrendyBeatz.com].mp3" },
  { id: "2nd-song", title: "Arike", artist: "Kunmie", streamUrl: "./Kunmie-Arike-(TrendyBeatz.com).mp3" },
  { id: "3rd-song", title: "Morenikeji", artist: "Konstant", streamUrl: "./Konstant - Morenikeji.mp3" },
  { id: "4th-song", title: "Those Eyes", artist: "New West", streamUrl: "./New_West_-_Those_Eyes_CeeNaija.com_.mp3" },
  { id: "5th-song", title: "Orente", artist: "Adekunle Gold", streamUrl: "./Adekunle-Gold-Orente--[TunezJam.com].mp3" },
];

// --- AUDIO ---
let audioCtx;
const streamPlayer = new Audio();
streamPlayer.loop = true;
streamPlayer.preload = "auto";
streamPlayer.volume = 0.4;
let soundEnabled = true;
let selectedSongId = LOVE_SONGS[0].id;

function getSongById(songId) {
  return LOVE_SONGS.find(song => song.id === songId) || LOVE_SONGS[0];
}

function updateSoundToggleText() {
  el.soundToggleBtn.textContent = soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
}

function setSelectedSong(songId, shouldPlay = true) {
  const song = getSongById(songId);
  selectedSongId = song.id;
  if (el.songSelect.value !== song.id) el.songSelect.value = song.id;

  let songChanged = false;
  // Only change the source if it's genuinely a different song to prevent glitching/restarting
  if (!streamPlayer.src.includes(song.streamUrl.replace('./', ''))) {
    streamPlayer.src = song.streamUrl;
    songChanged = true;
  }

  if (soundEnabled && shouldPlay) {
    // Only attempt to play if it's paused or the song just changed (stops the glitching loop)
    if (streamPlayer.paused || songChanged) {
      streamPlayer.play().catch(() => { /* Browser autoplay block handling */ });
    }
  }
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (soundEnabled) setSelectedSong(selectedSongId, true);
}

function playCollectSound() {
  if (!audioCtx || !soundEnabled) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

// DOM Elements
const el = {
  loreIntro: document.getElementById("loreIntro"),
  introScroll: document.getElementById("introScroll"),
  enterCastleBtn: document.getElementById("enterCastleBtn"),
  
  hud: document.getElementById("gameHud"),
  timeDisplay: document.getElementById("timeDisplay"),
  scores: document.getElementById("scores"),
  statusPill: document.getElementById("statusPill"),
  roomBadge: document.getElementById("roomBadge"),
  
  lobby: document.getElementById("lobby"),
  lobbyScroll: document.getElementById("lobbyScroll"),
  
  touchPad: document.getElementById("touchPad"),
  joystick: document.getElementById("joystick"),
  joystickKnob: document.getElementById("joystickKnob"),
  joinError: document.getElementById("joinError"),
  
  loverName: document.getElementById("loverName"),
  targetScoreInput: document.getElementById("targetScoreInput"),
  timeLimitInput: document.getElementById("timeLimitInput"),
  songSelect: document.getElementById("songSelect"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  createBotBtn: document.getElementById("createBotBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  readyBtn: document.getElementById("readyBtn"),
  
  pregamePanel: document.getElementById("pregamePanel"),
  pregameStatus: document.getElementById("pregameStatus"),
  partnerChoice: document.getElementById("partnerChoice"),
  
  hostShareModal: document.getElementById("hostShareModal"),
  hostCodeDisplay: document.getElementById("hostCodeDisplay"),
  waShareBtn: document.getElementById("waShareBtn"),
  copyHostCodeBtn: document.getElementById("copyHostCodeBtn"),
  closeHostShareBtn: document.getElementById("closeHostShareBtn"),

  todModal: document.getElementById("todModal"),
  todPromptText: document.getElementById("todPromptText"),
  todAnswerInput: document.getElementById("todAnswerInput"),
  submitTodBtn: document.getElementById("submitTodBtn"),
  todError: document.getElementById("todError"),
  todWaitModal: document.getElementById("todWaitModal"),

  resultModal: document.getElementById("resultModal"),
  resultTitle: document.getElementById("resultTitle"),
  resultBody: document.getElementById("resultBody"),
  todResultBox: document.getElementById("todResultBox"),
  todFinalPrompt: document.getElementById("todFinalPrompt"),
  todFinalAnswer: document.getElementById("todFinalAnswer"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),

  featherPen: document.getElementById("featherPen")
};

// --- SCROLL ANIMATIONS ---
function openScroll(scrollElement) { scrollElement.classList.add("open"); }
function closeScroll(scrollElement, overlayElement, callback) {
  scrollElement.classList.remove("open");
  setTimeout(() => { overlayElement.classList.add("hidden"); if (callback) callback(); }, 1000); 
}

// --- LOCAL STORAGE: FIRST TIME & AUTO-REJOIN ---
const hasVisited = localStorage.getItem("lra-visited");
const savedRoomCode = localStorage.getItem("lra-room-code");

if (hasVisited && !savedRoomCode) {
  // Skip intro, go straight to lobby
  el.loreIntro.classList.add("hidden");
  el.introScroll.classList.remove("open");
  el.lobby.classList.remove("hidden");
  setTimeout(() => openScroll(el.lobbyScroll), 50);
} else if (savedRoomCode) {
  // Auto-rejoin active game
  el.loreIntro.classList.add("hidden");
  el.introScroll.classList.remove("open");
  autoJoinRoom(savedRoomCode);
} else {
  // First time ever playing
  setTimeout(() => openScroll(el.introScroll), 100);
}

el.enterCastleBtn.addEventListener("click", () => {
  localStorage.setItem("lra-visited", "true");
  initAudio();
  closeScroll(el.introScroll, el.loreIntro, () => {
    el.lobby.classList.remove("hidden");
    setTimeout(() => openScroll(el.lobbyScroll), 50);
  });
});

async function autoJoinRoom(code) {
  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.joinRoom, { loverName: getLoverName(), roomCode: code, deviceId: localDeviceId });
    roomCode = code; 
    applyRoomState(data); 
    setStatus("Awake", "online"); 
    if(socket) socket.emit("join-room", roomCode);
    startPolling();
    el.lobby.classList.add("hidden");
    el.lobbyScroll.classList.remove("open");
    el.hud.classList.remove("hidden");
  } catch (e) {
    // Room died while they were away
    localStorage.removeItem("lra-room-code");
    el.lobby.classList.remove("hidden");
    setTimeout(() => openScroll(el.lobbyScroll), 50);
  }
}

LOVE_SONGS.forEach(song => {
  const option = document.createElement("option");
  option.value = song.id;
  option.textContent = `${song.title} — ${song.artist}`;
  el.songSelect.appendChild(option);
});
setSelectedSong(selectedSongId, false);
updateSoundToggleText();

el.songSelect.addEventListener("change", () => setSelectedSong(el.songSelect.value, true));
el.soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) { initAudio(); setSelectedSong(selectedSongId, true); } 
  else { streamPlayer.pause(); }
  updateSoundToggleText();
});

// --- TRUTH OR DARE DATA ---
const naughtyPrompts = [
  { type: "Truth", text: "What is your biggest secret turn-on?" },
  { type: "Truth", text: "What's a naughty fantasy you've never told me about?" },
  { type: "Truth", text: "Where is your favorite place to be kissed?" },
  { type: "Dare", text: "Send me a voice note moaning my name." },
  { type: "Dare", text: "Describe in detail what you want me to do to you later." }
];

// --- GAME LOGIC ---
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;

let activeMaxScore = 20, activeTimeLimit = 60;
let playerId = null, roomCode = null;
let players = {}, renderPlayers = {}, loveItems = [], scores = {}, names = {};
let isGameOver = false, winnerId = null;
let gameStartTime = null, pollTimer = null, todPhaseActive = false;
let isOfflineMode = false;

const CONVEX_PROXY_URL = "/api/convex";
const CONVEX_FUNCTIONS = {
  createRoom: "game:createRoom", joinRoom: "game:joinRoom", move: "game:move",
  getRoomState: "game:getRoomState", setMatchReady: "game:setMatchReady",
  playAgain: "game:playAgain", submitTod: "game:submitTod", leaveRoom: "game:leaveRoom"
};

const localDeviceId = (() => {
  let id = localStorage.getItem("lra-device-id");
  if (!id) { id = `lover-${Math.random().toString(36).slice(2, 11)}`; localStorage.setItem("lra-device-id", id); }
  return id;
})();

const joystickState = { x: 0, y: 0, active: false };
const lastSentMove = { x: null, y: null, socketAt: 0, convexAt: 0 };
const keys = new Set();

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const getLoverName = () => el.loverName.value.trim() || "Wanderer";
const getCustomScore = () => clamp(parseInt(el.targetScoreInput.value) || 20, 5, 99);
const getCustomTime = () => clamp(parseInt(el.timeLimitInput.value) || 60, 15, 300);

// --- SOCKET.IO INITIALIZATION & STATE ---
const socket = window.io ? io() : null;
let socketPositions = {}; // Stores the raw, fast coordinates from the socket

if (socket) {
  socket.on("player-moved", (data) => {
    // Save the partner's fast movement directly to our socket storage
    if (data.playerId !== playerId && !isGameOver) {
      socketPositions[data.playerId] = { x: data.x, y: data.y, timestamp: Date.now() };
    }
  });
}

async function convexCall(kind, path, args = {}) {
  const response = await fetch(CONVEX_PROXY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, path, args }) });
  if (!response.ok) throw new Error(`Convex error`);
  const data = await response.json();
  if (data?.status === "error") throw new Error(data.errorMessage);
  return data?.value ?? data?.result ?? data;
}

function setStatus(text, state = "offline") { el.statusPill.textContent = text; el.statusPill.className = `badge ${state}`; }

function updateScoreboard() {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  el.scores.innerHTML = "";
  sorted.forEach(([id, score]) => {
    const isYou = id === playerId;
    const div = document.createElement("div");
    div.className = `score-row ${isYou ? "is-you" : ""}`;
    div.innerHTML = `<span>${isYou ? "You" : names[id] || "Partner"}</span><span>${score}/${activeMaxScore}</span>`;
    el.scores.appendChild(div);
  });
}

function updateLocalTimer() {
  if (!gameStartTime || isGameOver) return;
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const remaining = Math.max(0, activeTimeLimit - elapsed);
  
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  el.timeDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  
  if (remaining <= 10) el.timeDisplay.parentElement.classList.add("danger");
  else el.timeDisplay.parentElement.classList.remove("danger");

  if (remaining === 0 && isOfflineMode) finishLocalGame();
}

// --- MULTIPLAYER STATE SYNC ---
function handleRoomDestroyed() {
  clearInterval(pollTimer); pollTimer = null; isGameOver = true; roomCode = null;
  localStorage.removeItem("lra-room-code"); // Clear auto-rejoin cache
  el.hud.classList.add("hidden"); el.resultModal.classList.add("hidden"); el.todModal.classList.add("hidden"); el.todWaitModal.classList.add("hidden");
  el.lobby.classList.remove("hidden"); setTimeout(() => openScroll(el.lobbyScroll), 50);
  el.joinError.textContent = "The chamber collapsed! Your partner fled.";
  window.alert("Your partner has left the room.");
  setStatus("Asleep", "offline");
}

function resumeCurrentRoom() {
  setStatus("Awake", "online");
  if (el.hud.classList.contains("hidden") && !isGameOver) {
    closeScroll(el.lobbyScroll, el.lobby, () => el.hud.classList.remove("hidden"));
  }
}

function applyRoomState(data = {}) {
  isGameOver = Boolean(data.isGameOver);
  winnerId = data.winnerId || null; 
  playerId = data.playerId || playerId;
  gameStartTime = data.gameStartTime || null;
  activeMaxScore = data.maxScore || 20; 
  activeTimeLimit = data.timeLimit || 60;
  if (data.selectedSongId) setSelectedSong(data.selectedSongId, true);
  
  if (scores[playerId] !== undefined && data.scores && data.scores[playerId] > scores[playerId]) { playCollectSound(); }

  // We DO NOT override nextPlayers coordinates here anymore. 
  // We let Convex update `players` normally so we don't accidentally freeze the partner.
  players = data.players || {}; 
  
  loveItems = data.loveItems || []; 
  scores = data.scores || {}; 
  names = data.names || {};
  
  el.roomBadge.textContent = `Chamber: ${data.roomCode || roomCode || "—"}`;
  
  if (data.gameStarted && !isGameOver) {
    if(!el.lobby.classList.contains("hidden")) {
      closeScroll(el.lobbyScroll, el.lobby, () => el.hud.classList.remove("hidden"));
    }
  }

  updateScoreboard(); 
  renderPregameInfo(data);

  if (isGameOver) {
    if (data.todData && !data.todData.completed) handleTodPhase(data.todData);
    else showFinalResultModal(data.todData);
  }
}

function renderPregameInfo(data = {}) {
  if (!roomCode || data.gameStarted || isOfflineMode) { el.pregamePanel.classList.add("hidden"); return; }
  el.pregamePanel.classList.remove("hidden");
  const readyPlayers = data.readyPlayers || {};
  const partnerId = Object.keys(names).find(id => id !== playerId);
  el.partnerChoice.textContent = partnerId ? `${names[partnerId] || "Partner"} is ${readyPlayers[partnerId] ? "Ready ✅" : "Not Ready"}` : `Awaiting arrival...`;
}

// --- TRUTH OR DARE PHASE ---
function handleTodPhase(todData) {
  if (todPhaseActive) return;
  todPhaseActive = true; el.hud.classList.add("hidden");
  if (winnerId === "draw") { showFinalResultModal(null); return; }
  
  if (playerId === todData.loserId) {
    el.todPromptText.textContent = `[${todData.isDare ? 'DARE' : 'TRUTH'}] ${todData.prompt}`;
    el.todAnswerInput.value = ""; el.todError.textContent = "";
    el.todModal.classList.remove("hidden");
  } else {
    el.todWaitModal.classList.remove("hidden");
  }
}

el.submitTodBtn.addEventListener("click", async () => {
  const ans = el.todAnswerInput.value.trim();
  if (!ans) { el.todError.textContent = "You cannot defy the spirits! Type an answer."; return; }
  el.submitTodBtn.disabled = true;

  if (isOfflineMode) {
    setTimeout(() => { el.todModal.classList.add("hidden"); showFinalResultModal({ prompt: el.todPromptText.textContent, answer: ans }); }, 500);
  } else {
    try { await convexCall("mutation", CONVEX_FUNCTIONS.submitTod, { roomCode, answer: ans }); el.todModal.classList.add("hidden"); } catch(e) { el.todError.textContent = "Connection lost. Try again."; }
  }
  el.submitTodBtn.disabled = false;
});

function showFinalResultModal(todData) {
  el.todWaitModal.classList.add("hidden"); el.todModal.classList.add("hidden");
  
  if (winnerId === "draw") {
    el.resultTitle.textContent = "Time Has Expired"; el.resultBody.textContent = "It is a draw. The spirits are appeased."; el.todResultBox.classList.add("hidden");
  } else if (winnerId === playerId) {
    el.resultTitle.textContent = "👑 Victorious!"; el.resultBody.textContent = "You conquered the trial. Here is your partner's confession:";
  } else {
    el.resultTitle.textContent = "💀 Defeated"; el.resultBody.textContent = "You have failed... hopefully you enjoyed your punishment!";
  }

  if (todData && todData.answer && winnerId !== "draw") {
    el.todResultBox.classList.remove("hidden"); el.todFinalPrompt.textContent = todData.prompt; el.todFinalAnswer.textContent = `"${todData.answer}"`;
  } else { el.todResultBox.classList.add("hidden"); }

  el.resultModal.classList.remove("hidden");
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!roomCode || isOfflineMode) return;
    try {
      const state = await convexCall("query", CONVEX_FUNCTIONS.getRoomState, { roomCode, playerId });
      if (state) { applyRoomState(state); } else { handleRoomDestroyed(); }
    } catch (e) {}
  }, 1000);
}

// --- OFFLINE/BOT LOGIC ---
function startOfflineMode() {
  initAudio(); isOfflineMode = true; playerId = "local-player"; const botId = "bot-player";
  activeMaxScore = getCustomScore(); activeTimeLimit = getCustomTime();

  players = { [playerId]: { x: 100, y: 100, color: "#8a1c1c" }, [botId]: { x: 860, y: 500, color: "#d4af37" } };
  renderPlayers = { ...players }; names = { [playerId]: getLoverName(), [botId]: "Spirit Bot" }; scores = { [playerId]: 0, [botId]: 0 };
  loveItems = Array.from({ length: 20 }, (_, i) => ({ id: i, x: Math.random() * 900 + 30, y: Math.random() * 540 + 30, type: Math.floor(Math.random() * 4) }));
  
  gameStartTime = Date.now(); isGameOver = false; winnerId = null; todPhaseActive = false; roomCode = "LOCAL";
  setSelectedSong(el.songSelect.value || selectedSongId, true); el.roomBadge.textContent = "Chamber: Spirit Realm";
  
  closeScroll(el.lobbyScroll, el.lobby, () => { el.hud.classList.remove("hidden"); setStatus("Solo Trial", "offline"); updateScoreboard(); });
}

function finishLocalGame() {
  if (isGameOver) return;
  isGameOver = true;
  const p1 = scores[playerId]; const p2 = scores["bot-player"];
  winnerId = p1 > p2 ? playerId : (p2 > p1 ? "bot-player" : "draw");
  
  if (winnerId !== "draw") {
    const promptObj = naughtyPrompts[Math.floor(Math.random() * naughtyPrompts.length)];
    if (winnerId === "bot-player") { handleTodPhase({ loserId: playerId, prompt: promptObj.text, isDare: promptObj.type === "Dare", completed: false }); } 
    else { showFinalResultModal({ prompt: promptObj.text, answer: "*Ancient Spirit Noises* I submit to your power, mortal." }); }
  } else { showFinalResultModal(null); }
}

function runOfflineTick() {
  if (isGameOver) return;
  const bot = players["bot-player"];
  if (bot && loveItems.length > 0) {
    let nearest = loveItems[0]; let minDist = Infinity;
    loveItems.forEach(item => { const d = (item.x - bot.x)**2 + (item.y - bot.y)**2; if (d < minDist) { minDist = d; nearest = item; } });
    bot.x += Math.sign(nearest.x - bot.x) * 1.5; bot.y += Math.sign(nearest.y - bot.y) * 1.5;
  }
  Object.keys(players).forEach(id => {
    const p = players[id];
    for (let i = loveItems.length - 1; i >= 0; i--) {
      const item = loveItems[i];
      if (Math.hypot(p.x - item.x, p.y - item.y) < 30) {
        scores[id]++; if (id === playerId) playCollectSound();
        loveItems.splice(i, 1); loveItems.push({ id: Date.now(), x: Math.random()*900+30, y: Math.random()*540+30, type: Math.floor(Math.random() * 4)});
        updateScoreboard(); if (scores[id] >= activeMaxScore) finishLocalGame();
      }
    }
  });
}

// --- EVENT LISTENERS ---
el.createBotBtn.addEventListener("click", startOfflineMode);

el.createRoomBtn.addEventListener("click", async () => {
  initAudio();
  if (roomCode && playerId && !isOfflineMode && !isGameOver) {
    const shouldLeave = window.confirm(`You are already in room ${roomCode}.\n\nPress OK to leave it and create a new room, or Cancel to resume your current room.`);
    if (!shouldLeave) { resumeCurrentRoom(); return; }
    try { await convexCall("mutation", CONVEX_FUNCTIONS.leaveRoom, { roomCode, playerId }); } catch (e) {}
  }

  isOfflineMode = false;
  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.createRoom, { loverName: getLoverName(), deviceId: localDeviceId, maxScore: getCustomScore(), timeLimit: getCustomTime(), selectedSongId: el.songSelect.value });
    roomCode = data.roomCode; applyRoomState(data); setStatus("Awake", "online");
    el.hostCodeDisplay.textContent = roomCode; el.hostShareModal.classList.remove("hidden");
    
    localStorage.setItem("lra-room-code", roomCode); // Save for auto-rejoin
    if(socket) socket.emit("join-room", roomCode);
    startPolling();
  } catch (e) { el.joinError.textContent = e.message || "Failed to open chamber."; }
});

el.waShareBtn.addEventListener("click", () => {
  const text = encodeURIComponent(`I summon you to the Castle of Hearts 🏰\nChamber Code: *${roomCode}*\nEnter here: ${window.location.href}`);
  window.open(`https://wa.me/?text=${text}`, "_blank");
});

el.copyHostCodeBtn.addEventListener("click", () => { navigator.clipboard.writeText(roomCode); el.copyHostCodeBtn.textContent = "Copied!"; setTimeout(() => el.copyHostCodeBtn.textContent = "Copy Code", 2000); });
el.closeHostShareBtn.addEventListener("click", () => el.hostShareModal.classList.add("hidden"));

el.joinRoomBtn.addEventListener("click", async () => {
  initAudio(); const code = el.roomCodeInput.value.toUpperCase().trim(); isOfflineMode = false;
  try {
    const data = await convexCall("mutation", CONVEX_FUNCTIONS.joinRoom, { loverName: getLoverName(), roomCode: code, deviceId: localDeviceId });
    roomCode = code; applyRoomState(data); setStatus("Awake", "online"); 
    
    localStorage.setItem("lra-room-code", roomCode); // Save for auto-rejoin
    if(socket) socket.emit("join-room", roomCode);
    startPolling();
  } catch (e) { el.joinError.textContent = e.message || "Failed to enter chamber."; }
});

el.readyBtn.addEventListener("click", async () => {
  try { await convexCall("mutation", CONVEX_FUNCTIONS.setMatchReady, { roomCode, playerId, ready: true }); el.readyBtn.disabled = true; el.readyBtn.textContent = "Awaiting ritual start..."; } 
  catch (e) { el.joinError.textContent = "Failed to signify readiness."; }
});

el.playAgainBtn.addEventListener("click", async () => {
  el.resultModal.classList.add("hidden");
  if (isOfflineMode) { startOfflineMode(); return; }
  try { const data = await convexCall("mutation", CONVEX_FUNCTIONS.playAgain, { roomCode, playerId }); el.readyBtn.disabled = false; el.readyBtn.textContent = "I am Ready"; todPhaseActive = false; applyRoomState(data); } catch(e) {}
});

el.leaveRoomBtn.addEventListener("click", async () => {
  localStorage.removeItem("lra-room-code"); // Clear auto-rejoin cache
  if(roomCode && playerId && !isOfflineMode) { try { await convexCall("mutation", CONVEX_FUNCTIONS.leaveRoom, { roomCode, playerId }); } catch(e) {} }
  window.location.reload();
});

// --- MOVEMENT & RENDER LOOP ---
document.addEventListener("keydown", e => { const m = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" }; if (m[e.code]) keys.add(m[e.code]); });
document.addEventListener("keyup", e => { const m = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" }; if (m[e.code]) keys.delete(m[e.code]); });

const moveJoystick = (clientX, clientY) => {
  const rect = el.joystick.getBoundingClientRect(); const maxRadius = rect.width * 0.4;
  let dx = clientX - (rect.left + rect.width / 2), dy = clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy); if (dist > maxRadius) { dx *= maxRadius/dist; dy *= maxRadius/dist; }
  joystickState.x = clamp(dx / maxRadius, -1, 1); joystickState.y = clamp(dy / maxRadius, -1, 1); joystickState.active = true;
  el.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
};

el.joystick.addEventListener("pointerdown", e => { el.joystick.setPointerCapture(e.pointerId); moveJoystick(e.clientX, e.clientY); });
el.joystick.addEventListener("pointermove", e => { if (joystickState.active) moveJoystick(e.clientX, e.clientY); });
["pointerup", "pointercancel"].forEach(ev => el.joystick.addEventListener(ev, () => { joystickState.active = false; joystickState.x = 0; joystickState.y = 0; el.joystickKnob.style.transform = `translate(-50%, -50%)`; }));

async function sendMove(x, y) {
  if (isOfflineMode || !roomCode || !playerId || isGameOver) return;
  const now = Date.now(); 

  // Fast emit to Socket.io for immediate visual update (~60 FPS)
  if (socket && now - lastSentMove.socketAt >= 16) {
    socket.emit("player-move", { roomCode, playerId, x, y });
    lastSentMove.socketAt = now;
  }

  // Slower emit to Convex to process collisions and game state in the DB (~10 FPS)
  if (now - lastSentMove.convexAt >= 100) {
    lastSentMove.convexAt = now;
    try { await convexCall("mutation", CONVEX_FUNCTIONS.move, { roomCode, playerId, x, y }); } catch (e) {}
  }
}

function moveSelf() {
  if (!playerId || !players[playerId] || isGameOver || !gameStartTime) return;
  const me = players[playerId]; const speed = 5.0;
  let vx = joystickState.x, vy = joystickState.y;
  if (keys.has("left")) vx -= 1; if (keys.has("right")) vx += 1; if (keys.has("up")) vy -= 1; if (keys.has("down")) vy += 1;
  me.x = clamp(me.x + clamp(vx, -1, 1) * speed, 20, WORLD_WIDTH - 20); me.y = clamp(me.y + clamp(vy, -1, 1) * speed, 20, WORLD_HEIGHT - 20);
  
  if (!isOfflineMode) sendMove(me.x, me.y);
}

function drawHeart(x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 40, size / 40);
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(0, -6, -20, -6, -20, 10);
  ctx.bezierCurveTo(-20, 22, -5, 30, 0, 36); ctx.bezierCurveTo(5, 30, 20, 22, 20, 10);
  ctx.bezierCurveTo(20, -6, 0, -6, 0, 10); ctx.closePath();
  ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  loveItems.forEach(item => drawHeart(item.x, item.y, 18, ["#8a1c1c", "#a67c52", "#d4af37", "#5a382c"][item.type] || "#fff"));
  Object.entries(renderPlayers).forEach(([id, p]) => {
    const mine = id === playerId; drawHeart(p.x, p.y, mine ? 36 : 30, p.color);
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "600 14px Merienda, cursive"; ctx.textAlign = "center";
    ctx.fillText(mine ? "You" : names[id], p.x, p.y - 25);
  });
}

// --- AUTO PAUSE/RESUME ON TAB CHANGE ---
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { streamPlayer.pause(); } 
  else { if (soundEnabled) { streamPlayer.play().catch(() => {}); } }
});

function gameLoop() {
  moveSelf(); 
  if (isOfflineMode) { runOfflineTick(); }

  // MERGE LOGIC: Trust Socket first, fallback to Convex
  Object.keys(players).forEach(id => {
    const convexPos = players[id];
    
    if (!renderPlayers[id]) { renderPlayers[id] = { ...convexPos }; }

    if (id === playerId) {
      // It's me. Use my local immediate coordinates.
      renderPlayers[id].x = convexPos.x;
      renderPlayers[id].y = convexPos.y;
    } else {
      // It's the partner. Check if we have a fresh Socket coordinate (< 500ms old)
      const sockPos = socketPositions[id];
      if (sockPos && (Date.now() - sockPos.timestamp < 500)) {
        renderPlayers[id].x = sockPos.x;
        renderPlayers[id].y = sockPos.y;
      } else {
        // Fallback to Convex if Socket is lagging or dead
        renderPlayers[id].x = convexPos.x;
        renderPlayers[id].y = convexPos.y;
      }
    }
    renderPlayers[id].color = convexPos.color; // Always pull color from Convex
  });
  
  draw(); 
  requestAnimationFrame(gameLoop);
}

setInterval(updateLocalTimer, 1000);
gameLoop();