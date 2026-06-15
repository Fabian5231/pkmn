// Kleiner TTB-Tracker-Server – ohne externe Abhängigkeiten.
// Liefert index.html aus und speichert die Daten automatisch in data.json.
//
// Start:  node server.js     (dann http://localhost:3000 öffnen)

const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");

// Startdaten, falls noch keine data.json existiert
const SEED = [
  { name: "Karmesin & Purpur", qty: 1, paid: 59.99, value: 125 },
  { name: "Fatale Flammen TTB", qty: 2, paid: 64.99, value: 114 },
  { name: "Karmesin & Purpur (Maskerade im Zwielicht)", qty: 2, paid: 64.99, value: 115 },
  { name: "Erhabene Helden (6er Booster)", qty: 2, paid: 50.00, value: 67 }
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function readItems() {
  try {
    const text = await fs.readFile(DATA_FILE, "utf8");
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : SEED;
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(SEED, null, 2));
    return SEED;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5_000_000) req.destroy(); // simpler Schutz
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": MIME[".json"] });
  res.end(body);
}

async function serveStatic(res, urlPath) {
  // Pfad absichern: keine Verzeichniswechsel nach oben
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(ROOT, safe === "/" || safe === "\\" ? "index.html" : safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nicht gefunden");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // --- API: Daten lesen/schreiben ---
  if (url.pathname === "/api/items") {
    if (req.method === "GET") {
      return sendJson(res, 200, await readItems());
    }
    if (req.method === "PUT" || req.method === "POST") {
      try {
        const body = await readBody(req);
        const data = JSON.parse(body);
        if (!Array.isArray(data)) throw new Error("Erwarte ein Array");
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return sendJson(res, 200, { ok: true, count: data.length });
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
      }
    }
    res.writeHead(405); return res.end("Method Not Allowed");
  }

  // --- Statische Dateien (index.html etc.) ---
  if (req.method === "GET") return serveStatic(res, url.pathname);
  res.writeHead(405); res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`TTB-Tracker läuft auf  http://localhost:${PORT}`);
  console.log(`Daten werden gespeichert in:  ${DATA_FILE}`);
});
