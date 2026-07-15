// db.js — Database SQLite (bawaan Node.js, tanpa dependency tambahan)
"use strict";

const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

// Lokasi file database bisa diatur lewat variabel DB_PATH (dipakai saat deploy
// dengan disk permanen). Default: folder ./data di dalam proyek.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "laundry.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// ---- Skema tabel ----
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id      TEXT PRIMARY KEY,
    nama    TEXT NOT NULL,
    harga   INTEGER NOT NULL,
    satuan  TEXT NOT NULL,
    urutan  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    nama          TEXT NOT NULL,
    hp            TEXT,
    layanan_id    TEXT NOT NULL,
    layanan_nama  TEXT NOT NULL,
    harga_satuan  INTEGER NOT NULL,
    satuan        TEXT NOT NULL,
    qty           REAL NOT NULL,
    subtotal      INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'proses',
    lunas         INTEGER NOT NULL DEFAULT 0,
    metode        TEXT,
    tanggal       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS counters (
    nama  TEXT PRIMARY KEY,
    nilai INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    salt       TEXT NOT NULL,
    hash       TEXT NOT NULL,
    role       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// ---- Bantuan password (enkripsi scrypt bawaan Node) ----
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const calc = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const a = Buffer.from(calc, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Data awal layanan (hanya sekali) ----
if (db.prepare("SELECT COUNT(*) AS n FROM services").get().n === 0) {
  const insS = db.prepare(
    "INSERT INTO services (id, nama, harga, satuan, urutan) VALUES (?, ?, ?, ?, ?)"
  );
  [
    ["cuci_kering", "Cuci Kering", 5000, "kg", 1],
    ["cuci_setrika", "Cuci + Setrika", 7000, "kg", 2],
    ["setrika", "Setrika Saja", 4000, "kg", 3],
    ["express", "Cuci Express (6 jam)", 12000, "kg", 4],
    ["bedcover", "Bed Cover / Selimut", 20000, "pcs", 5],
  ].forEach((r) => insS.run(...r));
}

if (db.prepare("SELECT COUNT(*) AS n FROM counters WHERE nama='invoice'").get().n === 0) {
  db.prepare("INSERT INTO counters (nama, nilai) VALUES ('invoice', 0)").run();
}

// ---- Akun owner awal (username: owner / password: owner123) ----
if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0) {
  createUser("owner", "owner123", "owner");
}

// ---- Contoh pesanan (hanya sekali) ----
if (db.prepare("SELECT COUNT(*) AS n FROM orders").get().n === 0) {
  const now = Date.now();
  const iso = (h) => new Date(now - h * 3600 * 1000).toISOString();
  createOrder({ nama: "Andi Saputra", hp: "0812-1111-2222", layananId: "cuci_setrika", qty: 3.5, status: "diambil", tanggal: iso(26), lunas: 1, metode: "tunai" });
  createOrder({ nama: "Siti Rahma", hp: "0813-3333-4444", layananId: "express", qty: 2, status: "selesai", tanggal: iso(5), lunas: 1, metode: "transfer" });
  createOrder({ nama: "Budi Hartono", hp: "0857-5555-6666", layananId: "cuci_kering", qty: 5, status: "proses", tanggal: iso(1), lunas: 0, metode: null });
}

// ================= USERS =================
function createUser(username, password, role) {
  username = String(username || "").trim();
  if (!username) throw new Error("Username wajib diisi");
  if (!password || String(password).length < 4) throw new Error("Password minimal 4 karakter");
  if (!["owner", "kasir"].includes(role)) role = "kasir";
  if (db.prepare("SELECT 1 FROM users WHERE lower(username)=lower(?)").get(username))
    throw new Error("Username sudah dipakai");
  const { salt, hash } = hashPassword(password);
  const info = db.prepare(
    "INSERT INTO users (username, salt, hash, role, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(username, salt, hash, role, new Date().toISOString());
  return { id: Number(info.lastInsertRowid), username, role };
}

function listUsers() {
  return db.prepare("SELECT id, username, role, created_at FROM users ORDER BY role DESC, id").all();
}

function deleteUser(id) {
  return db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0;
}

function countOwners() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='owner'").get().n;
}

function getUser(id) {
  return db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(id);
}

function setPassword(id, password) {
  if (!password || String(password).length < 4) throw new Error("Password minimal 4 karakter");
  const { salt, hash } = hashPassword(password);
  return db.prepare("UPDATE users SET salt=?, hash=? WHERE id=?").run(salt, hash, id).changes > 0;
}

function authenticate(username, password) {
  const u = db.prepare("SELECT * FROM users WHERE lower(username)=lower(?)")
    .get(String(username || "").trim());
  if (!u) return null;
  if (!verifyPassword(password, u.salt, u.hash)) return null;
  return { id: u.id, username: u.username, role: u.role };
}

// ================= SESSIONS =================
function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, userId, new Date().toISOString());
  return token;
}
function getSessionUser(token) {
  if (!token) return null;
  return db.prepare(
    "SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).get(token) || null;
}
function deleteSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ================= SERVICES =================
function listServices() {
  return db.prepare("SELECT * FROM services ORDER BY urutan, nama").all();
}
function getService(id) {
  return db.prepare("SELECT * FROM services WHERE id = ?").get(id);
}
function createService(data) {
  const nama = String(data.nama || "").trim();
  const harga = Math.round(Number(data.harga));
  const satuan = String(data.satuan || "").trim() || "kg";
  if (!nama) throw new Error("Nama layanan wajib diisi");
  if (!(harga >= 0)) throw new Error("Harga tidak valid");
  let id = nama.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "layanan";
  if (db.prepare("SELECT 1 FROM services WHERE id = ?").get(id)) id = id + "_" + Date.now();
  const maxU = db.prepare("SELECT COALESCE(MAX(urutan),0) AS m FROM services").get().m;
  db.prepare("INSERT INTO services (id, nama, harga, satuan, urutan) VALUES (?, ?, ?, ?, ?)")
    .run(id, nama, harga, satuan, maxU + 1);
  return getService(id);
}
function updateService(id, data) {
  const s = getService(id);
  if (!s) return null;
  const nama = data.nama !== undefined ? String(data.nama).trim() : s.nama;
  const harga = data.harga !== undefined ? Math.round(Number(data.harga)) : s.harga;
  const satuan = data.satuan !== undefined ? (String(data.satuan).trim() || s.satuan) : s.satuan;
  if (!nama) throw new Error("Nama layanan wajib diisi");
  if (!(harga >= 0)) throw new Error("Harga tidak valid");
  db.prepare("UPDATE services SET nama=?, harga=?, satuan=? WHERE id=?").run(nama, harga, satuan, id);
  return getService(id);
}
function deleteService(id) {
  return db.prepare("DELETE FROM services WHERE id = ?").run(id).changes > 0;
}

// ================= ORDERS =================
function nextInvoice() {
  db.prepare("UPDATE counters SET nilai = nilai + 1 WHERE nama='invoice'").run();
  const n = db.prepare("SELECT nilai FROM counters WHERE nama='invoice'").get().nilai;
  return "LDR-" + String(n).padStart(4, "0");
}
function listOrders() {
  return db.prepare("SELECT * FROM orders ORDER BY tanggal DESC").all();
}
function getOrder(id) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
}
function createOrder(data) {
  const svc = getService(data.layananId);
  if (!svc) throw new Error("Layanan tidak ditemukan");
  const qty = Number(data.qty);
  if (!data.nama || !String(data.nama).trim()) throw new Error("Nama pelanggan wajib diisi");
  if (!(qty > 0)) throw new Error("Jumlah harus lebih dari 0");

  const id = nextInvoice();
  const subtotal = Math.round(svc.harga * qty);
  const tanggal = data.tanggal || new Date().toISOString();
  const status = data.status || "proses";
  const lunas = data.lunas ? 1 : 0;
  const metode = data.metode || null;

  db.prepare(`
    INSERT INTO orders
      (id, nama, hp, layanan_id, layanan_nama, harga_satuan, satuan, qty, subtotal, status, lunas, metode, tanggal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, String(data.nama).trim(), (data.hp || "").trim(), svc.id, svc.nama, svc.harga, svc.satuan, qty, subtotal, status, lunas, metode, tanggal);

  return getOrder(id);
}
function updateOrder(id, patch) {
  const o = getOrder(id);
  if (!o) return null;
  const status = patch.status ?? o.status;
  const lunas = patch.lunas != null ? (patch.lunas ? 1 : 0) : o.lunas;
  const metode = patch.metode !== undefined ? patch.metode : o.metode;
  db.prepare("UPDATE orders SET status=?, lunas=?, metode=? WHERE id=?").run(status, lunas, metode, id);
  return getOrder(id);
}
function deleteOrder(id) {
  return db.prepare("DELETE FROM orders WHERE id = ?").run(id).changes > 0;
}
function report() {
  const rows = db.prepare("SELECT tanggal, subtotal, lunas FROM orders").all();
  const hariIni = new Date().toISOString().slice(0, 10);
  const bulanIni = hariIni.slice(0, 7);
  let totalHari = 0, totalBulan = 0, totalSemua = 0, belumLunas = 0, jmlLunas = 0;
  for (const r of rows) {
    if (r.lunas) {
      jmlLunas++;
      totalSemua += r.subtotal;
      if (r.tanggal.slice(0, 10) === hariIni) totalHari += r.subtotal;
      if (r.tanggal.slice(0, 7) === bulanIni) totalBulan += r.subtotal;
    } else {
      belumLunas += r.subtotal;
    }
  }
  return { totalHari, totalBulan, totalSemua, belumLunas, jmlLunas };
}

module.exports = {
  // users & auth
  createUser, listUsers, deleteUser, countOwners, getUser, setPassword,
  authenticate, createSession, getSessionUser, deleteSession,
  // services
  listServices, getService, createService, updateService, deleteService,
  // orders
  listOrders, getOrder, createOrder, updateOrder, deleteOrder, report,
};
