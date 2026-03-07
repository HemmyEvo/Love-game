const path = require("path");
const express = require("express");
const http = require("http"); // Added for Socket.io
const { Server } = require("socket.io"); // Added for Socket.io
const convexProxyHandler = require("./api/convex");

const app = express();
const server = http.createServer(app); // Wrap express
const io = new Server(server); // Initialize Socket.io

const publicDir = path.join(__dirname, "Public");

app.use(express.json());
app.post("/api/convex", (req, res) => convexProxyHandler(req, res));

app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// --- SOCKET.IO GAMEPLAY LOGIC ---
io.on("connection", (socket) => {
  // Join a specific game chamber
  socket.on("join-room", (roomCode) => {
    socket.join(roomCode);
  });

  // Receive movement from one player and broadcast to the other
  socket.on("player-move", (data) => {
    // data contains: { roomCode, playerId, x, y }
    socket.to(data.roomCode).emit("player-moved", data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});