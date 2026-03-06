const path = require("path");
const express = require("express");
const convexProxyHandler = require("./api/convex");

const app = express();
const publicDir = path.join(__dirname, "Public");

app.use(express.json());
app.post("/api/convex", (req, res) => convexProxyHandler(req, res));

app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
