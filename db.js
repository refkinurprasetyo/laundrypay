// db.js — Database SQLite (bawaan Node.js, tanpa dependency tambahan)
"use strict";

const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

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
`);

// ---- Data awal (hanya sekali, saat tabel masih kosong) ----
const jmlService = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
if (jmlService === 0) {
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

const jmlCounter = db.prepare("SELECT COUNT(*) AS n FROM counters WHERE nama='invoice'").get().n;
if (jmlCounter === 0) {
  db.prepare("INSERT INTO counters (nama, nilai) VALUES ('invoice', 0)").run();
}

const jmlOrder = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
if (jmlOrder === 0) {
  // beberapa contoh pesanan supaya aplikasi tidak kosong saat pertama dibuka
  const now = new Date();
  const iso = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  createOrder({ nama: "Andi Saputra", hp: "0812-1111-2222", layananId: "cuci_setrika", qty: 3.5, status: "diambil", tanggal: iso(26), lunas: 1, metode: "tunai" });
  createOrder({ nama: "Siti Rahma", hp: "0813-3333-4444", layananId: "express", qty: 2, status: "selesai", tanggal: iso(5), lunas: 1, metode: "transfer" });
  createOrder({ nama: "Budi Hartono", hp: "0857-5555-6666", layananId: "cuci_kering", qty: 5, status: "proses", tanggal: iso(1), lunas: 0, metode: null });
}

// ---- Fungsi bantu ----
function listServices() {
  return db.prepare("SELECT * FROM services ORDER BY urutan").all();
}

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
  const svc = db.prepare("SELECT * FROM services WHERE id = ?").get(data.layananId);
  if (!svc) throw new Error("Layanan tidak ditemukan");
  const qty = Number(data.qty);
  if (!data.nama || !data.nama.trim()) throw new Error("Nama pelanggan wajib diisi");
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
  `).run(id, data.nama.trim(), (data.hp || "").trim(), svc.id, svc.nama, svc.harga, svc.satuan, qty, subtotal, status, lunas, metode, tanggal);

  return getOrder(id);
}

function updateOrder(id, patch) {
  const o = getOrder(id);
  if (!o) return null;
  const status = patch.status ?? o.status;
  const lunas = patch.lunas != null ? (patch.lunas ? 1 : 0) : o.lunas;
  const metode = patch.metode !== undefined ? patch.metode : o.metode;
  db.prepare("UPDATE orders SET status = ?, lunas = ?, metode = ? WHERE id = ?")
    .run(status, lunas, metode, id);
  return getOrder(id);
}

function deleteOrder(id) {
  const info = db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  return info.changes > 0;
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
  listServices, listOrders, getOrder, createOrder, updateOrder, deleteOrder, report,
};
