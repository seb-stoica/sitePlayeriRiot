// Server mic (Node 18+, fără dependențe): servește site-ul și face proxy către Riot API.
// Cheia API rămâne pe server, deci nu apare niciodată în browser.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY = process.env.RIOT_API_KEY;
if (!KEY) { console.error("Lipsește RIOT_API_KEY. Vezi README."); process.exit(1); }

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const ALLOWED_HOST = /^[a-z0-9]+\.api\.riotgames\.com$/;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/riot") {
    const host = url.searchParams.get("host") || "";
    const target = url.searchParams.get("path") || "";
    if (!ALLOWED_HOST.test(host) || !target.startsWith("/")) {
      res.writeHead(400); return res.end(JSON.stringify({ error: "Cerere invalidă" }));
    }
    try {
      const r = await fetch(`https://${host}${target}`, { headers: { "X-Riot-Token": KEY } });
      res.writeHead(r.status, { "Content-Type": "application/json" });
      return res.end(await r.text());
    } catch (e) {
      res.writeHead(502); return res.end(JSON.stringify({ error: "Riot API nu răspunde" }));
    }
  }

  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const full = path.join(__dirname, path.normalize(file));
  if (!full.startsWith(__dirname) || !["index.html", "style.css", "script.js"].includes(path.basename(full))) {
    res.writeHead(404); return res.end("Not found");
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Deschide http://localhost:${PORT}`));