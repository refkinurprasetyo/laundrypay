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
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
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

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
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
    if (!url.startsWith("/api/")) return serveStatic(req, res);

    // ---- identitas pengguna dari cookie sesi ----
    const token = parseCookies(req).session;
    const user = db.getSessionUser(token);
    const isOwner = user && user.role === "owner";
    const requireOwner = () => {
      if (!isOwner) { sendJSON(res, 403, { error: "Akses khusus owner" }); return false; }
      return true;
    };

    // ---- endpoint publik (tanpa login) ----
    if (method === "POST" && url === "/api/login") {
      const body = await readBody(req);
      const u = db.authenticate(body.username, body.password);
      if (!u) return sendJSON(res, 401, { error: "Username atau password salah" });
      const t = db.createSession(u.id);
      res.setHeader("Set-Cookie", `session=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
      return sendJSON(res, 200, u);
    }
    if (method === "POST" && url === "/api/logout") {
      db.deleteSession(token);
      res.setHeader("Set-Cookie", `session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "GET" && url === "/api/me") {
      if (!user) return sendJSON(res, 401, { error: "Belum login" });
      return sendJSON(res, 200, user);
    }

    // ---- mulai sini wajib login ----
    if (!user) return sendJSON(res, 401, { error: "Belum login" });

    // ------- SERVICES -------
    if (url === "/api/services") {
      if (method === "GET") return sendJSON(res, 200, db.listServices());
      if (method === "POST") {
        if (!requireOwner()) return;
        return sendJSON(res, 201, db.createService(await readBody(req)));
      }
    }
    let m = url.match(/^\/api\/services\/([^/]+)$/);
    if (m) {
      if (!requireOwner()) return;
      const id = decodeURIComponent(m[1]);
      if (method === "PATCH") {
        const upd = db.updateService(id, await readBody(req));
        if (!upd) return sendJSON(res, 404, { error: "Layanan tidak ditemukan" });
        return sendJSON(res, 200, upd);
      }
      if (method === "DELETE") {
        return sendJSON(res, 200, { ok: db.deleteService(id) });
      }
    }

    // ------- ORDERS -------
    if (url === "/api/orders") {
      if (method === "GET") return sendJSON(res, 200, db.listOrders());
      if (method === "POST") return sendJSON(res, 201, db.createOrder(await readBody(req)));
    }
    m = url.match(/^\/api\/orders\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === "PATCH") {
        const upd = db.updateOrder(id, await readBody(req));
        if (!upd) return sendJSON(res, 404, { error: "Pesanan tidak ditemukan" });
        return sendJSON(res, 200, upd);
      }
      if (method === "DELETE") {
        if (!requireOwner()) return; // hapus pesanan hanya owner
        const ok = db.deleteOrder(id);
        if (!ok) return sendJSON(res, 404, { error: "Pesanan tidak ditemukan" });
        return sendJSON(res, 200, { ok: true });
      }
    }

    // ------- LAPORAN (owner) -------
    if (method === "GET" && url === "/api/report") {
      if (!requireOwner()) return;
      return sendJSON(res, 200, db.report());
    }

    // ------- USERS (owner) -------
    if (url === "/api/users") {
      if (!requireOwner()) return;
      if (method === "GET") return sendJSON(res, 200, db.listUsers());
      if (method === "POST") {
        const b = await readBody(req);
        return sendJSON(res, 201, db.createUser(b.username, b.password, b.role));
      }
    }
    m = url.match(/^\/api\/users\/(\d+)$/);
    if (m) {
      if (!requireOwner()) return;
      const id = Number(m[1]);
      if (method === "DELETE") {
        if (id === user.id) return sendJSON(res, 400, { error: "Tidak bisa menghapus akun sendiri" });
        const target = db.getUser(id);
        if (target && target.role === "owner" && db.countOwners() <= 1)
          return sendJSON(res, 400, { error: "Minimal harus ada 1 owner" });
        return sendJSON(res, 200, { ok: db.deleteUser(id) });
      }
      if (method === "PATCH") {
        const b = await readBody(req);
        return sendJSON(res, 200, { ok: db.setPassword(id, b.password) });
      }
    }

    return sendJSON(res, 404, { error: "Endpoint tidak ditemukan" });
  } catch (err) {
    return sendJSON(res, 400, { error: err.message || "Terjadi kesalahan" });
  }
});

server.listen(PORT, () => {
  console.log(`LaundryPay berjalan di http://localhost:${PORT}`);
});
