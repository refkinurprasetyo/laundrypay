// sw.js — Service Worker sederhana agar aplikasi bisa dipasang (PWA)
// dan tetap terbuka saat offline (kerangka aplikasi di-cache).
const CACHE = "laundrypay-v2";
const ASSETS = ["/", "/index.html", "/app.js", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Permintaan ke API selalu ambil dari jaringan (data harus terbaru).
  if (url.pathname.startsWith("/api/")) return;
  // Aset statis: coba cache dulu, kalau tidak ada ambil dari jaringan.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});
