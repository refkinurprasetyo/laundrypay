// app.js — Logika frontend LaundryPay (vanilla JS, tanpa framework)
"use strict";

const STATUS = {
  proses:  { label: "Diproses", cls: "b-proses" },
  selesai: { label: "Selesai",  cls: "b-selesai" },
  diambil: { label: "Diambil",  cls: "b-diambil" },
};

let services = [];
let orders = [];
let cari = "";

// ---------- util ----------
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const tglID = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svcById = (id) => services.find((s) => s.id === id) || {};

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal terhubung ke server");
  return data;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- muat data ----------
async function load() {
  try {
    [services, orders] = await Promise.all([
      api("GET", "/api/services"),
      api("GET", "/api/orders"),
    ]);
    renderDaftar();
    renderLaporan();
  } catch (e) {
    document.getElementById("daftar").innerHTML =
      `<div class="empty">Gagal memuat data.<br>${esc(e.message)}</div>`;
  }
}

// ---------- daftar pesanan ----------
function renderDaftar() {
  const q = cari.toLowerCase();
  const list = orders.filter(
    (o) => o.nama.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
  );
  const el = document.getElementById("daftar");
  if (list.length === 0) {
    el.innerHTML = `<div class="empty">Belum ada pesanan.</div>`;
    return;
  }
  el.innerHTML = list.map((o) => {
    const st = STATUS[o.status] || STATUS.proses;
    const bayar = o.lunas
      ? `<span class="badge b-lunas">Lunas</span>`
      : `<span class="badge b-belum">Belum bayar</span>`;
    const opts = Object.entries(STATUS).map(([k, v]) =>
      `<option value="${k}" ${k === o.status ? "selected" : ""}>${v.label}</option>`).join("");
    const tombolBayar = o.lunas ? "" :
      `<button class="chip chip-green" onclick="bukaBayar('${o.id}')">💵 Bayar</button>`;
    return `
      <div class="card">
        <div class="row-top">
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="name">${esc(o.nama)}</span>
              <span class="inv">#${esc(o.id)}</span>
              <span class="badge ${st.cls}">${st.label}</span>
              ${bayar}
            </div>
            <div class="sub">${esc(o.layanan_nama)} · ${o.qty} ${esc(o.satuan)} · ${tglID(o.tanggal)}</div>
            ${o.hp ? `<div class="hp">${esc(o.hp)}</div>` : ""}
          </div>
          <div class="price">${rupiah(o.subtotal)}</div>
        </div>
        <div class="actions">
          <select class="mini" onchange="ubahStatus('${o.id}', this.value)">${opts}</select>
          ${tombolBayar}
          <button class="chip chip-gray" onclick="bukaStruk('${o.id}')">🧾 Struk</button>
          <button class="chip chip-red" onclick="hapus('${o.id}')">🗑️</button>
        </div>
      </div>`;
  }).join("");
}

// ---------- laporan ----------
function renderLaporan() {
  api("GET", "/api/report").then((r) => {
    document.getElementById("stats").innerHTML = `
      <div class="stat s1"><div>📅</div><div class="lbl">Pendapatan Hari Ini</div><div class="val">${rupiah(r.totalHari)}</div></div>
      <div class="stat s2"><div>📈</div><div class="lbl">Pendapatan Bulan Ini</div><div class="val">${rupiah(r.totalBulan)}</div></div>
      <div class="stat s3"><div>👛</div><div class="lbl">Total Diterima</div><div class="val">${rupiah(r.totalSemua)}</div></div>
      <div class="stat s4"><div>⏳</div><div class="lbl">Belum Terbayar</div><div class="val">${rupiah(r.belumLunas)}</div></div>`;
    document.getElementById("tblTitle").textContent = `Riwayat Transaksi Lunas (${r.jmlLunas})`;
    const lunas = orders.filter((o) => o.lunas);
    const body = document.getElementById("tblBody");
    body.innerHTML = lunas.length === 0
      ? `<tr><td colspan="5" class="empty">Belum ada transaksi lunas.</td></tr>`
      : lunas.map((o) => `
        <tr>
          <td class="inv">#${esc(o.id)}</td>
          <td><b>${esc(o.nama)}</b></td>
          <td style="color:var(--muted)">${tglID(o.tanggal)}</td>
          <td>${o.metode === "transfer" ? "💳" : "💵"} ${esc(o.metode || "-")}</td>
          <td class="r price">${rupiah(o.subtotal)}</td>
        </tr>`).join("");
  });
}

// ---------- modal helper ----------
function openModal(html) {
  document.getElementById("modalRoot").innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">${html}</div>
    </div>`;
}
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

// ---------- form pesanan baru ----------
function bukaForm() {
  const opts = services.map((s) =>
    `<option value="${s.id}">${esc(s.nama)} — ${rupiah(s.harga)}/${esc(s.satuan)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Pesanan Baru</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <label class="f">Nama Pelanggan *</label>
      <input class="inp" id="fNama" placeholder="mis. Andi Saputra" />
      <label class="f">No. HP</label>
      <input class="inp" id="fHp" placeholder="mis. 0812-xxxx-xxxx" />
      <label class="f">Jenis Layanan</label>
      <select class="inp" id="fLayanan" onchange="hitungEstimasi()">${opts}</select>
      <div class="two">
        <div>
          <label class="f">Jumlah *</label>
          <input class="inp" id="fQty" type="number" min="0" step="0.1" placeholder="0" oninput="hitungEstimasi()" />
        </div>
        <div>
          <label class="f">Status</label>
          <select class="inp" id="fStatus">
            <option value="proses">Diproses</option>
            <option value="selesai">Selesai</option>
            <option value="diambil">Diambil</option>
          </select>
        </div>
      </div>
      <div class="estimate"><span>Perkiraan Total</span><b id="fEstimasi">Rp 0</b></div>
      <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="simpanPesanan()">Simpan Pesanan</button>
    </div>`);
  hitungEstimasi();
}

function hitungEstimasi() {
  const id = document.getElementById("fLayanan").value;
  const qty = Number(document.getElementById("fQty").value) || 0;
  document.getElementById("fEstimasi").textContent = rupiah((svcById(id).harga || 0) * qty);
}

async function simpanPesanan() {
  const nama = document.getElementById("fNama").value.trim();
  const qty = Number(document.getElementById("fQty").value);
  if (!nama) return toast("Nama pelanggan wajib diisi");
  if (!(qty > 0)) return toast("Jumlah harus lebih dari 0");
  const body = {
    nama,
    hp: document.getElementById("fHp").value.trim(),
    layananId: document.getElementById("fLayanan").value,
    qty,
    status: document.getElementById("fStatus").value,
  };
  try {
    const baru = await api("POST", "/api/orders", body);
    orders.unshift(baru);
    closeModal();
    renderDaftar();
    renderLaporan();
    toast("Pesanan tersimpan");
  } catch (e) { toast(e.message); }
}

// ---------- ubah status / hapus ----------
async function ubahStatus(id, status) {
  try {
    const upd = await api("PATCH", "/api/orders/" + id, { status });
    orders = orders.map((o) => (o.id === id ? upd : o));
    renderLaporan();
  } catch (e) { toast(e.message); }
}

async function hapus(id) {
  if (!confirm("Hapus pesanan ini?")) return;
  try {
    await api("DELETE", "/api/orders/" + id);
    orders = orders.filter((o) => o.id !== id);
    renderDaftar();
    renderLaporan();
    toast("Pesanan dihapus");
  } catch (e) { toast(e.message); }
}

// ---------- pembayaran ----------
function bukaBayar(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  openModal(`
    <div class="modal-head"><h3>Pembayaran</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="pay-total">
        <div style="color:var(--muted);font-size:13px">${esc(o.nama)} · #${esc(o.id)}</div>
        <div class="amt">${rupiah(o.subtotal)}</div>
      </div>
      <div style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:12px">Pilih metode pembayaran</div>
      <div class="pay-methods">
        <button class="method" onclick="konfirmasiBayar('${o.id}','tunai')"><span class="ic">💵</span>Tunai</button>
        <button class="method" onclick="konfirmasiBayar('${o.id}','transfer')"><span class="ic">💳</span>Transfer</button>
      </div>
    </div>`);
}

async function konfirmasiBayar(id, metode) {
  try {
    const upd = await api("PATCH", "/api/orders/" + id, { lunas: true, metode });
    orders = orders.map((o) => (o.id === id ? upd : o));
    renderDaftar();
    renderLaporan();
    bukaStruk(id);
    toast("Pembayaran berhasil");
  } catch (e) { toast(e.message); }
}

// ---------- struk ----------
function bukaStruk(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  openModal(`
    <div class="modal-head"><h3>Struk Pembayaran</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="receipt" id="receiptPrintable">
        <div class="center">
          <div class="store">LAUNDRYPAY</div>
          <div class="small">Jl. Bersih Wangi No. 7</div>
          <div class="small">0800-LAUNDRY</div>
        </div>
        <hr>
        <div class="rrow"><span class="k">No. Nota</span><span>#${esc(o.id)}</span></div>
        <div class="rrow"><span class="k">Tanggal</span><span>${tglID(o.tanggal)}</span></div>
        <div class="rrow"><span class="k">Pelanggan</span><span>${esc(o.nama)}</span></div>
        <hr>
        <div class="rrow"><span class="k">${esc(o.layanan_nama)}</span><span>${o.qty} ${esc(o.satuan)}</span></div>
        <div class="rrow"><span class="k">Harga satuan</span><span>${rupiah(o.harga_satuan)}</span></div>
        <hr>
        <div class="rtotal"><span>TOTAL</span><span>${rupiah(o.subtotal)}</span></div>
        <div class="rrow"><span class="k">Status</span><span>${o.lunas ? "LUNAS" : "BELUM BAYAR"}</span></div>
        ${o.lunas ? `<div class="rrow"><span class="k">Metode</span><span>${esc(o.metode || "-")}</span></div>` : ""}
        <hr>
        <div class="center small" style="margin-top:6px">Terima kasih 🙏</div>
      </div>
      <button class="btn btn-dark no-print" style="margin-top:16px" onclick="window.print()">🖨️ Cetak Struk</button>
    </div>`);
}

// ---------- tab & event ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const tab = t.dataset.tab;
    document.getElementById("view-pesanan").style.display = tab === "pesanan" ? "" : "none";
    document.getElementById("view-laporan").style.display = tab === "laporan" ? "" : "none";
    if (tab === "laporan") renderLaporan();
  });
});
document.getElementById("btnBaru").addEventListener("click", bukaForm);
document.getElementById("cari").addEventListener("input", (e) => { cari = e.target.value; renderDaftar(); });

// PWA service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

load();
