const rawConvexUrl = process.env.CONVEX_HTTP_URL || "https://rugged-alpaca-539.convex.site";
const CONVEX_HTTP_URL = rawConvexUrl.includes(".convex.site")
  ? rawConvexUrl.replace(".convex.site", ".convex.cloud")
  : rawConvexUrl;
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY
  || "dev:rugged-alpaca-539|eyJ2MiI6IjRiYzhmOTZkN2NjNDRmYzBiNTI3ZjAyN2U5YjliYmYxIn0=";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const kind = String(body.kind || req.query.kind || "").toLowerCase();
  if (kind !== "query" && kind !== "mutation") {
    res.status(400).json({ error: "Invalid Convex API kind" });
    return;
  }

  try {
    const response = await fetch(`${CONVEX_HTTP_URL}/api/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${CONVEX_DEPLOY_KEY}`,
      },
      body: JSON.stringify({ path: body.path, args: body.args || {} }),
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = { error: raw };
    }

    res.status(response.status).json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Convex proxy request failed",
      details: error?.message || String(error),
    });
  }
};
