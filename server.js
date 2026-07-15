// server.js — Backend LaundryPay (hanya pakai modul bawaan Node.js)
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function sendJSON(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("Payload terlalu besar"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error("JSON tidak valid")); }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  // cegah keluar dari folder public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Tidak ditemukan");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = req.url.split("?")[0];

  try {
    // ---------- API ----------
    if (url.startsWith("/api/")) {
      if (method === "GET" && url === "/api/services") {
        return sendJSON(res, 200, db.listServices());
      }
      if (method === "GET" && url === "/api/orders") {
        return sendJSON(res, 200, db.listOrders());
      }
      if (method === "GET" && url === "/api/report") {
        return sendJSON(res, 200, db.report());
      }
      if (method === "POST" && url === "/api/orders") {
        const body = await readBody(req);
        const order = db.createOrder(body);
        return sendJSON(res, 201, order);
      }
      const m = url.match(/^\/api\/orders\/([^/]+)$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (method === "PATCH") {
          const body = await readBody(req);
          const updated = db.updateOrder(id, body);
          if (!updated) return sendJSON(res, 404, { error: "Pesanan tidak ditemukan" });
          return sendJSON(res, 200, updated);
        }
        if (method === "DELETE") {
          const ok = db.deleteOrder(id);
          if (!ok) return sendJSON(res, 404, { error: "Pesanan tidak ditemukan" });
          return sendJSON(res, 200, { ok: true });
        }
      }
      return sendJSON(res, 404, { error: "Endpoint tidak ditemukan" });
    }

    // ---------- File statis (frontend) ----------
    return serveStatic(req, res);
  } catch (err) {
    return sendJSON(res, 400, { error: err.message || "Terjadi kesalahan" });
  }
});

server.listen(PORT, () => {
  console.log(`LaundryPay berjalan di http://localhost:${PORT}`);
});
