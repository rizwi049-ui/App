import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const KEY = process.env.OLLAMA_API_KEY;
const ACCESS_CODE = process.env.ACCESS_CODE || "";
const BASE = "https://ollama.com";
const FALLBACK = ["gpt-oss:120b", "gpt-oss:20b", "deepseek-v3.1:671b", "qwen3-coder:480b"];

function guard(req, res, next) {
  if (ACCESS_CODE && req.get("x-access-code") !== ACCESS_CODE) {
    return res.status(401).json({ error: "Wrong access code" });
  }
  next();
}

app.get("/api/models", guard, async (_req, res) => {
  try {
    const r = await fetch(`${BASE}/api/tags`, { headers: { Authorization: `Bearer ${KEY}` } });
    const d = await r.json();
    const names = (d.models || []).map((m) => m.name);
    res.json(names.length ? names : FALLBACK);
  } catch {
    res.json(FALLBACK);
  }
});

app.post("/api/chat", guard, async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "OLLAMA_API_KEY is not set on the server" });
  const { model, messages } = req.body || {};
  try {
    const r = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t || "Upstream error" });
    }
    res.setHeader("Content-Type", "application/x-ndjson");
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e) });
    else res.end();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running on port ${port}`));
