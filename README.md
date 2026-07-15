# 👕 LaundryPay — Aplikasi Pembayaran Laundry

Aplikasi kasir laundry lengkap: kelola pesanan & pelanggan, hitung harga otomatis,
catat pembayaran (tunai/transfer), cetak struk, dan lihat laporan pendapatan.
Data tersimpan di **database** (backend), dan aplikasinya bisa **dipasang di HP**
seperti aplikasi biasa.

Dibuat tanpa "ribet": tidak butuh install macam-macam. Backend memakai Node.js
bawaan + database SQLite, tanpa dependency tambahan.

---

## 📱 Isi aplikasi

- **Tab Pesanan** — tambah pesanan (nama pelanggan, no. HP, jenis layanan, jumlah kg/pcs),
  ubah status (Diproses → Selesai → Diambil), tandai **Lunas** lewat tombol Bayar,
  dan cetak **struk**.
- **Tab Laporan** — pendapatan hari ini, bulan ini, total diterima, tagihan belum lunas,
  serta daftar semua transaksi lunas.

Harga layanan & data contoh bisa kamu ubah sendiri (lihat bagian *Menyesuaikan* di bawah).

---

## 🚀 Cara termudah: pasang online (bisa dibuka dari mana saja)

Tujuannya: aplikasi hidup 24 jam di internet, lalu kamu buka & pasang di HP.
Kita pakai **Render.com** (gratis untuk mencoba). **Tidak perlu Terminal sama sekali** —
semua lewat website.

### Langkah 1 — Siapkan akun

1. Buat akun **GitHub** di https://github.com (gratis). GitHub adalah tempat menyimpan
   kode aplikasimu.
2. Buat akun **Render** di https://render.com — pilih **"Sign up with GitHub"** supaya
   langsung tersambung.

### Langkah 2 — Unggah folder aplikasi ke GitHub (tanpa Terminal)

1. Di GitHub, klik tombol **+** (kanan atas) → **New repository**.
2. Isi **Repository name**: `laundrypay` → pilih **Public** → klik **Create repository**.
3. Di halaman repo yang baru, klik tautan **"uploading an existing file"**
   (atau tombol **Add file → Upload files**).
4. **Seret semua isi folder `laundrypay`** ini ke kotak unggah
   (file `server.js`, `db.js`, `package.json`, folder `public`, dll — **isinya**, bukan
   folder pembungkusnya).
5. Klik **Commit changes**.

> 💡 Pastikan file `server.js` dan `package.json` berada di **paling atas** repo
> (bukan di dalam sub-folder), supaya Render bisa menemukannya.

### Langkah 3 — Hubungkan ke Render

1. Di Render, klik **New +** → **Web Service**.
2. Pilih repo **laundrypay** yang tadi kamu buat → **Connect**.
3. Render biasanya mengisi otomatis. Pastikan:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Klik **Create Web Service**. Tunggu beberapa menit sampai muncul **"Live"**.
5. Alamat aplikasimu ada di atas halaman, misalnya:
   `https://laundrypay-xxxx.onrender.com` — **itulah link aplikasimu**. 🎉

> ⚠️ **Penting soal penyimpanan data.**
> Paket **gratis** Render cocok untuk mencoba, tetapi datanya **bisa ter-reset** saat
> server tidur/di-update, dan server "tidur" setelah 15 menit tidak dipakai
> (buka pertama jadi lambat ~1 menit). Untuk usaha sungguhan yang datanya **tidak boleh hilang**,
> lihat bagian berikut.

### Langkah 3b — Agar data permanen (disarankan untuk dipakai sungguhan)

Data laundry (pesanan, pembayaran) sebaiknya tidak hilang. Caranya: aktifkan **disk permanen**.
Ini butuh paket berbayar termurah Render (**Starter**, sekitar $7/bulan).

Cara paling mudah — pakai file **`render.yaml`** yang sudah disertakan:

1. Di Render klik **New +** → **Blueprint**.
2. Pilih repo `laundrypay` → Render membaca `render.yaml` dan otomatis menyiapkan
   web service **+ disk permanen di folder `/data`**.
3. Klik **Apply**. Selesai — datamu aman meski server restart.

(Atau manual: di service kamu → **Settings → Disks → Add Disk**, Mount Path `/data`,
lalu tambah **Environment Variable** `DB_PATH` = `/data/laundry.db`.)

---

## 📲 Memasang di HP (seperti aplikasi asli)

Aplikasi ini adalah **PWA** — bisa ditaruh di layar utama HP dan dibuka layar penuh
tanpa tampilan browser. Tidak lewat Play Store / App Store.

**Android (Chrome):**
1. Buka link aplikasimu (`https://...onrender.com`) di Chrome.
2. Ketuk menu **⋮** (kanan atas) → **Tambahkan ke layar utama** / **Install app**.
3. Ikonnya muncul di layar HP. Buka seperti aplikasi biasa.

**iPhone / iPad (Safari):**
1. Buka link aplikasimu di **Safari**.
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Pilih **Tambahkan ke Layar Utama** → **Tambah**.

Kamu bisa memasangnya di beberapa HP sekaligus (mis. HP kasir & HP pemilik) — semua
melihat data yang sama karena tersimpan di satu database.

---

## 💻 (Opsional) Mencoba dulu di komputer sendiri

Kalau ingin menguji sebelum online:

1. Install **Node.js versi 22 atau lebih baru** dari https://nodejs.org (pilih "LTS").
2. Buka folder `laundrypay` ini.
3. Jalankan aplikasinya:
   - **Windows:** klik dua kali file **`jalankan-windows.bat`**.
   - **Mac/Linux:** buka Terminal di folder ini, ketik `node server.js`, tekan Enter.
4. Buka browser ke **http://localhost:3000**.

Untuk membukanya dari HP di **WiFi yang sama**: cari alamat IP komputermu
(mis. `192.168.1.5`), lalu di HP buka `http://192.168.1.5:3000`.

---

## ⚙️ Menyesuaikan aplikasi

Semua ada di file **`db.js`**, bagian **"Data awal"**:

- **Ubah harga / jenis layanan** — sunting daftar di dalam `insS.run(...)`.
  Format: `["id_unik", "Nama Layanan", harga, "satuan", urutan]`.
- **Nama & alamat toko pada struk** — ada di **`public/index.html`** & **`public/app.js`**,
  cari tulisan `LAUNDRYPAY`, `Jl. Bersih Wangi No. 7`, `0800-LAUNDRY`.

Setelah mengubah file, unggah ulang ke GitHub (Add file → Upload files) — Render akan
memperbarui otomatis.

> Catatan: mengubah harga hanya mempengaruhi pesanan **baru**. Pesanan lama tetap
> memakai harga saat dibuat (biar laporan lama tidak berubah).

---

## 🗂️ Struktur file

```
laundrypay/
├── server.js            → server/backend (menyajikan API + halaman web)
├── db.js                → database SQLite: skema, data awal, fungsi-fungsi
├── package.json         → info proyek & perintah "start"
├── render.yaml          → setelan deploy Render + disk permanen
├── .node-version        → memberi tahu Render pakai Node 22
├── jalankan-windows.bat → jalankan cepat di Windows (klik dua kali)
└── public/              → semua yang dilihat pengguna (frontend)
    ├── index.html       → tampilan aplikasi
    ├── app.js           → logika tombol, form, pembayaran, struk
    ├── manifest.json    → identitas PWA (nama, ikon)
    ├── sw.js            → service worker (agar bisa dipasang & buka offline)
    └── icon-*.png       → ikon aplikasi
```

## 🔌 Daftar API (untuk yang ingin tahu)

| Method | Alamat | Fungsi |
|--------|--------|--------|
| GET | `/api/services` | daftar jenis layanan |
| GET | `/api/orders` | daftar semua pesanan |
| GET | `/api/report` | ringkasan laporan pendapatan |
| POST | `/api/orders` | buat pesanan baru |
| PATCH | `/api/orders/:id` | ubah status / tandai lunas |
| DELETE | `/api/orders/:id` | hapus pesanan |

---

Dibuat untuk Renjani · LaundryPay v1.0
