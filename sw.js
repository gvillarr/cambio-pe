// Guarda la app en el teléfono para que abra sin señal.
// La tasa NO pasa por aquí: la página guarda la última en su propio almacenamiento.
//
// Con señal, la página se pide SIEMPRE a internet saltándose la caché del navegador
// (GitHub Pages la deja 10 min); sólo sin señal se usa la copia guardada. Así una
// corrección llega en la primera apertura. (La v2 guardaba la copia vieja del
// navegador y la seguía mostrando: medido el 17-nov-2026.)
const CACHE = "cambio-pe-v3";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const ESPERA_RED_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  const listo = caches.keys()
    .then((keys) => {
      const viejas = keys.filter((k) => k !== CACHE);
      return Promise.all(viejas.map((k) => caches.delete(k))).then(() => viejas.length > 0);
    })
    .then((habiaOtra) => self.clients.claim().then(() => habiaOtra));
  e.waitUntil(listo);
  // Si reemplaza una versión anterior, recarga una vez la pantalla abierta para que se vea
  // la nueva. Va FUERA de waitUntil: dentro, la recarga espera a que esta versión termine
  // de activarse y la activación espera a la recarga (se trababa 5 min; medido 17-nov).
  listo.then((habiaOtra) => {
    if (!habiaOtra) return;
    return self.clients.matchAll({ type: "window" })
      .then((cs) => Promise.all(cs.map((cl) => cl.navigate(cl.url).catch(() => {}))));
  });
});

function conTope(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("sin respuesta")), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!own && !fonts) return; // las fuentes de tasas van directo a internet

  // La página: primero internet (sin caché del navegador), y sólo sin señal la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        conTope(fetch(req.url, { cache: "no-store" }), ESPERA_RED_MS)
          .then((res) => { if (res && res.ok) c.put("./", res.clone()); return res; })
          .catch(() => c.match("./").then((hit) => hit || c.match("index.html")))
      )
    );
    return;
  }

  // Íconos, manifiesto y tipografías: lo guardado al tiro, y se renueva por detrás.
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: own }).then((hit) => {
        const net = fetch(own ? new Request(req, { cache: "no-cache" }) : req)
          .then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
