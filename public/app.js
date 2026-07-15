// app.js — Frontend LaundryPay (vanilla JS, dengan login & peran)
"use strict";

const STATUS = {
  proses:  { label: "Diproses", cls: "b-proses" },
  selesai: { label: "Selesai",  cls: "b-selesai" },
  diambil: { label: "Diambil",  cls: "b-diambil" },
};

let me = null;          // { id, username, role }
let services = [];
let orders = [];
let users = [];
let cari = "";
let activeTab = "pesanan";

// ---------- util ----------
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const tglID = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svcById = (id) => services.find((s) => s.id === id) || {};
const isOwner = () => me && me.role === "owner";

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { showLogin(); throw new Error(data.error || "Sesi berakhir, silakan login"); }
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- auth flow ----------
function showLogin() {
  document.getElementById("appView").style.display = "none";
  document.getElementById("loginView").style.display = "flex";
}
function showApp() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("appView").style.display = "block";
}

async function init() {
  try {
    me = await api("GET", "/api/me");
    await startApp();
  } catch {
    showLogin();
  }
}

async function startApp() {
  document.getElementById("uName").textContent = me.username;
  document.getElementById("uRole").textContent = me.role;
  showApp();
  buildTabs();
  activeTab = "pesanan";
  await loadCore();
  switchTab("pesanan");
}

async function loadCore() {
  [services, orders] = await Promise.all([
    api("GET", "/api/services"),
    api("GET", "/api/orders"),
  ]);
  renderDaftar();
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("loginErr");
  err.style.display = "none";
  try {
    me = await api("POST", "/api/login", {
      username: document.getElementById("loginUser").value,
      password: document.getElementById("loginPass").value,
    });
    document.getElementById("loginPass").value = "";
    await startApp();
  } catch (e2) {
    err.textContent = e2.message;
    err.style.display = "block";
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  try { await api("POST", "/api/logout"); } catch {}
  me = null;
  showLogin();
});

// ---------- tabs (per peran) ----------
function buildTabs() {
  const defs = [{ k: "pesanan", label: "📋 Pesanan" }];
  if (isOwner()) {
    defs.push({ k: "laporan", label: "📈 Laporan" });
    defs.push({ k: "layanan", label: "🏷️ Layanan" });
    defs.push({ k: "akun", label: "👥 Akun" });
  }
  const el = document.getElementById("tabs");
  el.innerHTML = defs.map((t) =>
    `<button class="tab" data-tab="${t.k}">${t.label}</button>`).join("");
  el.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab)));
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((x) =>
    x.classList.toggle("active", x.dataset.tab === tab));
  ["pesanan", "laporan", "layanan", "akun"].forEach((k) => {
    const v = document.getElementById("view-" + k);
    if (v) v.style.display = k === tab ? "" : "none";
  });
  if (tab === "laporan") renderLaporan();
  if (tab === "layanan") renderLayanan();
  if (tab === "akun") renderAkun();
}

// ---------- daftar pesanan ----------
function renderDaftar() {
  const q = cari.toLowerCase();
  const list = orders.filter(
    (o) => o.nama.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
  );
  const el = document.getElementById("daftar");
  if (list.length === 0) { el.innerHTML = `<div class="empty">Belum ada pesanan.</div>`; return; }
  el.innerHTML = list.map((o) => {
    const st = STATUS[o.status] || STATUS.proses;
    const bayar = o.lunas
      ? `<span class="badge b-lunas">Lunas</span>`
      : `<span class="badge b-belum">Belum bayar</span>`;
    const opts = Object.entries(STATUS).map(([k, v]) =>
      `<option value="${k}" ${k === o.status ? "selected" : ""}>${v.label}</option>`).join("");
    const tombolBayar = o.lunas ? "" :
      `<button class="chip chip-green" onclick="bukaBayar('${o.id}')">💵 Bayar</button>`;
    const tombolHapus = isOwner()
      ? `<button class="chip chip-red" onclick="hapus('${o.id}')">🗑️</button>` : "";
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
          <select onchange="ubahStatus('${o.id}', this.value)">${opts}</select>
          ${tombolBayar}
          <button class="chip chip-gray" onclick="bukaStruk('${o.id}')">🧾 Struk</button>
          ${tombolHapus}
        </div>
      </div>`;
  }).join("");
}

// ---------- laporan (owner) ----------
function renderLaporan() {
  api("GET", "/api/report").then((r) => {
    document.getElementById("stats").innerHTML = `
      <div class="stat s1"><div>📅</div><div class="lbl">Pendapatan Hari Ini</div><div class="val">${rupiah(r.totalHari)}</div></div>
      <div class="stat s2"><div>📈</div><div class="lbl">Pendapatan Bulan Ini</div><div class="val">${rupiah(r.totalBulan)}</div></div>
      <div class="stat s3"><div>👛</div><div class="lbl">Total Diterima</div><div class="val">${rupiah(r.totalSemua)}</div></div>
      <div class="stat s4"><div>⏳</div><div class="lbl">Belum Terbayar</div><div class="val">${rupiah(r.belumLunas)}</div></div>`;
    document.getElementById("tblTitle").innerHTML = `<span>Riwayat Transaksi Lunas (${r.jmlLunas})</span>`;
    const lunas = orders.filter((o) => o.lunas);
    document.getElementById("tblBody").innerHTML = lunas.length === 0
      ? `<tr><td colspan="5" class="empty">Belum ada transaksi lunas.</td></tr>`
      : lunas.map((o) => `
        <tr>
          <td class="inv">#${esc(o.id)}</td>
          <td><b>${esc(o.nama)}</b></td>
          <td style="color:var(--muted)">${tglID(o.tanggal)}</td>
          <td>${o.metode === "transfer" ? "💳" : "💵"} ${esc(o.metode || "-")}</td>
          <td class="r price">${rupiah(o.subtotal)}</td>
        </tr>`).join("");
  }).catch((e) => toast(e.message));
}

// ---------- kelola layanan (owner) ----------
function renderLayanan() {
  const el = document.getElementById("daftarLayanan");
  el.innerHTML = services.length === 0
    ? `<div class="empty">Belum ada layanan.</div>`
    : services.map((s) => `
      <div class="mrow">
        <div class="info">
          <b>${esc(s.nama)}</b>
          <div class="meta">${rupiah(s.harga)} / ${esc(s.satuan)}</div>
        </div>
        <button class="iconbtn" onclick="bukaLayananForm('${s.id}')">✏️ Ubah</button>
        <button class="iconbtn red" onclick="hapusLayanan('${s.id}')">🗑️</button>
      </div>`).join("");
}

function bukaLayananForm(id) {
  const s = id ? svcById(id) : { nama: "", harga: "", satuan: "kg" };
  openModal(`
    <div class="modal-head"><h3>${id ? "Ubah" : "Tambah"} Layanan</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <label class="f">Nama Layanan *</label>
      <input class="inp" id="svcNama" value="${esc(s.nama)}" placeholder="mis. Cuci + Setrika" />
      <div class="two">
        <div>
          <label class="f">Harga (Rp) *</label>
          <input class="inp" id="svcHarga" type="number" min="0" value="${s.harga}" placeholder="0" />
        </div>
        <div>
          <label class="f">Satuan</label>
          <input class="inp" id="svcSatuan" value="${esc(s.satuan || "kg")}" placeholder="kg / pcs" />
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:18px" onclick="simpanLayanan('${id || ""}')">Simpan</button>
    </div>`);
}

async function simpanLayanan(id) {
  const body = {
    nama: document.getElementById("svcNama").value.trim(),
    harga: Number(document.getElementById("svcHarga").value),
    satuan: document.getElementById("svcSatuan").value.trim() || "kg",
  };
  if (!body.nama) return toast("Nama layanan wajib diisi");
  if (!(body.harga >= 0)) return toast("Harga tidak valid");
  try {
    if (id) {
      const upd = await api("PATCH", "/api/services/" + id, body);
      services = services.map((s) => (s.id === id ? upd : s));
    } else {
      services.push(await api("POST", "/api/services", body));
    }
    closeModal();
    renderLayanan();
    toast("Layanan tersimpan");
  } catch (e) { toast(e.message); }
}

async function hapusLayanan(id) {
  if (!confirm("Hapus layanan ini? Pesanan lama tidak terpengaruh.")) return;
  try {
    await api("DELETE", "/api/services/" + id);
    services = services.filter((s) => s.id !== id);
    renderLayanan();
    toast("Layanan dihapus");
  } catch (e) { toast(e.message); }
}

// ---------- kelola akun (owner) ----------
async function renderAkun() {
  try { users = await api("GET", "/api/users"); } catch (e) { return toast(e.message); }
  document.getElementById("daftarAkun").innerHTML = users.map((u) => `
    <div class="mrow">
      <div class="info">
        <b>${esc(u.username)}</b> ${u.id === me.id ? '<span class="rolechip" style="background:#e0f2fe;color:#0369a1">Anda</span>' : ""}
        <div class="meta">Peran: ${u.role === "owner" ? "Owner (akses penuh)" : "Kasir (input & bayar)"}</div>
      </div>
      <button class="iconbtn" onclick="bukaGantiPassword(${u.id}, '${esc(u.username)}')">🔑</button>
      ${u.id === me.id ? "" : `<button class="iconbtn red" onclick="hapusAkun(${u.id})">🗑️</button>`}
    </div>`).join("");
}

function bukaAkunForm() {
  openModal(`
    <div class="modal-head"><h3>Akun Baru</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <label class="f">Username *</label>
      <input class="inp" id="akUser" placeholder="mis. kasir1" autocomplete="off" />
      <label class="f">Password *</label>
      <input class="inp" id="akPass" type="text" placeholder="minimal 4 karakter" autocomplete="off" />
      <label class="f">Peran</label>
      <select class="inp" id="akRole">
        <option value="kasir">Kasir — input pesanan, bayar, struk</option>
        <option value="owner">Owner — akses penuh</option>
      </select>
      <button class="btn btn-primary" style="width:100%;margin-top:18px" onclick="simpanAkun()">Buat Akun</button>
    </div>`);
}

async function simpanAkun() {
  const body = {
    username: document.getElementById("akUser").value.trim(),
    password: document.getElementById("akPass").value,
    role: document.getElementById("akRole").value,
  };
  if (!body.username) return toast("Username wajib diisi");
  if (body.password.length < 4) return toast("Password minimal 4 karakter");
  try {
    await api("POST", "/api/users", body);
    closeModal();
    renderAkun();
    toast("Akun dibuat");
  } catch (e) { toast(e.message); }
}

function bukaGantiPassword(id, username) {
  openModal(`
    <div class="modal-head"><h3>Ganti Password</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--muted);margin-bottom:6px">Akun: <b>${esc(username)}</b></p>
      <label class="f">Password Baru *</label>
      <input class="inp" id="npPass" type="text" placeholder="minimal 4 karakter" autocomplete="off" />
      <button class="btn btn-primary" style="width:100%;margin-top:18px" onclick="simpanPassword(${id})">Simpan</button>
    </div>`);
}

async function simpanPassword(id) {
  const password = document.getElementById("npPass").value;
  if (password.length < 4) return toast("Password minimal 4 karakter");
  try {
    await api("PATCH", "/api/users/" + id, { password });
    closeModal();
    toast("Password diperbarui");
  } catch (e) { toast(e.message); }
}

async function hapusAkun(id) {
  if (!confirm("Hapus akun ini?")) return;
  try {
    await api("DELETE", "/api/users/" + id);
    renderAkun();
    toast("Akun dihapus");
  } catch (e) { toast(e.message); }
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
  if (services.length === 0) return toast("Belum ada layanan. Minta owner menambah layanan dulu.");
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
  try {
    const baru = await api("POST", "/api/orders", {
      nama, hp: document.getElementById("fHp").value.trim(),
      layananId: document.getElementById("fLayanan").value, qty,
      status: document.getElementById("fStatus").value,
    });
    orders.unshift(baru);
    closeModal();
    renderDaftar();
    toast("Pesanan tersimpan");
  } catch (e) { toast(e.message); }
}

// ---------- status / hapus / bayar / struk ----------
async function ubahStatus(id, status) {
  try {
    const upd = await api("PATCH", "/api/orders/" + id, { status });
    orders = orders.map((o) => (o.id === id ? upd : o));
  } catch (e) { toast(e.message); }
}

async function hapus(id) {
  if (!confirm("Hapus pesanan ini?")) return;
  try {
    await api("DELETE", "/api/orders/" + id);
    orders = orders.filter((o) => o.id !== id);
    renderDaftar();
    toast("Pesanan dihapus");
  } catch (e) { toast(e.message); }
}

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
    bukaStruk(id);
    toast("Pembayaran berhasil");
  } catch (e) { toast(e.message); }
}

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

// ---------- events ----------
document.getElementById("btnBaru").addEventListener("click", bukaForm);
document.getElementById("btnLayananBaru").addEventListener("click", () => bukaLayananForm(""));
document.getElementById("btnAkunBaru").addEventListener("click", bukaAkunForm);
document.getElementById("cari").addEventListener("input", (e) => { cari = e.target.value; renderDaftar(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

init();
