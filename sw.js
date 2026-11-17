// Guarda la app en el teléfono para que abra sin señal.
// La tasa NO pasa por aquí: la página guarda la última en su propio almacenamiento.
const CACHE = "cambio-pe-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!own && !fonts) return; // las fuentes de tasas van directo a internet

  // Responde con lo guardado y lo renueva en segundo plano.
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: own }).then((hit) => {
        const net = fetch(req)
          .then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; })
          .catch(() => hit || (req.mode === "navigate" ? c.match("index.html") : undefined));
        return hit || net;
      })
    )
  );
});
