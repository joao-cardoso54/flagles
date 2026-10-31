// Service worker do Flagles.
// - App (HTML/CSS/JS/dados/fontes/ícones): guardada à instalação; servida da cache e atualizada em segundo plano
//   (stale-while-revalidate): um deploy novo aparece no 2.º arranque.
// - Bandeiras (flagcdn.com): cache-first; "precache-flags" guarda-as todas para jogar offline.
// - YouTube e o resto: não são intercetados (o áudio precisa de internet).
// Ao mudar ficheiros da app, aumentar VERSION para forçar renovação da cache.
const VERSION = "2026-10-31.26";
const APP = `flagles-app-${VERSION}`;
const FLAGS = "flagles-flags-v1";

const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/style.css",
  "js/main.js", "js/player.js", "js/data.js", "js/text.js", "js/levels.js", "js/progress.js", "js/version.js", "js/audio.js", "js/spotify.js", "spotify-teste.html",
  "data/songs-tiered.json", "data/flags.json", "data/spotify-ids.json",
  "fonts/fraunces-latin.woff2", "fonts/instrument-sans-latin.woff2",
  "icons/logo.svg", "icons/beatles-heads.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png",
];

self.addEventListener("install", e => {
  // antes: caches.open(APP).then(c => c.addAll(SHELL))  -> addAll usa a cache HTTP do browser e podia guardar ficheiros antigos
  // (o GitHub Pages deixa os ficheiros em cache 10 minutos). cache:"reload" obriga a ir buscar a versão atual.
  e.waitUntil(
    caches.open(APP)
      .then(c => Promise.all(SHELL.map(async url => {
        const res = await fetch(new Request(url, { cache: "reload" }));
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        await c.put(url, res);
      })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("flagles-app-") && k !== APP).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === "https://flagcdn.com") {
    e.respondWith(
      caches.open(FLAGS).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone()); // opaca: UE e ONU (sem CORS)
        return res;
      }),
    );
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(APP).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const refresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
        if (hit) { refresh.catch(() => {}); return hit; }
        return refresh;
      }),
    );
  }
});

// A página manda a lista de URLs das bandeiras; guardamo-las em segundo plano.
self.addEventListener("message", e => {
  if (e.data?.type !== "precache-flags") return;
  e.waitUntil(
    caches.open(FLAGS).then(async cache => {
      for (const url of e.data.urls) {
        if (await cache.match(url)) continue;
        try { const r = await fetch(url, { mode: "cors" }); if (r.ok) await cache.put(url, r); }
        catch (err) { // sem CORS (UE, ONU): guarda a resposta opaca, que a imagem consegue usar
          try { await cache.put(url, await fetch(url, { mode: "no-cors" })); } catch (e2) { /* sem rede: fica para a próxima */ }
        }
      }
    }),
  );
});
